import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Clerk webhook to sync user data
// Configure in Clerk Dashboard → Webhooks → Add Endpoint
// URL: https://your-domain.com/api/webhooks/clerk
// Events: user.created, user.updated, user.deleted

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data } = body;

    switch (type) {
      case 'user.created':
      case 'user.updated': {
        const { id, first_name, last_name, email_addresses } = data;
        const displayName = [first_name, last_name].filter(Boolean).join(' ') || 'Usuário';
        const email = email_addresses?.[0]?.email_address || '';

        // Upsert member
        const wsResult = await query(`SELECT id FROM workspaces LIMIT 1`);
        const workspaceId = wsResult.rows[0]?.id;
        if (!workspaceId) break;

        await query(
          `INSERT INTO members (workspace_id, user_id, clerk_user_id, display_name, email, role, is_approved)
           VALUES ($1, $2, $3, $4, $5, 'member', false)
           ON CONFLICT (workspace_id, user_id) DO UPDATE
           SET display_name = $4, email = $5, clerk_user_id = $3`,
          [workspaceId, id, id, displayName, email]
        );
        break;
      }

      case 'user.deleted': {
        const { id } = data;
        await query(`DELETE FROM members WHERE clerk_user_id = $1`, [id]);
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Clerk webhook error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
