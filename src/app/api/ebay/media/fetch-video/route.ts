import { NextResponse } from 'next/server';
import { getAccounts, getActiveAccountId, ensureStoreAsync, getStore } from '@/lib/ebay/server-store';
import { ensureFreshAccessToken, uploadVideoToEbayMediaApi } from '@/lib/ebay/live-sync';
import { extractGoogleDriveId } from '@/lib/ebay/google-drive-scanner';

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const body = await request.json();
    const { videoUrl, sku, accountId, apiKey } = body;

    if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.trim()) {
      return NextResponse.json(
        { success: false, error: 'Video URL is required' },
        { status: 400 }
      );
    }

    const cleanUrl = videoUrl.trim();
    const store = getStore();
    const accounts = getAccounts();
    const account =
      accounts.find((a) => a.id === accountId) ||
      accounts.find((a) => a.id === getActiveAccountId()) ||
      accounts.find((a) => a.accessToken);

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'No active connected eBay account found' },
        { status: 400 }
      );
    }

    await ensureFreshAccessToken(account);

    const fileName = `video_${(sku || 'item').replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
    const effectiveApiKey =
      (apiKey || '').trim() ||
      (store.masterConfig as any)?.googleDriveApiKey ||
      process.env.GOOGLE_DRIVE_API_KEY ||
      '';

    const gDriveId = extractGoogleDriveId(cleanUrl).id;

    console.log(`[Fetch Video API] Processing video for SKU: "${sku || 'N/A'}", gDriveId: "${gDriveId || 'None'}"`);

    const uploadRes = await uploadVideoToEbayMediaApi(
      account,
      cleanUrl,
      fileName,
      effectiveApiKey
    );

    if (uploadRes.success && uploadRes.videoId) {
      return NextResponse.json({
        success: true,
        videoId: uploadRes.videoId,
        gDriveId: gDriveId || undefined,
        message: 'Video successfully fetched and registered with eBay Media API!',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: uploadRes.error || 'Failed to upload video to eBay Media API',
        },
        { status: 422 }
      );
    }
  } catch (err: any) {
    console.error('[Fetch Video API] Exception:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error while fetching video' },
      { status: 500 }
    );
  }
}
