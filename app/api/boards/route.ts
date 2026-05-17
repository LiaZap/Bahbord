import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { db } from '@/lib/drizzle';
import { boards } from '@/lib/schema/tickets';
import { boardRoles } from '@/lib/schema/rbac';
import { eq } from 'drizzle-orm';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const memberId = searchParams.get('member_id');

    let result;

    // Without project_id: return all boards the member has access to
    if (!projectId && memberId) {
      const orgRole = await query(
        `SELECT role FROM org_roles WHERE member_id = $1`, [memberId]
      );
      const isOrgAdmin = orgRole.rows[0] && ['owner', 'admin'].includes(orgRole.rows[0].role);

      if (isOrgAdmin) {
        result = await query(
          `SELECT b.id, b.project_id, b.name, b.type, b.is_default FROM boards b ORDER BY b.is_default DESC, b.name ASC`
        );
      } else {
        result = await query(
          `SELECT b.id, b.project_id, b.name, b.type, b.is_default FROM boards b
           WHERE EXISTS (SELECT 1 FROM board_roles br WHERE br.board_id = b.id AND br.member_id = $1)
              OR EXISTS (SELECT 1 FROM project_roles pr WHERE pr.project_id = b.project_id AND pr.member_id = $1)
           ORDER BY b.is_default DESC, b.name ASC`,
          [memberId]
        );
      }
      return NextResponse.json(result.rows);
    }

    if (!projectId) {
      result = await query(`SELECT b.id, b.project_id, b.name, b.type, b.is_default FROM boards b ORDER BY b.is_default DESC, b.name ASC`);
      return NextResponse.json(result.rows);
    }

    if (memberId) {
      // Verificar se membro é admin do projeto ou da org
      const projectRole = await query(
        `SELECT role FROM project_roles WHERE member_id = $1 AND project_id = $2`,
        [memberId, projectId]
      );
      const pRole = projectRole.rows[0]?.role;

      if (pRole === 'admin') {
        // Project admin → vê todos os boards do projeto
        result = await query(
          `SELECT
            b.id, b.project_id, b.name, b.description, b.type,
            b.filter_query, b.is_default, b.created_at, b.updated_at,
            (SELECT COUNT(*) FROM tickets t WHERE t.board_id = b.id)::int AS ticket_count
          FROM boards b
          WHERE b.project_id = $1
          ORDER BY b.is_default DESC, b.name ASC`,
          [projectId]
        );
      } else {
        // Member/viewer → só boards onde tem board_role
        result = await query(
          `SELECT
            b.id, b.project_id, b.name, b.description, b.type,
            b.filter_query, b.is_default, b.created_at, b.updated_at,
            (SELECT COUNT(*) FROM tickets t WHERE t.board_id = b.id)::int AS ticket_count
          FROM boards b
          WHERE b.project_id = $1
            AND (
              -- Project admin/member vê todos
              EXISTS (SELECT 1 FROM project_roles pr WHERE pr.project_id = $1 AND pr.member_id = $2 AND pr.role IN ('admin', 'member'))
              -- Ou tem board_role específico
              OR EXISTS (SELECT 1 FROM board_roles br WHERE br.board_id = b.id AND br.member_id = $2)
              -- Ou é org admin/owner
              OR EXISTS (SELECT 1 FROM org_roles orr JOIN projects p ON p.workspace_id = orr.workspace_id WHERE p.id = $1 AND orr.member_id = $2 AND orr.role IN ('owner', 'admin'))
            )
          ORDER BY b.is_default DESC, b.name ASC`,
          [projectId, memberId]
        );
      }
    } else {
      // Sem filtro → todos (backward compat)
      result = await query(
        `SELECT
          b.id, b.project_id, b.name, b.description, b.type,
          b.filter_query, b.is_default, b.created_at, b.updated_at,
          (SELECT COUNT(*) FROM tickets t WHERE t.board_id = b.id)::int AS ticket_count
        FROM boards b
        WHERE b.project_id = $1
        ORDER BY b.is_default DESC, b.name ASC`,
        [projectId]
      );
    }

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/boards error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    const body = await request.json();
    const { project_id, name, type, description } = body;

    if (!project_id || !name) {
      return NextResponse.json({ error: 'project_id e name são obrigatórios' }, { status: 400 });
    }

    // Verificar permissão: precisa ser project admin ou org admin
    if (!auth) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    if (!isAdmin(auth.role)) {
      const projRole = await query(
        `SELECT role FROM project_roles WHERE member_id = $1 AND project_id = $2`,
        [auth.id, project_id]
      );
      if (projRole.rows[0]?.role !== 'admin') {
        return NextResponse.json({ error: 'Apenas administradores do projeto podem criar boards' }, { status: 403 });
      }
    }

    const validTypes = ['kanban', 'scrum', 'simple'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json({ error: `type inválido. Use: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const [board] = await db.insert(boards).values({
      projectId: project_id,
      name,
      type: type || 'kanban',
      description: description || null,
    }).returning();

    // Dar board_role admin ao criador
    if (auth) {
      await db.insert(boardRoles).values({
        boardId: board.id,
        memberId: auth.id,
        role: 'admin',
      }).onConflictDoNothing();
    }

    return NextResponse.json(board, { status: 201 });
  } catch (err) {
    console.error('POST /api/boards error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    if (!isAdmin(auth.role)) {
      // Verificar se é board admin ou project admin
      const body_check = await request.clone().json();
      if (body_check.id) {
        const boardRole = await query(`SELECT role FROM board_roles WHERE board_id = $1 AND member_id = $2`, [body_check.id, auth.id]);
        const projRole = await query(
          `SELECT pr.role FROM project_roles pr JOIN boards b ON b.project_id = pr.project_id WHERE b.id = $1 AND pr.member_id = $2`,
          [body_check.id, auth.id]
        );
        if (boardRole.rows[0]?.role !== 'admin' && projRole.rows[0]?.role !== 'admin') {
          return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }
      }
    }

    const body = await request.json();
    const { id, name, description } = body;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }
    updateData.updatedAt = new Date();

    const [updated] = await db.update(boards)
      .set(updateData)
      .where(eq(boards.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Board não encontrado' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/boards error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Apenas administradores podem remover boards' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const deleted = await db.delete(boards).where(eq(boards.id, id)).returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Board não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/boards error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
