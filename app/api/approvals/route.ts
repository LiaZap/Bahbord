import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

// GET — listar pedidos de aprovação (pendentes, aprovados, rejeitados)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const wsId = await getDefaultWorkspaceId();

    const result = await query(
      `SELECT ar.id, ar.type, ar.status, ar.request_data, ar.reviewer_note, ar.created_at, ar.reviewed_at,
        m.display_name AS requester_name, m.email AS requester_email,
        rm.display_name AS reviewer_name
      FROM approval_requests ar
      JOIN members m ON m.id = ar.requester_id
      LEFT JOIN members rm ON rm.id = ar.reviewer_id
      WHERE ar.workspace_id = $1 AND ar.status = $2
      ORDER BY ar.created_at DESC`,
      [wsId, status]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/approvals error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST — criar pedido de aprovação
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, request_data, requester_id } = body;

    if (!type || !requester_id) {
      return NextResponse.json({ error: 'type e requester_id são obrigatórios' }, { status: 400 });
    }

    const wsId = await getDefaultWorkspaceId();

    // Verificar se já existe pedido pendente do mesmo tipo
    const existing = await query(
      `SELECT id FROM approval_requests WHERE requester_id = $1 AND type = $2 AND status = 'pending'`,
      [requester_id, type]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      return NextResponse.json({ error: 'Já existe um pedido pendente deste tipo' }, { status: 409 });
    }

    const result = await query(
      `INSERT INTO approval_requests (workspace_id, requester_id, type, request_data)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [wsId, requester_id, type, JSON.stringify(request_data || {})]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/approvals error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// PATCH — aprovar ou rejeitar pedido
export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Apenas administradores podem aprovar/rejeitar pedidos' }, { status: 403 });
    }

    const body = await request.json();
    const { id, action, reviewer_note, board_id, project_id, role: assignRole } = body;
    const reviewer_id = auth.id;

    if (!id || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'id e action (approve/reject) são obrigatórios' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const result = await query(
      `UPDATE approval_requests
       SET status = $1, reviewer_id = $2, reviewer_note = $3, reviewed_at = NOW()
       WHERE id = $4 AND status = 'pending'
       RETURNING *`,
      [newStatus, reviewer_id || null, reviewer_note || null, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Pedido não encontrado ou já processado' }, { status: 404 });
    }

    const approval = result.rows[0];

    // Se aprovado e é criação de projeto, criar o projeto automaticamente
    if (action === 'approve' && approval.type === 'project_creation') {
      const data = approval.request_data;
      const wsId = approval.workspace_id;

      if (data.name && data.prefix) {
        const project = await query(
          `INSERT INTO projects (workspace_id, name, prefix, description, color)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [wsId, data.name, data.prefix, data.description || null, data.color || '#3b82f6']
        );

        // Criar board padrão
        if (project.rows[0]) {
          await query(
            `INSERT INTO boards (project_id, name, type, is_default)
             VALUES ($1, 'Board Principal', 'kanban', true)`,
            [project.rows[0].id]
          );

          // Dar acesso admin ao requester no projeto
          await query(
            `INSERT INTO project_roles (project_id, member_id, role)
             VALUES ($1, $2, 'admin')
             ON CONFLICT DO NOTHING`,
            [project.rows[0].id, approval.requester_id]
          );
        }
      }
    }

    // Se aprovado e é acesso ao board (usuário externo)
    if (action === 'approve' && approval.type === 'board_access') {
      const targetBoardId = board_id || approval.request_data?.board_id;
      const targetRole = assignRole || 'viewer';

      if (targetBoardId) {
        // Dar acesso ao board
        await query(
          `INSERT INTO board_roles (board_id, member_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (board_id, member_id) DO UPDATE SET role = $3`,
          [targetBoardId, approval.requester_id, targetRole]
        );

        // Também dar acesso de viewer ao projeto (para ele ver no sidebar)
        const boardProject = await query(
          `SELECT project_id FROM boards WHERE id = $1`, [targetBoardId]
        );
        if (boardProject.rows[0]) {
          await query(
            `INSERT INTO project_roles (project_id, member_id, role)
             VALUES ($1, $2, 'viewer')
             ON CONFLICT (project_id, member_id) DO NOTHING`,
            [boardProject.rows[0].project_id, approval.requester_id]
          );
        }
      }

      // Aprovar membro na org
      await query(`UPDATE members SET is_approved = true WHERE id = $1`, [approval.requester_id]);
    }

    // Se aprovado e é acesso ao projeto
    if (action === 'approve' && approval.type === 'project_access') {
      const targetProjectId = project_id || approval.request_data?.project_id;
      const targetRole = assignRole || 'member';

      if (targetProjectId) {
        await query(
          `INSERT INTO project_roles (project_id, member_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (project_id, member_id) DO UPDATE SET role = $3`,
          [targetProjectId, approval.requester_id, targetRole]
        );
      }

      await query(`UPDATE members SET is_approved = true WHERE id = $1`, [approval.requester_id]);
    }

    // Se aprovado e é acesso à org
    if (action === 'approve' && approval.type === 'org_access') {
      const targetRole = assignRole || 'member';
      await query(
        `INSERT INTO org_roles (workspace_id, member_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (workspace_id, member_id) DO UPDATE SET role = $3`,
        [approval.workspace_id, approval.requester_id, targetRole]
      );
      await query(`UPDATE members SET is_approved = true WHERE id = $1`, [approval.requester_id]);
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/approvals error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
