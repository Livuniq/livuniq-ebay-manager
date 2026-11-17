import { NextResponse } from 'next/server';
import { getMasterConfig, connectNewAccount, getStore, ensureStoreAsync } from '@/lib/ebay/server-store';
import { syncLiveEbayData } from '@/lib/ebay/live-sync';
import fs from 'fs';
import path from 'path';

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
  const isSandbox = Boolean(
    masterConfig.masterAppId?.includes('-SBX-') ||
    masterConfig.environment === 'sandbox'
  );
  const tokenHost = isSandbox
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token';

  try {
    const credentials = Buffer.from(
      `${masterConfig.masterAppId}:${masterConfig.masterCertId}`
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
        redirect_uri: masterConfig.masterRuName,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('eBay Token Exchange Error:', tokenData);
      return NextResponse.redirect(
        new URL(`/?oauth_error=${encodeURIComponent(tokenData.error_description || 'Token exchange failed')}`, request.url)
      );
    }

    // Connect this seller account
    const newAccount = connectNewAccount({
      ebayUsername: 'eBay_Live_Seller',
      storeName: 'eBay Live Store',
      marketplace: 'EBAY_US',
    });

    const store = getStore();
    const targetAcc = store.accounts.find((a) => a.id === newAccount.id);
    if (targetAcc) {
      targetAcc.accessToken = tokenData.access_token;
      targetAcc.refreshToken = tokenData.refresh_token;
      targetAcc.tokenExpiresAt = new Date(Date.now() + (tokenData.refresh_token_expires_in || 47304000) * 1000).toISOString();
      targetAcc.lastSyncedAt = new Date().toISOString();

      // Immediately pull real live listings & orders directly using eBay Trading API!
      try {
        const syncRes = await syncLiveEbayData(targetAcc);
        if (syncRes.username && syncRes.username !== 'eBay_Live_Seller') {
          targetAcc.ebayUsername = syncRes.username;
          targetAcc.storeName = `${syncRes.username} Store`;
        }
      } catch (liveSyncErr) {
        console.error('Live sync error during OAuth callback:', liveSyncErr);
      }
    }

    const DATA_DIR = path.join(process.cwd(), '.data');
    const DATA_FILE = path.join(DATA_DIR, 'ebay_state.json');
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');

    return NextResponse.redirect(new URL(`/?connected_store=${encodeURIComponent(targetAcc?.ebayUsername || 'eBay_Seller')}`, request.url));
  } catch (err) {
    console.error('OAuth Callback processing error:', err);
    return NextResponse.redirect(new URL(`/?oauth_error=${encodeURIComponent((err as Error).message)}`, request.url));
  }
}
