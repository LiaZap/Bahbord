import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { hasTicketAccess } from '@/lib/access-check';
import { logAudit, extractRequestMeta } from '@/lib/audit';

interface CustomerRequestRow {
  id: string;
  workspace_id: string;
  ticket_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  request_text: string;
  source: string;
  source_url: string | null;
  resolved_at: string | null;
  created_at: string;
  created_by: string | null;
}

async function loadRequest(id: string, workspaceId: string): Promise<CustomerRequestRow | null> {
  const res = await query<CustomerRequestRow>(
    `SELECT id, workspace_id, ticket_id, customer_email, customer_name,
            request_text, source, source_url, resolved_at, created_at, created_by
     FROM customer_requests
     WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId]
  );
  return res.rows[0] ?? null;
}

// ----------------------------------------------------------------------------
// PATCH /api/customer-requests/[id]
// body: { ticket_id?, resolved_at? }
//   - vincula a ticket (ou desliga com null) e/ou marca resolvido
// ----------------------------------------------------------------------------
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { id } = await params;
    const existing = await loadRequest(id, auth.workspace_id);
    if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const { ticket_id, resolved_at } = body as {
      ticket_id?: string | null;
      resolved_at?: string | boolean | null;
    };

    // Se vai vincular a ticket diferente, valida acesso
    if (ticket_id !== undefined && ticket_id !== null && ticket_id !== existing.ticket_id) {
      const allowed = await hasTicketAccess(auth, ticket_id);
      if (!allowed) return NextResponse.json({ error: 'Acesso negado ao ticket' }, { status: 403 });
    }
    // Se já tinha ticket vinculado, valida acesso ao antigo também
    if (existing.ticket_id) {
      const allowedOld = await hasTicketAccess(auth, existing.ticket_id);
      if (!allowedOld && !isAdmin(auth.role)) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
    }

    // Monta UPDATE dinâmico
    const updates: string[] = [];
    const values: Array<unknown> = [];
    if (ticket_id !== undefined) {
      values.push(ticket_id);
      updates.push(`ticket_id = $${values.length}`);
    }
    if (resolved_at !== undefined) {
      // aceita ISO string OR null OR true (now())
      let val: string | null = null;
      if (resolved_at === true || resolved_at === 'now') {
        val = new Date().toISOString();
      } else if (typeof resolved_at === 'string' && resolved_at) {
        val = resolved_at;
      }
      values.push(val);
      updates.push(`resolved_at = $${values.length}`);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nada a atualizar' }, { status: 400 });
    }

    values.push(id);
    values.push(auth.workspace_id);
    const updated = await query<CustomerRequestRow>(
      `UPDATE customer_requests
       SET ${updates.join(', ')}
       WHERE id = $${values.length - 1} AND workspace_id = $${values.length}
       RETURNING id, workspace_id, ticket_id, customer_email, customer_name,
                 request_text, source, source_url, resolved_at, created_at, created_by`,
      values
    );

    const row = updated.rows[0];
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: auth.workspace_id,
      actorId: auth.id,
      action: 'customer_request.updated',
      entityType: 'customer_request',
      entityId: id,
      changes: {
        before: { ticket_id: existing.ticket_id, resolved_at: existing.resolved_at },
        after: { ticket_id: row.ticket_id, resolved_at: row.resolved_at },
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(row);
  } catch (err) {
    console.error('PATCH /api/customer-requests/[id] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// ----------------------------------------------------------------------------
// DELETE /api/customer-requests/[id] - admin only
// ----------------------------------------------------------------------------
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await loadRequest(id, auth.workspace_id);
    if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

    await query(
      `DELETE FROM customer_requests WHERE id = $1 AND workspace_id = $2`,
      [id, auth.workspace_id]
    );

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: auth.workspace_id,
      actorId: auth.id,
      action: 'customer_request.deleted',
      entityType: 'customer_request',
      entityId: id,
      changes: {
        ticket_id: existing.ticket_id,
        customer_email: existing.customer_email,
        source: existing.source,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/customer-requests/[id] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
