import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';
import { hasTicketAccess } from '@/lib/access-check';
import { logAudit, extractRequestMeta } from '@/lib/audit';

type RelationType = 'blocks' | 'blocked_by' | 'relates_to';
const VALID_TYPES: ReadonlyArray<RelationType> = ['blocks', 'blocked_by', 'relates_to'];

/** Devolve o tipo "espelho" pra criar/remover a contrapartida. */
function mirrorType(t: RelationType): RelationType {
  if (t === 'blocks') return 'blocked_by';
  if (t === 'blocked_by') return 'blocks';
  return 'relates_to'; // simétrico
}

/**
 * GET /api/ticket-relations?ticket_id=X
 * Retorna todas relations onde X é source OU target, com info do "outro lado"
 * (ticket_key, title, status_name).
 */
export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');
    if (!ticketId) {
      return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
    }

    const access = await hasTicketAccess(auth, ticketId);
    if (!access) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Listamos as relations onde ticket é source. Como criamos espelhos
    // automaticamente, isso já cobre os dois sentidos sem UNION.
    const result = await query(
      `SELECT
        r.id,
        r.source_ticket_id,
        r.target_ticket_id,
        r.relation_type,
        r.created_at,
        r.created_by,
        tf.ticket_key AS target_ticket_key,
        tf.title AS target_title,
        tf.status_name AS target_status_name,
        tf.status_color AS target_status_color,
        tf.is_done AS target_is_done
      FROM ticket_relations r
      LEFT JOIN tickets_full tf ON tf.id = r.target_ticket_id
      WHERE r.source_ticket_id = $1
      ORDER BY r.created_at ASC`,
      [ticketId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/ticket-relations error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * POST /api/ticket-relations
 * body: { source_ticket_id, target_ticket_id, relation_type }
 *
 * Cria a relation + espelho automaticamente. Idempotente: se já existir
 * (UNIQUE constraint) retorna 200 com o registro existente.
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    let body: { source_ticket_id?: string; target_ticket_id?: string; relation_type?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const source = body.source_ticket_id;
    const target = body.target_ticket_id;
    const type = body.relation_type as RelationType | undefined;

    if (!source || !target || !type) {
      return NextResponse.json(
        { error: 'source_ticket_id, target_ticket_id e relation_type obrigatórios' },
        { status: 400 }
      );
    }
    if (source === target) {
      return NextResponse.json({ error: 'Ticket não pode se relacionar consigo' }, { status: 400 });
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `relation_type inválido. Use: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Permissão: precisa ter acesso ao source. Target só precisa existir.
    const access = await hasTicketAccess(auth, source);
    if (!access) {
      return NextResponse.json({ error: 'Acesso negado ao ticket source' }, { status: 403 });
    }
    const targetExists = await query<{ id: string; workspace_id: string }>(
      `SELECT id, workspace_id FROM tickets WHERE id = $1`,
      [target]
    );
    if (!targetExists.rows[0]) {
      return NextResponse.json({ error: 'Ticket target não encontrado' }, { status: 404 });
    }

    const sourceWsRes = await query<{ workspace_id: string }>(
      `SELECT workspace_id FROM tickets WHERE id = $1`,
      [source]
    );
    const wsId = sourceWsRes.rows[0]?.workspace_id ?? null;

    // Bloqueia relations entre workspaces diferentes
    if (wsId && targetExists.rows[0].workspace_id !== wsId) {
      return NextResponse.json(
        { error: 'Tickets de workspaces diferentes não podem ser vinculados' },
        { status: 403 }
      );
    }

    // Para evitar registros órfãos quando o espelho falha, fazemos os dois
    // INSERTs em uma transação. Se o segundo der erro, todo o lote rola back.
    const mirror = mirrorType(type);

    // Usamos uma única query CTE pra inserir os dois — sem precisar de client manual.
    // ON CONFLICT DO NOTHING garante idempotência. Retornamos a row do source.
    const result = await query(
      `WITH ins_main AS (
         INSERT INTO ticket_relations (source_ticket_id, target_ticket_id, relation_type, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (source_ticket_id, target_ticket_id, relation_type) DO NOTHING
         RETURNING id, source_ticket_id, target_ticket_id, relation_type, created_at, created_by
       ),
       ins_mirror AS (
         INSERT INTO ticket_relations (source_ticket_id, target_ticket_id, relation_type, created_by)
         VALUES ($2, $1, $5, $4)
         ON CONFLICT (source_ticket_id, target_ticket_id, relation_type) DO NOTHING
         RETURNING id
       )
       SELECT * FROM ins_main
       UNION ALL
       SELECT id, $1::uuid, $2::uuid, $3 AS relation_type, NOW(), $4::uuid
       FROM ticket_relations
       WHERE source_ticket_id = $1 AND target_ticket_id = $2 AND relation_type = $3
         AND NOT EXISTS (SELECT 1 FROM ins_main)
       LIMIT 1`,
      [source, target, type, auth.id, mirror]
    );

    const meta = extractRequestMeta(request);
    logAudit({
      workspaceId: wsId,
      actorId: auth.id,
      action: 'ticket.relation_created',
      entityType: 'ticket_relation',
      entityId: result.rows[0]?.id ?? null,
      changes: { source, target, type, mirror },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(result.rows[0] ?? { ok: true }, { status: 201 });
  } catch (err) {
    console.error('POST /api/ticket-relations error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * DELETE /api/ticket-relations?id=X
 * Remove a relation pelo id e também o espelho (mesma dupla source/target,
 * com tipo invertido).
 */
export async function DELETE(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const relRes = await query<{
      id: string;
      source_ticket_id: string;
      target_ticket_id: string;
      relation_type: RelationType;
    }>(
      `SELECT id, source_ticket_id, target_ticket_id, relation_type
       FROM ticket_relations WHERE id = $1`,
      [id]
    );
    if (!relRes.rows[0]) {
      return NextResponse.json({ error: 'Relation não encontrada' }, { status: 404 });
    }
    const rel = relRes.rows[0];

    const access = await hasTicketAccess(auth, rel.source_ticket_id);
    if (!access) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Apaga a relation principal + espelho (mesma dupla, tipo invertido).
    const mirror = mirrorType(rel.relation_type);
    await query(
      `DELETE FROM ticket_relations
       WHERE id = $1
          OR (source_ticket_id = $2 AND target_ticket_id = $3 AND relation_type = $4)`,
      [rel.id, rel.target_ticket_id, rel.source_ticket_id, mirror]
    );

    const wsRes = await query<{ workspace_id: string }>(
      `SELECT workspace_id FROM tickets WHERE id = $1`,
      [rel.source_ticket_id]
    );
    const meta = extractRequestMeta(request);
    logAudit({
      workspaceId: wsRes.rows[0]?.workspace_id ?? null,
      actorId: auth.id,
      action: 'ticket.relation_deleted',
      entityType: 'ticket_relation',
      entityId: rel.id,
      changes: {
        source: rel.source_ticket_id,
        target: rel.target_ticket_id,
        type: rel.relation_type,
        mirror,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/ticket-relations error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
