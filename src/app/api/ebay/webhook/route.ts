import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getStore,
  ensureStoreAsync,
  saveStoreAsync,
  getActiveAccountId,
} from '@/lib/ebay/server-store';
import { EbayMessageThread } from '@/lib/ebay/types';

// Helper to decode XML entities
function decodeXmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// SOAP OK response for eBay Platform Notifications
const SOAP_SUCCESS_RESPONSE = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <NotificationResponse xmlns="urn:ebay:apis:eBLBaseComponents">
      <Ack>Success</Ack>
    </NotificationResponse>
  </soapenv:Body>
</soapenv:Envelope>`;

// GET handler: handles eBay challenge validation / health check
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const challengeCode = searchParams.get('challenge_code');

    if (challengeCode) {
      // eBay Event Notification API challenge verification
      const store = await ensureStoreAsync();
      const verificationToken =
        process.env.EBAY_WEBHOOK_VERIFICATION_TOKEN ||
        store.masterConfig?.masterRuName ||
        'livuniq_webhook_secret_token_2026';
      const endpointUrl = 'https://livuniq-ebay-manager.vercel.app/api/ebay/webhook';

      const hash = crypto
        .createHash('sha256')
        .update(challengeCode + verificationToken + endpointUrl)
        .digest('hex');

      return NextResponse.json({ challengeResponse: hash }, { status: 200 });
    }

    // Health check ping
    return new NextResponse('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (err) {
    return new NextResponse('OK', { status: 200 });
  }
}

// HEAD handler: some systems test URL readiness via HEAD
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

// POST handler: receives real-time eBay Platform Notifications (push)
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // Check if empty ping
    if (!rawBody || !rawBody.trim()) {
      return new NextResponse(SOAP_SUCCESS_RESPONSE, {
        status: 200,
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      });
    }

    // Check if JSON challenge verification
    if (rawBody.trim().startsWith('{')) {
      try {
        const json = JSON.parse(rawBody);
        if (json.challengeCode) {
          const store = await ensureStoreAsync();
          const verificationToken =
            process.env.EBAY_WEBHOOK_VERIFICATION_TOKEN ||
            store.masterConfig?.masterRuName ||
            'livuniq_webhook_secret_token_2026';
          const endpointUrl = 'https://livuniq-ebay-manager.vercel.app/api/ebay/webhook';

          const hash = crypto
            .createHash('sha256')
            .update(json.challengeCode + verificationToken + endpointUrl)
            .digest('hex');

          return NextResponse.json({ challengeResponse: hash }, { status: 200 });
        }
      } catch {
        // Continue to XML parsing
      }
    }

    await ensureStoreAsync();
    const store = getStore();

    // Parse XML payload from eBay Platform Notifications
    const eventNameMatch = rawBody.match(/<NotificationEventName>([^<]+)<\/NotificationEventName>/i);
    const eventName = eventNameMatch ? eventNameMatch[1] : '';

    console.log(`[eBay Webhook] Received notification event: ${eventName || 'Unknown'}`);

    // We process AskSellerQuestion and MemberMessageExchange events
    const isMessageEvent =
      eventName === 'AskSellerQuestion' ||
      eventName === 'MemberMessageExchange' ||
      rawBody.includes('MemberMessageExchange') ||
      rawBody.includes('AskSellerQuestion') ||
      rawBody.includes('<Question>');

    if (isMessageEvent) {
      // Extract details
      const recipientMatch =
        rawBody.match(/<RecipientUserID>([^<]+)<\/RecipientUserID>/i) ||
        rawBody.match(/<SellerUserID>([^<]+)<\/SellerUserID>/i) ||
        rawBody.match(/<SellerID>([^<]+)<\/SellerID>/i);
      const recipientUsername = recipientMatch ? recipientMatch[1] : '';

      const itemIdMatch = rawBody.match(/<ItemID>([^<]+)<\/ItemID>/i);
      const itemId = itemIdMatch ? itemIdMatch[1] : '';

      const itemTitleMatch = rawBody.match(/<Title>([^<]+)<\/Title>/i);
      const itemTitle = itemTitleMatch ? decodeXmlEntities(itemTitleMatch[1]) : '';

      const senderIdMatch =
        rawBody.match(/<SenderID>([^<]+)<\/SenderID>/i) ||
        rawBody.match(/<Sender>([^<]+)<\/Sender>/i) ||
        rawBody.match(/<BuyerUserID>([^<]+)<\/BuyerUserID>/i);
      const senderId = senderIdMatch ? senderIdMatch[1] : 'buyer';

      const subjectMatch = rawBody.match(/<Subject>([\s\S]*?)<\/Subject>/i);
      const subject = subjectMatch ? decodeXmlEntities(subjectMatch[1]) : 'Inquiry regarding listing';

      const bodyMatch = rawBody.match(/<Body>([\s\S]*?)<\/Body>/i) || rawBody.match(/<Text>([\s\S]*?)<\/Text>/i);
      const messageBody = bodyMatch ? decodeXmlEntities(bodyMatch[1]) : '';

      const messageIdMatch = rawBody.match(/<MessageID>([^<]+)<\/MessageID>/i);
      const messageId = messageIdMatch ? messageIdMatch[1] : `${Date.now()}`;

      // Find target store account
      let targetAccount = store.accounts.find(
        (a) =>
          a.ebayUsername.toLowerCase() === recipientUsername.toLowerCase() ||
          (recipientUsername && a.storeName.toLowerCase().includes(recipientUsername.toLowerCase()))
      );

      if (!targetAccount) {
        const activeId = getActiveAccountId();
        targetAccount = store.accounts.find((a) => a.id === activeId) || store.accounts[0];
      }

      if (targetAccount && messageBody) {
        const thrId = `thr-ebay-${targetAccount.id}-${senderId.toLowerCase()}${itemId ? `-${itemId}` : ''}`;

        // Verify if thread is in deletedThreadIds
        if (!targetAccount.deletedThreadIds?.includes(thrId)) {
          const existingThread = store.threads.find((t) => t.id === thrId);

          const newMsg = {
            id: `msg-${messageId}`,
            sender: senderId,
            senderRole: 'BUYER' as const,
            timestamp: new Date().toISOString(),
            body: messageBody,
          };

          if (existingThread) {
            const isDup = existingThread.messages.some((m) => m.id === newMsg.id || m.body === newMsg.body);
            if (!isDup) {
              existingThread.messages.push(newMsg);
              existingThread.lastMessageSnippet = messageBody.slice(0, 120);
              existingThread.lastUpdated = newMsg.timestamp;
              existingThread.unread = true;
            }
          } else {
            const cleanSubject = subject.replace(/^(?:re|fwd):\s*/i, '').trim();
            const newThread: EbayMessageThread = {
              id: thrId,
              accountId: targetAccount.id,
              buyerUsername: senderId,
              buyerName: senderId,
              itemTitle: itemTitle || (itemId ? `Listing #${itemId}` : undefined),
              listingId: itemId ? `lst-${itemId}` : undefined,
              subject: cleanSubject || subject,
              lastMessageSnippet: messageBody.slice(0, 120),
              lastUpdated: new Date().toISOString(),
              unread: true,
              messages: [newMsg],
            };
            store.threads.unshift(newThread);
          }

          await saveStoreAsync(store);
          console.log(`[eBay Webhook] Real-time message successfully saved for store: ${targetAccount.ebayUsername}`);
        }
      }
    }

    // Always respond with 200 OK so eBay knows the notification was successfully delivered
    return new NextResponse(SOAP_SUCCESS_RESPONSE, {
      status: 200,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    });
  } catch (err) {
    console.error('[eBay Webhook] Error processing incoming notification:', err);
    // Still return 200 to prevent eBay from deactivating the webhook
    return new NextResponse(SOAP_SUCCESS_RESPONSE, {
      status: 200,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    });
  }
}
