import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { logAudit, extractRequestMeta } from '@/lib/audit';
import { safeEqual } from '@/lib/crypto-utils';
import { checkRateLimit } from '@/lib/rate-limit';

// ----------------------------------------------------------------------------
// POST /api/webhooks/customer-form
// ----------------------------------------------------------------------------
// Webhook público para formulário externo de captura de pedidos do cliente.
// Auth: header X-Form-Secret == process.env.PUBLIC_FORM_SECRET
//
// Body:
//   {
//     customer_email: string,
//     customer_name?: string,
//     request_text: string,
//     source_url?: string
//   }
//
// Cria customer_request com source='form'.
// ----------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // Rate limit por IP — webhook de form externo. 30/min absorve uso normal
    // (form embedável) e bloqueia spam massivo de pedidos falsos.
    const { ipAddress } = extractRequestMeta(request);
    const ipKey = ipAddress || 'unknown';
    const rl = checkRateLimit(`webhook-customer-form:${ipKey}`, 30, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: 'Rate limit excedido', retryAfter: rl.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
      );
    }

    const secret = request.headers.get('x-form-secret');
    const expected = process.env.PUBLIC_FORM_SECRET;

    if (!expected) {
      // Configuração ausente -> rejeita (evita aceitar form com secret vazio)
      return NextResponse.json({ ok: false, error: 'Webhook não configurado' }, { status: 503 });
    }
    if (!safeEqual(secret, expected)) {
      return NextResponse.json({ ok: false, error: 'Secret inválido' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      customer_email,
      customer_name,
      request_text,
      source_url,
    } = body as {
      customer_email?: string;
      customer_name?: string;
      request_text?: string;
      source_url?: string;
    };

    if (!request_text || !request_text.trim()) {
      return NextResponse.json({ ok: false, error: 'request_text é obrigatório' }, { status: 400 });
    }
    if (!customer_email || !customer_email.trim()) {
      return NextResponse.json({ ok: false, error: 'customer_email é obrigatório' }, { status: 400 });
    }
    // Limites pra prevenir DoS/spam via formulário público
    if (request_text.length > 5000) {
      return NextResponse.json({ ok: false, error: 'request_text excede 5000 caracteres' }, { status: 400 });
    }
    if (customer_name && customer_name.length > 200) {
      return NextResponse.json({ ok: false, error: 'customer_name excede 200 caracteres' }, { status: 400 });
    }

    const workspaceId = await getDefaultWorkspaceId();

    const result = await query<{ id: string }>(
      `INSERT INTO customer_requests
        (workspace_id, customer_email, customer_name, request_text, source, source_url)
       VALUES ($1, $2, $3, $4, 'form', $5)
       RETURNING id`,
      [
        workspaceId,
        customer_email.trim(),
        customer_name?.trim() || null,
        request_text.trim(),
        source_url || null,
      ]
    );

    const created = result.rows[0];
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId,
      actorId: null,
      action: 'customer_request.webhook_received',
      entityType: 'customer_request',
      entityId: created.id,
      changes: {
        source: 'form',
        customer_email: customer_email.trim(),
        source_url: source_url || null,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, message: 'Recebido', id: created.id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/webhooks/customer-form error:', err);
    return NextResponse.json({ ok: false, error: 'Erro interno' }, { status: 500 });
  }
}
