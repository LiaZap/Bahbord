import { NextResponse } from 'next/server';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { cachedQuery } from '@/lib/cache';
import { db } from '@/lib/drizzle';
import { statuses, services, members, categories, ticketTypes, clients, quickReactions } from '@/lib/schema/core';
import { projects, boards, sprints } from '@/lib/schema/tickets';
import { orgRoles } from '@/lib/schema/rbac';
import { eq, asc, desc, sql, and } from 'drizzle-orm';

// Tipos de options seguros pra cache (resultado idêntico entre membros não-admin
// e admin OU completamente independente de role). Excluí 'members' porque a
// projeção de email/phone depende de role do requester.
const CACHEABLE_TYPES = new Set([
  'statuses',
  'services',
  'categories',
  'ticket_types',
  'clients',
  'projects',
  'boards',
]);

type OptionType = 'statuses' | 'services' | 'members' | 'categories' | 'sprints' | 'ticket_types' | 'clients' | 'projects' | 'boards';

async function fetchOptions(type: OptionType, opts: { isAdmin: boolean; projectId: string | null }) {
  switch (type) {
    case 'statuses':
      return db.select({ id: statuses.id, name: statuses.name, color: statuses.color, is_done: statuses.isDone })
        .from(statuses).orderBy(asc(statuses.position));

    case 'services':
      return db.select({ id: services.id, name: services.name, color: services.color })
        .from(services).where(eq(services.isActive, true)).orderBy(asc(services.name));

    case 'categories':
      return db.select({ id: categories.id, name: categories.name, color: categories.color })
        .from(categories).orderBy(asc(categories.name));

    case 'ticket_types':
      return db.select({ id: ticketTypes.id, name: ticketTypes.name, icon: ticketTypes.icon, color: ticketTypes.color })
        .from(ticketTypes).orderBy(asc(ticketTypes.position));

    case 'clients':
      return db.select({ id: clients.id, name: clients.name, color: clients.color })
        .from(clients).where(eq(clients.isActive, true)).orderBy(asc(clients.name));

    case 'projects':
      return db.select({ id: projects.id, name: projects.name, prefix: projects.prefix, color: projects.color })
        .from(projects).where(eq(projects.isArchived, false)).orderBy(asc(projects.name));

    case 'boards':
      return db.select({ id: boards.id, name: boards.name, type: boards.type, project_id: boards.projectId })
        .from(boards).orderBy(asc(boards.name));

    case 'sprints':
      if (opts.projectId) {
        return db.select({ id: sprints.id, name: sprints.name, is_active: sprints.isActive })
          .from(sprints).where(eq(sprints.projectId, opts.projectId))
          .orderBy(desc(sprints.isActive), desc(sprints.createdAt));
      }
      return db.select({ id: sprints.id, name: sprints.name, is_active: sprints.isActive })
        .from(sprints).orderBy(desc(sprints.createdAt));

    case 'members':
      if (opts.isAdmin) {
        return db.select({
          id: members.id,
          display_name: members.displayName,
          email: members.email,
          phone: members.phone,
          avatar_url: members.avatarUrl,
          role: sql<string>`COALESCE(${orgRoles.role}, ${members.role}, 'member')`,
        }).from(members).leftJoin(orgRoles, eq(orgRoles.memberId, members.id))
          .orderBy(asc(members.displayName));
      }
      return db.select({
        id: members.id,
        display_name: members.displayName,
        avatar_url: members.avatarUrl,
        role: sql<string>`COALESCE(${orgRoles.role}, ${members.role}, 'member')`,
      }).from(members).leftJoin(orgRoles, eq(orgRoles.memberId, members.id))
        .where(sql`COALESCE(${members.isApproved}, true) = true`)
        .orderBy(asc(members.displayName));
  }
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as OptionType | null;
    const projectId = searchParams.get('project_id');

    const validTypes: OptionType[] = ['statuses', 'services', 'members', 'categories', 'sprints', 'ticket_types', 'clients', 'projects', 'boards'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: 'type inválido. Use: statuses, services, members, categories, sprints, ticket_types, clients, projects, boards' }, { status: 400 });
    }

    const isAdminUser = isAdmin(auth.role);
    const opts = { isAdmin: isAdminUser, projectId };

    // Cache leve (30s) pra tipos que não dependem do role do requester.
    if (CACHEABLE_TYPES.has(type)) {
      const cacheKey = `options:${type}:${projectId ?? '_'}`;
      const rows = await cachedQuery(cacheKey, () => fetchOptions(type, opts), 30_000);
      return NextResponse.json(rows);
    }

    const rows = await fetchOptions(type, opts);
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/options error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
