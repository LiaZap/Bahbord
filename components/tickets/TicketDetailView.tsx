'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Share2, Maximize2, X as XIcon, Trash2,
  ChevronDown, ChevronRight, Settings2
} from 'lucide-react';
import SubtaskList from './SubtaskList';
import TicketSidebar from './TicketSidebar';
import { DetailSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import TicketTypeIcon from '@/components/ui/TicketTypeIcon';
import { cn } from '@/lib/utils/cn';
import DOMPurify from 'dompurify';

// Lazy-load das seções pesadas que não fazem parte do above-the-fold do detalhe.
// Reduz o bundle inicial do detalhe em ~40KB (TipTap, Recharts internos do
// Activity, etc) e só baixa quando o usuário scrolla / interage.
const SectionFallback = () => <Skeleton className="h-12 w-full" />;
const LinkedTickets = dynamic(() => import('./LinkedTickets'), { ssr: false, loading: SectionFallback });
const ActivityTimeline = dynamic(() => import('./ActivityTimeline'), { ssr: false, loading: SectionFallback });
const DevLinks = dynamic(() => import('./DevLinks'), { ssr: false, loading: SectionFallback });
const AttachmentList = dynamic(() => import('./AttachmentList'), { ssr: false, loading: SectionFallback });
const AccessLinks = dynamic(() => import('./AccessLinks'), { ssr: false, loading: SectionFallback });
const TimeTracker = dynamic(() => import('./TimeTracker'), { ssr: false, loading: SectionFallback });
// RichTextEditor é o mais pesado (TipTap + extensions ~120KB). Só baixa quando
// o usuário clica pra editar a descrição.
const RichTextEditor = dynamic(() => import('@/components/editor/RichTextEditor'), {
  ssr: false,
  loading: () => <Skeleton className="h-32 w-full" />,
});

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
  board_id: string | null;
  project_id: string | null;
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canTrackTime, setCanTrackTime] = useState(false);
  const isAdmin = userRole === 'owner' || userRole === 'admin';
  const showTimeTracker = isAdmin || canTrackTime;
  const titleRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => {
      if (data?.member?.role) setUserRole(data.member.role);
      setCanTrackTime(data?.member?.can_track_time === true);
    }).catch(() => {});
  }, []);

  const [fetchError, setFetchError] = useState<{ status: number; message: string } | null>(null);

  const fetchTicket = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (res.ok) {
        const data = await res.json();
        setTicket(data);
        setTitleValue(data.title);
        setDescValue(data.description || '');
      } else {
        const err = await res.json().catch(() => ({}));
        setFetchError({ status: res.status, message: err.error || res.statusText });
      }
    } catch (err) {
      setFetchError({ status: 0, message: err instanceof Error ? err.message : 'Erro de rede' });
      console.error('Erro ao carregar ticket:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'm' || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = document.activeElement as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      // Não interceptar se foco está num campo editável (input, textarea, select,
      // ou qualquer contenteditable como o TipTap)
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target.isContentEditable) return;
      if (target.closest('[contenteditable="true"], .ProseMirror')) return;
      const commentInput = document.querySelector<HTMLInputElement>('input[placeholder*="comentário"]');
      if (commentInput) { e.preventDefault(); commentInput.focus(); }
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
    const isForbidden = fetchError?.status === 403;
    const isNotFound = fetchError?.status === 404;
    return (
      <div className="mx-auto max-w-[600px] py-16">
        <div className="card-premium p-8 text-center">
          <h2 className="font-serif text-[24px] text-primary">
            {isForbidden ? 'Sem acesso a este ticket' : isNotFound ? 'Ticket não encontrado' : 'Erro ao carregar'}
          </h2>
          <p className="mt-2 text-[13px] text-secondary">
            {isForbidden
              ? 'Você não tem permissão. Peça pra um admin atribuir você ao projeto deste ticket.'
              : isNotFound
              ? 'O ticket pode ter sido removido ou o link está errado.'
              : `Houve um problema: ${fetchError?.message || 'erro desconhecido'}`}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Link href="/" className="btn-premium btn-secondary">Dashboard</Link>
            <Link href="/my-tasks" className="btn-premium btn-primary">Minhas tarefas</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Top bar — breadcrumb + actions (quebra linha em mobile) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          {ticket.parent_key && (
            <>
              <TicketTypeIcon typeName={ticket.type_name} typeIcon={ticket.type_icon} size="sm" />
              <Link href={`/ticket/${ticket.parent_id}`} className="text-secondary-muted hover:text-blue-400 transition">
                {ticket.parent_key}
              </Link>
              <span className="text-tertiary-muted">/</span>
            </>
          )}
          <TicketTypeIcon typeName={ticket.type_name} typeIcon={ticket.type_icon} size="sm" />
          <span className="text-secondary-muted">{ticket.ticket_key}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href).then(() => toast('Link copiado', 'success'))}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-secondary-muted hover:bg-[var(--overlay-hover)] hover:text-primary"
            title="Copiar link"
          >
            <Share2 size={14} />
          </button>
          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="rounded-md p-1.5 text-secondary-muted hover:bg-[var(--overlay-hover)] hover:text-primary"
            title="Abrir em nova aba"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={handleDeleteTicket}
            className="rounded-md p-1.5 text-secondary-muted hover:bg-[var(--overlay-hover)] hover:text-red-400"
            title="Excluir ticket"
          >
            <Trash2 size={14} />
          </button>
          <Link href="/board" className="rounded-md p-1.5 text-secondary-muted hover:bg-[var(--overlay-hover)] hover:text-primary">
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
          className="mb-2 w-full rounded bg-transparent px-0 py-1 text-[20px] font-semibold text-[var(--text-primary)] outline-none ring-1 ring-blue-500/40 ring-offset-2 ring-offset-[var(--bg-primary)]"
        />
      ) : (
        <h1
          onClick={() => setEditingTitle(true)}
          className="mb-2 cursor-text text-[18px] sm:text-[20px] font-semibold text-primary hover:opacity-80 break-words"
        >
          {ticket.title}
        </h1>
      )}

      <div className="mb-5" />

      {/* Two column layout — sidebar empilha abaixo em <lg */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column — content */}
        <div className="flex-1 min-w-0 space-y-0">
          {/* Descrição */}
          <section className="border-b border-[var(--card-border)] pb-5 mb-5">
            <button
              onClick={() => setDescOpen(!descOpen)}
              className="mb-3 flex items-center gap-1.5 text-[14px] font-semibold text-primary"
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
                      <button onClick={() => setEditingDesc(false)} className="rounded px-3 py-1 text-[12px] text-secondary-muted hover:text-primary">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setEditingDesc(true)}
                    className="cursor-text text-[14px] leading-relaxed text-primary"
                  >
                    {ticket.description ? (
                      <div className="rich-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ticket.description) }} />
                    ) : (
                      <p className="text-tertiary-muted italic">Clique para adicionar uma descrição...</p>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Subtarefas */}
          <section className="border-b border-[var(--card-border)] pb-5 mb-5">
            <SubtaskList ticketId={ticket.id} />
          </section>

          {/* Tickets vinculados */}
          <section className="border-b border-[var(--card-border)] pb-5 mb-5">
            <LinkedTickets ticketId={ticket.id} />
          </section>

          {/* Desenvolvimento */}
          <section className="border-b border-[var(--card-border)] pb-5 mb-5">
            <DevLinks ticketId={ticket.id} />
          </section>

          {/* Acessos */}
          <section className="border-b border-[var(--card-border)] pb-5 mb-5">
            <AccessLinks ticketId={ticket.id} />
          </section>

          {/* Anexos */}
          <section className="border-b border-[var(--card-border)] pb-5 mb-5">
            <AttachmentList ticketId={ticket.id} />
          </section>

          {/* Atividade */}
          <section>
            <button
              onClick={() => setActivityOpen(!activityOpen)}
              className="mb-3 flex items-center gap-1.5 text-[14px] font-semibold text-primary"
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
          {showTimeTracker && (
            <div className="mt-4">
              <TimeTracker ticketId={ticket.id} />
            </div>
          )}

          {/* Footer timestamps */}
          <div className="mt-6 space-y-1 text-[11px] text-secondary-muted">
            <p>Criado {new Date(ticket.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            <p>Atualizado {new Date(ticket.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <Link href="/settings" className="mt-3 flex items-center gap-1.5 text-[11px] text-secondary-muted hover:text-primary">
            <Settings2 size={12} />
            Configurar
          </Link>
        </div>
      </div>
    </div>
  );
}
