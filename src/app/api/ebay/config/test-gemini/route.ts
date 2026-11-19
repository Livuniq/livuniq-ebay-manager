import { NextResponse } from 'next/server';
import { resolveWorkingGeminiEndpoint } from '@/lib/ebay/gemini-ai';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const apiKey = (body.apiKey || body.geminiApiKey || '').trim();

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Gemini API key is required' },
        { status: 400 }
      );
    }

    const result = await resolveWorkingGeminiEndpoint(apiKey);

    if (result.success && result.model) {
      return NextResponse.json({
        success: true,
        message: `✓ Google Gemini API Key 100% active aur valid hai! Model "${result.model.modelName}" (${result.model.apiVersion}) customer concierge ke liye ready hai.`,
        model: result.model,
        availableModels: result.availableModels,
      });
    }

    const rawMsg = result.error || 'Unknown error occurred';

    if (
      rawMsg.toLowerCase().includes('api key not valid') ||
      rawMsg.toLowerCase().includes('invalid') ||
      rawMsg.toLowerCase().includes('api_key_invalid')
    ) {
      return NextResponse.json({
        success: false,
        error: 'Gemini API key valid nahi hai. Kripya Google AI Studio (aistudio.google.com/app/apikey) se nayi API key copy karke dalein.',
        rawError: rawMsg,
      });
    }

    if (rawMsg.toLowerCase().includes('generative language api has not been used') || rawMsg.toLowerCase().includes('disabled')) {
      return NextResponse.json({
        success: false,
        error: `Google Cloud Project me Generative Language API disabled hai: ${rawMsg}`,
        rawError: rawMsg,
      });
    }

    return NextResponse.json({
      success: false,
      error: `Gemini API test error: ${rawMsg}`,
      rawError: rawMsg,
      availableModels: result.availableModels,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to connect to Google Gemini API' },
      { status: 500 }
    );
  }
}
