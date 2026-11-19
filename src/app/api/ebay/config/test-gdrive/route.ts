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
    // We test with a sample file ID check
    const testUrl = `https://www.googleapis.com/drive/v3/files/1Aps_2Gs3RUx4kb-XohNZFa0eAzrQ9lEF?fields=id,name&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(testUrl);

    if (res.ok) {
      return NextResponse.json({
        success: true,
        message: '✓ Google Drive API Key bilkul sahi aur active hai! Google Drive auto-fetch ke liye ready hai.',
      });
    }

    const errData = await res.json().catch(() => ({}));
    const rawMsg = errData.error?.message || res.statusText || 'Unknown error';
    const errReason = errData.error?.errors?.[0]?.reason || errData.error?.details?.[0]?.reason || '';

    // 1. Invalid API Key
    if (res.status === 400 || rawMsg.toLowerCase().includes('api key not valid') || errReason === 'API_KEY_INVALID') {
      return NextResponse.json({
        success: false,
        error: 'API key valid nahi hai. Kripya Google Cloud Console se sahi API key copy karke dalein.',
        rawError: rawMsg,
      });
    }

    // 2. Google Drive API not enabled in Google Cloud Console
    if (rawMsg.toLowerCase().includes('has not been used') || rawMsg.toLowerCase().includes('disabled') || errReason === 'SERVICE_DISABLED') {
      return NextResponse.json({
        success: false,
        error: 'Aapke Google Cloud project me "Google Drive API" enabled nahi hai. Kripya Google Cloud Console me "Google Drive API" ko enable karein.',
        rawError: rawMsg,
      });
    }

    // 3. Key restricted by IP or HTTP referrer
    if (rawMsg.toLowerCase().includes('ip') || rawMsg.toLowerCase().includes('referrer') || rawMsg.toLowerCase().includes('blocked') || rawMsg.toLowerCase().includes('restricted')) {
      return NextResponse.json({
        success: false,
        error: 'API Key par restriction lagi hui hai. Google Cloud Console me ja kar API Key Restrictions ko "None" set karein.',
        rawError: rawMsg,
      });
    }

    // 4. If Google returned 404 (File not found) or "insufficient permissions":
    // This confirms the API key was authenticated and Google Drive API is active!
    // (An API key accesses publicly shared links).
    if (res.status === 404 || rawMsg.toLowerCase().includes('permission') || errReason === 'insufficientFilePermissions') {
      return NextResponse.json({
        success: true,
        message: '✓ Google Drive API Key valid & active hai! (Bas apne Google Drive folders/videos ko "Anyone with the link - Viewer" par share rakhein).',
      });
    }

    return NextResponse.json({
      success: false,
      error: rawMsg || 'Google Drive API error',
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
