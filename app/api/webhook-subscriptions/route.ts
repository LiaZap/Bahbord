import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET() {
  try {
    await getAuthMember();
    const workspaceId = await getDefaultWorkspaceId();
    const result = await query(
      `SELECT id, url, secret, events, is_active, created_at
       FROM webhook_subscriptions
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [workspaceId]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/webhook-subscriptions error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    const body = await request.json();
    const { url, secret, events } = body;

    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'url e events são obrigatórios' },
        { status: 400 }
      );
    }

    const workspaceId = await getDefaultWorkspaceId();

    const result = await query(
      `INSERT INTO webhook_subscriptions (workspace_id, url, secret, events)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [workspaceId, url, secret || null, events]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/webhook-subscriptions error:', err);
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
    const { id, url, secret, events, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (url !== undefined) {
      sets.push(`url = $${idx}`);
      values.push(url);
      idx++;
    }
    if (secret !== undefined) {
      sets.push(`secret = $${idx}`);
      values.push(secret || null);
      idx++;
    }
    if (events !== undefined) {
      sets.push(`events = $${idx}`);
      values.push(events);
      idx++;
    }
    if (is_active !== undefined) {
      sets.push(`is_active = $${idx}`);
      values.push(is_active);
      idx++;
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    values.push(id);
    const result = await query(
      `UPDATE webhook_subscriptions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Subscription não encontrada' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/webhook-subscriptions error:', err);
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

    const result = await query(
      `DELETE FROM webhook_subscriptions WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Subscription não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/webhook-subscriptions error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
