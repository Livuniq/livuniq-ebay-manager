import { NextResponse } from 'next/server';
import { getAccounts, getActiveAccountId, ensureStoreAsync, getStore, updateListing, getAccountForEnvironment } from '@/lib/ebay/server-store';
import { ensureFreshAccessToken, uploadVideoToEbayMediaApi, reviseLiveEbayListing } from '@/lib/ebay/live-sync';
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

    let targetAccountId = accountId;
    let targetListing = null;

    if (sku) {
      const cleanSku = sku.trim().toLowerCase();
      targetListing = (store.listings || []).find(
        (l) => (l.sku || '').trim().toLowerCase() === cleanSku
      );
      if (targetListing?.accountId) {
        targetAccountId = targetListing.accountId;
      }
    }

    const account = getAccountForEnvironment(targetAccountId);

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'No active connected eBay account found' },
        { status: 400 }
      );
    }

    console.log(`[Fetch Video API] Target seller account: ${account.ebayUsername} (${account.id}), SKU: ${sku || 'N/A'}`);

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
      let liveRevised = false;
      let liveMessage = '';

      if (targetListing) {
        updateListing(targetListing.id, {
          videoId: uploadRes.videoId,
          videoUrl: cleanUrl,
        });

        if (targetListing.ebayListingId && /^\d+$/.test(targetListing.ebayListingId)) {
          console.log(`[Fetch Video API] Auto-attaching videoId ${uploadRes.videoId} to live eBay listing ${targetListing.ebayListingId}...`);
          try {
            const reviseRes = await reviseLiveEbayListing(account, targetListing.ebayListingId, {
              videoId: uploadRes.videoId,
              videoUrl: cleanUrl,
            });
            liveRevised = reviseRes.success;
            liveMessage = reviseRes.message;
            console.log('[Fetch Video API] Revise result:', reviseRes);
          } catch (rErr: any) {
            console.warn('[Fetch Video API] Auto-revise exception:', rErr);
            liveMessage = rErr.message;
          }
        }
      }

      return NextResponse.json({
        success: true,
        videoId: uploadRes.videoId,
        gDriveId: gDriveId || undefined,
        liveRevised,
        liveMessage,
        message: liveRevised
          ? 'Video successfully uploaded and linked live to your eBay listing!'
          : 'Video successfully fetched and registered with eBay Media API!',
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
