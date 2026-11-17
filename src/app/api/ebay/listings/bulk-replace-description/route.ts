import { NextResponse } from 'next/server';
import {
  bulkReplaceListingDescription,
  getActiveAccountId,
  getAccounts,
  getStore,
  ensureStoreAsync,
} from '@/lib/ebay/server-store';
import { reviseLiveEbayListing } from '@/lib/ebay/live-sync';

export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const body = await request.json();
    const { fromText, toText = '', accountId, listingIds, caseSensitive = false, dryRun = false, pushToEbay = false } = body;

    if (!fromText || typeof fromText !== 'string' || !fromText.trim()) {
      return NextResponse.json(
        { success: false, error: '"From" search text is required.' },
        { status: 400 }
      );
    }

    const targetAccountId = accountId || getActiveAccountId();
    const result = bulkReplaceListingDescription({
      accountId: targetAccountId,
      fromText,
      toText,
      listingIds,
      caseSensitive,
      dryRun,
    });

    let pushedCount = 0;
    const pushErrors: { sku: string; error: string }[] = [];

    // If requested and not dry run, sync modified descriptions directly to live eBay
    if (pushToEbay && !dryRun && result.updatedCount > 0) {
      const accounts = getAccounts();
      const account = accounts.find((a) => a.id === targetAccountId);
      if (account && account.accessToken) {
        const store = getStore();
        for (const item of result.updatedListings) {
          const fullListing = store.listings.find((l) => l.id === item.id);
          if (fullListing && fullListing.ebayListingId) {
            try {
              const reviseRes = await reviseLiveEbayListing(account, fullListing.id, {
                description: fullListing.description,
              });
              if (reviseRes.success) {
                pushedCount++;
              } else {
                pushErrors.push({ sku: fullListing.sku, error: reviseRes.message });
              }
            } catch (pErr) {
              pushErrors.push({ sku: fullListing.sku, error: (pErr as Error).message });
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      matchedCount: result.matchedCount,
      updatedCount: result.updatedCount,
      totalChecked: result.totalChecked,
      updatedListings: result.updatedListings,
      pushedCount,
      pushErrors,
      message: dryRun
        ? `Found in ${result.matchedCount} of ${result.totalChecked} listings.`
        : `Successfully replaced text in ${result.updatedCount} listing${result.updatedCount === 1 ? '' : 's'}!${
            pushedCount > 0 ? ` (${pushedCount} pushed to live eBay)` : ''
          }`,
    });
  } catch (err) {
    console.error('Error in bulk-replace-description API:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
