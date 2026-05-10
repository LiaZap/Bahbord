'use server';

import { headers } from 'next/headers';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export interface FeedbackPayload {
  customer_email: string;
  customer_name?: string;
  request_text: string;
  source_url?: string;
}

export interface FeedbackResult {
  ok: boolean;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT_LENGTH = 5000;
const MAX_NAME_LENGTH = 200;

/**
 * Server Action chamada pelo formulário público de feedback.
 *
 * - Não exige autenticação (página é pública).
 * - Insere direto na tabela customer_requests com source='form'.
 * - Sem necessidade de secret: o endpoint não é exposto, é chamado server-side
 *   pelo Next via Server Action (proteção against CSRF é nativa da plataforma).
 * - Validação rígida de input (email format, tamanhos, trim).
 */
export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResult> {
  try {
    const customerEmail = (payload.customer_email ?? '').trim();
    const customerName = (payload.customer_name ?? '').trim();
    const requestText = (payload.request_text ?? '').trim();
    const sourceUrl = (payload.source_url ?? '').trim();

    if (!customerEmail || !EMAIL_REGEX.test(customerEmail)) {
      return { ok: false, error: 'E-mail inválido' };
    }
    if (!requestText) {
      return { ok: false, error: 'Descrição obrigatória' };
    }
    if (requestText.length > MAX_TEXT_LENGTH) {
      return { ok: false, error: `Texto muito longo (máx ${MAX_TEXT_LENGTH} caracteres)` };
    }
    if (customerName.length > MAX_NAME_LENGTH) {
      return { ok: false, error: 'Nome muito longo' };
    }

    const workspaceId = await getDefaultWorkspaceId();

    const inserted = await query<{ id: string }>(
      `INSERT INTO customer_requests
        (workspace_id, customer_email, customer_name, request_text, source, source_url)
       VALUES ($1, $2, $3, $4, 'form', $5)
       RETURNING id`,
      [
        workspaceId,
        customerEmail,
        customerName || null,
        requestText,
        sourceUrl || null,
      ]
    );

    const created = inserted.rows[0];
    const hdrs = await headers();
    const ipAddress =
      hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      hdrs.get('x-real-ip') ||
      null;
    const userAgent = hdrs.get('user-agent') || null;

    await logAudit({
      workspaceId,
      actorId: null,
      action: 'customer_request.feedback_submitted',
      entityType: 'customer_request',
      entityId: created.id,
      changes: {
        source: 'form',
        customer_email: customerEmail,
        source_url: sourceUrl || null,
      },
      ipAddress,
      userAgent,
    });

    return { ok: true };
  } catch (err) {
    console.error('submitFeedback error:', err);
    return { ok: false, error: 'Erro interno. Tente novamente em instantes.' };
  }
}
