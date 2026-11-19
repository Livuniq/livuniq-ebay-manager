import { NextResponse } from 'next/server';
import {
  getListings,
  createListing,
  updateListing,
  deleteListing,
  clearAllListings,
  getActiveAccountId,
  getAccounts,
  getAccountForEnvironment,
  ensureStoreAsync,
  getStore,
  saveStoreAsync,
} from '@/lib/ebay/server-store';
import { reviseLiveEbayListing, addLiveEbayListing, endLiveEbayListing } from '@/lib/ebay/live-sync';
import { isEbayItemSpecific } from '@/lib/ebay/specifics-rules';
import { deduplicateImageUrls, updateDescriptionImages } from '@/lib/ebay/template-engine';

export const maxDuration = 120;

export async function GET(request: Request) {
  await ensureStoreAsync();
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId') || undefined;
  const listings = getListings(accountId);
  return NextResponse.json({ success: true, listings });
}

export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const data = await request.json();
    if (!data.title || data.price === undefined) {
      return NextResponse.json(
        { success: false, error: 'Title and Price are required' },
        { status: 400 }
      );
    }

    const targetAccountId = data.accountId || getActiveAccountId();
    let account = getAccountForEnvironment(targetAccountId);

    let ebayLiveStatus = 'LOCAL';
    let ebayMessage = '';
    let liveItemId: string | undefined = undefined;

    const shouldPublishToEbay = Boolean(data.publishToEbay);

    const cleanSpecifics: Record<string, string> = {};
    if (data.itemSpecifics) {
      for (const [k, v] of Object.entries(data.itemSpecifics)) {
        if (isEbayItemSpecific(k) && v !== undefined && v !== null && String(v).trim()) {
          cleanSpecifics[k] = String(v).trim();
        }
      }
    }

    const targetQty = !isNaN(parseInt(data.quantity)) ? parseInt(data.quantity) : 1;

    if (shouldPublishToEbay && account && account.accessToken) {
      const addResult = await addLiveEbayListing(account, {
        title: data.title,
        price: parseFloat(data.price),
        quantity: targetQty,
        sku: data.sku,
        description: data.description,
        categoryId: data.categoryId || '261975',
        conditionId: data.conditionId || '1000',
        conditionDescription: data.conditionDescription || data.sellerNotes,
        images: data.images,
        videoUrl: data.videoUrl,
        videoId: data.videoId,
        itemSpecifics: cleanSpecifics,
        shippingPolicyId: data.shippingPolicyId,
        shippingPolicyName: data.shippingPolicyName,
        returnPolicyId: data.returnPolicyId,
        returnPolicyName: data.returnPolicyName,
        paymentPolicyId: data.paymentPolicyId,
        paymentPolicyName: data.paymentPolicyName,
        locationCountry: data.locationCountry || account?.locationCountry,
        locationPostalCode: data.locationPostalCode || account?.locationPostalCode,
        locationCityState: data.locationCityState || account?.locationCityState,
      });

      console.log('addLiveEbayListing result:', addResult);
      if (addResult.success) {
        ebayLiveStatus = 'LIVE_CREATED';
        ebayMessage = addResult.message;
        liveItemId = addResult.itemId;
      } else {
        ebayLiveStatus = 'LIVE_FAILED';
        ebayMessage = addResult.message;
      }
    }

    const rawImages = Array.isArray(data.images) && data.images.length > 0 ? data.images : [];
    const images = deduplicateImageUrls(rawImages);
    const mainImageUrl = images[0] || data.imageUrl || 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500&auto=format&fit=crop&q=60';

    const created = createListing({
      accountId: targetAccountId,
      sku: data.sku || `SKU-${Date.now().toString().slice(-4)}`,
      title: data.title,
      price: parseFloat(data.price),
      currency: data.currency || account?.currency || 'USD',
      quantity: targetQty,
      category: data.category || '/Jewelry & Watches/Engagement & Wedding/Engagement Rings',
      condition: (data.conditionId === '1000' || data.conditionId === '1500' || data.conditionId === '1750') ? 'NEW' : 'USED',
      conditionId: data.conditionId || '1000',
      imageUrl: mainImageUrl,
      images: images.length > 0 ? images : [mainImageUrl],
      description: data.description || '',
      videoUrl: data.videoUrl || '',
      videoId: data.videoId || '',
      itemSpecifics: cleanSpecifics,
      sellerNotes: data.sellerNotes || data.conditionDescription || '',
      categoryId: data.categoryId || '261975',
      shippingPolicyId: data.shippingPolicyId,
      shippingPolicyName: data.shippingPolicyName,
      returnPolicyId: data.returnPolicyId,
      returnPolicyName: data.returnPolicyName,
      paymentPolicyId: data.paymentPolicyId,
      paymentPolicyName: data.paymentPolicyName,
      personalization: data.personalization || '',
      locationCountry: data.locationCountry || account?.locationCountry || 'US',
      locationPostalCode: data.locationPostalCode || account?.locationPostalCode || '',
      locationCityState: data.locationCityState || account?.locationCityState || '',
      status: shouldPublishToEbay ? (targetQty > 0 ? 'ACTIVE' : 'OUT_OF_STOCK') : 'DRAFT',
      ebayListingId: liveItemId,
      hasUnpublishedChanges: !shouldPublishToEbay || ebayLiveStatus !== 'LIVE_CREATED',
      lastSyncedWithEbayAt: ebayLiveStatus === 'LIVE_CREATED' ? new Date().toISOString() : undefined,
    });

    await saveStoreAsync(getStore());

    return NextResponse.json({
      success: true,
      listing: created,
      ebayLiveStatus,
      ebayMessage,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureStoreAsync();
    const body = await request.json();
    const { id, pushToEbay, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Listing ID is required' },
        { status: 400 }
      );
    }

    if (updates.price !== undefined) updates.price = parseFloat(updates.price);
    if (updates.quantity !== undefined) {
      updates.quantity = parseInt(updates.quantity);
      if (updates.quantity === 0) updates.status = 'OUT_OF_STOCK';
      else if (updates.quantity > 0 && updates.status === 'OUT_OF_STOCK') updates.status = 'ACTIVE';
    }
    if (updates.views !== undefined) updates.views = parseInt(updates.views) || 0;
    if (updates.watchers !== undefined) updates.watchers = parseInt(updates.watchers) || 0;

    if (updates.images && Array.isArray(updates.images)) {
      updates.images = deduplicateImageUrls(updates.images);
      if (updates.images.length > 0) {
        updates.imageUrl = updates.images[0];
      }
    }

    if (updates.itemSpecifics) {
      const cleanSpecifics: Record<string, string> = {};
      for (const [k, v] of Object.entries(updates.itemSpecifics)) {
        if (isEbayItemSpecific(k) && v !== undefined && v !== null && String(v).trim()) {
          cleanSpecifics[k] = String(v).trim();
        }
      }
      updates.itemSpecifics = cleanSpecifics;
    }

    const allListings = getListings();
    const existingListing = allListings.find((l) => l.id === id);
    if (!existingListing) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
    }

    // Auto-detect & update product gallery photos inside HTML description cleanly without altering layout, tables, or icons
    if (updates.images && Array.isArray(updates.images) && updates.images.length > 0) {
      const descToUpdate = updates.description || existingListing.description;
      if (descToUpdate) {
        updates.description = updateDescriptionImages(descToUpdate, updates.images, existingListing.images);
      }
    }

    // Push to eBay if explicitly requested OR if updating schedule time on an existing eBay listing
    const isScheduleChangeOnLiveItem = Boolean(existingListing.ebayListingId && updates.scheduledTime !== undefined);
    const shouldPushToEbay = Boolean(pushToEbay) || isScheduleChangeOnLiveItem;
    if (!shouldPushToEbay) {
      updates.hasUnpublishedChanges = true;
    }

    const initialUpdated = updateListing(id, updates);
    if (!initialUpdated) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
    }

    let currentListing: typeof initialUpdated = initialUpdated;
    let ebayLiveStatus = 'LOCAL';
    let ebayMessage = '';

    // Only revise on live eBay servers if user explicitly clicked "Update to Store" / "Push to eBay"
    if (shouldPushToEbay) {
      let account = getAccountForEnvironment(currentListing.accountId);

      console.log('Pushing listing to eBay live:', {
        listingId: currentListing.id,
        ebayListingId: currentListing.ebayListingId,
        account: account?.ebayUsername,
        hasToken: Boolean(account?.accessToken),
      });

      if (account && account.accessToken) {
        let isSuccess = false;
        let newEbayId = currentListing.ebayListingId;

        // If it already has an ebayListingId, try revising it
        if (currentListing.ebayListingId) {
          const store = getStore();
          const gApiKey = (store.masterConfig as any)?.googleDriveApiKey || process.env.GOOGLE_DRIVE_API_KEY;

          const oldVideoUrl = (existingListing.videoUrl || '').trim();
          const newVideoUrl = (updates.videoUrl || currentListing.videoUrl || '').trim();
          const isNewVideo = Boolean(newVideoUrl && newVideoUrl !== oldVideoUrl);
          // If video URL changed or if existingListing has no videoId, don't pass the stale videoId to reviseLiveEbayListing so it auto-uploads the new video!
          const targetReviseVideoId = isNewVideo && updates.videoId === existingListing.videoId
            ? undefined
            : (updates.videoId || (!isNewVideo ? currentListing.videoId : undefined));

          const reviseResult = await reviseLiveEbayListing(account, currentListing.ebayListingId, {
            title: currentListing.title,
            price: currentListing.price,
            quantity: currentListing.quantity,
            sku: currentListing.sku,
            description: currentListing.description,
            images: currentListing.images,
            itemSpecifics: currentListing.itemSpecifics,
            conditionDescription: currentListing.sellerNotes,
            categoryId: currentListing.categoryId,
            conditionId: currentListing.conditionId,
            videoId: targetReviseVideoId,
            videoUrl: newVideoUrl || currentListing.videoUrl,
            apiKey: gApiKey,
            shippingPolicyId: currentListing.shippingPolicyId,
            shippingPolicyName: currentListing.shippingPolicyName,
            returnPolicyId: currentListing.returnPolicyId,
            returnPolicyName: currentListing.returnPolicyName,
            paymentPolicyId: currentListing.paymentPolicyId,
            paymentPolicyName: currentListing.paymentPolicyName,
            scheduledTime: currentListing.scheduledTime,
            locationCountry: updates.locationCountry ? updates.locationCountry : undefined,
            locationPostalCode: updates.locationPostalCode ? updates.locationPostalCode : undefined,
            locationCityState: updates.locationCityState ? updates.locationCityState : undefined,
          });

          console.log('eBay reviseLiveEbayListing result:', reviseResult);

          if (reviseResult.success) {
            isSuccess = true;
            ebayLiveStatus = 'LIVE_UPDATED';
            ebayMessage = reviseResult.message;
            if (reviseResult.videoId && reviseResult.videoId !== currentListing.videoId) {
              currentListing.videoId = reviseResult.videoId;
              updateListing(id, { videoId: reviseResult.videoId });
            }
          } else if (reviseResult.message.includes('The scheduled time occurs in the past')) {
            // Item is already active on eBay (cannot set schedule time on an already active listing)
            const retryResult = await reviseLiveEbayListing(account, currentListing.ebayListingId, {
              title: currentListing.title,
              price: currentListing.price,
              quantity: currentListing.quantity,
              sku: currentListing.sku,
              description: currentListing.description,
              images: currentListing.images,
              itemSpecifics: currentListing.itemSpecifics,
              conditionDescription: currentListing.sellerNotes,
              categoryId: currentListing.categoryId,
              conditionId: currentListing.conditionId,
              videoId: targetReviseVideoId,
              videoUrl: newVideoUrl || currentListing.videoUrl,
              apiKey: gApiKey,
              shippingPolicyId: currentListing.shippingPolicyId,
              shippingPolicyName: currentListing.shippingPolicyName,
              returnPolicyId: currentListing.returnPolicyId,
              returnPolicyName: currentListing.returnPolicyName,
              paymentPolicyId: currentListing.paymentPolicyId,
              paymentPolicyName: currentListing.paymentPolicyName,
            });
            isSuccess = true;
            ebayLiveStatus = 'LIVE_UPDATED';
            ebayMessage = 'Listing is already live and active on eBay marketplace!';
            if (retryResult.videoId && retryResult.videoId !== currentListing.videoId) {
              currentListing.videoId = retryResult.videoId;
              updateListing(id, { videoId: retryResult.videoId });
            }
          } else if (
            reviseResult.message.includes('deleted') ||
            reviseResult.message.includes('not the seller') ||
            reviseResult.message.includes('Invalid item ID') ||
            reviseResult.message.includes('Item not found')
          ) {
            console.log('Listing not found on eBay live, creating via addLiveEbayListing...');
            const addResult = await addLiveEbayListing(account, {
              title: currentListing.title,
              price: currentListing.price,
              quantity: currentListing.quantity,
              sku: currentListing.sku,
              description: currentListing.description,
              categoryId: currentListing.categoryId || '261975',
              conditionId: currentListing.conditionId || '1000',
              conditionDescription: currentListing.sellerNotes,
              images: currentListing.images,
              videoUrl: currentListing.videoUrl,
              videoId: currentListing.videoId,
              itemSpecifics: currentListing.itemSpecifics,
              shippingPolicyId: currentListing.shippingPolicyId,
              shippingPolicyName: currentListing.shippingPolicyName,
              returnPolicyId: currentListing.returnPolicyId,
              returnPolicyName: currentListing.returnPolicyName,
              paymentPolicyId: currentListing.paymentPolicyId,
              paymentPolicyName: currentListing.paymentPolicyName,
              scheduledTime: currentListing.scheduledTime,
            });

            console.log('Fallback addLiveEbayListing result:', addResult);
            if (addResult.success) {
              isSuccess = true;
              newEbayId = addResult.itemId;
              ebayLiveStatus = 'LIVE_CREATED';
              ebayMessage = addResult.message;
            } else {
              ebayLiveStatus = 'LIVE_FAILED';
              ebayMessage = addResult.message;
            }
          } else {
            ebayLiveStatus = 'LIVE_FAILED';
            ebayMessage = reviseResult.message;
          }
        } else {
          // No ebayListingId yet, create live on eBay
          const addResult = await addLiveEbayListing(account, {
            title: currentListing.title,
            price: currentListing.price,
            quantity: currentListing.quantity,
            sku: currentListing.sku,
            description: currentListing.description,
            categoryId: currentListing.categoryId || '261975',
            conditionId: currentListing.conditionId || '1000',
            conditionDescription: currentListing.sellerNotes,
            images: currentListing.images,
            videoUrl: currentListing.videoUrl,
            videoId: currentListing.videoId,
            itemSpecifics: currentListing.itemSpecifics,
            shippingPolicyId: currentListing.shippingPolicyId,
            shippingPolicyName: currentListing.shippingPolicyName,
            returnPolicyId: currentListing.returnPolicyId,
            returnPolicyName: currentListing.returnPolicyName,
            paymentPolicyId: currentListing.paymentPolicyId,
            paymentPolicyName: currentListing.paymentPolicyName,
            scheduledTime: currentListing.scheduledTime,
            locationCountry: currentListing.locationCountry || account?.locationCountry,
            locationPostalCode: currentListing.locationPostalCode || account?.locationPostalCode,
            locationCityState: currentListing.locationCityState || account?.locationCityState,
          });

          console.log('Direct addLiveEbayListing result:', addResult);
          if (addResult.success) {
            isSuccess = true;
            newEbayId = addResult.itemId;
            ebayLiveStatus = 'LIVE_CREATED';
            ebayMessage = addResult.message;
          } else {
            ebayLiveStatus = 'LIVE_FAILED';
            ebayMessage = addResult.message;
          }
        }

        if (isSuccess) {
          const finalId = newEbayId || currentListing.ebayListingId;
          currentListing = updateListing(id, {
            ebayListingId: finalId,
            status: (currentListing.quantity !== undefined && currentListing.quantity !== null ? currentListing.quantity : 0) > 0 ? 'ACTIVE' : 'OUT_OF_STOCK',
            hasUnpublishedChanges: false,
            lastSyncedWithEbayAt: new Date().toISOString(),
          }) || currentListing;
        }
      } else {
        ebayLiveStatus = 'LIVE_FAILED';
        ebayMessage = 'No connected eBay account or valid token found to publish this listing.';
      }
    }

    await saveStoreAsync(getStore());

    return NextResponse.json({
      success: true,
      listing: currentListing,
      ebayLiveStatus,
      ebayMessage,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureStoreAsync();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all') === 'true';
    const endOnEbay = searchParams.get('endOnEbay') !== 'false';
    const accountId = searchParams.get('accountId') || getActiveAccountId();
    const accounts = getAccounts();
    const account = getAccountForEnvironment(accountId);

    if (all) {
      // User rule: Removal must ALWAYS be strictly scoped to the active store only
      const targetAccId = searchParams.get('accountId') || accountId;
      const targetAccount = accounts.find((a) => a.id === targetAccId) || account;
      
      const listingsToRemove = targetAccId
        ? getListings(targetAccId)
        : getListings(accountId);

      const endedResults: { itemId?: string; success: boolean; message: string }[] = [];

      if (endOnEbay) {
        for (const l of listingsToRemove) {
          if (l.ebayListingId) {
            const acc = accounts.find((a) => a.id === l.accountId) || targetAccount;
            if (acc) {
              const endRes = await endLiveEbayListing(acc, l.ebayListingId);
              endedResults.push({ itemId: l.ebayListingId, ...endRes });
            }
          }
        }
      }

      const clearedCount = clearAllListings(targetAccId || accountId);
      await saveStoreAsync(getStore());
      return NextResponse.json({
        success: true,
        clearedCount,
        endedOnEbayCount: endedResults.filter((r) => r.success).length,
        endedResults,
        message: `Successfully removed ${clearedCount} listings from store "${targetAccount?.storeName || targetAccount?.ebayUsername || 'Active Store'}"${endedResults.length > 0 ? ` and ended ${endedResults.filter(r => r.success).length} on live eBay` : ''}!`,
      });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID or all=true is required' }, { status: 400 });
    }

    const listing = getListings().find((l) => l.id === id);
    if (listing?.ebayListingId && endOnEbay && account) {
      await endLiveEbayListing(account, listing.ebayListingId);
    }

    const deleted = deleteListing(id);
    await saveStoreAsync(getStore());
    return NextResponse.json({ success: deleted });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
