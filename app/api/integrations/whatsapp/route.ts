import { NextResponse } from 'next/server';
import { sendWhatsApp } from '@/lib/whatsapp';

// GET - returns WhatsApp config status
export async function GET() {
  try {
    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiToken = process.env.WHATSAPP_API_TOKEN;
    const configured = Boolean(apiUrl && apiToken);

    return NextResponse.json({
      configured,
      apiUrl: configured ? apiUrl : null,
    });
  } catch (err) {
    console.error('GET /api/integrations/whatsapp error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST - send a test WhatsApp message
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, message } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { error: 'phone e message sao obrigatorios' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiToken = process.env.WHATSAPP_API_TOKEN;

    if (!apiUrl || !apiToken) {
      return NextResponse.json(
        { error: 'WhatsApp API nao configurada. Defina WHATSAPP_API_URL e WHATSAPP_API_TOKEN.' },
        { status: 503 }
      );
    }

    await sendWhatsApp(phone, message);

    return NextResponse.json({ ok: true, message: 'Mensagem enviada' });
  } catch (err) {
    console.error('POST /api/integrations/whatsapp error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
