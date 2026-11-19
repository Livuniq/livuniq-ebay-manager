import { NextResponse } from 'next/server';
import { getMasterConfig, updateMasterConfig, ensureStoreAsync, getActiveAccountId, getAccounts } from '@/lib/ebay/server-store';

export async function GET() {
  await ensureStoreAsync();
  const masterConfig = getMasterConfig();
  if (!masterConfig.masterAppId && process.env.EBAY_MASTER_APP_ID) {
    const envAppId = process.env.EBAY_MASTER_APP_ID;
    const isSbx = envAppId.includes('-SBX-');
    masterConfig.masterAppId = envAppId;
    masterConfig.masterCertId = process.env.EBAY_MASTER_CERT_ID || '';
    masterConfig.masterRuName = process.env.EBAY_MASTER_RU_NAME || '';
    masterConfig.isLiveConfigured = true;
    masterConfig.environment = isSbx ? 'sandbox' : masterConfig.environment || 'sandbox';
    if (isSbx && !masterConfig.sandboxAppId) {
      masterConfig.sandboxAppId = envAppId;
      masterConfig.sandboxCertId = process.env.EBAY_MASTER_CERT_ID || '';
      masterConfig.sandboxRuName = process.env.EBAY_MASTER_RU_NAME || '';
    } else if (!isSbx && !masterConfig.productionAppId) {
      masterConfig.productionAppId = envAppId;
      masterConfig.productionCertId = process.env.EBAY_MASTER_CERT_ID || '';
      masterConfig.productionRuName = process.env.EBAY_MASTER_RU_NAME || '';
    }
  }
  return NextResponse.json({
    success: true,
    config: masterConfig,
  });
}

export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const body = await request.json();
    const updated = updateMasterConfig({
      environment: body.environment || 'sandbox',
      masterAppId: body.masterAppId,
      masterCertId: body.masterCertId,
      masterRuName: body.masterRuName,
      sandboxAppId: body.sandboxAppId,
      sandboxCertId: body.sandboxCertId,
      sandboxRuName: body.sandboxRuName,
      productionAppId: body.productionAppId,
      productionCertId: body.productionCertId,
      productionRuName: body.productionRuName,
    });
    const activeAccountId = getActiveAccountId();
    const accounts = getAccounts();
    return NextResponse.json({
      success: true,
      config: updated,
      activeAccountId,
      accounts,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
