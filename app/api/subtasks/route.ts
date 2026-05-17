import { NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { subtasks } from '@/lib/schema/tickets';
import { eq, asc, sql, max } from 'drizzle-orm';
import { getAuthMember } from '@/lib/api-auth';
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
    if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const rows = await db.select({
      id: subtasks.id,
      title: subtasks.title,
      is_completed: subtasks.isDone,
      position: subtasks.position,
      created_at: subtasks.createdAt,
      completed_at: subtasks.completedAt,
    })
      .from(subtasks)
      .where(eq(subtasks.ticketId, ticketId))
      .orderBy(asc(subtasks.position), asc(subtasks.createdAt));

    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/subtasks error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { ticket_id, title } = body;

    if (!ticket_id || !title?.trim()) {
      return NextResponse.json({ error: 'ticket_id e title são obrigatórios' }, { status: 400 });
    }

    const allowed = await hasTicketAccess(auth, ticket_id);
    if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    // Calcular próxima posição
    const [posResult] = await db
      .select({ nextPos: sql<number>`COALESCE(MAX(${subtasks.position}), -1) + 1` })
      .from(subtasks)
      .where(eq(subtasks.ticketId, ticket_id));

    const [created] = await db.insert(subtasks).values({
      ticketId: ticket_id,
      title: title.trim(),
      position: posResult.nextPos,
      isDone: false,
    }).returning();

    return NextResponse.json({
      id: created.id,
      title: created.title,
      is_completed: created.isDone,
      position: created.position,
      created_at: created.createdAt,
      completed_at: created.completedAt,
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/subtasks error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { id, is_completed, title, position } = body;

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    // Verificar acesso ao ticket pai
    const [sub] = await db.select({ ticketId: subtasks.ticketId })
      .from(subtasks).where(eq(subtasks.id, id));
    if (!sub) {
      return NextResponse.json({ error: 'Subtask não encontrada' }, { status: 404 });
    }
    const allowed = await hasTicketAccess(auth, sub.ticketId);
    if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const updateData: Record<string, unknown> = {};
    if (typeof is_completed === 'boolean') {
      updateData.isDone = is_completed;
      updateData.completedAt = is_completed ? new Date() : null;
    }
    if (typeof title === 'string') {
      updateData.title = title.trim();
    }
    if (typeof position === 'number') {
      updateData.position = position;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    const [updated] = await db.update(subtasks)
      .set(updateData)
      .where(eq(subtasks.id, id))
      .returning();

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      is_completed: updated.isDone,
      position: updated.position,
      created_at: updated.createdAt,
      completed_at: updated.completedAt,
    });
  } catch (err) {
    console.error('PATCH /api/subtasks error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    const [sub] = await db.select({ ticketId: subtasks.ticketId })
      .from(subtasks).where(eq(subtasks.id, id));
    if (!sub) {
      return NextResponse.json({ error: 'Subtask não encontrada' }, { status: 404 });
    }
    const allowed = await hasTicketAccess(auth, sub.ticketId);
    if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    await db.delete(subtasks).where(eq(subtasks.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/subtasks error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
