import { EbayListing, EbayMessage } from './types';

export interface GenerateAiReplyParams {
  geminiApiKey: string;
  storeName?: string;
  buyerName?: string;
  buyerUsername: string;
  incomingMessage: string;
  chatHistory?: EbayMessage[];
  listing?: EbayListing | null;
  customInstructions?: string;
}

export async function generateAiCustomerReply(params: GenerateAiReplyParams): Promise<string | null> {
  const {
    geminiApiKey,
    storeName = 'Livuniq',
    buyerName,
    buyerUsername,
    incomingMessage,
    chatHistory = [],
    listing,
    customInstructions,
  } = params;

  if (!geminiApiKey || !geminiApiKey.trim()) {
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey.trim()}`;

  // Build listing specifics summary if available
  let listingContext = '';
  if (listing) {
    listingContext = `
PRODUCT DETAILS (The buyer is inquiring about this item):
- Title: ${listing.title}
- Price: $${listing.price !== undefined ? listing.price.toFixed(2) : 'N/A'}
- SKU: ${listing.sku || 'N/A'}
- Condition: ${listing.condition || 'Brand New with tags'}
${listing.itemSpecifics ? '- Specifications: ' + JSON.stringify(listing.itemSpecifics) : ''}
`;
  }

  // Build prior chat history summary
  let conversationHistory = '';
  if (chatHistory.length > 0) {
    conversationHistory = `
PRIOR CONVERSATION HISTORY (chronological):
${chatHistory.map((m) => `${m.senderRole === 'BUYER' ? buyerUsername : storeName}: ${m.body}`).join('\n')}
`;
  }

  const defaultStorePolicy = `
STORE POLICIES & KNOWLEDGE BASE:
- Complimentary physical IGI Grading Certificate Card included with all diamond purchases.
- Complimentary custom ring sizing available upon request (US Sizes 4 through 10, including half sizes).
- Standard handling & dispatch time: 8-10 business days (each piece is handcrafted with precision).
- Insured and tracked delivery via expedited carrier with signature confirmation.
- 30-Day Hassle-Free Return & Exchange Policy.
`;

  const systemPrompt = `You are a professional, courteous, and knowledgeable luxury jewelry customer care specialist for "${storeName}" on eBay.
Your role is to answer eBay buyer inquiries accurately, politely, and warmly.

${listingContext}
${defaultStorePolicy}
${customInstructions ? 'CUSTOM SELLER INSTRUCTIONS:\n' + customInstructions + '\n' : ''}
${conversationHistory}

LATEST BUYER INQUIRY:
From: ${buyerName || buyerUsername} (${buyerUsername})
Message: "${incomingMessage}"

CRITICAL RULES:
1. Address the buyer warmly (e.g. "Dear ${buyerName || buyerUsername}," or "Hello ${buyerName || buyerUsername},").
2. Answer their question directly using the product details and store policies above.
3. PRICE & OFFERS: Do NOT accept below-asking price discounts or promise unauthorized deals. If they ask for a discount, politely state that our prices reflect direct-from-workshop value, but customer management will be notified of their inquiry.
4. CUSTOM SIZING / MODIFICATIONS: Confidently confirm that custom sizes (US 4 to 10) or gold colors (Yellow/White/Rose Gold) can be handcrafted upon order placement.
5. CONCISENESS: Keep the response natural, warm, and concise (2 to 4 sentences). Avoid fluff, robotic phrasing, or overly repetitive greetings.
6. CLOSING: Conclude warmly with:
Warm regards,
${storeName} Customer Care Team

Reply with ONLY the response text to be sent to the buyer. Do not include markdown code fences, JSON, or meta commentary.`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: systemPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 350,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Gemini AI] API Error:', res.status, errText);
      return null;
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText || typeof candidateText !== 'string') {
      return null;
    }

    return candidateText.trim();
  } catch (err) {
    console.error('[Gemini AI] Generation failed:', err);
    return null;
  }
}
