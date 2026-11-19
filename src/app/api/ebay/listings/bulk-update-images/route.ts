import { NextResponse } from 'next/server';
import { getStore, saveStoreAsync, ensureStoreAsync, getActiveAccountId } from '@/lib/ebay/server-store';
import { reviseLiveEbayListing, ensureFreshAccessToken } from '@/lib/ebay/live-sync';
import { isVideoMedia, updateDescriptionImages, deduplicateImageUrls } from '@/lib/ebay/template-engine';

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const body = await request.json().catch(() => ({}));
    const targetAccountId = body.accountId || getActiveAccountId();
    const pushLiveToEbay = Boolean(body.pushLiveToEbay);
    const apiKey = (body.apiKey || '').trim();
    const updates: Array<{
      listingId?: string;
      sku: string;
      images: string[];
      videoUrl?: string;
      videoId?: string;
      updateDescription?: boolean;
    }> = body.updates || [];

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No image updates provided' },
        { status: 400 }
      );
    }

    const store = getStore();
    const defaultAccount =
      store.accounts.find((a) => a.id === targetAccountId) ||
      store.accounts.find((a) => a.ebayUsername === 'livuniq') ||
      store.accounts.find((a) => a.id === getActiveAccountId()) ||
      store.accounts.find((a) => a.accessToken) ||
      store.accounts[0];

    if (!defaultAccount) {
      return NextResponse.json(
        { success: false, error: 'No connected eBay account found' },
        { status: 400 }
      );
    }

    if (pushLiveToEbay) {
      await ensureFreshAccessToken(defaultAccount);
    }

    const results: Array<{
      listingId: string;
      sku: string;
      title: string;
      oldImageCount: number;
      newImageCount: number;
      description?: string;
      images?: string[];
      imageUrl?: string;
      videoUrl?: string;
      videoId?: string;
      videoError?: string;
      success: boolean;
      pushedToEbay: boolean;
      message: string;
    }> = [];

    for (const update of updates) {
      const cleanUpdateSku = (update.sku || '').trim().toLowerCase();
      const alphaNumUpdateSku = cleanUpdateSku.replace(/[^a-z0-9]/g, '');

      // Find listing by ID first, then by SKU (exact or alphanumeric)
      const listing = store.listings.find((l) => {
        if (targetAccountId && l.accountId !== targetAccountId) {
          // If sku matches anyway, allow matching so listing is found even if targetAccountId was missing/different
          const lSku = (l.sku || '').trim().toLowerCase();
          const lAlphaNum = lSku.replace(/[^a-z0-9]/g, '');
          if (lSku !== cleanUpdateSku && (alphaNumUpdateSku.length < 3 || lAlphaNum !== alphaNumUpdateSku)) {
            return false;
          }
        }

        if (update.listingId && l.id === update.listingId) return true;

        const lSku = (l.sku || '').trim().toLowerCase();
        const lAlphaNum = lSku.replace(/[^a-z0-9]/g, '');
        return lSku === cleanUpdateSku || (alphaNumUpdateSku.length >= 3 && lAlphaNum === alphaNumUpdateSku);
      });

      if (!listing) {
        results.push({
          listingId: update.listingId || '',
          sku: update.sku,
          title: 'Unknown',
          oldImageCount: 0,
          newImageCount: (update.images || []).length,
          success: false,
          pushedToEbay: false,
          message: `Listing with SKU "${update.sku}" not found in current store.`,
        });
        continue;
      }

      // Resolve the precise eBay seller account for this listing
      const listingAccount =
        store.accounts.find((a) => a.id === listing.accountId) ||
        store.accounts.find((a) => a.ebayUsername === 'livuniq') ||
        store.accounts.find((a) => a.id === targetAccountId) ||
        defaultAccount;

      if (pushLiveToEbay) {
        await ensureFreshAccessToken(listingAccount);
      }

      const oldImageCount = (listing.images && listing.images.length > 0)
        ? listing.images.length
        : listing.imageUrl
        ? 1
        : 0;

      // Filter and deduplicate only valid image URLs (strictly no videos and no duplicates)
      let validNewImages = deduplicateImageUrls(update.images || []);

      // If no new photos were provided in folder but a videoUrl is present, retain current listing photos so video can be updated!
      if (validNewImages.length === 0 && update.videoUrl) {
        validNewImages = listing.images && listing.images.length > 0
          ? [...listing.images]
          : listing.imageUrl
          ? [listing.imageUrl]
          : [];
      }

      if (validNewImages.length === 0 && !update.videoUrl) {
        results.push({
          listingId: listing.id,
          sku: listing.sku,
          title: listing.title,
          oldImageCount,
          newImageCount: 0,
          success: false,
          pushedToEbay: false,
          message: 'No valid image or video URLs provided in folder.',
        });
        continue;
      }

      // 1. COMPLETELY REMOVE OLD IMAGES AND REPLACE WITH NEW ONES
      const oldImages = listing.images && listing.images.length > 0
        ? [...listing.images]
        : listing.imageUrl
        ? [listing.imageUrl]
        : [];

      const oldVideoUrl = listing.videoUrl;
      const oldVideoId = listing.videoId;

      listing.images = [...validNewImages];
      listing.imageUrl = validNewImages[0];
      if (update.videoUrl) {
        listing.videoUrl = update.videoUrl;
      }
      if (update.videoId) {
        listing.videoId = update.videoId;
      }

      const shouldUpdateDesc = Boolean(update.updateDescription ?? body.updateDescription);

      // 1b. Update HTML Description ONLY if explicitly requested by user (keeps custom templates 100% safe by default)
      if (shouldUpdateDesc && listing.description) {
        listing.description = updateDescriptionImages(listing.description, validNewImages, oldImages);
      }

      listing.hasUnpublishedChanges = true;
      listing.lastUpdated = new Date().toISOString();

      let pushedToEbay = false;
      let ebayMessage = '';
      let videoErrorMsg: string | undefined = undefined;
      let reviseRes: any = null;

      // 2. If pushLiveToEbay is requested and the item is live on eBay (valid numeric Item ID)
      const hasLiveEbayId = Boolean(
        listing.ebayListingId &&
        listing.ebayListingId !== 'Pending' &&
        /^\d+$/.test(listing.ebayListingId.replace(/^#/, '').trim())
      );

      if (pushLiveToEbay && hasLiveEbayId && listing.ebayListingId) {
        try {
          // Determine video to pass to eBay:
          // If update.videoId is explicitly provided, use it.
          // If update.videoUrl is provided without videoId or differs from old video:
          // Pass undefined so reviseLiveEbayListing will invoke uploadVideoToEbayMediaApi to upload the binary video to eBay Commerce Media API!
          let targetVideoId = update.videoId;
          if (!targetVideoId && update.videoUrl) {
            const isUrlSame = (oldVideoUrl || '').trim() === (update.videoUrl || '').trim();
            const hasValidEbayVideoId = oldVideoId && /^[a-f0-9]{25,45}$/i.test(oldVideoId.trim());
            if (isUrlSame && hasValidEbayVideoId) {
              targetVideoId = oldVideoId;
            } else {
              targetVideoId = undefined; // Forces fresh upload to eBay Media API
            }
          }

          const revisePayload: {
            images: string[];
            videoUrl?: string;
            videoId?: string;
            description?: string;
            apiKey?: string;
            sku?: string;
          } = {
            images: validNewImages,
            videoUrl: update.videoUrl || listing.videoUrl,
            videoId: targetVideoId,
            apiKey: apiKey || (store.masterConfig as any).googleDriveApiKey,
            sku: listing.sku,
          };

          // Only send description to eBay if user opted to revise description
          if (shouldUpdateDesc && listing.description) {
            revisePayload.description = listing.description;
          }

          reviseRes = await reviseLiveEbayListing(
            listingAccount,
            listing.ebayListingId.replace(/^#/, '').trim(),
            revisePayload
          );

          videoErrorMsg = reviseRes.videoError;

          if (reviseRes.success) {
            pushedToEbay = true;
            if (reviseRes.videoId) {
              listing.videoId = reviseRes.videoId;
            }
            listing.hasUnpublishedChanges = false;
            listing.lastSyncedWithEbayAt = new Date().toISOString();
            listing.status = (listing.quantity !== undefined && listing.quantity !== null ? listing.quantity : 0) > 0 ? 'ACTIVE' : 'OUT_OF_STOCK';
            ebayMessage = reviseRes.videoId
              ? 'Live on eBay updated successfully with Video!'
              : reviseRes.videoError
              ? `Images updated on eBay, but video failed: ${reviseRes.videoError}`
              : 'Live on eBay updated successfully!';
          } else {
            ebayMessage = `eBay live sync failed: ${reviseRes.message}`;
          }
        } catch (revErr: any) {
          ebayMessage = `eBay sync error: ${revErr.message}`;
        }
      }

      results.push({
        listingId: listing.id,
        sku: listing.sku,
        title: listing.title,
        oldImageCount,
        newImageCount: validNewImages.length,
        description: listing.description,
        images: listing.images,
        imageUrl: listing.imageUrl,
        videoUrl: listing.videoUrl,
        videoId: listing.videoId,
        videoError: videoErrorMsg,
        success: true,
        pushedToEbay,
        message: pushedToEbay
          ? (reviseRes?.videoId
              ? `Old ${oldImageCount} images removed, ${validNewImages.length} new images updated & Video attached live on eBay!`
              : (reviseRes?.videoError
                  ? `Old ${oldImageCount} images removed, ${validNewImages.length} new images updated on eBay (⚠️ Video: ${reviseRes.videoError})`
                  : `Old ${oldImageCount} images removed, ${validNewImages.length} new images updated & pushed live to eBay!`))
          : `Old ${oldImageCount} images removed, ${validNewImages.length} new images updated locally. ${ebayMessage}`.trim(),
      });
    }

    await saveStoreAsync(store);

    const successCount = results.filter((r) => r.success).length;
    const livePushCount = results.filter((r) => r.pushedToEbay).length;

    return NextResponse.json({
      success: true,
      updatedCount: successCount,
      pushedToEbayCount: livePushCount,
      failedCount: results.length - successCount,
      results,
      message: `Successfully updated images for ${successCount} listings! ${
        livePushCount > 0 ? `(${livePushCount} listings updated live on eBay)` : ''
      }`,
    });
  } catch (err: any) {
    console.error('Bulk image update error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
