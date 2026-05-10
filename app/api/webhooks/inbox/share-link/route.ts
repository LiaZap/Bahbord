import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';

/**
 * POST /api/webhooks/inbox/share-link
 *
 * Recebe submissão de form público (link compartilhável p/ cliente reportar
 * problema sem login). Cria item na triage_inbox para triagem manual.
 *
 * Auth: header X-Webhook-Secret = env.WEBHOOK_SECRET_INBOX
 *
 * body: {
 *   workspace_id?: string,
 *   title: string,
 *   description?: string,
 *   reporter_name?: string,
 *   reporter_email: string  (obrigatório pra rastreabilidade do cliente)
 * }
 */

interface SharePayload {
  workspace_id?: string;
  title?: string;
  description?: string;
  reporter_name?: string;
  reporter_email?: string;
}

export async function POST(request: Request) {
  try {
    const expected = process.env.WEBHOOK_SECRET_INBOX;
    const provided = request.headers.get('x-webhook-secret');
    if (!expected) {
      return NextResponse.json(
        { error: 'WEBHOOK_SECRET_INBOX não configurado' },
        { status: 503 }
      );
    }
    if (provided !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: SharePayload;
    try {
      body = (await request.json()) as SharePayload;
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const title = (body.title || '').trim();
    const reporterEmail = (body.reporter_email || '').trim().toLowerCase();

    if (!title) {
      return NextResponse.json({ error: 'title obrigatório' }, { status: 400 });
    }
    if (!reporterEmail) {
      return NextResponse.json(
        { error: 'reporter_email obrigatório' },
        { status: 400 }
      );
    }
    // Validação básica de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
      return NextResponse.json({ error: 'reporter_email inválido' }, { status: 400 });
    }

    const workspaceId = body.workspace_id || (await getDefaultWorkspaceId());

    // Dedup: mesmo email + título nas últimas 24h conta como mesma submissão.
    // Usamos hash simples do email+title como external_id pra UNIQUE constraint.
    const externalId = `${reporterEmail}::${title.slice(0, 100)}`;

    const result = await query(
      `INSERT INTO triage_inbox (
         workspace_id, source, source_external_id, raw_payload,
         title, description, reporter_name, reporter_email
       ) VALUES ($1, 'share_link', $2, $3, $4, $5, $6, $7)
       ON CONFLICT (workspace_id, source, source_external_id) DO NOTHING
       RETURNING id`,
      [
        workspaceId,
        externalId,
        JSON.stringify(body),
        title,
        body.description || null,
        body.reporter_name || null,
        reporterEmail,
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { ok: true, deduped: true, message: 'Submissão duplicada ignorada' },
        { status: 200 }
      );
    }

    const itemId = result.rows[0]?.id;
    if (itemId) {
      classifyFireAndForget(itemId).catch((err) =>
        console.error('[share-link-webhook] classify failed', err)
      );
    }

    return NextResponse.json({ ok: true, inbox_id: itemId }, { status: 201 });
  } catch (err) {
    console.error('POST /api/webhooks/inbox/share-link error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

async function classifyFireAndForget(inboxItemId: string): Promise<void> {
  try {
    const itemRes = await query<{
      title: string;
      description: string | null;
      workspace_id: string;
      source: string;
      reporter_email: string | null;
    }>(
      `SELECT title, description, workspace_id, source, reporter_email
       FROM triage_inbox WHERE id = $1`,
      [inboxItemId]
    );
    if (!itemRes.rows[0]) return;
    const row = itemRes.rows[0];

    const { classifyAndSave } = await import('@/lib/ai-triage');
    await classifyAndSave(inboxItemId, row.workspace_id, {
      id: inboxItemId,
      workspace_id: row.workspace_id,
      title: row.title,
      description: row.description,
      source: row.source,
      reporter_email: row.reporter_email,
    });
  } catch (err) {
    console.error('[share-link-webhook] classifyFireAndForget error:', err);
  }
}
