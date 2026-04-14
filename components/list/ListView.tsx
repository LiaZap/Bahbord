'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TicketTypeIcon from '@/components/ui/TicketTypeIcon';
import { CheckSquare, Square, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';

interface Ticket {
  id: string;
  ticket_key: string;
  title: string;
  priority: string;
  status_name: string;
  status_color: string;
  status_id: string;
  service_name: string | null;
  service_color: string | null;
  assignee_name: string | null;
  assignee_id: string | null;
  type_icon: string;
  due: string | null;
  created: string | null;
}

interface ListViewProps {
  tickets: Ticket[];
  statuses: Array<{ id: string; name: string }>;
  members: Array<{ id: string; display_name: string }>;
}

type SortField = 'ticket_key' | 'title' | 'priority' | 'status_name' | 'assignee_name' | 'due';

const priorityLabels: Record<string, { label: string; color: string; order: number }> = {
  urgent: { label: 'Urgente', color: '#ef4444', order: 0 },
  high: { label: 'Alta', color: '#f97316', order: 1 },
  medium: { label: 'Média', color: '#eab308', order: 2 },
  low: { label: 'Baixa', color: '#60a5fa', order: 3 },
};

export default function ListView({ tickets, statuses, members }: ListViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('ticket_key');
  const [sortAsc, setSortAsc] = useState(false);
  const [bulkAction, setBulkAction] = useState('');

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === tickets.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tickets.map((t) => t.id)));
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  const sorted = [...tickets].sort((a, b) => {
    let cmp = 0;
    const av = (a[sortField] || '') as string;
    const bv = (b[sortField] || '') as string;

    if (sortField === 'priority') {
      cmp = (priorityLabels[av]?.order ?? 9) - (priorityLabels[bv]?.order ?? 9);
    } else {
      cmp = av.localeCompare(bv);
    }

    return sortAsc ? cmp : -cmp;
  });

  async function executeBulkAction() {
    if (selected.size === 0 || !bulkAction) return;

    const ids = Array.from(selected);

    try {
      let field: Record<string, unknown> = {};
      if (bulkAction.startsWith('status:')) {
        field = { status_id: bulkAction.replace('status:', '') };
      } else if (bulkAction.startsWith('assignee:')) {
        field = { assignee_id: bulkAction.replace('assignee:', '') || null };
      }

      const results = await Promise.all(ids.map((id) =>
        fetch(`/api/tickets/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(field),
        })
      ));

      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        toast(`${failed} de ${ids.length} ticket(s) falharam ao atualizar`, 'error');
      } else {
        toast(`${ids.length} ticket${ids.length > 1 ? 's' : ''} atualizado${ids.length > 1 ? 's' : ''}`, 'success');
      }
    } catch {
      toast('Erro de conexão ao atualizar tickets', 'error');
    }

    setSelected(new Set());
    setBulkAction('');
    router.refresh();
  }

  function SortHeader({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) {
    return (
      <button
        onClick={() => handleSort(field)}
        className={cn('flex items-center gap-1 text-left', className)}
      >
        {children}
        {sortField === field && <ArrowUpDown size={10} className="text-accent" />}
      </button>
    );
  }

  return (
    <div>
      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-accent/30 bg-accent/5 px-4 py-2 animate-slide-down">
          <span className="text-xs font-medium text-accent">{selected.size} selecionado{selected.size > 1 ? 's' : ''}</span>

          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="rounded border border-border/40 bg-surface px-2 py-1 text-xs text-slate-200 outline-none"
          >
            <option value="">Ação em lote...</option>
            <optgroup label="Mover para status">
              {statuses.map((s) => (
                <option key={s.id} value={`status:${s.id}`}>{s.name}</option>
              ))}
            </optgroup>
            <optgroup label="Atribuir a">
              <option value="assignee:">Não atribuído</option>
              {members.map((m) => (
                <option key={m.id} value={`assignee:${m.id}`}>{m.display_name}</option>
              ))}
            </optgroup>
          </select>

          <button
            onClick={executeBulkAction}
            disabled={!bulkAction}
            className="rounded bg-accent px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-40"
          >
            Aplicar
          </button>

          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-slate-400 hover:text-slate-200"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {/* Table header */}
      <div className="sticky top-0 z-10 flex items-center border-b border-border/40 bg-sidebar px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <button onClick={toggleAll} className="mr-3 shrink-0 text-slate-500 hover:text-slate-300">
          {selected.size === tickets.length && tickets.length > 0 ? (
            <CheckSquare size={14} className="text-accent" />
          ) : (
            <Square size={14} />
          )}
        </button>
        <SortHeader field="ticket_key" className="w-24 shrink-0">Key</SortHeader>
        <SortHeader field="title" className="flex-1">Título</SortHeader>
        <SortHeader field="status_name" className="w-32 shrink-0">Status</SortHeader>
        <SortHeader field="priority" className="w-24 shrink-0">Prioridade</SortHeader>
        <span className="w-28 shrink-0">Serviço</span>
        <SortHeader field="assignee_name" className="w-28 shrink-0">Responsável</SortHeader>
        <SortHeader field="due" className="w-24 shrink-0 text-right">Data limite</SortHeader>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/20">
        {sorted.map((t) => {
          const prio = priorityLabels[t.priority] || priorityLabels.medium;
          const isSelected = selected.has(t.id);
          return (
            <div
              key={t.id}
              className={cn(
                'flex items-center px-4 py-2.5 transition',
                isSelected ? 'bg-accent/5' : 'hover:bg-input/20'
              )}
            >
              <button
                onClick={() => toggleSelect(t.id)}
                className="mr-3 shrink-0 text-slate-500 hover:text-slate-300"
              >
                {isSelected ? (
                  <CheckSquare size={14} className="text-accent" />
                ) : (
                  <Square size={14} />
                )}
              </button>
              <Link href={`/ticket/${t.id}`} className="flex flex-1 items-center">
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
                <span className="w-24 shrink-0 text-right text-[11px] text-slate-600">{t.due || '-'}</span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
