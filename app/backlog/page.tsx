export const dynamic = "force-dynamic";
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { query } from '@/lib/db';
import TicketTypeIcon from '@/components/ui/TicketTypeIcon';

const priorityLabels: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgente', color: '#ef4444' },
  high: { label: 'Alta', color: '#f97316' },
  medium: { label: 'Média', color: '#eab308' },
  low: { label: 'Baixa', color: '#60a5fa' }
};

export default async function BacklogPage() {
  const result = await query(`
    SELECT
      ticket_key, id, title, priority, status_name, status_color,
      service_name, service_color, assignee_name, type_icon, type_name,
      to_char(due_date AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS due,
      to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS created
    FROM tickets_full
    WHERE is_archived = false AND sprint_id IS NULL
    ORDER BY created_at DESC
  `);

  const tickets = result.rows as any[];

  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1c1e] text-[#c5c8c6]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <ApprovalGate>
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-white">Backlog</h1>
              <p className="mt-1 text-sm text-slate-500">
                {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} sem sprint atribuído
              </p>
            </div>

            <div className="rounded-lg border border-border/40 bg-surface2 overflow-hidden">
              {/* Table header */}
              <div className="flex items-center border-b border-border/40 bg-sidebar px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <span className="w-24 shrink-0">Key</span>
                <span className="flex-1">Título</span>
                <span className="w-32 shrink-0">Status</span>
                <span className="w-24 shrink-0">Prioridade</span>
                <span className="w-28 shrink-0">Serviço</span>
                <span className="w-28 shrink-0">Responsável</span>
                <span className="w-24 shrink-0 text-right">Criado</span>
              </div>

              {/* Rows */}
              {tickets.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  Nenhum ticket no backlog. Todos os tickets estão em sprints.
                </div>
              ) : (
                <div className="divide-y divide-border/20">
                  {tickets.map((t) => {
                    const prio = priorityLabels[t.priority] || priorityLabels.medium;
                    return (
                      <Link
                        key={t.id}
                        href={`/ticket/${t.id}`}
                        className="flex items-center px-4 py-2.5 transition hover:bg-input/20"
                      >
                        <span className="w-24 shrink-0 font-mono text-[11px] text-slate-500">
                          <span className="mr-1 inline-flex"><TicketTypeIcon typeIcon={t.type_icon} size="sm" showBackground={false} /></span>
                          {t.ticket_key}
                        </span>
                        <span className="flex-1 truncate pr-4 text-sm text-slate-200">{t.title}</span>
                        <span className="w-32 shrink-0">
                          <span
                            className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ backgroundColor: t.status_color + '20', color: t.status_color }}
                          >
                            {t.status_name}
                          </span>
                        </span>
                        <span className="w-24 shrink-0">
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: prio.color }} />
                            {prio.label}
                          </span>
                        </span>
                        <span className="w-28 shrink-0 text-[11px] text-slate-400">{t.service_name || '-'}</span>
                        <span className="w-28 shrink-0 text-[11px] text-slate-500">{t.assignee_name || '-'}</span>
                        <span className="w-24 shrink-0 text-right text-[11px] text-slate-600">{t.created || '-'}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
