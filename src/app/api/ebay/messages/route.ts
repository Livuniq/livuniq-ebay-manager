import { NextResponse } from 'next/server';
import { getMessageThreads, sendReply, markThreadAsRead, getStore, saveStore, getActiveAccountId } from '@/lib/ebay/server-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId') || undefined;
  const threads = getMessageThreads(accountId);
  return NextResponse.json({ success: true, threads });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Simulate an incoming test buyer inquiry
    if (body.action === 'simulate') {
      const store = getStore();
      const targetAccountId = body.accountId || getActiveAccountId();
      const account = store.accounts.find((a) => a.id === targetAccountId) || store.accounts[0];

      const sampleQueries = [
        {
          buyerUsername: 'sarah_diamonds',
          buyerName: 'Sarah Jenkins',
          itemTitle: '2.50 ct MARQUISE Lab Grown Diamond Engagement Ring',
          subject: 'Custom ring sizing inquiry (US Size 6.5)',
          message: 'Hi seller! I love this 2.50 ct Marquise ring. Before purchasing, can you confirm if it can be customized to US size 6.5? How long will dispatch take?'
        },
        {
          buyerUsername: 'alex_luxury_gems',
          buyerName: 'Alex Thorne',
          itemTitle: '1.00 ct ROUND Lab Grown Diamond Engagement Ring',
          subject: 'IGI certificate report & gift packaging',
          message: 'Hello, does this ring come with the original physical IGI grading certificate card? Also is luxury presentation packaging included?'
        },
        {
          buyerUsername: 'michael_collector',
          buyerName: 'Michael Rossi',
          itemTitle: '2.75 ct MARQUISE Lab Grown Diamond Ring',
          subject: 'Expedited FedEx Express Delivery',
          message: 'Hi there! I am planning a proposal for next weekend. Do you offer expedited 2-day FedEx shipping with full insurance?'
        },
        {
          buyerUsername: 'jessica_rings99',
          buyerName: 'Jessica Taylor',
          itemTitle: '2.57 ct MARQUISE Diamond Solitaire Ring 14k White Gold',
          subject: 'Band thickness and engraving service',
          message: 'Hello! What is the width of the band? Also, do you offer complimentary custom inside band engraving (e.g. date & initials)?'
        }
      ];

      const chosen = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];
      const userListings = store.listings.filter((l) => l.accountId === targetAccountId || !targetAccountId);
      const matchedListing = userListings.length > 0 ? userListings[Math.floor(Math.random() * userListings.length)] : null;

      const newThreadId = `thr-${Date.now()}`;
      const newThread = {
        id: newThreadId,
        accountId: account?.id || targetAccountId,
        buyerUsername: chosen.buyerUsername,
        buyerName: chosen.buyerName,
        itemTitle: matchedListing ? matchedListing.title : chosen.itemTitle,
        listingId: matchedListing ? matchedListing.id : undefined,
        subject: chosen.subject,
        lastMessageSnippet: chosen.message,
        lastUpdated: new Date().toISOString(),
        unread: true,
        messages: [
          {
            id: `msg-${Date.now()}`,
            sender: chosen.buyerUsername,
            senderRole: 'BUYER' as const,
            timestamp: new Date().toISOString(),
            body: chosen.message,
          },
        ],
      };

      store.threads.unshift(newThread);
      saveStore(store);

      return NextResponse.json({ success: true, thread: newThread });
    }

    // 2. Standard reply sending
    const { threadId, reply } = body;
    if (!threadId || !reply?.trim()) {
      return NextResponse.json(
        { success: false, error: 'threadId and reply text are required' },
        { status: 400 }
      );
    }

    const updated = sendReply(threadId, reply);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Thread not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, thread: updated });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { threadId } = await request.json();
    if (!threadId) {
      return NextResponse.json({ success: false, error: 'threadId is required' }, { status: 400 });
    }

    const marked = markThreadAsRead(threadId);
    return NextResponse.json({ success: marked });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
