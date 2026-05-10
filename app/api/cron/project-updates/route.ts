import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { query } from '@/lib/db';
import { notifyMember } from '@/lib/notifications';
import { generateAndSaveUpdateForProject } from '@/lib/project-updates';
import { safeEqual } from '@/lib/crypto-utils';

/**
 * Sentry Cron monitoring (Fase 7.3) — ver comentário equivalente em
 * /api/cron/sla-check/route.ts. No-op gracioso quando DSN não definido.
 *
 * Schedule: sexta 20:00 UTC (= 17:00 America/Sao_Paulo).
 * maxRuntime maior porque o resumo semanal pode chamar a OpenAI por projeto.
 */
const MONITOR_SLUG = 'cron-project-updates';
const MONITOR_CONFIG = {
  schedule: { type: 'crontab', value: '0 20 * * 5' },
  checkinMargin: 10,
  maxRuntime: 15,
  timezone: 'UTC',
} as const;

/**
 * Cron worker — gera o status update semanal de cada projeto não-arquivado
 * e notifica o owner do workspace.
 *
 * Frequência alvo: toda sexta-feira às 17:00 (America/Sao_Paulo) =
 *   20:00 UTC durante BRT (UTC-3, sem DST atualmente).
 *
 * Auth: igual aos demais crons —
 *  - header `x-cron-secret: <CRON_SECRET>` OU
 *  - header `Authorization: Bearer <CRON_SECRET>`
 *  - se CRON_SECRET não estiver setado: dev → permite, prod → 401.
 *
 * Idempotência: a tabela `project_updates` (criada pela backend-eng-3b) tem
 * `UNIQUE(project_id, period_from, period_to)`. Se o cron rodar duas vezes
 * no mesmo período, a segunda execução incrementa `skipped` em vez de
 * duplicar — `generateAndSaveUpdateForProject` deve absorver o conflito e
 * retornar `{ status: 'skipped' }` (ou throw com código de unique violation,
 * que tratamos como skip aqui).
 *
 * Cap: 50 projetos por execução. Se um workspace tiver mais que isso, os
 * extras ficam pra próxima rodada (improvável na prática).
 *
 * Estratégia por projeto (try/catch isolado — falha de um não aborta batch):
 *   1. Calcula período: periodFrom = segunda 00:00 SP da semana corrente,
 *      periodTo = NOW().
 *   2. Chama `generateAndSaveUpdateForProject(projectId, from, to, true)`.
 *   3. Notifica o owner do workspace via in-app
 *      (`event: 'project_update.generated'`).
 */

const PROJECT_CAP = 50;

interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
}

interface UpdateResult {
  id?: string;
  status?: 'created' | 'skipped';
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

/**
 * Início da semana corrente em America/Sao_Paulo (segunda 00:00).
 * SP = UTC-3 fixo, sem DST. Calculamos via offset literal pra evitar
 * dependência de Intl/timezone db.
 *
 * Lógica: pega o "agora local SP", zera para 00:00 da segunda dessa semana,
 * e devolve o instante UTC equivalente.
 */
function startOfWeekSP(now: Date): Date {
  const SP_OFFSET_HOURS = -3;
  const spNow = new Date(now.getTime() + SP_OFFSET_HOURS * 60 * 60 * 1000);
  // Em SP-time, getUTC* representa o calendário local.
  const dow = spNow.getUTCDay(); // 0=Dom, 1=Seg, ..., 6=Sáb
  const daysSinceMonday = (dow + 6) % 7; // Seg→0, Ter→1, ..., Dom→6
  const mondaySP = new Date(spNow);
  mondaySP.setUTCDate(mondaySP.getUTCDate() - daysSinceMonday);
  mondaySP.setUTCHours(0, 0, 0, 0);
  // Converte de volta pra UTC real.
  return new Date(mondaySP.getTime() - SP_OFFSET_HOURS * 60 * 60 * 1000);
}

/**
 * Owner do workspace. Pega o member com role='owner' (menor created_at
 * desempata caso haja mais de um). Retorna null se workspace não tem owner
 * cadastrado — improvável, mas tratamos.
 */
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
      `[cron/project-updates] erro buscando owner ws=${workspaceId}:`,
      err
    );
    return null;
  }
}

async function runProjectUpdates(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  const periodFrom = startOfWeekSP(startedAt);
  const periodTo = startedAt;

  let generated = 0;
  let skipped = 0;
  const errors: { project_id: string; error: string }[] = [];

  try {
    const projects = await query<ProjectRow>(
      `SELECT id, workspace_id, name
       FROM projects
       WHERE is_archived = false
       ORDER BY workspace_id, created_at ASC
       LIMIT $1`,
      [PROJECT_CAP]
    );

    for (const p of projects.rows) {
      try {
        const result = (await generateAndSaveUpdateForProject(
          p.id,
          periodFrom,
          periodTo,
          true
        )) as UpdateResult | undefined;

        // Helper pode retornar `{status:'skipped'}` quando a unique constraint
        // já cobriu o período — não notificamos nesses casos.
        if (result?.status === 'skipped') {
          skipped += 1;
          continue;
        }

        generated += 1;

        // Notificação in-app pro owner do workspace.
        const ownerId = await findWorkspaceOwner(p.workspace_id);
        if (ownerId) {
          const link = result?.id
            ? `${appUrl()}/projects/${p.id}/updates/${result.id}`
            : `${appUrl()}/projects/${p.id}/updates`;
          notifyMember(ownerId, 'project_update.generated', {
            title: 'Status update semanal gerado',
            message: `Novo status update do projeto "${p.name}" disponível: ${link}`,
          });
        } else {
          console.log(
            `[cron/project-updates] ws=${p.workspace_id} sem owner — update ${p.id} gerado sem notificação`
          );
        }
      } catch (err) {
        // Postgres unique_violation = 23505. Se o helper deixar vazar, tratamos como skip.
        const e = err as { code?: string; message?: string };
        if (e?.code === '23505') {
          skipped += 1;
          continue;
        }
        const msg = e?.message || String(err);
        console.error(
          `[cron/project-updates] falha projeto ${p.id}:`,
          msg
        );
        errors.push({ project_id: p.id, error: msg });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: projects.rows.length,
      generated,
      skipped,
      errors,
      period_from: periodFrom.toISOString(),
      period_to: periodTo.toISOString(),
      ran_at: startedAt.toISOString(),
    });
  } catch (err) {
    console.error('POST /api/cron/project-updates error:', err);
    return NextResponse.json(
      { error: 'Erro interno', message: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  return Sentry.withMonitor(
    MONITOR_SLUG,
    () => runProjectUpdates(request),
    MONITOR_CONFIG,
  );
}

// Vercel Cron usa GET por padrão — proxy.
export async function GET(request: Request): Promise<NextResponse> {
  return POST(request);
}

// =============================================================================
// COMO AGENDAR
// =============================================================================
//
// 1) RODAR MANUALMENTE (smoke test):
//
//    # local
//    curl -X POST http://localhost:3000/api/cron/project-updates \
//      -H "Authorization: Bearer $CRON_SECRET"
//
//    # prod
//    curl -X POST https://projetos.bahtech.com.br/api/cron/project-updates \
//      -H "x-cron-secret: $CRON_SECRET"
//
//
// 2) GITHUB ACTIONS (.github/workflows/cron.yml).
//    Sexta 17:00 SP = 20:00 UTC (BRT é UTC-3, sem DST atualmente).
//
//    name: Cron — Project updates
//    on:
//      schedule:
//        - cron: '0 20 * * 5'   # toda sexta 20:00 UTC = 17:00 SP
//      workflow_dispatch: {}
//    jobs:
//      project-updates:
//        runs-on: ubuntu-latest
//        steps:
//          - name: Hit project updates
//            run: |
//              curl -fsS -X POST "${{ secrets.APP_URL }}/api/cron/project-updates" \
//                -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
//
//
// 3) VERCEL CRON (vercel.json).
//
//    {
//      "crons": [
//        { "path": "/api/cron/project-updates", "schedule": "0 20 * * 5" }
//      ]
//    }
//
//    Vercel injeta `Authorization: Bearer <CRON_SECRET>` automaticamente
//    se a env CRON_SECRET estiver setada no projeto.
// =============================================================================
