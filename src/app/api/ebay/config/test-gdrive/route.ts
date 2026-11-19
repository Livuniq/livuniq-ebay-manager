import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const apiKey = (body.apiKey || '').trim();

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    // Call Google Drive API v3 to test key validity & Drive API activation
    const testUrl = `https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id)&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(testUrl);

    if (res.ok) {
      return NextResponse.json({
        success: true,
        message: 'Google Drive API Key valid & active!',
      });
    }

    const errData = await res.json().catch(() => ({}));
    const rawMsg = errData.error?.message || res.statusText || 'Unknown error';

    let friendly = rawMsg;
    if (rawMsg.toLowerCase().includes('api key not valid')) {
      friendly = 'API key valid nahi hai. Kripya Google Cloud Console se copy ki hui poori API key dalein.';
    } else if (rawMsg.toLowerCase().includes('has not been used') || rawMsg.toLowerCase().includes('disabled')) {
      friendly = 'Aapke Google Cloud project me "Google Drive API" enabled nahi hai. Kripya Google Cloud Console me ja kar "Google Drive API" ko enable karein.';
    }

    return NextResponse.json({
      success: false,
      error: friendly,
      rawError: rawMsg,
      statusCode: res.status,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Connection failed' },
      { status: 500 }
    );
  }
}
