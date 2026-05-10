import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { notifyMember } from '@/lib/notifications';

/**
 * Cron worker — verifica tickets cujo SLA está perto de vencer e dispara
 * alertas (Slack workspace + notificação in-app pro assignee primário).
 *
 * Auth: igual ao /api/cron/recurring-tickets
 *  - header `x-cron-secret: <CRON_SECRET>` OU
 *  - header `Authorization: Bearer <CRON_SECRET>`
 *  - se CRON_SECRET não estiver setado, em dev passa, em prod 401.
 *
 * Schema esperado (criado pela migration `db/049_sla_policies.sql` da
 * backend-eng-3a):
 *   sla_policies(workspace_id, priority, hours_to_resolve,
 *                alert_hours_before, enabled)
 *   tickets.sla_due_at TIMESTAMPTZ
 *   tickets.sla_alert_sent_at TIMESTAMPTZ
 *
 * Estratégia (idempotente por design):
 *  - Pega até 100 tickets ABERTOS, com sla_due_at definido, alerta ainda
 *    não enviado, dentro da janela de aviso configurada na policy.
 *  - Pra cada ticket: dispara Slack do workspace (se houver), notifica
 *    in-app o assignee, e marca sla_alert_sent_at = NOW(). Erros por
 *    ticket NÃO abortam o batch (try/catch isolado).
 */

const BATCH_LIMIT = 100;

interface SlaRow {
  id: string;
  workspace_id: string;
  ticket_key: string;
  title: string;
  priority: string | null;
  assignee_id: string | null;
  sla_due_at: string;
  alert_hours_before: number;
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== 'production') return true;
    return false;
  }
  const headerSecret =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return headerSecret === secret;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://projetos.bahtech.com.br';
}

function isSlackUrl(url: string): boolean {
  return /hooks\.slack\.com\/services\//i.test(url);
}

function formatBR(d: Date): string {
  // dd/MM HH:mm em America/Sao_Paulo (UTC-3 fixo — sem DST atualmente).
  const tz = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const dd = String(tz.getUTCDate()).padStart(2, '0');
  const MM = String(tz.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(tz.getUTCHours()).padStart(2, '0');
  const mm = String(tz.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${MM} ${hh}:${mm}`;
}

/**
 * Busca webhooks Slack ativos pro workspace. Retorna array de URLs (pode
 * haver mais de um canal configurado por workspace).
 */
async function getSlackWebhooks(workspaceId: string): Promise<string[]> {
  try {
    const r = await query<{ url: string }>(
      `SELECT url FROM webhook_subscriptions
       WHERE workspace_id = $1 AND is_active = true`,
      [workspaceId]
    );
    return r.rows.map((row) => row.url).filter(isSlackUrl);
  } catch (err) {
    console.error(`[cron/sla-check] erro lendo webhooks ws=${workspaceId}:`, err);
    return [];
  }
}

async function sendSlackAlert(url: string, text: string, link: string): Promise<void> {
  const body = JSON.stringify({
    text,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*⚠️ Alerta de SLA*\n${text}` } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `<${link}|Abrir no Bah!Flow>` }] },
    ],
  });
  // Fire-and-forget mas com timeout pra não pendurar o cron.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn(`[cron/sla-check] slack ${res.status} url=${url.slice(0, 60)}…`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  let alertsSent = 0;
  const errors: { ticket_id: string; error: string }[] = [];

  try {
    // JOIN com sla_policies pra pegar alert_hours_before do tier (workspace+priority).
    // ticket_key é a view padrão do projeto: prefix + sequence_number formatado.
    const due = await query<SlaRow>(
      `SELECT
         t.id,
         t.workspace_id,
         (w.prefix || '-' || LPAD(t.sequence_number::text, 3, '0')) AS ticket_key,
         t.title,
         t.priority,
         t.assignee_id,
         t.sla_due_at,
         sp.alert_hours_before
       FROM tickets t
       JOIN workspaces w ON w.id = t.workspace_id
       LEFT JOIN statuses s ON s.id = t.status_id
       JOIN sla_policies sp
         ON sp.workspace_id = t.workspace_id
        AND sp.priority = COALESCE(t.priority, 'medium')
        AND sp.enabled = true
       WHERE COALESCE(s.is_done, false) = false
         AND t.is_archived = false
         AND t.sla_due_at IS NOT NULL
         AND t.sla_alert_sent_at IS NULL
         AND t.sla_due_at <= NOW() + (sp.alert_hours_before || ' hours')::interval
       ORDER BY t.sla_due_at ASC
       LIMIT $1`,
      [BATCH_LIMIT]
    );

    for (const row of due.rows) {
      try {
        const dueDate = new Date(row.sla_due_at);
        const hoursLeft = Math.max(
          0,
          Math.round((dueDate.getTime() - startedAt.getTime()) / 36e5)
        );
        const human = formatBR(dueDate);
        const text = `SLA do ticket ${row.ticket_key} (${row.title}) vence em ${hoursLeft}h (em ${human})`;
        const link = `${appUrl()}/ticket/${row.id}`;

        // 1) Slack workspace-level (se configurado). Nunca aborta o resto.
        const slackUrls = await getSlackWebhooks(row.workspace_id);
        if (slackUrls.length === 0) {
          console.log(
            `[cron/sla-check] ws=${row.workspace_id} sem webhook Slack — apenas in-app`
          );
        } else {
          await Promise.allSettled(slackUrls.map((u) => sendSlackAlert(u, text, link)));
        }

        // 2) In-app pro assignee primário (se houver). notifyMember é fire-and-forget.
        if (row.assignee_id) {
          notifyMember(row.assignee_id, 'sla.alert', {
            title: '⚠️ SLA prestes a vencer',
            message: text,
            ticketId: row.id,
          });
        } else {
          console.log(
            `[cron/sla-check] ticket ${row.ticket_key} sem assignee — só Slack`
          );
        }

        // 3) Marca como alertado (idempotência).
        await query(
          `UPDATE tickets SET sla_alert_sent_at = NOW() WHERE id = $1`,
          [row.id]
        );

        alertsSent += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cron/sla-check] falha ticket ${row.id}:`, msg);
        errors.push({ ticket_id: row.id, error: msg });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: due.rows.length,
      alerts_sent: alertsSent,
      errors,
      ran_at: startedAt.toISOString(),
    });
  } catch (err) {
    console.error('POST /api/cron/sla-check error:', err);
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
//    curl -X POST http://localhost:3000/api/cron/sla-check \
//      -H "Authorization: Bearer $CRON_SECRET"
//
//    # prod
//    curl -X POST https://projetos.bahtech.com.br/api/cron/sla-check \
//      -H "x-cron-secret: $CRON_SECRET"
//
//
// 2) GITHUB ACTIONS (recomendado se já usamos pra outros crons).
//    Adicionar no .github/workflows/cron.yml:
//
//    name: Cron jobs
//    on:
//      schedule:
//        # SLA check a cada 30 min — granularidade boa pra alertas
//        - cron: '*/30 * * * *'
//      workflow_dispatch: {}
//    jobs:
//      sla-check:
//        runs-on: ubuntu-latest
//        steps:
//          - name: Hit SLA check
//            run: |
//              curl -fsS -X POST "${{ secrets.APP_URL }}/api/cron/sla-check" \
//                -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
//
//
// 3) VERCEL CRON (mais simples, se hospedado na Vercel).
//    vercel.json:
//
//    {
//      "crons": [
//        { "path": "/api/cron/sla-check", "schedule": "0 */6 * * *" }
//        // ↑ a cada 6h (Hobby tier permite até diário; Pro libera mais).
//        // Pra alerta mais agressivo: "*/30 * * * *" (a cada 30 min).
//      ]
//    }
//
//    Vercel injeta automaticamente o header `Authorization: Bearer <CRON_SECRET>`
//    se a env CRON_SECRET estiver setada no projeto.
//
//
// FREQUÊNCIA SUGERIDA:
//   - Dev/staging: a cada 6h (`0 */6 * * *`) — barato, suficiente pra QA.
//   - Prod: a cada 30 min (`*/30 * * * *`) — alertas chegam quase em tempo real
//     sem martelar o DB. Se tier de cron tiver custo, 1h também é aceitável.
// =============================================================================
