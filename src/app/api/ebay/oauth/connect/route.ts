import { NextResponse } from 'next/server';
import { getMasterConfig } from '@/lib/ebay/server-store';

export async function GET(request: Request) {
  const masterConfig = getMasterConfig();
  const { searchParams } = new URL(request.url);
  const marketplace = searchParams.get('marketplace') || 'EBAY_US';

  const scopes = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    'https://api.ebay.com/oauth/api_scope/commerce.message',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
  ].join(' ');

  const isSandbox = masterConfig.environment === 'sandbox';
  const effectiveAppId = isSandbox
    ? (masterConfig.sandboxAppId || masterConfig.masterAppId)
    : (masterConfig.productionAppId || masterConfig.masterAppId);
  const effectiveRuName = isSandbox
    ? (masterConfig.sandboxRuName || masterConfig.masterRuName)
    : (masterConfig.productionRuName || masterConfig.masterRuName);

  const authHost = isSandbox
    ? 'https://auth.sandbox.ebay.com/oauth2/authorize'
    : 'https://auth.ebay.com/oauth2/authorize';

  // If live keys are configured, generate the actual eBay OAuth URL
  const targetUrl = Boolean(effectiveAppId && effectiveRuName)
    ? `${authHost}?client_id=${encodeURIComponent(
        effectiveAppId
      )}&response_type=code&redirect_uri=${encodeURIComponent(
        effectiveRuName
      )}&scope=${encodeURIComponent(scopes)}&state=${marketplace}`
    : null;

  return NextResponse.json({
    success: true,
    isLiveConfigured: masterConfig.isLiveConfigured,
    environment: masterConfig.environment,
    authUrl: targetUrl,
    scopes,
  });
}
