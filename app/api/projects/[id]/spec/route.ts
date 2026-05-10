import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { hasProjectAccess } from '@/lib/access-check';
import { logAudit, extractRequestMeta } from '@/lib/audit';

interface SpecRow {
  content_html: string;
  content_text: string;
  version: number;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
}

interface BacklinkRow {
  ticket_id: string;
  ticket_key: string;
  title: string;
  status_name: string | null;
  status_color: string | null;
  is_done: boolean | null;
}

/**
 * GET /api/projects/[id]/spec
 * Retorna o spec atual + backlinks. Se o spec ainda não existe, devolve um
 * shell vazio (não cria a linha no DB — o INSERT acontece no primeiro PUT).
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const canAccess = await hasProjectAccess(auth, params.id);
    if (!canAccess) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const specRes = await query<SpecRow>(
      `SELECT
         ps.content_html,
         ps.content_text,
         ps.version,
         ps.updated_at,
         ps.updated_by,
         m.display_name AS updated_by_name
       FROM project_specs ps
       LEFT JOIN members m ON m.id = ps.updated_by
       WHERE ps.project_id = $1`,
      [params.id],
    );

    const spec = specRes.rows[0] ?? {
      content_html: '',
      content_text: '',
      version: 0,
      updated_at: null,
      updated_by: null,
      updated_by_name: null,
    };

    const backlinksRes = await query<BacklinkRow>(
      `SELECT
         tf.id AS ticket_id,
         tf.ticket_key,
         tf.title,
         tf.status_name,
         tf.status_color,
         tf.is_done
       FROM project_spec_backlinks b
       JOIN tickets_full tf ON tf.id = b.target_ticket_id
       WHERE b.source_project_id = $1
       ORDER BY tf.ticket_key ASC`,
      [params.id],
    );

    return NextResponse.json({
      content_html: spec.content_html,
      content_text: spec.content_text,
      version: spec.version,
      updated_at: spec.updated_at,
      updated_by: spec.updated_by,
      updated_by_name: spec.updated_by_name,
      backlinks: backlinksRes.rows,
    });
  } catch (err) {
    console.error('GET /api/projects/[id]/spec error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[id]/spec
 * Body: { content_html, content_text, version }
 * - Admin only.
 * - Se version do body !== version no DB → 409 (conflito otimista).
 * - Caso contrário UPSERT com version+1, depois ressincroniza backlinks.
 *
 * Backlinks: extrai todos os tokens /[A-Z]{2,5}-\d+/ do HTML, busca tickets
 * matching no workspace via tickets_full.ticket_key e regrava a tabela
 * (DELETE all + INSERT new). Operação é idempotente e barata: o spec não
 * costuma ter centenas de menções.
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!isAdmin(auth.role)) {
      return NextResponse.json(
        { error: 'Apenas admins podem editar o spec' },
        { status: 403 },
      );
    }

    let body: {
      content_html?: string;
      content_text?: string;
      version?: number;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }

    const contentHtml = typeof body.content_html === 'string' ? body.content_html : '';
    const contentText = typeof body.content_text === 'string' ? body.content_text : '';
    const expectedVersion = typeof body.version === 'number' ? body.version : null;

    if (expectedVersion === null || expectedVersion < 0) {
      return NextResponse.json(
        { error: 'version obrigatório' },
        { status: 400 },
      );
    }

    // Hard limit pra não estourar payload — ~512KB de HTML é mais que suficiente
    // pra um spec de projeto. Acima disso provavelmente é abuso/bug do cliente.
    if (contentHtml.length > 512 * 1024) {
      return NextResponse.json(
        { error: 'Conteúdo excede 512KB' },
        { status: 413 },
      );
    }

    // Buscar projeto pra obter workspace + validar existência.
    const projRes = await query<{ workspace_id: string; is_archived: boolean }>(
      `SELECT workspace_id, is_archived FROM projects WHERE id = $1`,
      [params.id],
    );
    const project = projRes.rows[0];
    if (!project) {
      return NextResponse.json(
        { error: 'Projeto não encontrado' },
        { status: 404 },
      );
    }
    if (project.is_archived) {
      return NextResponse.json(
        { error: 'Projeto arquivado — spec read-only' },
        { status: 409 },
      );
    }

    // Detecção de conflito otimista. Se a row não existe, current=0 e o cliente
    // deve enviar 0 no primeiro save. Qualquer mismatch → 409.
    const currentRes = await query<{ version: number }>(
      `SELECT version FROM project_specs WHERE project_id = $1`,
      [params.id],
    );
    const currentVersion = currentRes.rows[0]?.version ?? 0;

    if (currentVersion !== expectedVersion) {
      return NextResponse.json(
        {
          error: 'Conflito de edição: outro admin salvou primeiro',
          current_version: currentVersion,
        },
        { status: 409 },
      );
    }

    const newVersion = currentVersion + 1;

    await query(
      `INSERT INTO project_specs
         (project_id, workspace_id, content_html, content_text, updated_at, updated_by, version)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6)
       ON CONFLICT (project_id) DO UPDATE
         SET content_html = EXCLUDED.content_html,
             content_text = EXCLUDED.content_text,
             updated_at = NOW(),
             updated_by = EXCLUDED.updated_by,
             version = EXCLUDED.version`,
      [
        params.id,
        project.workspace_id,
        contentHtml,
        contentText,
        auth.id,
        newVersion,
      ],
    );

    // Sincronizar backlinks. Regex matches "BAH-1", "PROJ-42", "bah-3", etc.
    // Case-insensitive — TipTap permite usuário digitar minúsculo.
    const matches = contentHtml.match(/[A-Za-z]{2,5}-\d+/g) ?? [];
    const uniqueKeys = Array.from(new Set(matches.map((k) => k.toUpperCase())));

    // Limpa o estado anterior independente de termos novas menções.
    await query(
      `DELETE FROM project_spec_backlinks WHERE source_project_id = $1`,
      [params.id],
    );

    let backlinkCount = 0;
    if (uniqueKeys.length > 0) {
      // Busca todos os ticket IDs de uma vez. Restringe ao workspace pra evitar
      // backlinks cross-tenant no improvável caso de prefixos compartilhados.
      const ticketsRes = await query<{ id: string; ticket_key: string }>(
        `SELECT id, ticket_key
         FROM tickets_full
         WHERE workspace_id = $1
           AND ticket_key = ANY($2::text[])`,
        [project.workspace_id, uniqueKeys],
      );

      if (ticketsRes.rows.length > 0) {
        // Bulk insert via UNNEST pra evitar N round-trips.
        const ticketIds = ticketsRes.rows.map((r) => r.id);
        await query(
          `INSERT INTO project_spec_backlinks (source_project_id, target_ticket_id)
           SELECT $1, t_id
           FROM UNNEST($2::uuid[]) AS t(t_id)
           ON CONFLICT DO NOTHING`,
          [params.id, ticketIds],
        );
        backlinkCount = ticketIds.length;
      }
    }

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: project.workspace_id,
      actorId: auth.id,
      action: 'project_spec.updated',
      entityType: 'project_spec',
      entityId: params.id,
      changes: {
        project_id: params.id,
        version_from: currentVersion,
        version_to: newVersion,
        content_length: contentHtml.length,
        backlink_count: backlinkCount,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      version: newVersion,
      updated_at: new Date().toISOString(),
      updated_by_name: auth.display_name,
      backlink_count: backlinkCount,
    });
  } catch (err) {
    console.error('PUT /api/projects/[id]/spec error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
