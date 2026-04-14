import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';

interface ClockifyConfig {
  api_key: string;
  workspace_id: string;
  project_id?: string | null;
}

interface TimeEntry {
  id: string;
  ticket_id: string;
  description: string | null;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  ticket_key: string;
}

// POST — sync unsynced time entries to Clockify
export async function POST() {
  try {
    const workspaceId = await getDefaultWorkspaceId();

    // 1. Get Clockify config
    const configResult = await query(
      `SELECT config, is_active FROM integrations
       WHERE workspace_id = $1 AND provider = 'clockify'`,
      [workspaceId]
    );

    if (configResult.rows.length === 0 || !configResult.rows[0].is_active) {
      return NextResponse.json(
        { error: 'Integração Clockify não configurada ou desativada' },
        { status: 400 }
      );
    }

    const config = configResult.rows[0].config as ClockifyConfig;

    if (!config.api_key || !config.workspace_id) {
      return NextResponse.json(
        { error: 'API key ou Workspace ID do Clockify não configurados' },
        { status: 400 }
      );
    }

    // 2. Fetch unsynced time entries (completed only, with ended_at)
    const entriesResult = await query<TimeEntry>(
      `SELECT te.id, te.ticket_id, te.description, te.started_at, te.ended_at,
              te.duration_minutes,
              COALESCE(w.prefix, '') || '-' || t.sequence_number AS ticket_key
       FROM time_entries te
       LEFT JOIN tickets t ON t.id = te.ticket_id
       LEFT JOIN workspaces w ON w.id = t.workspace_id
       WHERE te.external_id IS NULL
         AND te.is_running = false
         AND te.ended_at IS NOT NULL
       ORDER BY te.started_at ASC
       LIMIT 100`,
      []
    );

    if (entriesResult.rows.length === 0) {
      return NextResponse.json({ synced: 0, message: 'Nenhuma entrada para sincronizar' });
    }

    let syncedCount = 0;
    const errors: string[] = [];

    // 3. For each entry, create in Clockify
    for (const entry of entriesResult.rows) {
      try {
        const clockifyPayload = {
          start: new Date(entry.started_at).toISOString(),
          end: new Date(entry.ended_at).toISOString(),
          description: `[${entry.ticket_key}] ${entry.description || ''}`.trim(),
          ...(config.project_id ? { projectId: config.project_id } : {}),
        };

        const response = await fetch(
          `https://api.clockify.me/api/v1/workspaces/${config.workspace_id}/time-entries`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': config.api_key,
            },
            body: JSON.stringify(clockifyPayload),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          errors.push(`Entrada ${entry.id}: ${response.status} - ${errorText}`);
          continue;
        }

        const clockifyEntry = await response.json();

        // 4. Mark as synced
        await query(
          `UPDATE time_entries SET external_id = $1 WHERE id = $2`,
          [clockifyEntry.id, entry.id]
        );

        syncedCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Entrada ${entry.id}: ${message}`);
      }
    }

    return NextResponse.json({
      synced: syncedCount,
      total: entriesResult.rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('POST /api/integrations/clockify/sync error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
