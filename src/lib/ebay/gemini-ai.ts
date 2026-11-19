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

  // Preference ranking: fast flash models > latest > pro > general
  const priorityList = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
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
