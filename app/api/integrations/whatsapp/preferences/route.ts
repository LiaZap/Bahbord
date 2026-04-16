import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

// GET - list notification preferences for a member
export async function GET(request: Request) {
  try {
    await getAuthMember();

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json({ error: 'memberId obrigatorio' }, { status: 400 });
    }

    const result = await query(
      `SELECT event, channel, is_enabled FROM notification_preferences
       WHERE member_id = $1 AND channel = 'whatsapp'`,
      [memberId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/integrations/whatsapp/preferences error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST - upsert a notification preference
export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { memberId, event, channel, isEnabled } = body;

    if (!memberId || !event || !channel) {
      return NextResponse.json(
        { error: 'memberId, event e channel sao obrigatorios' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO notification_preferences (member_id, channel, event, is_enabled)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (member_id, channel, event)
       DO UPDATE SET is_enabled = $4
       RETURNING *`,
      [memberId, channel, event, isEnabled]
    );

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/integrations/whatsapp/preferences error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
