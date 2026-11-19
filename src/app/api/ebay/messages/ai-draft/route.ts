import { NextResponse } from 'next/server';
import { getStore, ensureStoreAsync, getAccountForEnvironment, getActiveAccountId } from '@/lib/ebay/server-store';
import { generateAiCustomerReply } from '@/lib/ebay/gemini-ai';

export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const store = getStore();
    const body = await request.json().catch(() => ({}));

    const threadId = body.threadId;
    const accountId = body.accountId || getActiveAccountId();

    if (!threadId) {
      return NextResponse.json({ success: false, error: 'threadId is required' }, { status: 400 });
    }

    const thread = store.threads.find((t) => t.id === threadId);
    if (!thread) {
      return NextResponse.json({ success: false, error: 'Thread not found' }, { status: 404 });
    }

    const geminiKey = store.masterConfig?.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({
        success: false,
        error: 'Google Gemini API Key set nahi hai. Kripya Settings tab me Gemini API Key dalein.',
      });
    }

    const account =
      store.accounts.find((a) => a.id === thread.accountId) ||
      (accountId ? store.accounts.find((a) => a.id === accountId) : null) ||
      getAccountForEnvironment(accountId);
    const storeName = account?.storeName || account?.ebayUsername || 'Livuniq';

    // Find matched listing for product specifics
    const matchedListing =
      store.listings.find((l) => l.id === thread.listingId) ||
      store.listings.find((l) => l.ebayListingId === thread.listingId) ||
      store.listings.find((l) => l.title?.toLowerCase().includes(thread.itemTitle?.toLowerCase() || '---')) ||
      null;

    const lastBuyerMsg = [...(thread.messages || [])].reverse().find((m) => m.senderRole === 'BUYER');
    const incomingText = lastBuyerMsg?.body || thread.lastMessageSnippet || thread.subject;

    const reply = await generateAiCustomerReply({
      geminiApiKey: geminiKey,
      storeName,
      buyerName: thread.buyerName,
      buyerUsername: thread.buyerUsername,
      incomingMessage: incomingText,
      chatHistory: thread.messages || [],
      listing: matchedListing,
      customInstructions: store.masterConfig?.aiCustomInstructions,
    });

    if (!reply) {
      return NextResponse.json({
        success: false,
        error: 'Gemini AI reply generate nahi kar paya. Kripya check karein ki API key active hai ya nahi.',
      });
    }

    return NextResponse.json({ success: true, reply });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal error generating AI reply' }, { status: 500 });
  }
}
