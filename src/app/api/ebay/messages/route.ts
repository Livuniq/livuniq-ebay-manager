import { NextResponse } from 'next/server';
import { getMessageThreads, sendReply, markThreadAsRead } from '@/lib/ebay/server-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId') || undefined;
  const threads = getMessageThreads(accountId);
  return NextResponse.json({ success: true, threads });
}

export async function POST(request: Request) {
  try {
    const { threadId, reply } = await request.json();
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
