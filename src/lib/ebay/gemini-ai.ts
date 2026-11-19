import { EbayListing, EbayMessage } from './types';

export interface WorkingGeminiModel {
  apiVersion: 'v1beta' | 'v1';
  modelName: string;
  endpoint: string;
  displayName?: string;
}

// In-memory cache of working models per API key
const modelCache = new Map<string, WorkingGeminiModel>();

/**
 * Automatically discovers and tests the best working Gemini model for the provided API key.
 * Tries ListModels first across v1beta and v1, then falls back to candidate list.
 */
export async function resolveWorkingGeminiEndpoint(apiKey: string): Promise<{
  success: boolean;
  model?: WorkingGeminiModel;
  availableModels?: string[];
  error?: string;
  rawError?: string;
}> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { success: false, error: 'Gemini API key is required' };
  }

  // Check cache first
  const cached = modelCache.get(cleanKey);
  if (cached) {
    return { success: true, model: cached };
  }

  const versions: Array<'v1beta' | 'v1'> = ['v1beta', 'v1'];
  const discoveredModels: Array<{ version: 'v1beta' | 'v1'; name: string; displayName?: string }> = [];
  let listError: string | null = null;

  // 1. Discover models via ListModels
  for (const ver of versions) {
    try {
      const listUrl = `https://generativelanguage.googleapis.com/${ver}/models?key=${encodeURIComponent(cleanKey)}`;
      const res = await fetch(listUrl, { method: 'GET' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const models = (data.models || [])
          .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map((m: any) => ({
            version: ver,
            name: (m.name || '').replace(/^models\//, ''),
            displayName: m.displayName || m.name,
          }));
        discoveredModels.push(...models);
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error?.message) {
          listError = errJson.error.message;
        }
      }
    } catch (e: any) {
      listError = e.message;
    }
  }

  // Preference ranking: fast flash-lite / flash models > latest > pro > general
  const priorityList = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-pro-latest',
    'gemini-pro',
  ];

  let candidates: Array<{ version: 'v1beta' | 'v1'; modelName: string; displayName?: string }> = [];

  if (discoveredModels.length > 0) {
    // Sort discovered models by priority
    const sorted = [...discoveredModels].sort((a, b) => {
      const idxA = priorityList.findIndex((p) => a.name.toLowerCase().includes(p.toLowerCase()));
      const idxB = priorityList.findIndex((p) => b.name.toLowerCase().includes(p.toLowerCase()));
      const scoreA = idxA >= 0 ? idxA : 999;
      const scoreB = idxB >= 0 ? idxB : 999;
      return scoreA - scoreB;
    });
    candidates = sorted.map((m) => ({
      version: m.version,
      modelName: m.name,
      displayName: m.displayName,
    }));
  } else {
    // Fallback static candidate list if ListModels didn't return anything
    for (const p of priorityList) {
      candidates.push({ version: 'v1beta', modelName: p });
      candidates.push({ version: 'v1', modelName: p });
    }
  }

  // 2. Test candidates with a minimal ping
  let lastError = listError || 'No supported Gemini models found';
  for (const cand of candidates) {
    const testEndpoint = `https://generativelanguage.googleapis.com/${cand.version}/models/${cand.modelName}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    try {
      const res = await fetch(testEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });

      if (res.ok) {
        const working: WorkingGeminiModel = {
          apiVersion: cand.version,
          modelName: cand.modelName,
          endpoint: testEndpoint,
          displayName: cand.displayName || cand.modelName,
        };
        modelCache.set(cleanKey, working);
        return {
          success: true,
          model: working,
          availableModels: discoveredModels.map((m) => `${m.name} (${m.version})`),
        };
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error?.message) {
          lastError = errJson.error.message;
        }
      }
    } catch (e: any) {
      lastError = e.message;
    }
  }

  return {
    success: false,
    error: lastError,
    rawError: lastError,
    availableModels: discoveredModels.map((m) => `${m.name} (${m.version})`),
  };
}

function extractHumanFirstName(name?: string, username?: string): string {
  if (name && name.trim()) {
    const clean = name.trim().replace(/^(mr|mrs|ms|dr)\.?\s+/i, '');
    const first = clean.split(/\s+/)[0];
    if (first && first.length > 1 && !first.includes('_') && !first.includes('.')) {
      return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }
  }
  if (username && username.trim()) {
    const cleanUser = username.trim().replace(/[0-9]+/g, '');
    const firstPart = cleanUser.split(/[_\.]/)[0];
    if (firstPart && firstPart.length > 2) {
      return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
    }
  }
  return 'there';
}

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

  // Resolve working model and endpoint
  const resolution = await resolveWorkingGeminiEndpoint(geminiApiKey);
  if (!resolution.success || !resolution.model) {
    console.error('[Gemini AI] Could not resolve working model:', resolution.error);
    return null;
  }

  const endpoint = resolution.model.endpoint;

  // Build listing specifics summary if available
  let listingContext = '';
  if (listing) {
    let specsFormatted = '';
    if (listing.itemSpecifics && typeof listing.itemSpecifics === 'object') {
      specsFormatted = Object.entries(listing.itemSpecifics)
        .map(([k, v]) => `  • ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n');
    }

    listingContext = `
PRODUCT DETAILS (Buyer is asking about this specific eBay listing):
- Title: ${listing.title}
- Price: $${listing.price !== undefined ? listing.price.toFixed(2) : 'N/A'}
- SKU: ${listing.sku || 'N/A'}
- Condition: ${listing.condition || 'Brand New with tags'}
${specsFormatted ? 'ITEM SPECIFICATIONS (Use these exact specs to answer technical questions):\n' + specsFormatted : ''}
`;
  }

  // Build prior chat history summary
  let conversationHistory = '';
  if (chatHistory.length > 0) {
    conversationHistory = `
PRIOR CONVERSATION HISTORY (Context from previous messages):
${chatHistory.map((m) => `${m.senderRole === 'BUYER' ? buyerUsername : storeName}: ${m.body}`).join('\n')}
`;
  }

  const defaultStorePolicy = `
STORE POLICIES & KNOWLEDGE BASE:
- Physical IGI Grading Certificate Card included with all diamond purchases.
- Complimentary custom ring sizing available on request (US Sizes 4 through 10, including half & quarter sizes).
- Standard handling & craft time: 8-10 business days (handcrafted to perfection).
- Tracked insured priority shipping with signature confirmation.
- 30-Day Hassle-Free Returns & Money-Back Guarantee.
`;

  const cleanFirstName = extractHumanFirstName(buyerName, buyerUsername);
  const friendlyGreeting = cleanFirstName !== 'there' ? `Hi ${cleanFirstName}!` : 'Hi there!';

  const systemPrompt = `You are a real, friendly human jewelry specialist working at the studio bench of "${storeName}" on eBay. You are answering direct eBay messages from American (US) shoppers.

CRITICAL DIRECTIVE — SOUND 100% HUMAN & CONVERSATIONAL (NEVER SOUND LIKE A ROBOT OR CORPORATE AI):
1. AMERICAN CONVERSATIONAL TONE: Write in warm, relaxed, confident, and natural everyday American English.
2. USE CONTRACTIONS: Always use natural contractions like "we'd love to", "it's", "you'll get", "we're", "can't wait". Real Americans never speak without contractions.
3. BE DIRECT: Answer their core question in the very first sentence. American buyers appreciate fast, clear, direct answers without beating around the bush.
4. FORBIDDEN ROBOTIC CLICHÉS (STRICTLY BANNED):
   - NEVER say: "Dear Sir/Madam", "Dear [Full Name]", "Respected customer"
   - NEVER say: "I would be delighted to inform you" -> say: "Yes, absolutely! We can definitely do that."
   - NEVER say: "Please rest assured" or "as per our store policy"
   - NEVER say: "exquisite piece", "pleased to assist", "do not hesitate to reach out"
   - NEVER sound like a stiff British butler or a corporate legal department.
5. SHORT & SWEET: Keep your message punchy (2 to 3 natural sentences max).
6. GREETING: Open with: "${friendlyGreeting}"
7. SIGN-OFF: End casually and cleanly like a real American boutique studio:
   Best,
   ${storeName} Team

${listingContext}
${defaultStorePolicy}
${customInstructions ? 'SELLER\'S CUSTOM TRAINING & STORE RULES:\n' + customInstructions + '\n' : ''}
${conversationHistory}

LATEST INCOMING BUYER MESSAGE:
From: ${cleanFirstName} (@${buyerUsername})
Message: "${incomingMessage}"

HOW A REAL JEWELER RESPONDS:
- Ring Size / Custom Sizing: "${friendlyGreeting} Yes, absolutely—we can custom craft this in a size [size] for you at no extra charge. Just leave a note with your size in the checkout notes, and our bench jewelers will handcraft it for you!"
- Technical Specs (Gold, Diamond, Carat, Clarity): Quote the exact real numbers from ITEM SPECIFICATIONS above simply and directly. (e.g., "It's solid 14k yellow gold and comes with the official physical IGI report card.")
- Discounts / Low Offers: Be friendly and authentic: "Thanks for the offer, ${cleanFirstName}! Our pieces are already priced at direct wholesale workshop rates, so we can't go lower on single pieces. But if you're looking at pairing it with a second piece, we'd be happy to put together a bundle deal for you!"
- Timeline / Shipping: "Our turnaround is 8-10 business days since each piece is freshly set by hand, and it ships fully insured with tracking right to your door."
- Casual Greetings ("hi", "hello", "?"): "Hey ${cleanFirstName}! Thanks for checking out our ${listing ? listing.title : 'jewelry'}. How can we help you with this piece today?"

Output ONLY the exact human message to send to the buyer.`;

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
    const parts = data.candidates?.[0]?.content?.parts || [];
    const textPieces = parts
      .map((p: any) => (typeof p.text === 'string' ? p.text : ''))
      .filter(Boolean);
    const candidateText = textPieces.join('').trim();
    if (!candidateText) {
      console.error('[Gemini AI] No text parts in response:', JSON.stringify(data));
      return null;
    }

    return candidateText;
  } catch (err) {
    console.error('[Gemini AI] Generation failed:', err);
    return null;
  }
}
