'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Share2, Maximize2, X as XIcon, Trash2,
  ChevronDown, ChevronRight, Settings2
} from 'lucide-react';
import SubtaskList from './SubtaskList';
import LinkedTickets from './LinkedTickets';
import ActivityTimeline from './ActivityTimeline';
import TicketSidebar from './TicketSidebar';
import TimeTracker from './TimeTracker';
import DevLinks from './DevLinks';
import AttachmentList from './AttachmentList';
import AccessLinks from './AccessLinks';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import TicketTypeIcon from '@/components/ui/TicketTypeIcon';
import { cn } from '@/lib/utils/cn';
import DOMPurify from 'dompurify';

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
  client_id: string | null;
  client_name: string | null;
  client_color: string | null;
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
  const [descOpen, setDescOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);
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
    } catch (err) { console.error('Erro ao carregar ticket:', err); }
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

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

  async function handleDeleteTicket() {
    if (!confirm('Excluir este ticket permanentemente? Esta ação não pode ser desfeita.')) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' });
      if (res.ok) {
        toast('Ticket excluído', 'success');
        window.location.href = '/board';
      } else {
        const err = await res.json();
        toast(err.error || 'Erro ao excluir', 'error');
      }
    } catch { toast('Erro de conexão', 'error'); }
  }

  async function updateField(field: string, value: unknown) {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value, _updated_at: ticket?.updated_at }),
      });
      if (res.ok) {
        toast('Ticket atualizado', 'success');
        await fetchTicket();
      } else if (res.status === 409) {
        toast('Ticket editado por outro usuário. Recarregando...', 'warning');
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

  if (loading) return <DetailSkeleton />;

  if (!ticket) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-slate-400">
        <p>Ticket não encontrado</p>
        <Link href="/board" className="mt-2 text-sm text-blue-400 hover:text-blue-300">Voltar ao board</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Top bar — breadcrumb + actions */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[13px]">
          {ticket.parent_key && (
            <>
              <TicketTypeIcon typeName={ticket.type_name} typeIcon={ticket.type_icon} size="sm" />
              <Link href={`/ticket/${ticket.parent_id}`} className="text-slate-400 hover:text-blue-400 transition">
                {ticket.parent_key}
              </Link>
              <span className="text-slate-600">/</span>
            </>
          )}
          <TicketTypeIcon typeName={ticket.type_name} typeIcon={ticket.type_icon} size="sm" />
          <span className="text-slate-400">{ticket.ticket_key}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href).then(() => toast('Link copiado', 'success'))}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
            title="Copiar link"
          >
            <Share2 size={14} />
          </button>
          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
            title="Abrir em nova aba"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={handleDeleteTicket}
            className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-red-400"
            title="Excluir ticket"
          >
            <Trash2 size={14} />
          </button>
          <Link href="/board" className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300">
            <XIcon size={14} />
          </Link>
        </div>
      </div>

      {/* Title */}
      {editingTitle ? (
        <input
          ref={titleRef}
          autoFocus
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); }}
          className="mb-2 w-full rounded bg-transparent px-0 py-1 text-[20px] font-semibold text-white outline-none ring-1 ring-blue-500/40 ring-offset-2 ring-offset-[#1a1c1e]"
        />
      ) : (
        <h1
          onClick={() => setEditingTitle(true)}
          className="mb-2 cursor-text text-[20px] font-semibold text-white hover:text-slate-200"
        >
          {ticket.title}
        </h1>
      )}

      <div className="mb-5" />

      {/* Two column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column — content */}
        <div className="flex-1 min-w-0 space-y-0">
          {/* Descrição */}
          <section className="border-b border-white/[0.04] pb-5 mb-5">
            <button
              onClick={() => setDescOpen(!descOpen)}
              className="mb-3 flex items-center gap-1.5 text-[14px] font-semibold text-slate-200"
            >
              {descOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Descrição
            </button>
            {descOpen && (
              <>
                {editingDesc ? (
                  <div className="space-y-2">
                    <RichTextEditor content={descValue} onChange={setDescValue} placeholder="Adicione uma descrição..." />
                    <div className="flex gap-2">
                      <button onClick={saveDescription} className="rounded bg-blue-600 px-3 py-1 text-[12px] font-medium text-white hover:bg-blue-500">Salvar</button>
                      <button onClick={() => setEditingDesc(false)} className="rounded px-3 py-1 text-[12px] text-slate-400 hover:text-slate-200">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setEditingDesc(true)}
                    className="cursor-text text-[14px] leading-relaxed text-slate-300"
                  >
                    {ticket.description ? (
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ticket.description) }} />
                    ) : (
                      <p className="text-slate-600 italic">Clique para adicionar uma descrição...</p>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Subtarefas */}
          <section className="border-b border-white/[0.04] pb-5 mb-5">
            <SubtaskList ticketId={ticket.id} />
          </section>

          {/* Tickets vinculados */}
          <section className="border-b border-white/[0.04] pb-5 mb-5">
            <LinkedTickets ticketId={ticket.id} />
          </section>

          {/* Desenvolvimento */}
          <section className="border-b border-white/[0.04] pb-5 mb-5">
            <DevLinks ticketId={ticket.id} />
          </section>

          {/* Acessos */}
          <section className="border-b border-white/[0.04] pb-5 mb-5">
            <AccessLinks ticketId={ticket.id} />
          </section>

          {/* Anexos */}
          <section className="border-b border-white/[0.04] pb-5 mb-5">
            <AttachmentList ticketId={ticket.id} />
          </section>

          {/* Atividade */}
          <section>
            <button
              onClick={() => setActivityOpen(!activityOpen)}
              className="mb-3 flex items-center gap-1.5 text-[14px] font-semibold text-slate-200"
            >
              {activityOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Atividade
            </button>
            {activityOpen && <ActivityTimeline ticketId={ticket.id} />}
          </section>
        </div>

        {/* Right column — sidebar */}
        <div className="w-full lg:w-[320px] shrink-0">
          <TicketSidebar ticket={ticket} onUpdate={updateField} />
          <div className="mt-4">
            <TimeTracker ticketId={ticket.id} />
          </div>

          {/* Footer timestamps */}
          <div className="mt-6 space-y-1 text-[11px] text-slate-500">
            <p>Criado {new Date(ticket.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            <p>Atualizado {new Date(ticket.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <Link href="/settings" className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300">
            <Settings2 size={12} />
            Configurar
          </Link>
        </div>
      </div>
    </div>
  );
}
