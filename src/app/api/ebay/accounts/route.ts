import { NextResponse } from 'next/server';
import {
  getAccounts,
  getActiveAccountId,
  setActiveAccountId,
  connectNewAccount,
  disconnectAccount,
  ensureStoreAsync,
  getStore,
  saveStoreAsync,
} from '@/lib/ebay/server-store';

export async function GET() {
  await ensureStoreAsync();
  const accounts = getAccounts();
  const activeAccountId = getActiveAccountId();
  return NextResponse.json({
    success: true,
    accounts,
    activeAccountId,
  });
}

export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const body = await request.json();

    // Action 1: Switch active account
    if (body.action === 'switch') {
      const activeId = setActiveAccountId(body.accountId);
      return NextResponse.json({ success: true, activeAccountId: activeId });
    }

    // Action 2: 1-Click Connect new account
    if (body.action === 'connect') {
      if (!body.ebayUsername) {
        return NextResponse.json(
          { success: false, error: 'eBay Username is required' },
          { status: 400 }
        );
      }

      const newAcc = connectNewAccount({
        ebayUsername: body.ebayUsername.trim(),
        storeName: body.storeName,
        marketplace: body.marketplace,
      });

      return NextResponse.json({
        success: true,
        account: newAcc,
        message: `Successfully connected ${newAcc.ebayUsername} via eBay OAuth 2.0!`,
      });
    }

    // Action 3: Rename store display name or update username
    if (body.action === 'rename' || body.action === 'update') {
      const store = getStore();
      const target = store.accounts.find((a) => a.id === body.accountId);
      if (target) {
        if (body.storeName) target.storeName = body.storeName.trim();
        if (body.ebayUsername) target.ebayUsername = body.ebayUsername.trim();
        await saveStoreAsync(store);
        return NextResponse.json({ success: true, account: target });
      }
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
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
    const accountId = searchParams.get('id');
    if (!accountId) {
      return NextResponse.json({ success: false, error: 'Account ID required' }, { status: 400 });
    }

    disconnectAccount(accountId);
    return NextResponse.json({ success: true, accounts: getAccounts(), activeAccountId: getActiveAccountId() });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
