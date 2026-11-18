import { NextResponse } from 'next/server';
import { getStore, saveStoreAsync, ensureStoreAsync, getActiveAccountId } from '@/lib/ebay/server-store';
import { reviseLiveEbayListing, ensureFreshAccessToken } from '@/lib/ebay/live-sync';
import { isVideoMedia, updateDescriptionImages, deduplicateImageUrls } from '@/lib/ebay/template-engine';

export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const body = await request.json().catch(() => ({}));
    const targetAccountId = body.accountId || getActiveAccountId();
    const pushLiveToEbay = Boolean(body.pushLiveToEbay);
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
    const account = store.accounts.find((a) => a.id === targetAccountId) || store.accounts[0];
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'No connected eBay account found' },
        { status: 400 }
      );
    }

    if (pushLiveToEbay) {
      await ensureFreshAccessToken(account);
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
      success: boolean;
      pushedToEbay: boolean;
      message: string;
    }> = [];

    for (const update of updates) {
      const cleanUpdateSku = (update.sku || '').trim().toLowerCase();
      const alphaNumUpdateSku = cleanUpdateSku.replace(/[^a-z0-9]/g, '');

      // Find listing by ID first, then by SKU (exact or alphanumeric)
      const listing = store.listings.find((l) => {
        const matchesAccount = !targetAccountId || l.accountId === targetAccountId;
        if (!matchesAccount) return false;

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

      const oldImageCount = (listing.images && listing.images.length > 0)
        ? listing.images.length
        : listing.imageUrl
        ? 1
        : 0;

      // Filter and deduplicate only valid image URLs (strictly no videos and no duplicates)
      const validNewImages = deduplicateImageUrls(update.images || []);

      if (validNewImages.length === 0) {
        results.push({
          listingId: listing.id,
          sku: listing.sku,
          title: listing.title,
          oldImageCount,
          newImageCount: 0,
          success: false,
          pushedToEbay: false,
          message: 'No valid image URLs provided in folder.',
        });
        continue;
      }

      // 1. COMPLETELY REMOVE OLD IMAGES AND REPLACE WITH NEW ONES
      const oldImages = listing.images && listing.images.length > 0
        ? [...listing.images]
        : listing.imageUrl
        ? [listing.imageUrl]
        : [];

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

      // 2. If pushLiveToEbay is requested and the item is live on eBay (valid numeric Item ID)
      const hasLiveEbayId = Boolean(
        listing.ebayListingId &&
        listing.ebayListingId !== 'Pending' &&
        /^\d+$/.test(listing.ebayListingId.replace(/^#/, '').trim())
      );

      if (pushLiveToEbay && hasLiveEbayId && listing.ebayListingId) {
        try {
          const revisePayload: {
            images: string[];
            videoUrl?: string;
            videoId?: string;
            description?: string;
          } = {
            images: validNewImages,
            videoUrl: update.videoUrl || listing.videoUrl,
            videoId: update.videoId || listing.videoId,
          };

          // Only send description to eBay if user opted to revise description
          if (shouldUpdateDesc && listing.description) {
            revisePayload.description = listing.description;
          }

          const reviseRes = await reviseLiveEbayListing(
            account,
            listing.ebayListingId.replace(/^#/, '').trim(),
            revisePayload
          );

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
        success: true,
        pushedToEbay,
        message: pushedToEbay
          ? `Old ${oldImageCount} images removed, ${validNewImages.length} new images updated & pushed live to eBay!`
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
