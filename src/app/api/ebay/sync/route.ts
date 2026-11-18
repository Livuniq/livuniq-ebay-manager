import { NextResponse } from 'next/server';
import { getStore, getActiveAccountId, ensureStoreAsync } from '@/lib/ebay/server-store';
import { syncLiveEbayData } from '@/lib/ebay/live-sync';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const body = await request.json().catch(() => ({}));
    const store = getStore();
    const accountId = body.accountId || getActiveAccountId();
    const account = store.accounts.find((a) => a.id === accountId);

    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    // If account has real eBay access token, pull live data from eBay API
    if (account.accessToken) {
      const liveResult = await syncLiveEbayData(account);
      return NextResponse.json({
        success: true,
        mode: 'LIVE',
        message: `Successfully synced live eBay catalog & messages for ${account.ebayUsername}!`,
        syncedListings: liveResult.syncedListings,
        syncedOrders: liveResult.syncedOrders,
        syncedMessages: liveResult.syncedMessages || 0,
        timestamp: account.lastSyncedAt,
      });
    }

    // If no access token yet, refresh catalog from current store state
    account.lastSyncedAt = new Date().toISOString();
    const currentListings = store.listings.filter((l) => l.accountId === account.id);
    const currentOrders = store.orders.filter((o) => o.accountId === account.id);
    const currentThreads = store.threads.filter((t) => t.accountId === account.id);

    return NextResponse.json({
      success: true,
      mode: 'SYNCHRONIZED',
      message: `Store ${account.storeName} catalog & orders synchronized!`,
      syncedListings: currentListings.length,
      syncedOrders: currentOrders.length,
      syncedMessages: currentThreads.length,
      timestamp: account.lastSyncedAt,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
