import { getStore, saveStore, saveStoreAsync } from './server-store';
import { ConnectedAccount, EbayListing, EbayOrder, EbayMessageThread, EbayMessage } from './types';
import { isEbayItemSpecific } from './specifics-rules';
import { isVideoMedia, cleanAndDecodeDescription, sanitizeGalleryHtml, deduplicateImageUrls, isJunkMessageOrCss } from './template-engine';
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

  const isSandbox = isSandboxEnv(masterConfig);
  const effectiveAppId = isSandbox
    ? (masterConfig.sandboxAppId || masterConfig.masterAppId)
    : (masterConfig.productionAppId || masterConfig.masterAppId);
  const effectiveCertId = isSandbox
    ? (masterConfig.sandboxCertId || masterConfig.masterCertId)
    : (masterConfig.productionCertId || masterConfig.masterCertId);

  if (!account.refreshToken || !effectiveAppId || !effectiveCertId) {
    return account.accessToken;
  }

  // If token is still fresh and force is false, reuse it
  if (!force && account.tokenExpiresAt && new Date(account.tokenExpiresAt).getTime() > Date.now() + 5 * 60 * 1000) {
    return account.accessToken;
  }

  const tokenHost = isSandbox
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token';

  try {
    const credentials = Buffer.from(
      `${effectiveAppId}:${effectiveCertId}`
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
  syncedMessages?: number;
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

  // 6. Sync Buyer Messages from eBay
  let syncedMessages = 0;
  try {
    syncedMessages = await syncLiveEbayMessages(account);
  } catch (msgErr) {
    console.error('Error syncing live eBay messages in syncLiveEbayData:', msgErr);
  }

  await saveStoreAsync(store);

  return {
    syncedListings: fetchedListings.length,
    syncedOrders: 0,
    syncedMessages,
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
    locationCountry?: string;
    locationPostalCode?: string;
    locationCityState?: string;
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

  // Location fields configured per account or listing
  const targetCountry = updates.locationCountry || account.locationCountry;
  const targetPostal = updates.locationPostalCode || account.locationPostalCode;
  const targetCityState = updates.locationCityState || account.locationCityState;
  if (targetCountry) {
    itemXmlFields += `<Country>${targetCountry}</Country>`;
  }
  if (targetPostal) {
    itemXmlFields += `<PostalCode>${targetPostal}</PostalCode>`;
  }
  if (targetCityState) {
    itemXmlFields += `<Location><![CDATA[${targetCityState}]]></Location>`;
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
    locationCountry?: string;
    locationPostalCode?: string;
    locationCityState?: string;
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
    <Country>${listing.locationCountry || account.locationCountry || 'US'}</Country>
    <Currency>${account.currency || 'USD'}</Currency>
    <DispatchTimeMax>10</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    ${listing.scheduledTime ? `<ScheduleTime>${new Date(listing.scheduledTime).toISOString()}</ScheduleTime>` : ''}
    <PostalCode>${listing.locationPostalCode || account.locationPostalCode || '16701'}</PostalCode>
    ${(listing.locationCityState || account.locationCityState) ? `<Location><![CDATA[${listing.locationCityState || account.locationCityState}]]></Location>` : ''}
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

function encodeXmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Helper: Parse historical back-and-forth chat conversation from eBay message text/body
export function parseChatHistoryFromEbayText(
  rawText: string,
  buyerUsername: string,
  sellerUsername: string,
  messageId: string,
  messageDate: string
): EbayMessage[] {
  if (!rawText || !rawText.trim()) return [];

  // 1. First strip full HTML style blocks, script blocks, head blocks, and comments completely
  let stripped = rawText
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<!--[\s\S]*?-->/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  let cleaned = decodeXmlEntities(stripped)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n--- Original Message ---\n$1\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();

  // If the remaining text is CSS junk or boilerplate, reject it
  if (isJunkMessageOrCss(cleaned)) {
    return [];
  }

  // Common eBay thread reply delimiters
  const splitPattern = /(?:-{3,}\s*(?:Original|Previous)\s*Message\s*-{3,}|\r?\n-{4,}\r?\n|On\s+[\w\s,:]+\s+wrote:|From:\s*[^\r\n<]+\s*(?:Sent|To):)/i;

  if (!splitPattern.test(cleaned)) {
    return [
      {
        id: `msg-${messageId}`,
        sender: buyerUsername,
        senderRole: 'BUYER',
        timestamp: messageDate,
        body: cleaned,
      },
    ];
  }

  // Split on delimiter
  const rawParts = cleaned.split(/(?:-{3,}\s*(?:Original|Previous)\s*Message\s*-{3,}|\r?\n-{4,}\r?\n|On\s+[\w\s,:]+\s+wrote:)/i);
  const parsedMsgs: EbayMessage[] = [];

  let turnIndex = 0;
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.length < 2 || isJunkMessageOrCss(trimmed)) continue;

    let sender = buyerUsername;
    let senderRole: 'BUYER' | 'SELLER' = 'BUYER';
    let turnTime = messageDate;
    let turnBody = trimmed;

    // Detect sender from "From: <name>" or "Sender: <name>"
    const fromMatch = turnBody.match(/(?:From|Sender):\s*([^\r\n<]+)/i);
    if (fromMatch && fromMatch[1]) {
      const fromName = fromMatch[1].trim();
      if (
        (sellerUsername && fromName.toLowerCase().includes(sellerUsername.toLowerCase())) ||
        fromName.toLowerCase().includes('seller')
      ) {
        sender = sellerUsername || 'Seller';
        senderRole = 'SELLER';
      } else {
        sender = fromName || buyerUsername;
        senderRole = 'BUYER';
      }
    } else {
      // If no explicit From header: alternating turns (turn 0 is newest, turn 1 is previous reply)
      if (turnIndex % 2 === 1) {
        sender = sellerUsername || 'Seller';
        senderRole = 'SELLER';
      }
    }

    // Detect timestamp from "Sent: <date>"
    const sentMatch = turnBody.match(/Sent:\s*([^\r\n<]+)/i);
    if (sentMatch && sentMatch[1]) {
      const parsedSent = Date.parse(sentMatch[1].trim());
      if (!isNaN(parsedSent)) {
        turnTime = new Date(parsedSent).toISOString();
      }
    }

    // Clean out metadata header noise from the message bubble text
    turnBody = turnBody
      .replace(/From:\s*[^\r\n<]+/gi, '')
      .replace(/To:\s*[^\r\n<]+/gi, '')
      .replace(/Sent:\s*[^\r\n<]+/gi, '')
      .replace(/Subject:\s*[^\r\n<]+/gi, '')
      .replace(/Item Title:\s*[^\r\n<]+/gi, '')
      .replace(/Item Number:\s*[^\r\n<]+/gi, '')
      .trim();

    if (turnBody && turnBody.length > 1 && !isJunkMessageOrCss(turnBody)) {
      parsedMsgs.push({
        id: `msg-${messageId}-${turnIndex}`,
        sender,
        senderRole,
        timestamp: turnTime,
        body: turnBody,
      });
      turnIndex++;
    }
  }

  // Quoted text was ordered from newest to oldest. Reverse to display in chronological conversation order.
  if (parsedMsgs.length > 0) {
    return parsedMsgs.reverse();
  }
  return !isJunkMessageOrCss(cleaned) && cleaned.length > 0
    ? [
        {
          id: `msg-${messageId}`,
          sender: buyerUsername,
          senderRole: 'BUYER',
          timestamp: messageDate,
          body: cleaned,
        },
      ]
    : [];
}

// Helper: Safely merge conversation messages without dropping past replies, stripping CSS junk
function mergeThreadMessages(existing: EbayMessage[], incoming: EbayMessage[]): EbayMessage[] {
  const map = new Map<string, EbayMessage>();
  const norm = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

  for (const m of existing) {
    if (isJunkMessageOrCss(m.body)) continue;
    const key = `${m.senderRole}-${norm(m.body)}`;
    map.set(key, m);
  }

  for (const m of incoming) {
    if (isJunkMessageOrCss(m.body)) continue;
    const key = `${m.senderRole}-${norm(m.body)}`;
    if (!map.has(key)) {
      map.set(key, m);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

// 7. Sync Buyer Messages directly from eBay Trading API (GetMemberMessages & GetMyMessages)
// Supports deep historical sync up to 1 full year (365 days) across multi-window chunks
export async function syncLiveEbayMessages(account: ConnectedAccount, daysBack = 365): Promise<number> {
  const store = getStore();
  let accessToken = (await ensureFreshAccessToken(account)) || account.accessToken;
  const masterConfig = store.masterConfig;

  if (!accessToken) {
    return 0;
  }

  const tradingUrl = isSandboxEnv(masterConfig)
    ? 'https://api.sandbox.ebay.com/ws/api.dll'
    : 'https://api.ebay.com/ws/api.dll';

  const siteId = account.marketplace === 'EBAY_GB' ? '3' : account.marketplace === 'EBAY_DE' ? '77' : '0';
  const newThreadsMap = new Map<string, EbayMessageThread>();

  // Generate 89-day chunk time windows up to daysBack (eBay maximum per GetMemberMessages call is 90 days)
  const now = Date.now();
  const clampedDays = Math.min(Math.max(daysBack, 30), 365);
  const earliestTime = now - clampedDays * 24 * 60 * 60 * 1000;
  const timeWindows: { startIso: string; endIso: string }[] = [];
  let currentEnd = now;

  while (currentEnd > earliestTime) {
    const currentStart = Math.max(earliestTime, currentEnd - 89 * 24 * 60 * 60 * 1000);
    timeWindows.push({
      startIso: new Date(currentStart).toISOString(),
      endIso: new Date(currentEnd).toISOString(),
    });
    currentEnd = currentStart;
  }

  // A. Fetch Member Messages across each historical time window
  for (const window of timeWindows) {
    let pageNumber = 1;
    let hasMorePages = true;

    while (hasMorePages && pageNumber <= 3) {
      try {
        const makeMemberMessagesXml = (msgType: string, page: number) => `<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <MailMessageType>${msgType}</MailMessageType>
  <DetailLevel>ReturnAll</DetailLevel>
  <StartCreationTime>${window.startIso}</StartCreationTime>
  <EndCreationTime>${window.endIso}</EndCreationTime>
  <Pagination>
    <EntriesPerPage>100</EntriesPerPage>
    <PageNumber>${page}</PageNumber>
  </Pagination>
</GetMemberMessagesRequest>`;

        let res = await fetch(tradingUrl, {
          method: 'POST',
          headers: {
            'X-EBAY-API-SITEID': siteId,
            'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
            'X-EBAY-API-CALL-NAME': 'GetMemberMessages',
            'X-EBAY-API-IAF-TOKEN': accessToken,
            'Content-Type': 'text/xml',
          },
          body: makeMemberMessagesXml('All', pageNumber),
        });

        let respXml = await res.text();

        if (respXml.includes('IAF token supplied is expired') || respXml.includes('21916984') || respXml.includes('931')) {
          const freshToken = await ensureFreshAccessToken(account, true);
          if (freshToken) {
            accessToken = freshToken;
            res = await fetch(tradingUrl, {
              method: 'POST',
              headers: {
                'X-EBAY-API-SITEID': siteId,
                'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
                'X-EBAY-API-CALL-NAME': 'GetMemberMessages',
                'X-EBAY-API-IAF-TOKEN': freshToken,
                'Content-Type': 'text/xml',
              },
              body: makeMemberMessagesXml('All', pageNumber),
            });
            respXml = await res.text();
          }
        }

        // If 'All' is disallowed by schema, retry with 'AskSellerQuestion'
        if (respXml.includes('<SeverityCode>Error</SeverityCode>') && respXml.includes('MailMessageType')) {
          res = await fetch(tradingUrl, {
            method: 'POST',
            headers: {
              'X-EBAY-API-SITEID': siteId,
              'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
              'X-EBAY-API-CALL-NAME': 'GetMemberMessages',
              'X-EBAY-API-IAF-TOKEN': accessToken,
              'Content-Type': 'text/xml',
            },
            body: makeMemberMessagesXml('AskSellerQuestion', pageNumber),
          });
          respXml = await res.text();
        }

        // Parse MemberMessageExchange nodes
        const exchangeRegex = /<MemberMessageExchange>([\s\S]*?)<\/MemberMessageExchange>/g;
        let exMatch;
        let matchesFound = 0;
        while ((exMatch = exchangeRegex.exec(respXml)) !== null) {
          matchesFound++;
          const block = exMatch[1];
          const itemId = block.match(/<ItemID>([^<]+)<\/ItemID>/)?.[1] || '';
          const itemTitle = decodeXmlEntities(block.match(/<Title>([^<]+)<\/Title>/)?.[1] || '');
          const senderId = block.match(/<SenderID>([^<]+)<\/SenderID>/)?.[1] || 'buyer';
          const subject = decodeXmlEntities(block.match(/<Subject>([\s\S]*?)<\/Subject>/)?.[1] || 'Inquiry regarding listing');
          const body = decodeXmlEntities(block.match(/<Body>([\s\S]*?)<\/Body>/)?.[1] || '');
          const messageId = block.match(/<MessageID>([^<]+)<\/MessageID>/)?.[1] || `${Date.now()}`;
          const creationDate = block.match(/<CreationDate>([^<]+)<\/CreationDate>/)?.[1] || new Date().toISOString();
          const status = block.match(/<MessageStatus>([^<]+)<\/MessageStatus>/)?.[1] || 'Unanswered';
          const isUnanswered = status.toLowerCase() === 'unanswered';

          const parsedHistory = parseChatHistoryFromEbayText(
            body || subject,
            senderId,
            account.ebayUsername || 'Seller',
            messageId,
            creationDate
          );

          const responseMatch = block.match(/<Response>([\s\S]*?)<\/Response>/);
          if (responseMatch) {
            parsedHistory.push({
              id: `msg-resp-${messageId}`,
              sender: account.ebayUsername || 'Seller',
              senderRole: 'SELLER',
              timestamp: creationDate,
              body: decodeXmlEntities(responseMatch[1]),
            });
          }

          const cleanSubject = subject.replace(/^(?:re|fwd):\s*/i, '').trim();
          const thrId = `thr-ebay-${account.id}-${senderId.toLowerCase()}${itemId ? `-${itemId}` : ''}`;

          if (newThreadsMap.has(thrId)) {
            const existingThr = newThreadsMap.get(thrId)!;
            existingThr.messages = mergeThreadMessages(existingThr.messages, parsedHistory);
            const lastMsg = existingThr.messages[existingThr.messages.length - 1];
            if (lastMsg) {
              existingThr.lastMessageSnippet = lastMsg.body.slice(0, 120);
              existingThr.lastUpdated = lastMsg.timestamp;
            }
            if (isUnanswered) existingThr.unread = true;
          } else {
            const lastMsg = parsedHistory[parsedHistory.length - 1];
            newThreadsMap.set(thrId, {
              id: thrId,
              accountId: account.id,
              buyerUsername: senderId,
              buyerName: senderId,
              itemTitle: itemTitle || (itemId ? `Item #${itemId}` : undefined),
              listingId: itemId ? `lst-${itemId}` : undefined,
              subject: cleanSubject || subject,
              lastMessageSnippet: (lastMsg?.body || body || subject).slice(0, 120),
              lastUpdated: lastMsg?.timestamp || creationDate,
              unread: isUnanswered,
              messages: parsedHistory,
            });
          }
        }

        const hasMoreMatch = respXml.match(/<HasMoreItems>([^<]+)<\/HasMoreItems>/i);
        hasMorePages = Boolean(hasMoreMatch && hasMoreMatch[1]?.toLowerCase() === 'true' && matchesFound > 0);
        pageNumber++;
      } catch (err) {
        console.error('Error fetching GetMemberMessages window:', window, err);
        hasMorePages = false;
      }
    }
  }

  // B. Query GetMyMessages to capture official seller inbox headers & message bodies
  try {
    const getHeadersXml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <DetailLevel>ReturnHeaders</DetailLevel>
  <StartTime>${new Date(earliestTime).toISOString()}</StartTime>
  <EndTime>${new Date(now).toISOString()}</EndTime>
</GetMyMessagesRequest>`;

    const headersRes = await fetch(tradingUrl, {
      method: 'POST',
      headers: {
        'X-EBAY-API-SITEID': siteId,
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
        'X-EBAY-API-CALL-NAME': 'GetMyMessages',
        'X-EBAY-API-IAF-TOKEN': accessToken,
        'Content-Type': 'text/xml',
      },
      body: getHeadersXml,
    });

    const headersXml = await headersRes.text();
    const idRegex = /<MessageID>([^<]+)<\/MessageID>/g;
    const allMsgIds: string[] = [];
    let idMatch;
    while ((idMatch = idRegex.exec(headersXml)) !== null) {
      allMsgIds.push(idMatch[1]);
    }

    // Batch query ReturnMessages in chunks of up to 10 (maximum eBay limit per call)
    // Take up to 100 most recent message IDs
    const targetIds = allMsgIds.slice(0, 100);
    const chunkSize = 10;
    for (let i = 0; i < targetIds.length; i += chunkSize) {
      const chunk = targetIds.slice(i, i + chunkSize);
      const getDetailXml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <DetailLevel>ReturnMessages</DetailLevel>
  <MessageIDs>
    ${chunk.map((id) => `<MessageID>${id}</MessageID>`).join('')}
  </MessageIDs>
</GetMyMessagesRequest>`;

      const detailRes = await fetch(tradingUrl, {
        method: 'POST',
        headers: {
          'X-EBAY-API-SITEID': siteId,
          'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
          'X-EBAY-API-CALL-NAME': 'GetMyMessages',
          'X-EBAY-API-IAF-TOKEN': accessToken,
          'Content-Type': 'text/xml',
        },
        body: getDetailXml,
      });

      const detailXml = await detailRes.text();
      const msgRegex = /<Message>([\s\S]*?)<\/Message>/g;
      let mMatch;
      while ((mMatch = msgRegex.exec(detailXml)) !== null) {
        const block = mMatch[1];
        const messageId = block.match(/<MessageID>([^<]+)<\/MessageID>/)?.[1] || '';
        if (!messageId) continue;

        const sender = block.match(/<Sender>([^<]+)<\/Sender>/)?.[1] || 'eBay Member';
        if (sender.toLowerCase() === 'ebay' && !block.includes('<ItemID>')) continue;

        const subject = decodeXmlEntities(block.match(/<Subject>([\s\S]*?)<\/Subject>/)?.[1] || `Message from ${sender}`);
        const textRaw = block.match(/<Text>([\s\S]*?)<\/Text>/)?.[1] || '';
        const receiveDate = block.match(/<ReceiveDate>([^<]+)<\/ReceiveDate>/)?.[1] || new Date().toISOString();
        const read = block.match(/<Read>([^<]+)<\/Read>/)?.[1] === 'true';
        const itemId = block.match(/<ItemID>([^<]+)<\/ItemID>/)?.[1] || '';

        const parsedHistory = parseChatHistoryFromEbayText(
          textRaw || subject,
          sender,
          account.ebayUsername || 'Seller',
          messageId,
          receiveDate
        );

        const cleanSubject = subject.replace(/^(?:re|fwd):\s*/i, '').trim();
        const thrId = `thr-ebay-${account.id}-${sender.toLowerCase()}${itemId ? `-${itemId}` : ''}`;

        if (newThreadsMap.has(thrId)) {
          const existingThr = newThreadsMap.get(thrId)!;
          existingThr.messages = mergeThreadMessages(existingThr.messages, parsedHistory);
          const lastMsg = existingThr.messages[existingThr.messages.length - 1];
          if (lastMsg) {
            existingThr.lastMessageSnippet = lastMsg.body.slice(0, 120);
            existingThr.lastUpdated = lastMsg.timestamp;
          }
          if (!read) existingThr.unread = true;
        } else {
          const lastMsg = parsedHistory[parsedHistory.length - 1];
          newThreadsMap.set(thrId, {
            id: thrId,
            accountId: account.id,
            buyerUsername: sender,
            buyerName: sender,
            itemTitle: itemId ? `Listing #${itemId}` : undefined,
            listingId: itemId ? `lst-${itemId}` : undefined,
            subject: cleanSubject || subject,
            lastMessageSnippet: (lastMsg?.body || subject).slice(0, 120),
            lastUpdated: lastMsg?.timestamp || receiveDate,
            unread: !read,
            messages: parsedHistory,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error fetching GetMyMessages historical batch:', err);
  }

  // C. Merge into store.threads preserving any existing seller replies
  const newThreadsList = Array.from(newThreadsMap.values());
  if (newThreadsList.length > 0) {
    const otherThreads = store.threads.filter((t) => t.accountId !== account.id);
    const existingAccountThreads = store.threads.filter((t) => t.accountId === account.id);

    for (const incomingThr of newThreadsList) {
      const idx = existingAccountThreads.findIndex(
        (t) =>
          t.id === incomingThr.id ||
          (t.buyerUsername.toLowerCase() === incomingThr.buyerUsername.toLowerCase() &&
            (t.listingId === incomingThr.listingId || t.subject.toLowerCase() === incomingThr.subject.toLowerCase()))
      );

      if (idx >= 0) {
        const existing = existingAccountThreads[idx];
        const mergedMsgs = mergeThreadMessages(existing.messages, incomingThr.messages);
        const lastMsg = mergedMsgs[mergedMsgs.length - 1];

        // Check if a truly new message arrived from BUYER
        const existingMsgCount = existing.messages?.length || 0;
        const hasNewIncomingBuyerMsg =
          mergedMsgs.length > existingMsgCount && lastMsg?.senderRole === 'BUYER';

        // Preserve read status if user already read it! Only mark unread if new buyer message arrived
        const updatedUnread = hasNewIncomingBuyerMsg ? true : existing.unread;

        existingAccountThreads[idx] = {
          ...existing,
          ...incomingThr,
          unread: updatedUnread,
          messages: mergedMsgs,
          lastMessageSnippet: lastMsg?.body?.slice(0, 120) || incomingThr.lastMessageSnippet,
          lastUpdated: lastMsg?.timestamp || incomingThr.lastUpdated,
        };
      } else {
        // If it's a new thread, but the last message is from SELLER, it was already replied to
        const lastMsg = incomingThr.messages[incomingThr.messages.length - 1];
        if (lastMsg && lastMsg.senderRole === 'SELLER') {
          incomingThr.unread = false;
        }
        existingAccountThreads.unshift(incomingThr);
      }
    }

    store.threads = [...existingAccountThreads, ...otherThreads];
    await saveStoreAsync(store);
  }

  return newThreadsList.length;
}

// 8. Reply directly to buyer on live eBay via AddMemberMessageRTQ
export async function sendLiveEbayReply(
  account: ConnectedAccount,
  params: {
    itemId?: string;
    parentMessageId?: string;
    recipientUsername: string;
    replyText: string;
  }
): Promise<{ success: boolean; message: string }> {
  let accessToken = (await ensureFreshAccessToken(account)) || account.accessToken;
  const masterConfig = getStore().masterConfig;

  if (!accessToken) {
    return { success: false, message: 'No active access token for account' };
  }

  const tradingUrl = isSandboxEnv(masterConfig)
    ? 'https://api.sandbox.ebay.com/ws/api.dll'
    : 'https://api.ebay.com/ws/api.dll';

  const siteId = account.marketplace === 'EBAY_GB' ? '3' : account.marketplace === 'EBAY_DE' ? '77' : '0';
  const rawItemId = params.itemId ? params.itemId.replace(/^lst-/, '') : '';

  const addXml = `<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageRTQRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  ${rawItemId ? `<ItemID>${rawItemId}</ItemID>` : ''}
  <MemberMessage>
    <Body>${encodeXmlEntities(params.replyText)}</Body>
    ${params.parentMessageId ? `<ParentMessageID>${params.parentMessageId.replace(/^msg-/, '')}</ParentMessageID>` : ''}
    <RecipientID>${encodeXmlEntities(params.recipientUsername)}</RecipientID>
  </MemberMessage>
</AddMemberMessageRTQRequest>`;

  try {
    let res = await fetch(tradingUrl, {
      method: 'POST',
      headers: {
        'X-EBAY-API-SITEID': siteId,
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
        'X-EBAY-API-CALL-NAME': 'AddMemberMessageRTQ',
        'X-EBAY-API-IAF-TOKEN': accessToken,
        'Content-Type': 'text/xml',
      },
      body: addXml,
    });

    let respText = await res.text();

    if (respText.includes('IAF token supplied is expired') || respText.includes('21916984')) {
      const freshToken = await ensureFreshAccessToken(account, true);
      if (freshToken) {
        accessToken = freshToken;
        const retryRes = await fetch(tradingUrl, {
          method: 'POST',
          headers: {
            'X-EBAY-API-SITEID': siteId,
            'X-EBAY-API-COMPATIBILITY-LEVEL': '1200',
            'X-EBAY-API-CALL-NAME': 'AddMemberMessageRTQ',
            'X-EBAY-API-IAF-TOKEN': freshToken,
            'Content-Type': 'text/xml',
          },
          body: addXml,
        });
        respText = await retryRes.text();
      }
    }

    const isSuccess = respText.includes('<Ack>Success</Ack>') || respText.includes('<Ack>Warning</Ack>');
    if (isSuccess) {
      return { success: true, message: 'Reply sent directly to buyer on eBay!' };
    } else {
      const errMsg = extractEbayErrorMessage(respText, 'eBay failed to deliver reply message');
      return { success: false, message: errMsg };
    }
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}
