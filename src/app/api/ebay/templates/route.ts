import { NextResponse } from 'next/server';
import {
  getTemplates,
  saveTemplate,
  deleteTemplate,
  ensureStoreAsync,
  getStore,
  saveStoreAsync,
} from '@/lib/ebay/server-store';

export async function GET(request: Request) {
  await ensureStoreAsync();
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId') || undefined;
  const templates = getTemplates(accountId);
  return NextResponse.json({ success: true, templates });
}

export async function POST(request: Request) {
  try {
    await ensureStoreAsync();
    const body = await request.json();
    if (!body.name || !body.html) {
      return NextResponse.json({ success: false, error: 'Name and HTML content are required' }, { status: 400 });
    }

    const { accountId, ...tplData } = body;
    const saved = saveTemplate(tplData, accountId);
    await saveStoreAsync(getStore());
    return NextResponse.json({ success: true, template: saved });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureStoreAsync();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const accountId = searchParams.get('accountId') || undefined;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Template ID required' }, { status: 400 });
    }

    const deleted = deleteTemplate(id, accountId);
    await saveStoreAsync(getStore());
    return NextResponse.json({ success: deleted });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
