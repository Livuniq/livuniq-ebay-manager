import { NextResponse } from 'next/server';
import { getStore, saveStore, getActiveAccountId } from '@/lib/ebay/server-store';
import { addLiveEbayListing, ensureFreshAccessToken } from '@/lib/ebay/live-sync';
import { isVideoMedia } from '@/lib/ebay/template-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetAccountId = body.accountId || getActiveAccountId();
    const store = getStore();

    const account = store.accounts.find((a) => a.id === targetAccountId) || store.accounts[0];
    if (!account) {
      return NextResponse.json({ success: false, error: 'No connected eBay account found' }, { status: 400 });
    }

    await ensureFreshAccessToken(account);

    // Find all draft / unpublished listings for this account
    const drafts = store.listings.filter(
      (l) => l.accountId === targetAccountId && (l.hasUnpublishedChanges || l.status === 'DRAFT' || !l.ebayListingId)
    );

    if (drafts.length === 0) {
      return NextResponse.json({
        success: true,
        publishedCount: 0,
        message: 'No unpublished drafts found for this store',
      });
    }

    const results: Array<{ id: string; title: string; success: boolean; itemId?: string; message: string }> = [];

    for (const draft of drafts) {
      const validImages = (draft.images && draft.images.length > 0 ? draft.images : [draft.imageUrl]).filter(
        (u) => Boolean(u && u.trim()) && !isVideoMedia(u)
      );

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

    saveStore(store);

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
