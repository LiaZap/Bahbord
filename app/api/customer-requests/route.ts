import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';
import { hasTicketAccess } from '@/lib/access-check';
import { logAudit, extractRequestMeta } from '@/lib/audit';

// ----------------------------------------------------------------------------
// /api/customer-requests
// ----------------------------------------------------------------------------
// GET  ?ticket_id=X   -> lista todos requests linkados ao ticket
// POST                -> cria request
//   - Auth normal: member do workspace
//   - Público: header X-Public-Form-Secret == process.env.PUBLIC_FORM_SECRET
//     (usado por formulário externo / share link)
// ----------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');

    if (ticketId) {
      const allowed = await hasTicketAccess(auth, ticketId);
      if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const params: Array<unknown> = [auth.workspace_id];
    let where = 'cr.workspace_id = $1';

    if (ticketId) {
      params.push(ticketId);
      where += ` AND cr.ticket_id = $${params.length}`;
    }

    const result = await query(
      `SELECT
         cr.id, cr.workspace_id, cr.ticket_id,
         cr.customer_email, cr.customer_name, cr.request_text,
         cr.source, cr.source_url,
         cr.created_at, cr.created_by, cr.resolved_at,
         m.display_name AS created_by_name
       FROM customer_requests cr
       LEFT JOIN members m ON m.id = cr.created_by
       WHERE ${where}
       ORDER BY cr.created_at DESC`,
      params
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/customer-requests error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      ticket_id,
      customer_email,
      customer_name,
      request_text,
      source,
      source_url,
    } = body as {
      ticket_id?: string;
      customer_email?: string;
      customer_name?: string;
      request_text?: string;
      source?: string;
      source_url?: string;
    };

    if (!request_text || !request_text.trim()) {
      return NextResponse.json({ error: 'request_text é obrigatório' }, { status: 400 });
    }
    // Limites server-side pra prevenir DoS/spam via formulário público
    if (request_text.length > 5000) {
      return NextResponse.json({ error: 'request_text excede 5000 caracteres' }, { status: 400 });
    }
    if (customer_name && customer_name.length > 200) {
      return NextResponse.json({ error: 'customer_name excede 200 caracteres' }, { status: 400 });
    }

    const validSources = ['manual', 'share_link', 'email', 'form'];
    const finalSource = source && validSources.includes(source) ? source : 'manual';

    // -------- AUTH: público com secret OU membro autenticado --------
    const publicSecret = request.headers.get('x-public-form-secret');
    const expectedSecret = process.env.PUBLIC_FORM_SECRET;
    const isPublic = !!(publicSecret && expectedSecret && publicSecret === expectedSecret);

    let workspaceId: string | null = null;
    let actorId: string | null = null;

    if (isPublic) {
      // Público: precisa resolver workspace. Se vier ticket_id, deriva. Senão,
      // pega o workspace default (assume single-tenant pra v1).
      if (ticket_id) {
        const wsRes = await query<{ workspace_id: string }>(
          `SELECT workspace_id FROM tickets WHERE id = $1 LIMIT 1`,
          [ticket_id]
        );
        if (wsRes.rows[0]) workspaceId = wsRes.rows[0].workspace_id;
      }
      if (!workspaceId) {
        const defaultWs = await query<{ id: string }>(`SELECT id FROM workspaces LIMIT 1`);
        workspaceId = defaultWs.rows[0]?.id ?? null;
      }
      if (!workspaceId) {
        return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 500 });
      }
    } else {
      const auth = await getAuthMember();
      if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

      if (ticket_id) {
        const allowed = await hasTicketAccess(auth, ticket_id);
        if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }

      workspaceId = auth.workspace_id;
      actorId = auth.id;
    }

    const result = await query<{ id: string }>(
      `INSERT INTO customer_requests
        (workspace_id, ticket_id, customer_email, customer_name, request_text, source, source_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, workspace_id, ticket_id, customer_email, customer_name,
                 request_text, source, source_url, created_at, created_by, resolved_at`,
      [
        workspaceId,
        ticket_id || null,
        customer_email || null,
        customer_name || null,
        request_text.trim(),
        finalSource,
        source_url || null,
        actorId,
      ]
    );

    const created = result.rows[0];
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId,
      actorId,
      action: 'customer_request.created',
      entityType: 'customer_request',
      entityId: created.id,
      changes: {
        ticket_id: ticket_id || null,
        source: finalSource,
        customer_email: customer_email || null,
        is_public: isPublic,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('POST /api/customer-requests error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
