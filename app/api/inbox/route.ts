import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';
import { logAudit, extractRequestMeta } from '@/lib/audit';

const VALID_SOURCES = ['slack', 'sentry', 'share_link', 'email', 'manual', 'github'] as const;
type Source = (typeof VALID_SOURCES)[number];

/**
 * GET /api/inbox?status=pending&limit=50&offset=0
 *
 * Lista items do triage_inbox do workspace do usuário.
 * Default: status=pending. Use status=all pra remover filtro.
 */
export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') || 'pending').toLowerCase();
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50') || 50));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    const params: unknown[] = [auth.workspace_id];
    let statusFilter = '';
    if (status !== 'all') {
      params.push(status);
      statusFilter = `AND status = $${params.length}`;
    }
    params.push(limit);
    params.push(offset);

    const result = await query(
      `SELECT
        id, workspace_id, source, source_external_id,
        title, description, reporter_name, reporter_email,
        status, ai_suggestion,
        resulting_ticket_id, duplicate_of_ticket_id, reject_reason,
        created_at, triaged_at, triaged_by
       FROM triage_inbox
       WHERE workspace_id = $1 ${statusFilter}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countParams: unknown[] = [auth.workspace_id];
    let countStatusFilter = '';
    if (status !== 'all') {
      countParams.push(status);
      countStatusFilter = `AND status = $${countParams.length}`;
    }
    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM triage_inbox WHERE workspace_id = $1 ${countStatusFilter}`,
      countParams
    );

    return NextResponse.json({
      data: result.rows,
      pagination: { limit, offset, total: parseInt(countResult.rows[0]?.total || '0', 10) },
    });
  } catch (err) {
    console.error('GET /api/inbox error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * POST /api/inbox
 * body: {
 *   source: 'slack'|'sentry'|'share_link'|'email'|'manual'|'github',
 *   title: string,
 *   description?: string,
 *   reporter_name?: string,
 *   reporter_email?: string,
 *   raw_payload?: object,
 *   source_external_id?: string
 * }
 *
 * Cria item de triagem. Dispara classificação IA fire-and-forget.
 * Usuário deve estar autenticado (mas não precisa de role específica — é INBOX).
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    let body: {
      source?: string;
      title?: string;
      description?: string;
      reporter_name?: string;
      reporter_email?: string;
      raw_payload?: Record<string, unknown>;
      source_external_id?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const source = body.source as Source | undefined;
    const title = (body.title || '').trim();

    if (!source || !VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        { error: `source inválido. Use: ${VALID_SOURCES.join(', ')}` },
        { status: 400 }
      );
    }
    if (!title) {
      return NextResponse.json({ error: 'title obrigatório' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO triage_inbox (
         workspace_id, source, source_external_id, raw_payload,
         title, description, reporter_name, reporter_email
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (workspace_id, source, source_external_id) DO NOTHING
       RETURNING *`,
      [
        auth.workspace_id,
        source,
        body.source_external_id || null,
        JSON.stringify(body.raw_payload || {}),
        title,
        body.description || null,
        body.reporter_name || null,
        body.reporter_email || null,
      ]
    );

    if (result.rowCount === 0) {
      // Já existia (dedup pelo UNIQUE)
      const existing = await query(
        `SELECT * FROM triage_inbox
         WHERE workspace_id = $1 AND source = $2 AND source_external_id = $3`,
        [auth.workspace_id, source, body.source_external_id]
      );
      return NextResponse.json(
        { duplicate: true, item: existing.rows[0] || null },
        { status: 200 }
      );
    }

    const item = result.rows[0];

    // Dispara IA fire-and-forget — ai-eng-3a implementa lib/ai-triage.ts
    classifyInBackground(item.id).catch((err) =>
      console.error('[triage] classify failed for', item.id, err)
    );

    const meta = extractRequestMeta(request);
    logAudit({
      workspaceId: auth.workspace_id,
      actorId: auth.id,
      action: 'triage.inbox_created',
      entityType: 'triage_inbox',
      entityId: item.id,
      changes: { source, title },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('POST /api/inbox error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * Helper fire-and-forget: classifica item e salva em ai_suggestion.
 * Delega 100% para classifyAndSave de lib/ai-triage (que já carrega
 * context do workspace, classifica via OpenAI e faz UPDATE).
 */
async function classifyInBackground(inboxItemId: string): Promise<void> {
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
    console.error('[triage] classifyInBackground error:', err);
  }
}
