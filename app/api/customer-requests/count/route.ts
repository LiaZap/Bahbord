import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';
import { hasTicketAccess } from '@/lib/access-check';

// GET /api/customer-requests/count?ticket_id=X
// Retorna { count, customers: ["email1", ...] } pra renderizar badge
// "X clientes pediram" no ticket.
export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');

    if (!ticketId) {
      return NextResponse.json({ error: 'ticket_id é obrigatório' }, { status: 400 });
    }

    const allowed = await hasTicketAccess(auth, ticketId);
    if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const result = await query<{ count: string; customers: string[] }>(
      `SELECT
         COUNT(*)::int AS count,
         COALESCE(
           ARRAY_AGG(DISTINCT customer_email) FILTER (WHERE customer_email IS NOT NULL),
           ARRAY[]::text[]
         ) AS customers
       FROM customer_requests
       WHERE workspace_id = $1 AND ticket_id = $2`,
      [auth.workspace_id, ticketId]
    );

    const row = result.rows[0];
    return NextResponse.json({
      count: Number(row?.count ?? 0),
      customers: row?.customers ?? [],
    });
  } catch (err) {
    console.error('GET /api/customer-requests/count error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
