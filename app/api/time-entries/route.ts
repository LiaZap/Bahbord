import { NextResponse } from 'next/server';
import { query, getDefaultMemberId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { hasTicketAccess } from '@/lib/access-check';

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');

    if (!ticketId) {
      return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
    }

    const allowed = await hasTicketAccess(auth, ticketId);
    if (!allowed) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const userIsAdmin = isAdmin(auth.role);
    const params: unknown[] = [ticketId];
    let memberFilter = '';
    if (!userIsAdmin) {
      params.push(auth.id);
      memberFilter = ` AND te.member_id = $${params.length}`;
    }

    const result = await query(
      `SELECT te.id, te.description, te.started_at, te.ended_at,
        te.duration_minutes, te.is_running, te.is_billable, te.created_at,
        te.member_id,
        m.display_name AS member_name
      FROM time_entries te
      LEFT JOIN members m ON m.id = te.member_id
      WHERE te.ticket_id = $1${memberFilter}
      ORDER BY te.created_at DESC`,
      params
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/time-entries error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();

    const body = await request.json();
    const { ticket_id, action } = body;

    if (!ticket_id) {
      return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
    }

    let memberId = auth?.id;
    if (!memberId) {
      try {
        memberId = await getDefaultMemberId();
      } catch {
        return NextResponse.json({ error: 'Nenhum membro encontrado' }, { status: 400 });
      }
    }

    if (action === 'start') {
      // Parar qualquer timer rodando para este ticket (mín 1 min, arredonda pra cima)
      await query(
        `UPDATE time_entries SET is_running = false, ended_at = NOW(),
          duration_minutes = GREATEST(1, CEIL(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60))::int
        WHERE ticket_id = $1 AND is_running = true`,
        [ticket_id]
      );

      const result = await query(
        `INSERT INTO time_entries (ticket_id, member_id, started_at, is_running, is_billable)
         VALUES ($1, $2, NOW(), true, true)
         RETURNING *`,
        [ticket_id, memberId]
      );
      return NextResponse.json(result.rows[0], { status: 201 });
    }

    if (action === 'stop') {
      const result = await query(
        `UPDATE time_entries SET is_running = false, ended_at = NOW(),
          duration_minutes = GREATEST(1, CEIL(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60))::int
        WHERE ticket_id = $1 AND is_running = true
        RETURNING *`,
        [ticket_id]
      );
      return NextResponse.json(result.rows[0] || { ok: true });
    }

    // Log manual: action = 'log'
    if (action === 'log') {
      const { duration_minutes, description, is_billable } = body;
      const durMinutes = parseInt(String(duration_minutes), 10);
      if (!durMinutes || durMinutes <= 0) {
        return NextResponse.json({ error: 'duration_minutes deve ser > 0' }, { status: 400 });
      }

      const result = await query(
        `INSERT INTO time_entries (ticket_id, member_id, started_at, ended_at, duration_minutes, is_running, description, is_billable)
         VALUES ($1, $2, NOW() - make_interval(mins => $3::int), NOW(), $3::int, false, $4, $5)
         RETURNING *`,
        [ticket_id, memberId, durMinutes, description || null, is_billable !== false]
      );
      return NextResponse.json(result.rows[0], { status: 201 });
    }

    return NextResponse.json({ error: 'action deve ser start, stop ou log' }, { status: 400 });
  } catch (err) {
    console.error('POST /api/time-entries error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { id, description, duration_minutes, is_billable } = body;

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    // Permissão: admin/owner edita qualquer entry; member só a própria
    const userIsAdmin = isAdmin(auth.role);
    const owner = await query<{ member_id: string | null }>(
      `SELECT member_id FROM time_entries WHERE id = $1`,
      [id]
    );
    if (owner.rowCount === 0) {
      return NextResponse.json({ error: 'Entrada não encontrada' }, { status: 404 });
    }
    if (!userIsAdmin && owner.rows[0].member_id !== auth.id) {
      return NextResponse.json({ error: 'Sem permissão para editar esta entrada' }, { status: 403 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (description !== undefined) {
      sets.push(`description = $${idx}`);
      values.push(description);
      idx++;
    }

    if (duration_minutes !== undefined) {
      const dur = parseInt(String(duration_minutes), 10);
      if (isNaN(dur) || dur < 0) {
        return NextResponse.json({ error: 'duration_minutes inválido' }, { status: 400 });
      }
      sets.push(`duration_minutes = $${idx}`);
      values.push(dur);
      idx++;
    }

    if (is_billable !== undefined) {
      sets.push(`is_billable = $${idx}`);
      values.push(is_billable);
      idx++;
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    values.push(id);
    const result = await query(
      `UPDATE time_entries SET ${sets.join(', ')} WHERE id = $${idx} AND is_running = false RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Entrada não encontrada ou timer em execução' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/time-entries error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await getAuthMember();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    const result = await query(
      `DELETE FROM time_entries WHERE id = $1 AND is_running = false`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Entrada não encontrada ou timer em execução' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/time-entries error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
