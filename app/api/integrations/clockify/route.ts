import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

// GET — returns current Clockify config (api_key masked)
export async function GET() {
  try {
    await getAuthMember();

    const workspaceId = await getDefaultWorkspaceId();

    const result = await query(
      `SELECT id, config, is_active FROM integrations
       WHERE workspace_id = $1 AND provider = 'clockify'`,
      [workspaceId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ enabled: false, api_key: null, workspace_id: null, project_id: null });
    }

    const row = result.rows[0];
    const config = row.config as { api_key?: string; workspace_id?: string; project_id?: string };

    // Mask the API key — show only last 4 chars
    const maskedKey = config.api_key
      ? '••••••••' + config.api_key.slice(-4)
      : null;

    return NextResponse.json({
      enabled: row.is_active,
      api_key: maskedKey,
      workspace_id: config.workspace_id || null,
      project_id: config.project_id || null,
    });
  } catch (err) {
    console.error('GET /api/integrations/clockify error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST — save Clockify config
export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { api_key, workspace_id: clockifyWorkspaceId, project_id } = body;

    if (!api_key || !clockifyWorkspaceId) {
      return NextResponse.json(
        { error: 'api_key e workspace_id são obrigatórios' },
        { status: 400 }
      );
    }

    const workspaceId = await getDefaultWorkspaceId();

    const config = {
      api_key,
      workspace_id: clockifyWorkspaceId,
      project_id: project_id || null,
    };

    const result = await query(
      `INSERT INTO integrations (workspace_id, provider, config, is_active)
       VALUES ($1, 'clockify', $2, true)
       ON CONFLICT (workspace_id, provider)
       DO UPDATE SET config = $2, is_active = true
       RETURNING id`,
      [workspaceId, JSON.stringify(config)]
    );

    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error('POST /api/integrations/clockify error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE — remove Clockify config
export async function DELETE() {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const workspaceId = await getDefaultWorkspaceId();

    await query(
      `DELETE FROM integrations WHERE workspace_id = $1 AND provider = 'clockify'`,
      [workspaceId]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/integrations/clockify error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
