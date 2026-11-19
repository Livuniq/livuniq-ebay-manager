import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const apiKey = (body.apiKey || '').trim();

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Gemini API key is required' },
        { status: 400 }
      );
    }

    // Test Gemini 1.5 Flash endpoint with a fast greeting
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'Hello! Respond with: Gemini AI is active and ready!' }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 20,
        },
      }),
    });

    if (res.ok) {
      return NextResponse.json({
        success: true,
        message: '✓ Google Gemini API Key 100% valid aur active hai! Gemini 1.5 Flash customer support ke liye ready hai.',
      });
    }

    const errData = await res.json().catch(() => ({}));
    const rawMsg = errData.error?.message || res.statusText || 'Unknown error';

    if (res.status === 400 || rawMsg.toLowerCase().includes('api key not valid') || rawMsg.toLowerCase().includes('invalid')) {
      return NextResponse.json({
        success: false,
        error: 'Gemini API key valid nahi hai. Kripya Google AI Studio (aistudio.google.com) se nayi API key copy karke dalein.',
        rawError: rawMsg,
      });
    }

    return NextResponse.json({
      success: false,
      error: `Gemini API test error: ${rawMsg}`,
      rawError: rawMsg,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to connect to Google Gemini API' },
      { status: 500 }
    );
  }
}
