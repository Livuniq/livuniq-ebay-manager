import { NextResponse } from 'next/server';
import { getOrders, fulfillOrder } from '@/lib/ebay/server-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId') || undefined;
  const orders = getOrders(accountId);
  return NextResponse.json({ success: true, orders });
}

export async function POST(request: Request) {
  try {
    const { orderId, trackingNumber, carrier } = await request.json();

    if (!orderId || !trackingNumber || !carrier) {
      return NextResponse.json(
        { success: false, error: 'orderId, trackingNumber, and carrier are required' },
        { status: 400 }
      );
    }

    const fulfilled = fulfillOrder(orderId, trackingNumber, carrier);
    if (!fulfilled) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order: fulfilled });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
