import { NextResponse } from 'next/server';
import { getStore, getActiveAccountId, ensureStoreAsync, saveStoreAsync, getAccountForEnvironment } from '@/lib/ebay/server-store';
import { ensureFreshAccessToken, isAccountSandbox } from '@/lib/ebay/live-sync';

export interface EbayBusinessPolicyItem {
  id: string;
  name: string;
  type: 'SHIPPING' | 'RETURN' | 'PAYMENT';
  description?: string;
  isDefault?: boolean;
}

export async function GET(request: Request) {
  try {
    await ensureStoreAsync();
    const { searchParams } = new URL(request.url);
    const store = getStore();
    const accountId = searchParams.get('accountId') || getActiveAccountId();
    const account = getAccountForEnvironment(accountId);

    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    const masterConfig = store.masterConfig;
    const isSandbox = isAccountSandbox(account, masterConfig);
    const apiHost = isSandbox
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';

    let shippingPolicies: EbayBusinessPolicyItem[] = [];
    let returnPolicies: EbayBusinessPolicyItem[] = [];
    let paymentPolicies: EbayBusinessPolicyItem[] = [];

    if (account.accessToken) {
      const accessToken = (await ensureFreshAccessToken(account)) || account.accessToken;
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const marketplaceId = account.marketplace || 'EBAY_US';

      // 1. Fulfillment (Shipping) Policies
      try {
        const res = await fetch(`${apiHost}/sell/account/v1/fulfillment_policy?marketplace_id=${marketplaceId}`, { headers });
        const data = await res.json();
        if (data.fulfillmentPolicies && Array.isArray(data.fulfillmentPolicies)) {
          shippingPolicies = data.fulfillmentPolicies.map((p: any) => ({
            id: p.fulfillmentPolicyId,
            name: p.name,
            type: 'SHIPPING',
            description: p.description || p.name,
          }));
        }
      } catch (err) {
        console.error('Error fetching shipping policies:', err);
      }

      // 2. Return Policies
      try {
        const res = await fetch(`${apiHost}/sell/account/v1/return_policy?marketplace_id=${marketplaceId}`, { headers });
        const data = await res.json();
        if (data.returnPolicies && Array.isArray(data.returnPolicies)) {
          returnPolicies = data.returnPolicies.map((p: any) => ({
            id: p.returnPolicyId,
            name: p.name,
            type: 'RETURN',
            description: p.description || p.name,
          }));
        }
      } catch (err) {
        console.error('Error fetching return policies:', err);
      }

      // 3. Payment Policies
      try {
        const res = await fetch(`${apiHost}/sell/account/v1/payment_policy?marketplace_id=${marketplaceId}`, { headers });
        const data = await res.json();
        if (data.paymentPolicies && Array.isArray(data.paymentPolicies)) {
          paymentPolicies = data.paymentPolicies.map((p: any) => ({
            id: p.paymentPolicyId,
            name: p.name,
            type: 'PAYMENT',
            description: p.description || p.name,
          }));
        }
      } catch (err) {
        console.error('Error fetching payment policies:', err);
      }
    }

    return NextResponse.json({
      success: true,
      shippingPolicies,
      returnPolicies,
      paymentPolicies,
      defaults: {
        shippingPolicyId: account.shippingPolicyId || (shippingPolicies[0]?.id ?? ''),
        shippingPolicyName: account.shippingPolicyName || (shippingPolicies[0]?.name ?? ''),
        returnPolicyId: account.returnPolicyId || (returnPolicies[0]?.id ?? ''),
        returnPolicyName: account.returnPolicyName || (returnPolicies[0]?.name ?? ''),
        paymentPolicyId: account.paymentPolicyId || (paymentPolicies[0]?.id ?? ''),
        paymentPolicyName: account.paymentPolicyName || (paymentPolicies[0]?.name ?? ''),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

// Update default store policies
export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const body = await request.json();
    const store = getStore();
    const accountId = body.accountId || getActiveAccountId();
    const targetAccount = store.accounts.find((a) => a.id === accountId);

    if (!targetAccount) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    if (body.shippingPolicyId !== undefined) targetAccount.shippingPolicyId = body.shippingPolicyId;
    if (body.shippingPolicyName !== undefined) targetAccount.shippingPolicyName = body.shippingPolicyName;
    if (body.returnPolicyId !== undefined) targetAccount.returnPolicyId = body.returnPolicyId;
    if (body.returnPolicyName !== undefined) targetAccount.returnPolicyName = body.returnPolicyName;
    if (body.paymentPolicyId !== undefined) targetAccount.paymentPolicyId = body.paymentPolicyId;
    if (body.paymentPolicyName !== undefined) targetAccount.paymentPolicyName = body.paymentPolicyName;

    await saveStoreAsync(store);

    return NextResponse.json({
      success: true,
      account: targetAccount,
      message: 'Store default policies updated successfully!',
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
