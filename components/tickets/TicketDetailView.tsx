'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye } from 'lucide-react';
import SubtaskList from './SubtaskList';
import LinkedTickets from './LinkedTickets';
import ActivityTimeline from './ActivityTimeline';
import TicketSidebar from './TicketSidebar';
import TimeTracker from './TimeTracker';
import AttachmentList from './AttachmentList';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

interface TicketData {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  ticket_key: string;
  due_date: string | null;
  type_name: string;
  type_icon: string;
  type_color: string;
  ticket_type_id: string;
  status_id: string;
  status_name: string;
  status_color: string;
  service_id: string | null;
  service_name: string | null;
  service_color: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  reporter_id: string | null;
  reporter_name: string | null;
  category_id: string | null;
  category_name: string | null;
  sprint_id: string | null;
  sprint_name: string | null;
  parent_id: string | null;
  parent_key: string | null;
  parent_title: string | null;
  subtask_count: number;
  subtask_done_count: number;
  comment_count: number;
  total_time_minutes: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface TicketDetailViewProps {
  ticketId: string;
}

export default function TicketDetailView({ ticketId }: TicketDetailViewProps) {
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (res.ok) {
        const data = await res.json();
        setTicket(data);
        setTitleValue(data.title);
        setDescValue(data.description || '');
      }
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  // Keyboard shortcut: M para focar no campo de comentário
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'm' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'SELECT') {
        const commentInput = document.querySelector<HTMLInputElement>('input[placeholder*="comentário"]');
        if (commentInput) { e.preventDefault(); commentInput.focus(); }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  async function updateField(field: string, value: unknown) {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        toast('Ticket atualizado', 'success');
        await fetchTicket();
      } else {
        toast('Erro ao atualizar', 'error');
      }
    } catch {
      toast('Erro de conexão', 'error');
    }
  }

  async function saveTitle() {
    if (titleValue.trim() && titleValue !== ticket?.title) {
      await updateField('title', titleValue.trim());
    }
    setEditingTitle(false);
  }

  async function saveDescription() {
    if (descValue !== ticket?.description) {
      await updateField('description', descValue || null);
    }
    setEditingDesc(false);
  }

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!ticket) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-slate-400">
        <p>Ticket não encontrado</p>
        <Link href="/board" className="mt-2 text-sm text-accent hover:text-blue-400">
          Voltar ao board
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2">
        <Link href="/board" className="flex items-center gap-1 text-xs text-slate-500 transition hover:text-accent">
          <ArrowLeft size={12} />
          Board
        </Link>
        <span className="text-slate-600">/</span>
        {ticket.parent_key && (
          <>
            <Link href={`/ticket/${ticket.parent_id}`} className="font-mono text-xs text-accent hover:underline">
              {ticket.parent_key}
            </Link>
            <span className="text-slate-600">/</span>
          </>
        )}
        <span className="text-xs text-slate-400">{ticket.ticket_key}</span>

        {/* Viewers placeholder */}
        <div className="ml-auto flex items-center gap-1 text-xs text-slate-500">
          <Eye size={13} />
          <span>-</span>
        </div>
      </div>

      {/* Header: type icon + key + status */}
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span>{ticket.type_icon}</span>
        <span className="font-mono text-slate-500">{ticket.ticket_key}</span>
      </div>

      {/* Editable title */}
      {editingTitle ? (
        <input
          ref={titleRef}
          autoFocus
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); }}
          className="mb-6 w-full rounded border border-accent/40 bg-surface px-2 py-1 text-2xl font-bold text-white outline-none"
        />
      ) : (
        <h1
          onClick={() => setEditingTitle(true)}
          className="mb-6 cursor-pointer text-2xl font-bold text-white transition hover:text-accent"
          title="Clique para editar"
        >
          {ticket.title}
        </h1>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        {/* Main content - left column */}
        <div className="space-y-6">
          {/* Description */}
          <section className="rounded-lg border border-border/40 bg-surface2 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Descrição</h2>
              {editingDesc ? (
                <button
                  onClick={saveDescription}
                  className="rounded bg-accent px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-500"
                >
                  Salvar
                </button>
              ) : (
                <button
                  onClick={() => setEditingDesc(true)}
                  className="rounded px-2 py-0.5 text-[11px] text-slate-500 hover:bg-surface hover:text-slate-300"
                >
                  Editar
                </button>
              )}
            </div>
            {editingDesc ? (
              <RichTextEditor
                content={descValue}
                onChange={setDescValue}
                placeholder="Adicione uma descrição..."
              />
            ) : (
              <div
                onClick={() => setEditingDesc(true)}
                className="prose prose-invert prose-sm max-w-none cursor-pointer text-slate-300 transition hover:text-slate-200"
                title="Clique para editar"
              >
                {ticket.description ? (
                  <div dangerouslySetInnerHTML={{ __html: ticket.description }} />
                ) : (
                  <p className="italic text-slate-600">Clique para adicionar uma descrição...</p>
                )}
              </div>
            )}
          </section>

          {/* Subtasks */}
          <SubtaskList ticketId={ticket.id} />

          {/* Linked tickets */}
          <LinkedTickets ticketId={ticket.id} />

          {/* Attachments */}
          <AttachmentList ticketId={ticket.id} />

          {/* Activity timeline with tabs */}
          <ActivityTimeline ticketId={ticket.id} />
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <TicketSidebar ticket={ticket} onUpdate={updateField} />
          <TimeTracker ticketId={ticket.id} />
        </div>
      </div>
    </div>
  );
}
