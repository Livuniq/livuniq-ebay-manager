import { getStore, saveStore, saveStoreAsync } from './server-store';
import { ConnectedAccount, EbayListing, EbayOrder } from './types';
import { isEbayItemSpecific } from './specifics-rules';
import { isVideoMedia, cleanAndDecodeDescription, sanitizeGalleryHtml, deduplicateImageUrls } from './template-engine';
import fs from 'fs';
import path from 'path';

// Helper to clean XML values and prevent entity parse errors like &auto
function cleanXmlUrl(url: string): string {
  if (!url) return '';
  return url
    .replace(/&amp;/g, '&')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function isSandboxEnv(masterConfig: any): boolean {
  return Boolean(
    masterConfig?.masterAppId?.includes('-SBX-') ||
    masterConfig?.environment === 'sandbox'
  );
}

// Automatically refresh user access token using refreshToken when expired
export async function ensureFreshAccessToken(account: ConnectedAccount, force = false): Promise<string | undefined> {
  const store = getStore();
  const masterConfig = store.masterConfig;

  if (!account.refreshToken || !masterConfig.masterAppId || !masterConfig.masterCertId) {
    return account.accessToken;
  }

  // If token is still fresh and force is false, reuse it
  if (!force && account.tokenExpiresAt && new Date(account.tokenExpiresAt).getTime() > Date.now() + 5 * 60 * 1000) {
    return account.accessToken;
  }

  const tokenHost =
    isSandboxEnv(masterConfig)
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';

  try {
    const credentials = Buffer.from(
      `${masterConfig.masterAppId}:${masterConfig.masterCertId}`
    ).toString('base64');

    const res = await fetch(tokenHost, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: account.refreshToken,
      }),
    });

    const data = await res.json();
    if (res.ok && data.access_token) {
      account.accessToken = data.access_token;
      account.tokenExpiresAt = new Date(Date.now() + (data.expires_in || 7200) * 1000).toISOString();

      // Persist in state file / cloud database
      const targetAcc = store.accounts.find((a) => a.id === account.id);
      if (targetAcc) {
        targetAcc.accessToken = data.access_token;
        targetAcc.tokenExpiresAt = account.tokenExpiresAt;
      }
      await saveStoreAsync(store);
      console.log('Successfully refreshed eBay access token for', account.ebayUsername);
      return data.access_token;
    } else {
      console.error('Failed to refresh eBay token:', data);
    }
  } catch (err) {
    console.error('Error in ensureFreshAccessToken:', err);
  }

  return account.accessToken;
}

export async function syncLiveEbayData(account: ConnectedAccount): Promise<{
  syncedListings: number;
  syncedOrders: number;
  username: string;
  error?: string;
}> {
  const store = getStore();
  let accessToken = (await ensureFreshAccessToken(account)) || account.accessToken;
  const masterConfig = store.masterConfig;

  if (!accessToken) {
    return { syncedListings: 0, syncedOrders: 0, username: account.ebayUsername, error: 'No access token available' };
  }

  const tradingUrl =
    isSandboxEnv(masterConfig)
      ? 'https://api.sandbox.ebay.com/ws/api.dll'
      : 'https://api.ebay.com/ws/api.dll';

  const siteId = account.marketplace === 'EBAY_GB' ? '3' : account.marketplace === 'EBAY_DE' ? '77' : '0';

  let realUsername = account.ebayUsername;

  // 1. Get real eBay user profile via Trading API GetUser
  try {
    const getUserXml = `<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <DetailLevel>ReturnAll</DetailLevel>
</GetUserRequest>`;

    const userRes = await fetch(tradingUrl, {
      method: 'POST',
      headers: {
        'X-EBAY-API-SITEID': siteId,
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
        'X-EBAY-API-CALL-NAME': 'GetUser',
        'X-EBAY-API-IAF-TOKEN': accessToken,
        'Content-Type': 'text/xml',
      },
      body: getUserXml,
    });

    const userText = await userRes.text();
    const matchUser = userText.match(/<UserID>([^<]+)<\/UserID>/);
    if (matchUser && matchUser[1]) {
      realUsername = matchUser[1];
      account.ebayUsername = realUsername;
      if (!account.storeName || account.storeName === 'eBay Live Store') {
        account.storeName = `${realUsername} Store`;
      }
    }

    // Try fetching formal eBay Store name via GetStore
    try {
      const getStoreXml = `<?xml version="1.0" encoding="utf-8"?>
<GetStoreRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <CategoryStructureOnly>false</CategoryStructureOnly>
</GetStoreRequest>`;
      const storeRes = await fetch(tradingUrl, {
        method: 'POST',
        headers: {
          'X-EBAY-API-SITEID': siteId,
          'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
          'X-EBAY-API-CALL-NAME': 'GetStore',
          'X-EBAY-API-IAF-TOKEN': accessToken,
          'Content-Type': 'text/xml',
        },
        body: getStoreXml,
      });
      const storeXml = await storeRes.text();
      const matchStore = storeXml.match(/<Store>[\s\S]*?<Name>([^<]+)<\/Name>/i);
      if (matchStore && matchStore[1]) {
        account.storeName = decodeXmlEntities(matchStore[1]);
      }
    } catch {
      // Store subscription not active or error - retain username store
    }
  } catch (err) {
    console.error('Error fetching user from Trading API:', err);
  }

  const fetchedListings: EbayListing[] = [];

  // 2. Fetch Live Active Listings from eBay Trading API (GetMyeBaySelling)
  try {
    const getSellingXml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>100</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
  </ActiveList>
</GetMyeBaySellingRequest>`;

    let sellingRes = await fetch(tradingUrl, {
      method: 'POST',
      headers: {
        'X-EBAY-API-SITEID': siteId,
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
        'X-EBAY-API-IAF-TOKEN': accessToken,
        'Content-Type': 'text/xml',
      },
      body: getSellingXml,
    });

    let xml = await sellingRes.text();

    if (xml.includes('IAF token supplied is expired') || xml.includes('21916984') || xml.includes('931')) {
      console.log('IAF token expired in syncLiveEbayData. Auto-refreshing...');
      const freshToken = await ensureFreshAccessToken(account, true);
      if (freshToken) {
        accessToken = freshToken;
        sellingRes = await fetch(tradingUrl, {
          method: 'POST',
          headers: {
            'X-EBAY-API-SITEID': siteId,
            'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
            'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
            'X-EBAY-API-IAF-TOKEN': freshToken,
            'Content-Type': 'text/xml',
          },
          body: getSellingXml,
        });
        xml = await sellingRes.text();
      }
    }

    const itemRegex = /<Item>([\s\S]*?)<\/Item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemBlock = match[1];

      const itemId = itemBlock.match(/<ItemID>([^<]+)<\/ItemID>/)?.[1] || '';
      const title = itemBlock.match(/<Title>([^<]+)<\/Title>/)?.[1] || 'eBay Listing';
      const curVal = parseFloat(itemBlock.match(/<CurrentPrice[^>]*>([^<]+)<\/CurrentPrice>/)?.[1] || '0');
      const startVal = parseFloat(itemBlock.match(/<StartPrice[^>]*>([^<]+)<\/StartPrice>/)?.[1] || '0');
      const binVal = parseFloat(itemBlock.match(/<BuyItNowPrice[^>]*>([^<]+)<\/BuyItNowPrice>/)?.[1] || '0');
      const parsedPrice = (curVal > 0 ? curVal : null) || (startVal > 0 ? startVal : null) || (binVal > 0 ? binVal : 0);
      const quantityStr =
        itemBlock.match(/<QuantityAvailable>([^<]+)<\/QuantityAvailable>/)?.[1] ||
        itemBlock.match(/<Quantity>([^<]+)<\/Quantity>/)?.[1] ||
        '1';
      const quantitySoldStr = itemBlock.match(/<QuantitySold>([^<]+)<\/QuantitySold>/)?.[1] || '0';
      const galleryUrl =
        itemBlock.match(/<GalleryURL>([^<]+)<\/GalleryURL>/)?.[1] ||
        'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500&auto=format&fit=crop&q=60';
      const sku = itemBlock.match(/<SKU>([^<]+)<\/SKU>/)?.[1] || `EBAY-${itemId.slice(-6)}`;
      const category = itemBlock.match(/<CategoryName>([^<]+)<\/CategoryName>/)?.[1] || 'Jewelry & Watches';

      // Parse all images inside PictureDetails if present and deduplicate
      const pictureUrls: string[] = [];
      const picRegex = /<PictureURL>([^<]+)<\/PictureURL>/g;
      let picMatch;
      while ((picMatch = picRegex.exec(itemBlock)) !== null) {
        pictureUrls.push(picMatch[1]);
      }
      if (pictureUrls.length === 0 && galleryUrl) {
        pictureUrls.push(galleryUrl);
      }
      const uniquePictureUrls = deduplicateImageUrls(pictureUrls);

      if (itemId) {
        fetchedListings.push({
          id: `lst-${itemId}`,
          accountId: account.id,
          sku,
          title,
          price: parsedPrice,
          currency: account.currency || 'USD',
          quantity: parseInt(quantityStr) || 1,
          sold: parseInt(quantitySoldStr) || 0,
          category,
          condition: 'NEW',
          imageUrl: uniquePictureUrls[0] || galleryUrl,
          images: uniquePictureUrls,
          status: parseInt(quantityStr) > 0 ? 'ACTIVE' : 'OUT_OF_STOCK',
          ebayListingId: itemId,
          hasUnpublishedChanges: false,
          lastSyncedWithEbayAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error('Error fetching live active listings from Trading API:', err);
  }

  // 3. If fetchedListings is empty but store has existing items with ebayListingId, include them for enrichment
  if (fetchedListings.length === 0) {
    const existingEbayItems = store.listings.filter((l) => l.accountId === account.id && l.ebayListingId);
    fetchedListings.push(...existingEbayItems);
  }

  // 4. Call GetItem for each live listing to pull 100% accurate Title, Description (HTML), Specifics, Price, and all Photos!
  for (const item of fetchedListings) {
    if (!item.ebayListingId) continue;
    try {
      const getItemXml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>${item.ebayListingId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
  <IncludeItemSpecifics>true</IncludeItemSpecifics>
</GetItemRequest>`;

      const itemRes = await fetch(tradingUrl, {
        method: 'POST',
        headers: {
          'X-EBAY-API-SITEID': siteId,
          'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
          'X-EBAY-API-CALL-NAME': 'GetItem',
          'X-EBAY-API-IAF-TOKEN': accessToken,
          'Content-Type': 'text/xml',
        },
        body: getItemXml,
      });

      const itemDetailXml = await itemRes.text();

      // Title
      const liveTitle = itemDetailXml.match(/<Title>([^<]+)<\/Title>/)?.[1];
      if (liveTitle) item.title = liveTitle;

      // Description (including custom HTML template, cleaned of XML entities & legacy prefixes)
      const descMatch = itemDetailXml.match(/<Description>([\s\S]*?)<\/Description>/);
      if (descMatch) {
        item.description = cleanAndDecodeDescription(descMatch[1]);
      }

      // Price resolution: Prioritize CurrentPrice (active selling price), then StartPrice, then BuyItNowPrice (if > 0)
      const curVal = parseFloat(itemDetailXml.match(/<CurrentPrice[^>]*>([^<]+)<\/CurrentPrice>/)?.[1] || '0');
      const startVal = parseFloat(itemDetailXml.match(/<StartPrice[^>]*>([^<]+)<\/StartPrice>/)?.[1] || '0');
      const binVal = parseFloat(itemDetailXml.match(/<BuyItNowPrice[^>]*>([^<]+)<\/BuyItNowPrice>/)?.[1] || '0');
      const realItemPrice = (curVal > 0 ? curVal : null) || (startVal > 0 ? startVal : null) || (binVal > 0 ? binVal : 0);
      if (realItemPrice > 0) {
        item.price = realItemPrice;
      }

      // Quantity & Stock Status
      const liveQty =
        itemDetailXml.match(/<QuantityAvailable>([^<]+)<\/QuantityAvailable>/)?.[1] ||
        itemDetailXml.match(/<Quantity>([^<]+)<\/Quantity>/)?.[1];
      if (liveQty && !isNaN(parseInt(liveQty))) {
        item.quantity = parseInt(liveQty);
        item.status = item.quantity > 0 ? 'ACTIVE' : 'OUT_OF_STOCK';
      }

      // Photos
      const detailPicUrls: string[] = [];
      const picRegex = /<PictureURL>([^<]+)<\/PictureURL>/g;
      let pMatch;
      while ((pMatch = picRegex.exec(itemDetailXml)) !== null) {
        detailPicUrls.push(pMatch[1]);
      }
      if (detailPicUrls.length > 0) {
        item.images = detailPicUrls;
        item.imageUrl = detailPicUrls[0];
      }

      // Item Specifics
      const itemSpecs: Record<string, string> = {};
      const nvRegex = /<NameValueList>([\s\S]*?)<\/NameValueList>/g;
      let nvMatch;
      while ((nvMatch = nvRegex.exec(itemDetailXml)) !== null) {
        const nvBlock = nvMatch[1];
        const name = nvBlock.match(/<Name>([^<]+)<\/Name>/)?.[1];
        const val = nvBlock.match(/<Value>([^<]+)<\/Value>/)?.[1];
        if (name && val) {
          itemSpecs[name.trim()] = val.trim();
        }
      }
      if (Object.keys(itemSpecs).length > 0) {
        item.itemSpecifics = itemSpecs;
      }

      // Condition Notes
      const condDesc = itemDetailXml.match(/<ConditionDescription>([^<]+)<\/ConditionDescription>/)?.[1];
      if (condDesc) item.sellerNotes = condDesc;

      // Video ID
      const videoIdMatch = itemDetailXml.match(/<VideoID>([^<]+)<\/VideoID>/)?.[1];
      if (videoIdMatch) item.videoId = videoIdMatch;

      item.hasUnpublishedChanges = false;
      item.lastSyncedWithEbayAt = new Date().toISOString();
      item.lastUpdated = new Date().toISOString();
    } catch (enrichErr) {
      console.error('Error enriching item details from eBay GetItem:', enrichErr);
    }
  }

  // 5. Update listings in store
  if (fetchedListings.length > 0) {
    store.listings = store.listings.filter((l) => l.accountId !== account.id);
    store.listings.push(...fetchedListings);
  }

  account.lastSyncedAt = new Date().toISOString();

  const targetAcc = store.accounts.find((a) => a.id === account.id);
  if (targetAcc) {
    targetAcc.ebayUsername = account.ebayUsername;
    targetAcc.storeName = account.storeName;
    targetAcc.lastSyncedAt = account.lastSyncedAt;
  }

  await saveStoreAsync(store);

  return {
    syncedListings: fetchedListings.length,
    syncedOrders: 0,
    username: realUsername,
  };
}

function decodeXmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function normalizePolicies(input: {
  shippingId?: string;
  shippingName?: string;
  returnId?: string;
  returnName?: string;
  paymentId?: string;
  paymentName?: string;
}) {
  let { shippingId, shippingName, returnId, returnName, paymentId, paymentName } = input;

  if (shippingId && !/^\d+$/.test(shippingId.trim())) {
    if (!shippingName) shippingName = shippingId;
    shippingId = undefined;
  }
  if (returnId && !/^\d+$/.test(returnId.trim())) {
    if (!returnName) returnName = returnId;
    returnId = undefined;
  }
  if (paymentId && !/^\d+$/.test(paymentId.trim())) {
    if (!paymentName) paymentName = paymentId;
    paymentId = undefined;
  }

  // Known shortcuts / defaults for this store
  if (shippingName?.trim().toLowerCase() === 's1' || (!shippingId && !shippingName)) {
    shippingId = '6269964000';
    shippingName = 's1';
  }
  if (returnName?.trim().toLowerCase() === 'r1' || (!returnId && !returnName)) {
    returnId = '6269963000';
    returnName = 'r1';
  }
  if (paymentName?.trim().toLowerCase() === 'p1' || (!paymentId && !paymentName)) {
    paymentId = '6269962000';
    paymentName = 'p1';
  }

  return { shippingId, shippingName, returnId, returnName, paymentId, paymentName };
}

function extractEbayErrorMessage(respText: string, defaultMsg = 'eBay request returned error'): string {
  const errorBlocks = respText.match(/<Errors>[\s\S]*?<\/Errors>/g) || [];
  for (const block of errorBlocks) {
    if (block.includes('<SeverityCode>Error</SeverityCode>')) {
      const longMsg = block.match(/<LongMessage>([^<]+)<\/LongMessage>/)?.[1];
      const shortMsg = block.match(/<ShortMessage>([^<]+)<\/ShortMessage>/)?.[1];
      if (longMsg || shortMsg) return decodeXmlEntities((longMsg || shortMsg)!);
    }
  }
  const generalMatch =
    respText.match(/<LongMessage>([^<]+)<\/LongMessage>/) ||
    respText.match(/<ShortMessage>([^<]+)<\/ShortMessage>/);
  return generalMatch ? decodeXmlEntities(generalMatch[1]) : defaultMsg;
}

// 5. Update/Revise a Live Listing directly on eBay Servers via ReviseFixedPriceItem
export async function reviseLiveEbayListing(
  account: ConnectedAccount,
  itemId: string,
  updates: {
    title?: string;
    price?: number;
    quantity?: number;
    sku?: string;
    description?: string;
    images?: string[];
    itemSpecifics?: Record<string, string>;
    conditionDescription?: string;
    categoryId?: string;
    conditionId?: string;
    videoId?: string;
    shippingPolicyId?: string;
    shippingPolicyName?: string;
    returnPolicyId?: string;
    returnPolicyName?: string;
    paymentPolicyId?: string;
    paymentPolicyName?: string;
    scheduledTime?: string;
  }
): Promise<{ success: boolean; message: string }> {
  const store = getStore();
  const accessToken = (await ensureFreshAccessToken(account)) || account.accessToken;
  const masterConfig = store.masterConfig;

  if (!accessToken || !itemId) {
    return { success: false, message: 'Missing access token or ItemID' };
  }

  const tradingUrl =
    isSandboxEnv(masterConfig)
      ? 'https://api.sandbox.ebay.com/ws/api.dll'
      : 'https://api.ebay.com/ws/api.dll';

  const siteId = account.marketplace === 'EBAY_GB' ? '3' : account.marketplace === 'EBAY_DE' ? '77' : '0';

  let itemXmlFields = `<ItemID>${itemId}</ItemID>`;
  if (updates.title) {
    itemXmlFields += `<Title><![CDATA[${updates.title.slice(0, 80)}]]></Title>`;
  }
  if (updates.price !== undefined && updates.price > 0) {
    itemXmlFields += `<StartPrice currencyID="${account.currency || 'USD'}">${updates.price.toFixed(2)}</StartPrice>`;
  }
  if (updates.quantity !== undefined) {
    itemXmlFields += `<Quantity>${updates.quantity}</Quantity>`;
  }
  if (updates.scheduledTime) {
    const schedDate = new Date(updates.scheduledTime);
    if (!isNaN(schedDate.getTime())) {
      const now = Date.now();
      const effectiveTime = schedDate.getTime() > now ? schedDate.toISOString() : new Date(now + 65 * 1000).toISOString();
      itemXmlFields += `<ScheduleTime>${effectiveTime}</ScheduleTime>`;
    }
  }
  if (updates.sku) {
    itemXmlFields += `<SKU><![CDATA[${updates.sku}]]></SKU>`;
  }
  if (updates.categoryId) {
    itemXmlFields += `<PrimaryCategory><CategoryID>${updates.categoryId}</CategoryID></PrimaryCategory>`;
  }
  if (updates.conditionId) {
    itemXmlFields += `<ConditionID>${updates.conditionId}</ConditionID>`;
  }
  if (updates.description) {
    const cleanDesc = sanitizeGalleryHtml(updates.description);
    itemXmlFields += `<Description><![CDATA[${cleanDesc}]]></Description>`;
  }
  if (updates.conditionDescription) {
    itemXmlFields += `<ConditionDescription><![CDATA[${updates.conditionDescription}]]></ConditionDescription>`;
  }
  if (updates.images && Array.isArray(updates.images) && updates.images.length > 0) {
    const validImages: string[] = [];
    const photoOnlyUpdates = updates.images.filter((u) => !isVideoMedia(u));
    for (const u of photoOnlyUpdates) {
      if (u.startsWith('http://') || u.startsWith('https://')) {
        validImages.push(u);
      } else if (u.startsWith('/uploads/')) {
        try {
          const localPath = path.join(process.cwd(), 'public', u.split('?')[0]);
          if (fs.existsSync(localPath)) {
            const buf = fs.readFileSync(localPath);
            const ebayForm = new FormData();
            ebayForm.append('image', new Blob([buf], { type: 'image/jpeg' }), path.basename(localPath));
            const epsEndpoint =
              isSandboxEnv(masterConfig)
                ? 'https://apim.sandbox.ebay.com/commerce/media/v1_beta/image/create_image_from_file'
                : 'https://apim.ebay.com/commerce/media/v1_beta/image/create_image_from_file';
            const epsRes = await fetch(epsEndpoint, {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}` },
              body: ebayForm,
            });
            if (epsRes.status === 201) {
              const epsData = await epsRes.json();
              const epsUrl = epsData.maxDimensionImageUrl || epsData.imageUrl;
              if (epsUrl) validImages.push(epsUrl);
            }
          }
        } catch (convErr) {
          console.error('Auto EPS upload error:', convErr);
        }
      }
    }

    const dedupedValidImages = deduplicateImageUrls(validImages);
    if (dedupedValidImages.length > 0) {
      itemXmlFields += `<PictureDetails>
        <GalleryType>Gallery</GalleryType>
        ${dedupedValidImages.map((url) => `<PictureURL>${cleanXmlUrl(url)}</PictureURL>`).join('')}
      </PictureDetails>`;
    }
  }
  if (updates.itemSpecifics && Object.keys(updates.itemSpecifics).length > 0) {
    const validSpecifics = Object.entries(updates.itemSpecifics).filter(
      ([k, v]) => isEbayItemSpecific(k) && Boolean(v && v.trim())
    );
    if (validSpecifics.length > 0) {
      itemXmlFields += `<ItemSpecifics>
        ${validSpecifics
          .map(([k, v]) => {
            const cleanVal = v.length > 65 ? v.slice(0, 65) : v;
            return `<NameValueList><Name><![CDATA[${k}]]></Name><Value><![CDATA[${cleanVal}]]></Value></NameValueList>`;
          })
          .join('')}
      </ItemSpecifics>`;
    }
  }
  if (updates.videoId) {
    itemXmlFields += `<VideoDetails><VideoID>${updates.videoId}</VideoID></VideoDetails>`;
  }
  if (
    updates.shippingPolicyId ||
    updates.shippingPolicyName ||
    updates.returnPolicyId ||
    updates.returnPolicyName ||
    updates.paymentPolicyId ||
    updates.paymentPolicyName
  ) {
    const norm = normalizePolicies({
      shippingId: updates.shippingPolicyId,
      shippingName: updates.shippingPolicyName,
      returnId: updates.returnPolicyId,
      returnName: updates.returnPolicyName,
      paymentId: updates.paymentPolicyId,
      paymentName: updates.paymentPolicyName,
    });

    let profilesXml = '<SellerProfiles>';
    if (norm.shippingId) {
      profilesXml += `<SellerShippingProfile><ShippingProfileID>${norm.shippingId}</ShippingProfileID></SellerShippingProfile>`;
    } else if (norm.shippingName) {
      profilesXml += `<SellerShippingProfile><ShippingProfileName><![CDATA[${norm.shippingName}]]></ShippingProfileName></SellerShippingProfile>`;
    }
    if (norm.returnId) {
      profilesXml += `<SellerReturnProfile><ReturnProfileID>${norm.returnId}</ReturnProfileID></SellerReturnProfile>`;
    } else if (norm.returnName) {
      profilesXml += `<SellerReturnProfile><ReturnProfileName><![CDATA[${norm.returnName}]]></ReturnProfileName></SellerReturnProfile>`;
    }
    if (norm.paymentId) {
      profilesXml += `<SellerPaymentProfile><PaymentProfileID>${norm.paymentId}</PaymentProfileID></SellerPaymentProfile>`;
    } else if (norm.paymentName) {
      profilesXml += `<SellerPaymentProfile><PaymentProfileName><![CDATA[${norm.paymentName}]]></PaymentProfileName></SellerPaymentProfile>`;
    }
    profilesXml += '</SellerProfiles>';
    itemXmlFields += profilesXml;
  }

  const reviseXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    ${itemXmlFields}
  </Item>
</ReviseFixedPriceItemRequest>`;

  try {
    const res = await fetch(tradingUrl, {
      method: 'POST',
      headers: {
        'X-EBAY-API-SITEID': siteId,
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
        'X-EBAY-API-CALL-NAME': 'ReviseFixedPriceItem',
        'X-EBAY-API-IAF-TOKEN': accessToken,
        'Content-Type': 'text/xml',
      },
      body: reviseXml,
    });

    let respText = await res.text();

    // Auto-refresh token and retry once if expired
    if (respText.includes('IAF token supplied is expired') || respText.includes('21916984')) {
      console.log('IAF token expired detected in reviseLiveEbayListing. Auto-refreshing token...');
      const freshToken = await ensureFreshAccessToken(account, true);
      if (freshToken) {
        const retryRes = await fetch(tradingUrl, {
          method: 'POST',
          headers: {
            'X-EBAY-API-SITEID': siteId,
            'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
            'X-EBAY-API-CALL-NAME': 'ReviseFixedPriceItem',
            'X-EBAY-API-IAF-TOKEN': freshToken,
            'Content-Type': 'text/xml',
          },
          body: reviseXml,
        });
        respText = await retryRes.text();
      }
    }

    const isSuccess =
      respText.includes('<Ack>Success</Ack>') ||
      respText.includes('<Ack>Warning</Ack>');

    if (isSuccess) {
      return { success: true, message: 'Changes successfully published live to eBay marketplace!' };
    } else {
      const errMsg = extractEbayErrorMessage(respText, 'eBay ReviseItem returned error');
      return { success: false, message: errMsg };
    }
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

// 6. Create & Publish a Brand New Listing directly to eBay Servers via AddFixedPriceItem
export async function addLiveEbayListing(
  account: ConnectedAccount,
  listing: {
    title: string;
    price: number;
    quantity: number;
    sku?: string;
    description?: string;
    categoryId?: string;
    conditionId?: string;
    conditionDescription?: string;
    images?: string[];
    videoUrl?: string;
    videoId?: string;
    itemSpecifics?: Record<string, string>;
    shippingPolicyId?: string;
    shippingPolicyName?: string;
    returnPolicyId?: string;
    returnPolicyName?: string;
    paymentPolicyId?: string;
    paymentPolicyName?: string;
    scheduledTime?: string;
  }
): Promise<{ success: boolean; itemId?: string; message: string }> {
  const store = getStore();
  const accessToken = (await ensureFreshAccessToken(account)) || account.accessToken;
  const masterConfig = store.masterConfig;

  if (!accessToken) {
    return { success: false, message: 'Missing eBay access token for active seller' };
  }

  const tradingUrl =
    isSandboxEnv(masterConfig)
      ? 'https://api.sandbox.ebay.com/ws/api.dll'
      : 'https://api.ebay.com/ws/api.dll';

  const siteId = account.marketplace === 'EBAY_GB' ? '3' : account.marketplace === 'EBAY_DE' ? '77' : '0';

  let specificsXml = '';
  if (listing.itemSpecifics && Object.keys(listing.itemSpecifics).length > 0) {
    const validSpecifics = Object.entries(listing.itemSpecifics).filter(
      ([k, v]) => isEbayItemSpecific(k) && Boolean(v && v.trim())
    );
    if (validSpecifics.length > 0) {
      specificsXml = `<ItemSpecifics>
        ${validSpecifics
          .map(([k, v]) => {
            const cleanVal = v.length > 65 ? v.slice(0, 65) : v;
            return `<NameValueList><Name><![CDATA[${k}]]></Name><Value><![CDATA[${cleanVal}]]></Value></NameValueList>`;
          })
          .join('')}
      </ItemSpecifics>`;
    }
  }

  const rawImages = (
    listing.images && listing.images.length > 0
      ? listing.images
      : ['https://i.ebayimg.com/00/s/MTYwMFgxNjAw/z/dasAAOSwRdNmbcnI/$_57.JPG?set_id=880000500F']
  ).filter((u) => !isVideoMedia(u));

  const validAddImages: string[] = [];
  for (const u of rawImages) {
    if (u.startsWith('http://') || u.startsWith('https://')) {
      validAddImages.push(u);
    } else if (u.startsWith('/uploads/')) {
      try {
        const localPath = path.join(process.cwd(), 'public', u.split('?')[0]);
        if (fs.existsSync(localPath)) {
          const buf = fs.readFileSync(localPath);
          const ebayForm = new FormData();
          ebayForm.append('image', new Blob([buf], { type: 'image/jpeg' }), path.basename(localPath));
          const epsEndpoint =
            isSandboxEnv(masterConfig)
              ? 'https://apim.sandbox.ebay.com/commerce/media/v1_beta/image/create_image_from_file'
              : 'https://apim.ebay.com/commerce/media/v1_beta/image/create_image_from_file';
          const epsRes = await fetch(epsEndpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: ebayForm,
          });
          if (epsRes.status === 201) {
            const epsData = await epsRes.json();
            const epsUrl = epsData.maxDimensionImageUrl || epsData.imageUrl;
            if (epsUrl) validAddImages.push(epsUrl);
          }
        }
      } catch (addErr) {
        console.error('Auto EPS add error:', addErr);
      }
    }
  }

  const finalImages = deduplicateImageUrls(
    validAddImages.length > 0 ? validAddImages : ['https://i.ebayimg.com/00/s/MTYwMFgxNjAw/z/dasAAOSwRdNmbcnI/$_57.JPG?set_id=880000500F']
  );

  const pictureDetailsXml = `<PictureDetails>
    <GalleryType>Gallery</GalleryType>
    ${finalImages.map((url) => `<PictureURL>${cleanXmlUrl(url)}</PictureURL>`).join('')}
  </PictureDetails>`;

  const addItemXml = `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <Title><![CDATA[${listing.title.slice(0, 80)}]]></Title>
    <Description><![CDATA[${sanitizeGalleryHtml(listing.description || listing.title)}]]></Description>
    <PrimaryCategory>
      <CategoryID>${listing.categoryId || '92911'}</CategoryID>
    </PrimaryCategory>
    <StartPrice currencyID="${account.currency || 'USD'}">${listing.price.toFixed(2)}</StartPrice>
    <Quantity>${listing.quantity || 1}</Quantity>
    ${listing.sku ? `<SKU><![CDATA[${listing.sku}]]></SKU>` : ''}
    <ConditionID>${listing.conditionId || '3000'}</ConditionID>
    ${listing.conditionDescription ? `<ConditionDescription><![CDATA[${listing.conditionDescription}]]></ConditionDescription>` : ''}
    <Country>US</Country>
    <Currency>${account.currency || 'USD'}</Currency>
    <DispatchTimeMax>10</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    ${listing.scheduledTime ? `<ScheduleTime>${new Date(listing.scheduledTime).toISOString()}</ScheduleTime>` : ''}
    <PostalCode>16701</PostalCode>
    ${(() => {
      const norm = normalizePolicies({
        shippingId: listing.shippingPolicyId || account.shippingPolicyId,
        shippingName: listing.shippingPolicyName || account.shippingPolicyName,
        returnId: listing.returnPolicyId || account.returnPolicyId,
        returnName: listing.returnPolicyName || account.returnPolicyName,
        paymentId: listing.paymentPolicyId || account.paymentPolicyId,
        paymentName: listing.paymentPolicyName || account.paymentPolicyName,
      });

      const shippingTag = norm.shippingId
        ? `<ShippingProfileID>${norm.shippingId}</ShippingProfileID>`
        : `<ShippingProfileName><![CDATA[${norm.shippingName || 's1'}]]></ShippingProfileName>`;

      const returnTag = norm.returnId
        ? `<ReturnProfileID>${norm.returnId}</ReturnProfileID>`
        : `<ReturnProfileName><![CDATA[${norm.returnName || 'r1'}]]></ReturnProfileName>`;

      const paymentTag = norm.paymentId
        ? `<PaymentProfileID>${norm.paymentId}</PaymentProfileID>`
        : `<PaymentProfileName><![CDATA[${norm.paymentName || 'p1'}]]></PaymentProfileName>`;

      return `<SellerProfiles>
      <SellerShippingProfile>
        ${shippingTag}
      </SellerShippingProfile>
      <SellerReturnProfile>
        ${returnTag}
      </SellerReturnProfile>
      <SellerPaymentProfile>
        ${paymentTag}
      </SellerPaymentProfile>
    </SellerProfiles>`;
    })()}
    ${pictureDetailsXml}
    ${specificsXml}
    ${listing.videoId ? `<VideoDetails><VideoID>${listing.videoId}</VideoID></VideoDetails>` : ''}
    <OutOfStockControl>true</OutOfStockControl>
  </Item>
</AddFixedPriceItemRequest>`;

  try {
    const res = await fetch(tradingUrl, {
      method: 'POST',
      headers: {
        'X-EBAY-API-SITEID': siteId,
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
        'X-EBAY-API-CALL-NAME': 'AddFixedPriceItem',
        'X-EBAY-API-IAF-TOKEN': accessToken,
        'Content-Type': 'text/xml',
      },
      body: addItemXml,
    });

    let respText = await res.text();

    // Auto-refresh token and retry once if expired
    if (respText.includes('IAF token supplied is expired') || respText.includes('21916984')) {
      console.log('IAF token expired detected in addLiveEbayListing. Auto-refreshing token...');
      const freshToken = await ensureFreshAccessToken(account, true);
      if (freshToken) {
        const retryRes = await fetch(tradingUrl, {
          method: 'POST',
          headers: {
            'X-EBAY-API-SITEID': siteId,
            'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
            'X-EBAY-API-CALL-NAME': 'AddFixedPriceItem',
            'X-EBAY-API-IAF-TOKEN': freshToken,
            'Content-Type': 'text/xml',
          },
          body: addItemXml,
        });
        respText = await retryRes.text();
      }
    }

    const isSuccess =
      respText.includes('<Ack>Success</Ack>') ||
      respText.includes('<Ack>Warning</Ack>');

    if (isSuccess) {
      const idMatch = respText.match(/<ItemID>([^<]+)<\/ItemID>/);
      const newId = idMatch ? idMatch[1] : undefined;
      return {
        success: true,
        itemId: newId,
        message: `Listing successfully created and published live on eBay! Item ID: #${newId}`,
      };
    } else {
      const errMsg = extractEbayErrorMessage(respText, 'eBay AddFixedPriceItem returned error');
      return { success: false, message: errMsg };
    }
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

// 7. End/Cancel a Live Listing directly on eBay Servers via EndFixedPriceItem
export async function endLiveEbayListing(
  account: ConnectedAccount,
  itemId: string,
  endingReason: 'NotAvailable' | 'Incorrect' | 'LostOrBroken' | 'OtherListingEndingReason' = 'NotAvailable'
): Promise<{ success: boolean; message: string }> {
  const store = getStore();
  const accessToken = (await ensureFreshAccessToken(account)) || account.accessToken;
  const masterConfig = store.masterConfig;

  if (!accessToken || !itemId) {
    return { success: false, message: 'Missing access token or ItemID' };
  }

  const tradingUrl =
    isSandboxEnv(masterConfig)
      ? 'https://api.sandbox.ebay.com/ws/api.dll'
      : 'https://api.ebay.com/ws/api.dll';

  const siteId = account.marketplace === 'EBAY_GB' ? '3' : account.marketplace === 'EBAY_DE' ? '77' : '0';

  const endXml = `<?xml version="1.0" encoding="utf-8"?>
<EndFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>${itemId}</ItemID>
  <EndingReason>${endingReason}</EndingReason>
</EndFixedPriceItemRequest>`;

  try {
    const res = await fetch(tradingUrl, {
      method: 'POST',
      headers: {
        'X-EBAY-API-SITEID': siteId,
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
        'X-EBAY-API-CALL-NAME': 'EndFixedPriceItem',
        'X-EBAY-API-IAF-TOKEN': accessToken,
        'Content-Type': 'text/xml',
      },
      body: endXml,
    });

    let respText = await res.text();

    if (respText.includes('IAF token supplied is expired') || respText.includes('21916984')) {
      const freshToken = await ensureFreshAccessToken(account, true);
      if (freshToken) {
        const retryRes = await fetch(tradingUrl, {
          method: 'POST',
          headers: {
            'X-EBAY-API-SITEID': siteId,
            'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
            'X-EBAY-API-CALL-NAME': 'EndFixedPriceItem',
            'X-EBAY-API-IAF-TOKEN': freshToken,
            'Content-Type': 'text/xml',
          },
          body: endXml,
        });
        respText = await retryRes.text();
      }
    }

    const isSuccess =
      respText.includes('<Ack>Success</Ack>') ||
      respText.includes('<Ack>Warning</Ack>') ||
      respText.includes('listing has been deleted') ||
      respText.includes('ended');

    if (isSuccess) {
      return { success: true, message: `Listing #${itemId} ended on eBay.` };
    } else {
      const errMsg = extractEbayErrorMessage(respText, 'eBay EndFixedPriceItem returned error');
      return { success: false, message: errMsg };
    }
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}
