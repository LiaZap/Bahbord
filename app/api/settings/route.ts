import { NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { workspaces, statuses, services, categories, ticketTypes, quickReactions, members, clients } from '@/lib/schema/core';
import { tickets } from '@/lib/schema/tickets';
import { eq, sql } from 'drizzle-orm';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { logAudit, extractRequestMeta } from '@/lib/audit';
import { query } from '@/lib/db';
import type { PgTable } from 'drizzle-orm/pg-core';

// Tabelas auditáveis (subset sensível)
const AUDIT_SENSITIVE_TABLES = new Set(['members', 'clients']);

// Mapa tabela-nome → schema Drizzle
const TABLE_MAP: Record<string, PgTable> = {
  statuses,
  services,
  categories,
  ticket_types: ticketTypes,
  quick_reactions: quickReactions,
  members,
  clients,
};

// Colunas permitidas por tabela (segurança contra injection)
const ALLOWED_COLUMNS: Record<string, string[]> = {
  statuses: ['name', 'color', 'position', 'wip_limit', 'is_done'],
  services: ['name', 'color', 'is_active'],
  categories: ['name', 'color'],
  ticket_types: ['name', 'icon', 'color', 'description_template', 'position'],
  quick_reactions: ['emoji', 'label', 'position'],
  members: ['display_name', 'email', 'role', 'phone'],
  clients: ['name', 'color', 'contact_email', 'contact_phone', 'is_active'],
};

// Camel-case mapping para Drizzle
const COLUMN_CAMEL: Record<string, Record<string, string>> = {
  statuses: { name: 'name', color: 'color', position: 'position', wip_limit: 'wipLimit', is_done: 'isDone' },
  services: { name: 'name', color: 'color', is_active: 'isActive' },
  categories: { name: 'name', color: 'color' },
  ticket_types: { name: 'name', icon: 'icon', color: 'color', description_template: 'descriptionTemplate', position: 'position' },
  quick_reactions: { emoji: 'emoji', label: 'label', position: 'position' },
  members: { display_name: 'displayName', email: 'email', role: 'role', phone: 'phone' },
  clients: { name: 'name', color: 'color', contact_email: 'contactEmail', contact_phone: 'contactPhone', is_active: 'isActive' },
};

function filterAndMapFields(table: string, fields: Record<string, unknown>): Record<string, unknown> {
  const allowed = ALLOWED_COLUMNS[table];
  const camelMap = COLUMN_CAMEL[table];
  if (!allowed || !camelMap) return {};
  const mapped: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (allowed.includes(key) && camelMap[key]) {
      mapped[camelMap[key]] = val;
    }
  }
  return mapped;
}

// GET workspace settings
export async function GET() {
  try {
    const [ws] = await db.select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      prefix: workspaces.prefix,
      description: workspaces.description,
      created_at: workspaces.createdAt,
      updated_at: workspaces.updatedAt,
    }).from(workspaces).limit(1);
    return NextResponse.json(ws || null);
  } catch (err) {
    console.error('GET /api/settings error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// PATCH workspace settings ou item de tabela
export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { table, id, ...fields } = body;

    // Generic CRUD para tabelas de configuração
    if (table) {
      if (!TABLE_MAP[table]) {
        return NextResponse.json({ error: 'Tabela não permitida' }, { status: 400 });
      }

      const mapped = filterAndMapFields(table, fields);
      if (Object.keys(mapped).length === 0) {
        return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
      }

      const drizzleTable = TABLE_MAP[table];
      // Use raw query for dynamic table update (Drizzle requires static table ref for .update())
      const safeFields: Record<string, unknown> = {};
      const allowed = ALLOWED_COLUMNS[table] || [];
      for (const [key, val] of Object.entries(fields)) {
        if (allowed.includes(key)) safeFields[key] = val;
      }
      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      for (const [key, val] of Object.entries(safeFields)) {
        sets.push(`${key} = $${idx}`);
        values.push(val);
        idx++;
      }
      values.push(id);
      const result = await query(
        `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (AUDIT_SENSITIVE_TABLES.has(table)) {
        const meta = extractRequestMeta(request);
        await logAudit({
          workspaceId: auth.workspace_id,
          actorId: auth.id,
          action: `${table}.updated`,
          entityType: table,
          entityId: id,
          changes: safeFields,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });
      }

      return NextResponse.json(result.rows[0]);
    }

    // Update workspace (sem table param)
    const wsUpdate: Record<string, unknown> = {};
    if (body.name !== undefined) wsUpdate.name = body.name;
    if (body.description !== undefined) wsUpdate.description = body.description;
    if (body.prefix !== undefined) wsUpdate.prefix = body.prefix;

    if (Object.keys(wsUpdate).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo' }, { status: 400 });
    }
    wsUpdate.updatedAt = new Date();

    const [updated] = await db.update(workspaces)
      .set(wsUpdate)
      .where(eq(workspaces.id, auth.workspace_id))
      .returning();

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: auth.workspace_id,
      actorId: auth.id,
      action: 'workspace.updated',
      entityType: 'workspace',
      entityId: auth.workspace_id,
      changes: body,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/settings error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST - criar novo item em tabelas de configuração
export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { table, ...fields } = body;

    const allowedTables = ['statuses', 'services', 'categories', 'ticket_types', 'quick_reactions', 'clients'];
    if (!table || !allowedTables.includes(table)) {
      return NextResponse.json({ error: 'Tabela não permitida' }, { status: 400 });
    }

    const workspaceId = auth.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 400 });
    }

    // Filter allowed fields + add workspace_id
    const allowed = ALLOWED_COLUMNS[table] || [];
    const safeFields: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) safeFields[key] = val;
    }
    const allFields = { ...safeFields, workspace_id: workspaceId };
    const columns = Object.keys(allFields);
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const values = Object.values(allFields);

    const result = await query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );

    if (AUDIT_SENSITIVE_TABLES.has(table)) {
      const created = result.rows[0] as { id: string };
      const meta = extractRequestMeta(request);
      await logAudit({
        workspaceId,
        actorId: auth.id,
        action: `${table}.created`,
        entityType: table,
        entityId: created?.id,
        changes: safeFields,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/settings error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE
export async function DELETE(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const id = searchParams.get('id');

    const allowedTables = ['statuses', 'services', 'categories', 'ticket_types', 'quick_reactions', 'clients', 'members'];
    if (!table || !id || !allowedTables.includes(table)) {
      return NextResponse.json({ error: 'table e id obrigatórios' }, { status: 400 });
    }

    // Prevent removing the last admin/owner
    if (table === 'members') {
      const roleCheck = await query(`SELECT COUNT(*) AS cnt FROM org_roles WHERE role IN ('owner', 'admin')`);
      const currentCount = parseInt(roleCheck.rows[0].cnt, 10);
      const memberRole = await query(`SELECT role FROM org_roles WHERE member_id = $1`, [id]);
      const isTargetAdmin = memberRole.rows[0] && ['owner', 'admin'].includes(memberRole.rows[0].role);
      if (isTargetAdmin && currentCount <= 1) {
        return NextResponse.json({ error: 'Não é possível remover o último admin da organização' }, { status: 409 });
      }
    }

    // Verificar se tem tickets associados
    const fkChecks: Record<string, string> = {
      statuses: 'status_id',
      services: 'service_id',
      clients: 'client_id',
      categories: 'category_id',
    };

    if (fkChecks[table]) {
      const [check] = await db
        .select({ cnt: sql<number>`COUNT(*)::int` })
        .from(tickets)
        .where(eq((tickets as any)[fkChecks[table] === 'status_id' ? 'statusId' : fkChecks[table] === 'service_id' ? 'serviceId' : fkChecks[table] === 'client_id' ? 'clientId' : 'categoryId'], id));

      if (check.cnt > 0) {
        return NextResponse.json({ error: `Não é possível remover: existem tickets associados` }, { status: 409 });
      }
    }

    await query(`DELETE FROM ${table} WHERE id = $1`, [id]);

    if (AUDIT_SENSITIVE_TABLES.has(table)) {
      const meta = extractRequestMeta(request);
      await logAudit({
        workspaceId: auth.workspace_id,
        actorId: auth.id,
        action: `${table}.deleted`,
        entityType: table,
        entityId: id,
        changes: {},
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/settings error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
