import { NextResponse } from 'next/server';
import { getStore, saveStore, getActiveAccountId, ensureStoreAsync, saveStoreAsync } from '@/lib/ebay/server-store';
import { addLiveEbayListing, reviseLiveEbayListing, ensureFreshAccessToken } from '@/lib/ebay/live-sync';
import { isVideoMedia } from '@/lib/ebay/template-engine';

export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const body = await request.json().catch(() => ({}));
    const targetAccountId = body.accountId || getActiveAccountId();
    const store = getStore();

    const account = store.accounts.find((a) => a.id === targetAccountId) || store.accounts[0];
    if (!account) {
      return NextResponse.json({ success: false, error: 'No connected eBay account found' }, { status: 400 });
    }

    await ensureFreshAccessToken(account);

    const nowIso = new Date().toISOString();

    // Find all draft / unpublished listings for this account
    // If onlyDue is requested (from background auto-scheduler), ONLY pick items whose scheduled time has arrived!
    const drafts = store.listings.filter((l) => {
      const matchesAccount = !targetAccountId || l.accountId === targetAccountId;
      if (!matchesAccount) return false;

      if (body.onlyDue) {
        return Boolean(
          l.scheduledTime &&
          l.scheduledTime <= nowIso &&
          ((l.status as string) === 'SCHEDULED' || l.hasUnpublishedChanges || l.status === 'DRAFT' || !l.ebayListingId)
        );
      }

      // If manual "publish all drafts", ignore items scheduled for future dates
      if (l.scheduledTime && l.scheduledTime > nowIso) {
        return false;
      }

      return l.hasUnpublishedChanges || l.status === 'DRAFT' || !l.ebayListingId;
    });

    if (drafts.length === 0) {
      return NextResponse.json({
        success: true,
        publishedCount: 0,
        message: body.onlyDue
          ? 'No scheduled listings currently due for go-live'
          : 'No unpublished drafts found for this store',
      });
    }

    const results: Array<{ id: string; title: string; success: boolean; itemId?: string; message: string }> = [];

    for (const draft of drafts) {
      const validImages = (draft.images && draft.images.length > 0 ? draft.images : [draft.imageUrl]).filter(
        (u) => Boolean(u && u.trim()) && !isVideoMedia(u)
      );

      if (draft.ebayListingId) {
        // Item already exists on eBay, revise it to make sure changes & active state are synced
        const reviseRes = await reviseLiveEbayListing(account, draft.ebayListingId, {
          title: draft.title,
          price: draft.price,
          quantity: draft.quantity,
          sku: draft.sku,
          description: draft.description,
          images: validImages,
          itemSpecifics: draft.itemSpecifics,
          conditionDescription: draft.sellerNotes,
          categoryId: draft.categoryId,
          conditionId: draft.conditionId,
          videoId: draft.videoId,
          shippingPolicyId: draft.shippingPolicyId,
          shippingPolicyName: draft.shippingPolicyName,
          returnPolicyId: draft.returnPolicyId,
          returnPolicyName: draft.returnPolicyName,
          paymentPolicyId: draft.paymentPolicyId,
          paymentPolicyName: draft.paymentPolicyName,
        });

        if (reviseRes.success) {
          draft.status = 'ACTIVE';
          draft.hasUnpublishedChanges = false;
          draft.lastSyncedWithEbayAt = new Date().toISOString();
          results.push({ id: draft.id, title: draft.title, success: true, itemId: draft.ebayListingId, message: reviseRes.message });
        } else {
          results.push({ id: draft.id, title: draft.title, success: false, message: reviseRes.message });
        }
      } else {
        // Item not yet on eBay, create live listing
        const addRes = await addLiveEbayListing(account, {
          title: draft.title,
          price: draft.price,
          quantity: draft.quantity,
          sku: draft.sku,
          description: draft.description,
          categoryId: draft.categoryId || '261975',
          conditionId: draft.conditionId || '1000',
          conditionDescription: draft.sellerNotes,
          images: validImages,
          videoUrl: draft.videoUrl,
          videoId: draft.videoId,
          itemSpecifics: draft.itemSpecifics,
          shippingPolicyId: draft.shippingPolicyId,
          shippingPolicyName: draft.shippingPolicyName,
          returnPolicyId: draft.returnPolicyId,
          returnPolicyName: draft.returnPolicyName,
          paymentPolicyId: draft.paymentPolicyId,
          paymentPolicyName: draft.paymentPolicyName,
        });

        if (addRes.success) {
          draft.status = 'ACTIVE';
          draft.ebayListingId = addRes.itemId;
          draft.hasUnpublishedChanges = false;
          draft.lastSyncedWithEbayAt = new Date().toISOString();
          results.push({ id: draft.id, title: draft.title, success: true, itemId: addRes.itemId, message: addRes.message });
        } else {
          results.push({ id: draft.id, title: draft.title, success: false, message: addRes.message });
        }
      }
    }

    await saveStoreAsync(store);

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      publishedCount: successCount,
      failedCount: results.length - successCount,
      results,
      message: `Successfully published ${successCount} of ${results.length} drafts live to eBay!`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
