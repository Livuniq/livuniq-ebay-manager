import { NextResponse } from 'next/server';
import {
  getAccounts,
  getActiveAccountId,
  setActiveAccountId,
  connectNewAccount,
  disconnectAccount,
  ensureStoreAsync,
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
