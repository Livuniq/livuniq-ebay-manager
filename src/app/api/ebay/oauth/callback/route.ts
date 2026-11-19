import { NextResponse } from 'next/server';
import { getMasterConfig, connectNewAccount, getStore, ensureStoreAsync, saveStoreAsync } from '@/lib/ebay/server-store';
import { syncLiveEbayData } from '@/lib/ebay/live-sync';

export async function GET(request: Request) {
  await ensureStoreAsync();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    console.error('eBay OAuth denied or failed:', error, errorDescription);
    return NextResponse.redirect(new URL(`/?oauth_error=${encodeURIComponent(errorDescription || error)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?oauth_error=No_authorization_code_received', request.url));
  }

  const masterConfig = getMasterConfig();
  let stateEnv = '';
  try {
    const rawState = searchParams.get('state');
    if (rawState) {
      const parsed = JSON.parse(rawState);
      stateEnv = parsed.env || '';
    }
  } catch {}

  const isSandbox = Boolean(
    stateEnv === 'sandbox' ||
    (stateEnv !== 'production' && masterConfig.environment === 'sandbox')
  );

  const effectiveAppId = isSandbox
    ? (masterConfig.sandboxAppId || masterConfig.masterAppId)
    : (masterConfig.productionAppId || masterConfig.masterAppId);

  const effectiveCertId = isSandbox
    ? (masterConfig.sandboxCertId || masterConfig.masterCertId)
    : (masterConfig.productionCertId || masterConfig.masterCertId);

  const effectiveRuName = isSandbox
    ? (masterConfig.sandboxRuName || masterConfig.masterRuName)
    : (masterConfig.productionRuName || masterConfig.masterRuName);

  const tokenHost = isSandbox
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token';

  try {
    const credentials = Buffer.from(
      `${effectiveAppId}:${effectiveCertId}`
    ).toString('base64');

    const tokenResponse = await fetch(tokenHost, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: effectiveRuName,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('eBay Token Exchange Error:', tokenData);
      return NextResponse.redirect(
        new URL(`/?oauth_error=${encodeURIComponent(tokenData.error_description || 'Token exchange failed')}`, request.url)
      );
    }

    // Detect real eBay username & store name directly via Trading API
    let initialUsername = 'eBay_Seller';
    let initialStoreName = 'eBay Store';

    try {
      const siteId = '0';
      const tradingUrl = isSandbox
        ? 'https://api.sandbox.ebay.com/ws/api.dll'
        : 'https://api.ebay.com/ws/api.dll';

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
          'X-EBAY-API-IAF-TOKEN': tokenData.access_token,
          'Content-Type': 'text/xml',
        },
        body: getUserXml,
      });

      const userText = await userRes.text();
      const matchUser = userText.match(/<UserID>([^<]+)<\/UserID>/);
      if (matchUser && matchUser[1]) {
        initialUsername = matchUser[1];
        initialStoreName = `${initialUsername} Store`;
      }

      // Try GetStore for formal eBay store name
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
          'X-EBAY-API-IAF-TOKEN': tokenData.access_token,
          'Content-Type': 'text/xml',
        },
        body: getStoreXml,
      });
      const storeXml = await storeRes.text();
      const matchStore = storeXml.match(/<Store>[\s\S]*?<Name>([^<]+)<\/Name>/i);
      if (matchStore && matchStore[1]) {
        initialStoreName = matchStore[1].replace(/&amp;/g, '&');
      }
    } catch (e) {
      console.error('Error pre-fetching user details in OAuth callback:', e);
    }

    // Connect this seller account
    const newAccount = connectNewAccount({
      ebayUsername: initialUsername,
      storeName: initialStoreName,
      marketplace: 'EBAY_US',
    });

    const store = getStore();
    const targetAcc = store.accounts.find((a) => a.id === newAccount.id);
    if (targetAcc) {
      targetAcc.environment = isSandbox ? 'sandbox' : 'production';
      targetAcc.accessToken = tokenData.access_token;
      targetAcc.refreshToken = tokenData.refresh_token;
      targetAcc.tokenExpiresAt = new Date(Date.now() + (tokenData.refresh_token_expires_in || 47304000) * 1000).toISOString();
      targetAcc.lastSyncedAt = new Date().toISOString();
      await saveStoreAsync(store);

      // Immediately pull real live listings & orders directly using eBay Trading API!
      try {
        const syncRes = await syncLiveEbayData(targetAcc);
        if (syncRes.username && syncRes.username !== 'eBay_Seller') {
          targetAcc.ebayUsername = syncRes.username;
        }
      } catch (liveSyncErr) {
        console.error('Live sync error during OAuth callback:', liveSyncErr);
      }
    }

    await saveStoreAsync(store);

    return NextResponse.redirect(new URL(`/?connected_store=${encodeURIComponent(targetAcc?.ebayUsername || initialUsername)}`, request.url));
  } catch (err) {
    console.error('OAuth Callback processing error:', err);
    return NextResponse.redirect(new URL(`/?oauth_error=${encodeURIComponent((err as Error).message)}`, request.url));
  }
}
