import { NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { query } from '@/lib/db';
import { clients } from '@/lib/schema/core';
import { tickets } from '@/lib/schema/tickets';
import { eq, asc, sql } from 'drizzle-orm';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { cachedQuery, invalidateCachePrefix } from '@/lib/cache';

const CLIENTS_CACHE_PREFIX = 'clients:';

export async function GET() {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const workspaceId = auth.workspace_id;

    // Cache 60s — ticket_count via subquery, defasagem aceitável
    const rows = await cachedQuery(
      `${CLIENTS_CACHE_PREFIX}${workspaceId}`,
      async () => (await query(
        `SELECT c.id, c.name, c.color, c.contact_email, c.contact_phone, c.is_active,
          c.organization_id, c.created_at,
          o.name AS organization_name,
          (SELECT COUNT(*) FROM tickets t WHERE t.client_id = c.id)::int AS ticket_count
         FROM clients c
         LEFT JOIN organizations o ON o.id = c.organization_id
         WHERE c.workspace_id = $1
         ORDER BY c.name ASC`,
        [workspaceId]
      )).rows,
      60_000
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/clients error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { name, color, contact_email, contact_phone, organization_id } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }

    const [created] = await db.insert(clients).values({
      workspaceId: auth.workspace_id,
      name: name.trim(),
      color: color || '#6366f1',
      contactEmail: contact_email || null,
      contactPhone: contact_phone || null,
      isActive: true,
    }).returning();

    invalidateCachePrefix(CLIENTS_CACHE_PREFIX);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('POST /api/clients error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, color, contact_email, contact_phone, is_active } = body;
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (contact_email !== undefined) updateData.contactEmail = contact_email;
    if (contact_phone !== undefined) updateData.contactPhone = contact_phone;
    if (is_active !== undefined) updateData.isActive = is_active;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    const [updated] = await db.update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    invalidateCachePrefix(CLIENTS_CACHE_PREFIX);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/clients error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    // Verificar tickets vinculados
    const [check] = await db.select({ cnt: sql<number>`COUNT(*)::int` })
      .from(tickets).where(eq(tickets.clientId, id));

    if (check.cnt > 0) {
      return NextResponse.json({ error: 'Não é possível remover: existem tickets vinculados a este cliente' }, { status: 409 });
    }

    await db.delete(clients).where(eq(clients.id, id));
    invalidateCachePrefix(CLIENTS_CACHE_PREFIX);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/clients error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
