'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Share2, Maximize2, X as XIcon,
  ChevronDown, ChevronRight, Settings2, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SubtaskList from './SubtaskList';
import LinkedTickets from './LinkedTickets';
import ActivityTimeline from './ActivityTimeline';
import DevLinks from './DevLinks';
import GitHubLinks from './GitHubLinks';
import TicketSidebar from './TicketSidebar';
import TimeTracker from './TimeTracker';
import AttachmentList from './AttachmentList';
import AccessLinks from './AccessLinks';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import TicketTypeIcon from '@/components/ui/TicketTypeIcon';
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
  board_id: string | null;
  project_id: string | null;
}

interface TicketDetailModalProps {
  ticketId: string | null;
  onClose: () => void;
}

export default function TicketDetailModal({ ticketId, onClose }: TicketDetailModalProps) {
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [descOpen, setDescOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const isAdmin = userRole === 'owner' || userRole === 'admin';
  const { toast } = useToast();
  const { confirm } = useConfirm();

  async function handleDeleteTicket() {
    if (!ticket) return;
    const ok = await confirm({
      title: 'Excluir ticket',
      message: `Tem certeza que deseja excluir ${ticket.ticket_key}? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast('Ticket excluído', 'success');
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || 'Erro ao excluir', 'error');
      }
    } catch {
      toast('Erro ao excluir', 'error');
    }
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => {
      if (data?.member?.role) setUserRole(data.member.role);
    }).catch(() => {});
  }, []);

  const fetchTicket = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
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

  useEffect(() => {
    if (ticketId) {
      setTicket(null);
      setEditingTitle(false);
      setEditingDesc(false);
      fetchTicket();
    }
  }, [ticketId, fetchTicket]);

  // Escape fecha modal
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'm' && !e.ctrlKey && !e.metaKey &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA' &&
          document.activeElement?.tagName !== 'SELECT') {
        const input = document.querySelector<HTMLInputElement>('input[placeholder*="comentário"]');
        if (input) { e.preventDefault(); input.focus(); }
      }
    }
    if (ticketId) {
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }
  }, [ticketId, onClose]);

  async function updateField(field: string, value: unknown) {
    if (!ticketId) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value, _updated_at: ticket?.updated_at }),
      });
      if (res.ok) {
        toast('Atualizado', 'success');
        await fetchTicket();
      } else if (res.status === 409) {
        toast('Ticket editado por outro usuário. Recarregando...', 'warning');
        await fetchTicket();
      } else {
        toast('Erro ao atualizar', 'error');
      }
    } catch { toast('Erro ao atualizar', 'error'); }
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

  return (
    <AnimatePresence>
      {ticketId && (
        <motion.div
          key="ticket-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="mt-4 mb-4 md:mt-8 md:mb-8 flex h-[calc(100vh-32px)] md:h-[calc(100vh-64px)] w-full max-w-[1100px] mx-2 md:mx-0 flex-col rounded-lg border border-[var(--card-border)] bg-[var(--modal-bg)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Loading */}
            {loading && (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              </div>
            )}

            {/* Error */}
            {!loading && !ticket && (
              <div className="flex flex-1 items-center justify-center text-[14px] text-secondary">
                Ticket não encontrado
              </div>
            )}

            {/* Content */}
            {!loading && ticket && (
              <>
                {/* Top bar — breadcrumb + ações */}
                <div className="flex shrink-0 items-center justify-between border-b border-[var(--card-border)] px-5 py-2.5">
                  <div className="flex items-center gap-1.5 text-[12.5px]">
                    {ticket.parent_key && (
                      <>
                        <TicketTypeIcon typeName={ticket.type_name} typeIcon={ticket.type_icon} size="sm" />
                        <button onClick={() => { onClose(); setTimeout(() => { window.location.href = `/ticket/${ticket.parent_id}`; }, 100); }} className="text-secondary hover:text-[var(--accent)] transition-colors">
                          {ticket.parent_key}
                        </button>
                        <span className="text-[var(--text-tertiary)]">/</span>
                      </>
                    )}
                    <TicketTypeIcon typeName={ticket.type_name} typeIcon={ticket.type_icon} size="sm" />
                    <span className="font-mono font-medium text-primary tabular-nums">{ticket.ticket_key}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/ticket/${ticket.id}`).then(() => toast('Link copiado', 'success'))}
                      className="rounded p-1.5 text-secondary transition hover:bg-[var(--overlay-hover)] hover:text-primary"
                      title="Copiar link"
                    >
                      <Share2 size={13} />
                    </button>
                    <button
                      onClick={() => { onClose(); window.open(`/ticket/${ticket.id}`, '_blank'); }}
                      className="rounded p-1.5 text-secondary transition hover:bg-[var(--overlay-hover)] hover:text-primary"
                      title="Abrir em nova aba"
                    >
                      <Maximize2 size={13} />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={handleDeleteTicket}
                        className="rounded p-1.5 text-secondary transition hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                        title="Excluir ticket"
                        aria-label="Excluir ticket"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <button onClick={onClose} className="rounded p-1.5 text-secondary transition hover:bg-[var(--overlay-hover)] hover:text-primary">
                      <XIcon size={13} />
                    </button>
                  </div>
                </div>

                {/* Body — scrollable */}
                <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
                  {/* Left column — conteúdo */}
                  <div className="flex-1 overflow-y-auto px-6 py-6">
                    {/* Title — serif editorial */}
                    {editingTitle ? (
                      <input
                        autoFocus
                        value={titleValue}
                        onChange={(e) => setTitleValue(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); }}
                        className="mb-5 w-full rounded bg-transparent font-serif text-[24px] font-medium text-primary outline-none ring-1 ring-[var(--accent)]/40 px-1 -mx-1"
                        style={{ letterSpacing: '-0.015em' }}
                      />
                    ) : (
                      <h1
                        onClick={() => setEditingTitle(true)}
                        className="mb-5 cursor-text font-serif text-[24px] font-medium text-primary hover:text-secondary transition-colors leading-tight"
                        style={{ letterSpacing: '-0.015em' }}
                      >
                        {ticket.title}
                      </h1>
                    )}

                    {/* Descrição */}
                    <section className="mb-6">
                      <button onClick={() => setDescOpen(!descOpen)} className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-secondary hover:text-primary transition-colors">
                        {descOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        Descrição
                      </button>
                      {descOpen && (
                        editingDesc ? (
                          <div className="space-y-2">
                            <RichTextEditor content={descValue} onChange={setDescValue} placeholder="Adicione uma descrição..." />
                            <div className="flex gap-2">
                              <button onClick={saveDescription} className="btn-premium btn-primary text-[12px]">Salvar</button>
                              <button onClick={() => setEditingDesc(false)} className="btn-premium btn-ghost text-[12px]">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div onClick={() => setEditingDesc(true)} className="cursor-text text-[14px] leading-relaxed text-secondary hover:text-primary transition-colors">
                            {ticket.description ? (
                              <div className="text-primary" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ticket.description) }} />
                            ) : (
                              <p className="italic text-[var(--text-tertiary)]">Clique para adicionar uma descrição...</p>
                            )}
                          </div>
                        )
                      )}
                    </section>

                    {/* Subtarefas */}
                    <section className="mb-6 border-t border-[var(--card-border)] pt-5">
                      <SubtaskList ticketId={ticket.id} />
                    </section>

                    {/* Tickets vinculados */}
                    <section className="mb-6 border-t border-[var(--card-border)] pt-5">
                      <LinkedTickets ticketId={ticket.id} />
                    </section>

                    {/* Desenvolvimento */}
                    <section className="mb-6 border-t border-[var(--card-border)] pt-5">
                      <DevLinks ticketId={ticket.id} />
                    </section>

                    {/* GitHub (webhook-synced) */}
                    <section className="mb-6 border-t border-[var(--card-border)] pt-5">
                      <GitHubLinks ticketId={ticket.id} />
                    </section>

                    {/* Acessos */}
                    <section className="mb-6 border-t border-[var(--card-border)] pt-5">
                      <AccessLinks ticketId={ticket.id} />
                    </section>

                    {/* Anexos */}
                    <section className="mb-6 border-t border-[var(--card-border)] pt-5">
                      <AttachmentList ticketId={ticket.id} />
                    </section>

                    {/* Atividade */}
                    <section className="border-t border-[var(--card-border)] pt-5">
                      <button onClick={() => setActivityOpen(!activityOpen)} className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-secondary hover:text-primary transition-colors">
                        {activityOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        Atividade
                      </button>
                      {activityOpen && <ActivityTimeline ticketId={ticket.id} />}
                    </section>
                  </div>

                  {/* Right sidebar — metadata */}
                  <div className="w-full md:w-[300px] shrink-0 overflow-y-auto border-t md:border-t-0 md:border-l border-[var(--card-border)] bg-[var(--bg-secondary)] px-5 py-5">
                    <TicketSidebar ticket={ticket} onUpdate={updateField} />
                    {isAdmin && (
                      <div className="mt-5 pt-5 border-t border-[var(--card-border)]">
                        <TimeTracker ticketId={ticket.id} />
                      </div>
                    )}
                    <div className="mt-5 pt-5 border-t border-[var(--card-border)] space-y-1 text-[11px] text-[var(--text-tertiary)]">
                      <p>Criado {new Date(ticket.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      <p>Atualizado {new Date(ticket.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    {isAdmin && (
                      <a href="/settings" className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors">
                        <Settings2 size={11} />
                        Configurar
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
