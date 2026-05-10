import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';

/**
 * POST /api/webhooks/inbox/slack
 *
 * Recebe payload do Slack (interactive message, slash command ou Events API)
 * e cria item na triage_inbox.
 *
 * Auth: header X-Webhook-Secret = env.WEBHOOK_SECRET_INBOX
 *
 * Aceita formato genérico de evento Slack — extrai title/description/user
 * de campos comuns (text, message.text, event.text, user.name, etc).
 *
 * TODO (Sprint futura): se este endpoint for exposto a um Slack App público,
 * implementar verificação HMAC SHA-256 do signing secret:
 *   sigBase = `v0:${timestamp}:${rawBody}`
 *   expected = `v0=${hmacSha256(SLACK_SIGNING_SECRET, sigBase)}`
 *   compara com header `X-Slack-Signature`. Hoje só validamos token custom
 *   (uso interno via proxy controlado).
 */

interface SlackPayload {
  // Slack envia formatos diferentes (events API, interactive, slash commands).
  // Tratamos os mais comuns.
  team_id?: string;
  text?: string;
  user_name?: string;
  user?: { id?: string; name?: string };
  message?: { text?: string; ts?: string; user?: string };
  event?: {
    text?: string;
    user?: string;
    ts?: string;
    type?: string;
    channel?: string;
  };
  channel_name?: string;
  channel?: { id?: string; name?: string };
  // Campos vindos de uma submissão "Reportar bug" customizada (modal):
  workspace_id?: string;
  title?: string;
  description?: string;
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

    let payload: SlackPayload;
    try {
      payload = (await request.json()) as SlackPayload;
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    // Tenta extrair título/descrição em ordem de prioridade
    const explicitTitle = (payload.title || '').trim();
    const fallbackText =
      payload.event?.text ||
      payload.message?.text ||
      payload.text ||
      '';

    let title = explicitTitle;
    let description = payload.description || null;

    if (!title) {
      // Pega primeira linha do texto como título (até 200 chars)
      const firstLine = fallbackText.split('\n')[0]?.trim() || '';
      title = firstLine.slice(0, 200);
      // Resto vira description
      if (fallbackText.length > firstLine.length && !description) {
        description = fallbackText.slice(firstLine.length).trim() || null;
      }
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Não foi possível extrair título do payload' },
        { status: 400 }
      );
    }

    const reporterName =
      payload.user?.name || payload.user_name || payload.message?.user || null;

    // Dedup ID: ts da mensagem Slack (único por canal+team)
    const externalId =
      payload.event?.ts || payload.message?.ts ||
      (payload.channel?.id ? `${payload.channel.id}-${Date.now()}` : null);

    const workspaceId = payload.workspace_id || (await getDefaultWorkspaceId());

    const result = await query(
      `INSERT INTO triage_inbox (
         workspace_id, source, source_external_id, raw_payload,
         title, description, reporter_name, reporter_email
       ) VALUES ($1, 'slack', $2, $3, $4, $5, $6, $7)
       ON CONFLICT (workspace_id, source, source_external_id) DO NOTHING
       RETURNING id`,
      [
        workspaceId,
        externalId,
        JSON.stringify(payload),
        title,
        description,
        reporterName,
        payload.reporter_email || null,
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
    }

    const itemId = result.rows[0]?.id;
    // Fire-and-forget: dispara classificação IA chamando endpoint interno
    if (itemId) {
      classifyFireAndForget(itemId).catch((err) =>
        console.error('[slack-webhook] classify failed', err)
      );
    }

    return NextResponse.json({ ok: true, inbox_id: itemId }, { status: 201 });
  } catch (err) {
    console.error('POST /api/webhooks/inbox/slack error:', err);
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
    console.error('[slack-webhook] classifyFireAndForget error:', err);
  }
}
