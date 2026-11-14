import { NextResponse } from 'next/server';
import { getTemplates, saveTemplate, deleteTemplate } from '@/lib/ebay/server-store';

export async function GET() {
  const templates = getTemplates();
  return NextResponse.json({ success: true, templates });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.html) {
      return NextResponse.json({ success: false, error: 'Name and HTML content are required' }, { status: 400 });
    }

    const saved = saveTemplate(body);
    return NextResponse.json({ success: true, template: saved });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Template ID required' }, { status: 400 });
    }

    const deleted = deleteTemplate(id);
    return NextResponse.json({ success: deleted });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
