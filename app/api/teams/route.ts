import { NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { query } from '@/lib/db';
import { teams, teamMembers } from '@/lib/schema/rbac';
import { eq, and } from 'drizzle-orm';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { cachedQuery, invalidateCachePrefix } from '@/lib/cache';

const TEAMS_CACHE_PREFIX = 'teams:';

export async function GET() {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const workspaceId = auth.workspace_id;

    // Cache 60s — query complexa com json_agg mantida em raw SQL
    const rows = await cachedQuery(
      `${TEAMS_CACHE_PREFIX}${workspaceId}`,
      async () => (await query(
        `SELECT
          t.id, t.name, t.description, t.color, t.created_at,
          COUNT(tm.member_id)::int AS member_count,
          COALESCE(
            json_agg(
              json_build_object('id', m.id, 'display_name', m.display_name, 'email', m.email, 'role', tm.role)
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'
          ) AS members
        FROM teams t
        LEFT JOIN team_members tm ON tm.team_id = t.id
        LEFT JOIN members m ON m.id = tm.member_id
        WHERE t.workspace_id = $1
        GROUP BY t.id
        ORDER BY t.name ASC`,
        [workspaceId]
      )).rows,
      60_000
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/teams error:', err);
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
    const { name, description, color } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }

    const [created] = await db.insert(teams).values({
      workspaceId: auth.workspace_id,
      name: name.trim(),
      description: description || null,
      color: color || '#6366f1',
    }).returning();

    invalidateCachePrefix(TEAMS_CACHE_PREFIX);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('POST /api/teams error:', err);
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
    const { id, action, member_id, role, name, description, color } = body;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    // Add member to team
    if (action === 'add_member') {
      if (!member_id) {
        return NextResponse.json({ error: 'member_id é obrigatório' }, { status: 400 });
      }
      await db.insert(teamMembers).values({
        teamId: id,
        memberId: member_id,
        role: role || 'member',
      }).onConflictDoUpdate({
        target: [teamMembers.teamId, teamMembers.memberId],
        set: { role: role || 'member' },
      });
      invalidateCachePrefix(TEAMS_CACHE_PREFIX);
      return NextResponse.json({ success: true });
    }

    // Remove member from team
    if (action === 'remove_member') {
      if (!member_id) {
        return NextResponse.json({ error: 'member_id é obrigatório' }, { status: 400 });
      }
      await db.delete(teamMembers)
        .where(and(eq(teamMembers.teamId, id), eq(teamMembers.memberId, member_id)));
      invalidateCachePrefix(TEAMS_CACHE_PREFIX);
      return NextResponse.json({ success: true });
    }

    // Update team fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    const [updated] = await db.update(teams)
      .set(updateData)
      .where(eq(teams.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 404 });
    }

    invalidateCachePrefix(TEAMS_CACHE_PREFIX);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/teams error:', err);
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

    const deleted = await db.delete(teams).where(eq(teams.id, id)).returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 404 });
    }

    invalidateCachePrefix(TEAMS_CACHE_PREFIX);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/teams error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
