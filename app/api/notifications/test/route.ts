import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { createNotification } from '@/lib/notifications';

/**
 * POST /api/notifications/test
 * Admin-only. Cria uma notificação de teste para o member_id do body
 * (ou pra si mesmo se não passar). Retorna o que aconteceu pra debug.
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const targetId = body.member_id || auth.id;
    const workspaceId = await getDefaultWorkspaceId();

    // Conta antes
    const before = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM notifications WHERE COALESCE(recipient_id, member_id) = $1`,
      [targetId]
    );

    // Cria notificação
    let createError: string | null = null;
    try {
      await createNotification({
        workspace_id: workspaceId,
        recipient_id: targetId,
        actor_id: auth.id,
        type: 'test',
        title: 'Notificação de teste',
        message: `Disparada por ${auth.display_name} em ${new Date().toLocaleString('pt-BR')}`,
      });
    } catch (e) {
      createError = e instanceof Error ? e.message : String(e);
    }

    // Conta depois
    const after = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM notifications WHERE COALESCE(recipient_id, member_id) = $1`,
      [targetId]
    );

    // Última notif
    const last = await query(
      `SELECT id, type, title, message, recipient_id, member_id, created_at
       FROM notifications
       WHERE COALESCE(recipient_id, member_id) = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [targetId]
    );

    // Schema da tabela
    const cols = await query<{ column_name: string; is_nullable: string; data_type: string }>(
      `SELECT column_name, is_nullable, data_type
       FROM information_schema.columns
       WHERE table_name = 'notifications'
       ORDER BY ordinal_position`
    );

    return NextResponse.json({
      target_member_id: targetId,
      target_workspace_id: workspaceId,
      count_before: parseInt(before.rows[0]?.count || '0'),
      count_after: parseInt(after.rows[0]?.count || '0'),
      created: parseInt(after.rows[0]?.count || '0') > parseInt(before.rows[0]?.count || '0'),
      create_error: createError,
      last_notification: last.rows[0] || null,
      schema: cols.rows,
    });
  } catch (err) {
    console.error('POST /api/notifications/test error:', err);
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    );
  }
}
