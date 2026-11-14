import { NextResponse } from 'next/server';
import { getMasterConfig, updateMasterConfig } from '@/lib/ebay/server-store';

export async function GET() {
  const masterConfig = getMasterConfig();
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
