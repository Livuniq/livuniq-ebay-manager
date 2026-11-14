import { NextResponse } from 'next/server';
import { getStore, getActiveAccountId, createListing } from '@/lib/ebay/server-store';
import { addLiveEbayListing, ensureFreshAccessToken } from '@/lib/ebay/live-sync';
import { isEbayItemSpecific } from '@/lib/ebay/specifics-rules';
import { isVideoMedia } from '@/lib/ebay/template-engine';
import { EbayListing } from '@/lib/ebay/types';

export interface BulkImportItemPayload {
  sku: string;
  title: string;
  price: number;
  quantity: number;
  categoryId?: string;
  categoryName?: string;
  conditionId?: string;
  sellerNotes?: string;
  images?: string[];
  videoUrl?: string;
  videoId?: string;
  description?: string;
  itemSpecifics?: Record<string, string>;
  templateAttributes?: Record<string, any>;
  shippingPolicyId?: string;
  shippingPolicyName?: string;
  returnPolicyId?: string;
  returnPolicyName?: string;
  paymentPolicyId?: string;
  paymentPolicyName?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, accountId, publishToEbay } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No items provided for bulk import' }, { status: 400 });
    }

    const store = getStore();
    const targetAccountId = accountId || getActiveAccountId();
    const account = store.accounts.find((a) => a.id === targetAccountId) || store.accounts[0];

    const shouldPublishToEbay = Boolean(publishToEbay);

    if (shouldPublishToEbay && account) {
      await ensureFreshAccessToken(account);
    }

    const results: Array<{
      sku: string;
      title: string;
      success: boolean;
      ebayLiveStatus: 'LIVE_CREATED' | 'LIVE_FAILED' | 'LOCAL';
      ebayItemId?: string;
      message?: string;
      listing?: EbayListing;
    }> = [];

    for (const item of items as BulkImportItemPayload[]) {
      let liveItemId: string | undefined = undefined;
      let ebayLiveStatus: 'LIVE_CREATED' | 'LIVE_FAILED' | 'LOCAL' = 'LOCAL';
      let message = 'Saved as draft';

      const rawImages = Array.isArray(item.images) ? item.images : [];
      // Filter out any videos so validImages strictly contains product photos
      const validImages = rawImages.filter((u) => Boolean(u && u.trim()) && !isVideoMedia(u));
      const detectedVideo = item.videoUrl || rawImages.find((u) => isVideoMedia(u));
      const mainImageUrl = validImages[0] || 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500&auto=format&fit=crop&q=60';

      // Clean item specifics so ONLY legitimate eBay aspects are included (strictly no Excel headers)
      const cleanSpecifics: Record<string, string> = {};
      if (item.itemSpecifics) {
        for (const [k, v] of Object.entries(item.itemSpecifics)) {
          if (isEbayItemSpecific(k) && v !== undefined && v !== null && String(v).trim()) {
            cleanSpecifics[k] = String(v).trim();
          }
        }
      }

      if (shouldPublishToEbay && account && account.accessToken) {
        try {
          const addRes = await addLiveEbayListing(account, {
            title: item.title,
            price: item.price,
            quantity: item.quantity || 1,
            sku: item.sku,
            description: item.description,
            categoryId: item.categoryId || '261975',
            conditionId: item.conditionId || '1000',
            conditionDescription: item.sellerNotes,
            images: validImages,
            videoUrl: detectedVideo,
            videoId: item.videoId,
            itemSpecifics: cleanSpecifics,
            shippingPolicyId: item.shippingPolicyId,
            shippingPolicyName: item.shippingPolicyName,
            returnPolicyId: item.returnPolicyId,
            returnPolicyName: item.returnPolicyName,
            paymentPolicyId: item.paymentPolicyId,
            paymentPolicyName: item.paymentPolicyName,
          });

          if (addRes.success) {
            ebayLiveStatus = 'LIVE_CREATED';
            liveItemId = addRes.itemId;
            message = addRes.message;
          } else {
            ebayLiveStatus = 'LIVE_FAILED';
            message = addRes.message;
          }
        } catch (liveErr) {
          ebayLiveStatus = 'LIVE_FAILED';
          message = (liveErr as Error).message;
        }
      }

      // Create in local store database
      const createdListing = createListing({
        accountId: targetAccountId,
        sku: item.sku || `SKU-${Date.now().toString().slice(-4)}`,
        title: item.title,
        price: item.price,
        currency: account?.currency || 'USD',
        quantity: item.quantity || 1,
        category: item.categoryName || '/Jewelry & Watches/Engagement & Wedding/Engagement Rings',
        condition: (item.conditionId === '1000' || item.conditionId === '1500' || item.conditionId === '1750') ? 'NEW' : 'USED',
        conditionId: item.conditionId || '1000',
        imageUrl: mainImageUrl,
        images: validImages.length > 0 ? validImages : [mainImageUrl],
        videoUrl: detectedVideo,
        videoId: item.videoId,
        description: item.description || '',
        itemSpecifics: cleanSpecifics,
        templateAttributes: item.templateAttributes || {},
        sellerNotes: item.sellerNotes || '',
        categoryId: item.categoryId || '261975',
        shippingPolicyId: item.shippingPolicyId,
        shippingPolicyName: item.shippingPolicyName,
        returnPolicyId: item.returnPolicyId,
        returnPolicyName: item.returnPolicyName,
        paymentPolicyId: item.paymentPolicyId,
        paymentPolicyName: item.paymentPolicyName,
        status: shouldPublishToEbay ? (ebayLiveStatus === 'LIVE_CREATED' ? 'ACTIVE' : 'DRAFT') : 'DRAFT',
        ebayListingId: liveItemId,
        hasUnpublishedChanges: !shouldPublishToEbay || ebayLiveStatus !== 'LIVE_CREATED',
        lastSyncedWithEbayAt: ebayLiveStatus === 'LIVE_CREATED' ? new Date().toISOString() : undefined,
      });

      results.push({
        sku: item.sku,
        title: item.title,
        success: shouldPublishToEbay ? ebayLiveStatus === 'LIVE_CREATED' : true,
        ebayLiveStatus,
        ebayItemId: liveItemId,
        message,
        listing: createdListing,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      total: results.length,
      successCount,
      failureCount,
      publishToEbay: shouldPublishToEbay,
      results,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
