import { NextResponse } from 'next/server';
import { getMasterConfig } from '@/lib/ebay/server-store';

export async function GET(request: Request) {
  const masterConfig = getMasterConfig();
  const { searchParams } = new URL(request.url);

  const reqEnv = searchParams.get('env');
  const isSandbox = reqEnv === 'sandbox' || (reqEnv !== 'production' && masterConfig.environment === 'sandbox');

  const effectiveAppId = isSandbox
    ? (masterConfig.sandboxAppId || masterConfig.masterAppId)
    : (masterConfig.productionAppId || masterConfig.masterAppId);

  const effectiveRuName = isSandbox
    ? (masterConfig.sandboxRuName || masterConfig.masterRuName)
    : (masterConfig.productionRuName || masterConfig.masterRuName);

  const marketplace = searchParams.get('marketplace') || 'EBAY_US';

  const scopes = [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    'https://api.ebay.com/oauth/api_scope/commerce.message',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
  ].join(' ');

  const authHost = isSandbox
    ? 'https://auth.sandbox.ebay.com/oauth2/authorize'
    : 'https://auth.ebay.com/oauth2/authorize';

  // Check if live master keys are entered in Master API Setup
  if (effectiveAppId && effectiveRuName) {
    const state = JSON.stringify({ marketplace, env: isSandbox ? 'sandbox' : 'production', t: Date.now() });
    const ebayConsentUrl = `${authHost}?client_id=${encodeURIComponent(
      effectiveAppId
    )}&response_type=code&redirect_uri=${encodeURIComponent(
      effectiveRuName
    )}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;

    return NextResponse.redirect(ebayConsentUrl);
  }

  // If master keys are not yet configured, redirect to a guided setup or return json
  const referer = request.headers.get('referer') || '/';
  return NextResponse.redirect(
    new URL('/?oauth_notice=setup_required', request.url)
  );
}
