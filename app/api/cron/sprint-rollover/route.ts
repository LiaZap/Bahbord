import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { notifyMember } from '@/lib/notifications';
import { rolloverSprint } from '@/lib/sprint-rollover';
import { safeEqual } from '@/lib/crypto-utils';

/**
 * Cron worker — rola sprints expiradas com `auto_rollover=true` para a
 * próxima sprint, movendo tickets em aberto e notificando os envolvidos.
 *
 * Frequência alvo: diariamente às 06:00 (America/Sao_Paulo) =
 *   09:00 UTC (BRT é UTC-3, sem DST atualmente).
 *
 * Auth: igual aos demais crons —
 *  - header `x-cron-secret: <CRON_SECRET>` OU
 *  - header `Authorization: Bearer <CRON_SECRET>`
 *  - se CRON_SECRET não estiver setado: dev → permite, prod → 401.
 *
 * Critério de seleção:
 *   - sprints.auto_rollover = true
 *   - sprints.is_active = true
 *   - sprints.end_date <= NOW()
 *   - sprints.rolled_over_at IS NULL  (idempotência: o helper marca depois)
 *
 * Estratégia por sprint (try/catch isolado):
 *   1. `rolloverSprint(sprintId)` — backend-eng cria a próxima sprint,
 *      move tickets abertos e marca `rolled_over_at = NOW()` no antigo.
 *   2. Notifica owner do workspace + assignees afetados via
 *      `event: 'sprint.rolled_over'`.
 */

interface SprintRow {
  id: string;
  workspace_id: string;
  name: string;
  end_date: string;
}

interface RolloverResult {
  // Helper retorna snake_case (mesmo shape do endpoint manual)
  old_sprint_id?: string;
  new_sprint_id?: string;
  moved_count?: number;
  archived_count?: number;
  strategy?: string;
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== 'production') return true;
    return false;
  }
  const headerSecret =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    null;
  return safeEqual(headerSecret, secret);
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://projetos.bahtech.com.br';
}

async function findWorkspaceOwner(workspaceId: string): Promise<string | null> {
  try {
    const r = await query<{ id: string }>(
      `SELECT id FROM members
       WHERE workspace_id = $1 AND role = 'owner'
       ORDER BY created_at ASC
       LIMIT 1`,
      [workspaceId]
    );
    return r.rows[0]?.id || null;
  } catch (err) {
    console.error(
      `[cron/sprint-rollover] erro buscando owner ws=${workspaceId}:`,
      err
    );
    return null;
  }
}

/**
 * Helper retorna apenas IDs/contadores. Buscamos o nome da nova sprint e
 * os assignees afetados (via sprint_id ou parent_sprint_id) em queries
 * separadas pra notificar todos os envolvidos.
 */
async function assigneesFromNewSprint(newSprintId: string): Promise<string[]> {
  try {
    const r = await query<{ assignee_id: string }>(
      `SELECT DISTINCT assignee_id
       FROM tickets
       WHERE sprint_id = $1 AND assignee_id IS NOT NULL`,
      [newSprintId]
    );
    return r.rows.map((row) => row.assignee_id);
  } catch (err) {
    console.error('[cron/sprint-rollover] erro lendo assignees:', err);
    return [];
  }
}

async function fetchSprintName(sprintId: string): Promise<string | null> {
  try {
    const r = await query<{ name: string }>(
      `SELECT name FROM sprints WHERE id = $1`,
      [sprintId]
    );
    return r.rows[0]?.name || null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  let rolledOver = 0;
  const errors: { sprint_id: string; error: string }[] = [];

  try {
    const due = await query<SprintRow>(
      `SELECT id, workspace_id, name, end_date
       FROM sprints
       WHERE auto_rollover = true
         AND is_active = true
         AND end_date <= NOW()
         AND rolled_over_at IS NULL
       ORDER BY end_date ASC
       LIMIT 100`
    );

    for (const s of due.rows) {
      try {
        const result = (await rolloverSprint(s.id)) as
          | RolloverResult
          | undefined;

        rolledOver += 1;

        // Monta destinatários: owner do workspace + assignees afetados (set).
        const recipients = new Set<string>();
        const ownerId = await findWorkspaceOwner(s.workspace_id);
        if (ownerId) recipients.add(ownerId);

        const newSprintId = result?.new_sprint_id;
        const inferredAssignees = newSprintId
           ? await assigneesFromNewSprint(newSprintId)
          : [];
        for (const id of inferredAssignees) {
          if (id) recipients.add(id);
        }

        const newName =
          (newSprintId ? await fetchSprintName(newSprintId) : null) ||
          'próxima sprint';
        const moved = result?.moved_count ?? 0;
        // Não há rota /sprints/[id] — linka pra lista
        const link = `${appUrl()}/sprints`;

        const message =
          `Sprint "${s.name}" foi encerrada e ${moved} ticket(s) ` +
          `em aberto migraram para "${newName}". Acesse: ${link}`;

        for (const memberId of recipients) {
          notifyMember(memberId, 'sprint.rolled_over', {
            title: 'Sprint rolada automaticamente',
            message,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[cron/sprint-rollover] falha sprint ${s.id}:`,
          msg
        );
        errors.push({ sprint_id: s.id, error: msg });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: due.rows.length,
      rolled_over: rolledOver,
      errors,
      ran_at: startedAt.toISOString(),
    });
  } catch (err) {
    console.error('POST /api/cron/sprint-rollover error:', err);
    return NextResponse.json(
      { error: 'Erro interno', message: (err as Error).message },
      { status: 500 }
    );
  }
}

// Vercel Cron usa GET por padrão — proxy.
export async function GET(request: Request) {
  return POST(request);
}

// =============================================================================
// COMO AGENDAR
// =============================================================================
//
// 1) RODAR MANUALMENTE (smoke test):
//
//    # local
//    curl -X POST http://localhost:3000/api/cron/sprint-rollover \
//      -H "Authorization: Bearer $CRON_SECRET"
//
//    # prod
//    curl -X POST https://projetos.bahtech.com.br/api/cron/sprint-rollover \
//      -H "x-cron-secret: $CRON_SECRET"
//
//
// 2) GITHUB ACTIONS (.github/workflows/cron.yml).
//    Diário 06:00 SP = 09:00 UTC (BRT é UTC-3, sem DST atualmente).
//
//    name: Cron — Sprint rollover
//    on:
//      schedule:
//        - cron: '0 9 * * *'    # diariamente às 09:00 UTC = 06:00 SP
//      workflow_dispatch: {}
//    jobs:
//      sprint-rollover:
//        runs-on: ubuntu-latest
//        steps:
//          - name: Hit sprint rollover
//            run: |
//              curl -fsS -X POST "${{ secrets.APP_URL }}/api/cron/sprint-rollover" \
//                -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
//
//
// 3) VERCEL CRON (vercel.json).
//
//    {
//      "crons": [
//        { "path": "/api/cron/sprint-rollover", "schedule": "0 9 * * *" }
//      ]
//    }
//
//    Vercel injeta `Authorization: Bearer <CRON_SECRET>` automaticamente
//    se a env CRON_SECRET estiver setada no projeto.
// =============================================================================
