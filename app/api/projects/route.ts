import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { createProjectSchema } from '@/lib/validators';

export async function GET(request: Request) {
  try {
    await getAuthMember();
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id');
    const workspaceId = await getDefaultWorkspaceId();

    const baseSelect = `
      SELECT
        p.id, p.workspace_id, p.name, p.prefix, p.description, p.color,
        p.is_archived, p.created_at, p.updated_at,
        (SELECT COUNT(*) FROM boards b WHERE b.project_id = p.id)::int AS board_count,
        (SELECT COUNT(*) FROM tickets t WHERE t.project_id = p.id)::int AS ticket_count
      FROM projects p`;

    let result;

    if (memberId) {
      // Verificar nível de acesso do membro
      const orgRole = await query(
        `SELECT role FROM org_roles WHERE member_id = $1 AND workspace_id = $2`,
        [memberId, workspaceId]
      );
      const role = orgRole.rows[0]?.role;

      if (role === 'owner' || role === 'admin') {
        // Org owner/admin → vê todos os projetos
        result = await query(
          `${baseSelect}
           WHERE p.workspace_id = $1 AND p.is_archived = false
           ORDER BY p.name ASC`,
          [workspaceId]
        );
      } else {
        // Cliente/member → só projetos onde tem acesso (project_role ou board_role)
        result = await query(
          `${baseSelect}
           WHERE p.workspace_id = $1 AND p.is_archived = false
             AND (
               EXISTS (SELECT 1 FROM project_roles pr WHERE pr.project_id = p.id AND pr.member_id = $2)
               OR EXISTS (
                 SELECT 1 FROM board_roles br
                 JOIN boards b ON b.id = br.board_id
                 WHERE b.project_id = p.id AND br.member_id = $2
               )
             )
           ORDER BY p.name ASC`,
          [workspaceId, memberId]
        );
      }
    } else {
      // Sem filtro → todos (backward compat)
      result = await query(
        `${baseSelect}
         WHERE p.workspace_id = $1 AND p.is_archived = false
         ORDER BY p.name ASC`,
        [workspaceId]
      );
    }

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/projects error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Capture raw body to preserve non-schema fields (e.g. requester_id)
    let rawBody: Record<string, unknown>;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createProjectSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { name, prefix, description, color, template_id } = parsed.data;

    const workspaceId = await getDefaultWorkspaceId();
    const requesterId = typeof rawBody.requester_id === 'string' ? rawBody.requester_id : undefined;

    // Se requester_id informado, verificar se é owner/admin da org
    // Se não for, criar pedido de aprovação ao invés de criar direto
    if (requesterId) {
      const roleCheck = await query(
        `SELECT role FROM org_roles WHERE member_id = $1 AND workspace_id = $2`,
        [requesterId, workspaceId]
      );
      const role = roleCheck.rows[0]?.role;

      if (role !== 'owner' && role !== 'admin') {
        // Criar pedido de aprovação
        const approval = await query(
          `INSERT INTO approval_requests (workspace_id, requester_id, type, request_data)
           VALUES ($1, $2, 'project_creation', $3)
           RETURNING *`,
          [workspaceId, requesterId, JSON.stringify({ name, prefix: prefix.toUpperCase(), description, color })]
        );
        return NextResponse.json(
          { pending: true, approval_id: approval.rows[0].id, message: 'Pedido de criação enviado para aprovação do administrador' },
          { status: 202 }
        );
      }
    }

    const result = await query(
      `INSERT INTO projects (workspace_id, name, prefix, description, color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [workspaceId, name, prefix.toUpperCase(), description || null, color || '#3b82f6']
    );

    const project = result.rows[0];

    // Create default board for the project
    await query(
      `INSERT INTO boards (project_id, name, type, is_default)
       VALUES ($1, $2, 'kanban', true)`,
      [project.id, 'Board Principal']
    );

    // If template_id provided, log it for future use
    if (template_id) {
      await query(
        `INSERT INTO changelog (workspace_id, project_id, entity_type, entity_id, action, details)
         VALUES ($1, $2, 'project', $3, 'created', $4)`,
        [workspaceId, project.id, project.id, JSON.stringify({ template_id })]
      );
    }

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects error:', err);
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
    const { id, name, description, color, is_archived } = body;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx}`); values.push(name); idx++; }
    if (description !== undefined) { sets.push(`description = $${idx}`); values.push(description); idx++; }
    if (color !== undefined) { sets.push(`color = $${idx}`); values.push(color); idx++; }
    if (is_archived !== undefined) { sets.push(`is_archived = $${idx}`); values.push(is_archived); idx++; }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE projects SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/projects error:', err);
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

    // Archive instead of hard delete
    const result = await query(
      `UPDATE projects SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, project: result.rows[0] });
  } catch (err) {
    console.error('DELETE /api/projects error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
