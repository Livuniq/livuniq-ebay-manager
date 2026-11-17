import { NextResponse } from 'next/server';
import { getMasterConfig, updateMasterConfig } from '@/lib/ebay/server-store';

export async function GET() {
  const masterConfig = getMasterConfig();
  if (!masterConfig.masterAppId && process.env.EBAY_MASTER_APP_ID) {
    masterConfig.masterAppId = process.env.EBAY_MASTER_APP_ID;
    masterConfig.masterCertId = process.env.EBAY_MASTER_CERT_ID || '';
    masterConfig.masterRuName = process.env.EBAY_MASTER_RU_NAME || '';
    masterConfig.isLiveConfigured = true;
    masterConfig.environment = process.env.EBAY_MASTER_APP_ID.includes('-SBX-')
      ? 'sandbox'
      : masterConfig.environment || 'sandbox';
  }
  return NextResponse.json({
    success: true,
    config: masterConfig,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updated = updateMasterConfig({
      masterAppId: body.masterAppId,
      masterCertId: body.masterCertId,
      masterRuName: body.masterRuName,
      environment: body.environment || 'demo',
    });
    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
