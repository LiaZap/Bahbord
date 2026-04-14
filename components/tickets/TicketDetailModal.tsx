'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Eye, Share2, Maximize2, MoreHorizontal, X as XIcon,
  ChevronDown, ChevronRight, Plus, Settings2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SubtaskList from './SubtaskList';
import LinkedTickets from './LinkedTickets';
import ActivityTimeline from './ActivityTimeline';
import TicketSidebar from './TicketSidebar';
import TimeTracker from './TimeTracker';
import AttachmentList from './AttachmentList';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { useToast } from '@/components/ui/Toast';
import TicketTypeIcon from '@/components/ui/TicketTypeIcon';

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
  const { toast } = useToast();

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
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        toast('Atualizado', 'success');
        await fetchTicket();
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
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mt-8 mb-8 flex h-[calc(100vh-64px)] w-full max-w-[1100px] flex-col rounded-xl border border-white/[0.08] bg-[#1e2126] shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Loading */}
            {loading && (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            )}

            {/* Error */}
            {!loading && !ticket && (
              <div className="flex flex-1 items-center justify-center text-[14px] text-slate-500">
                Ticket não encontrado
              </div>
            )}

            {/* Content */}
            {!loading && ticket && (
              <>
                {/* Top bar */}
                <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-3">
                  <div className="flex items-center gap-1.5 text-[13px]">
                    {ticket.parent_key && (
                      <>
                        <TicketTypeIcon typeName={ticket.type_name} typeIcon={ticket.type_icon} size="sm" />
                        <button onClick={() => { onClose(); setTimeout(() => { window.location.href = `/ticket/${ticket.parent_id}`; }, 100); }} className="text-slate-400 hover:text-blue-400">
                          {ticket.parent_key}
                        </button>
                        <span className="text-slate-600">/</span>
                      </>
                    )}
                    <TicketTypeIcon typeName={ticket.type_name} typeIcon={ticket.type_icon} size="sm" />
                    <span className="font-medium text-slate-300">{ticket.ticket_key}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300">
                      <Eye size={14} /> 1
                    </button>
                    <button className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"><Share2 size={14} /></button>
                    <button className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"><MoreHorizontal size={14} /></button>
                    <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"><XIcon size={14} /></button>
                  </div>
                </div>

                {/* Body — scrollable */}
                <div className="flex flex-1 overflow-hidden">
                  {/* Left column */}
                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    {/* Title */}
                    {editingTitle ? (
                      <input
                        autoFocus
                        value={titleValue}
                        onChange={(e) => setTitleValue(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); }}
                        className="mb-4 w-full rounded bg-transparent text-[20px] font-semibold text-white outline-none ring-1 ring-blue-500/40"
                      />
                    ) : (
                      <h1 onClick={() => setEditingTitle(true)} className="mb-4 cursor-text text-[20px] font-semibold text-white hover:text-slate-200">
                        {ticket.title}
                      </h1>
                    )}

                    {/* Descrição */}
                    <section className="mb-6">
                      <button onClick={() => setDescOpen(!descOpen)} className="mb-2 flex items-center gap-1.5 text-[14px] font-semibold text-slate-200">
                        {descOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        Descrição
                      </button>
                      {descOpen && (
                        editingDesc ? (
                          <div className="space-y-2">
                            <RichTextEditor content={descValue} onChange={setDescValue} placeholder="Adicione uma descrição..." />
                            <div className="flex gap-2">
                              <button onClick={saveDescription} className="rounded bg-blue-600 px-3 py-1 text-[12px] font-medium text-white hover:bg-blue-500">Salvar</button>
                              <button onClick={() => setEditingDesc(false)} className="rounded px-3 py-1 text-[12px] text-slate-400 hover:text-slate-200">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div onClick={() => setEditingDesc(true)} className="cursor-text text-[14px] leading-relaxed text-slate-300">
                            {ticket.description ? (
                              <div dangerouslySetInnerHTML={{ __html: ticket.description }} />
                            ) : (
                              <p className="italic text-slate-600">Clique para adicionar uma descrição...</p>
                            )}
                          </div>
                        )
                      )}
                    </section>

                    {/* Subtarefas */}
                    <section className="mb-6 border-t border-white/[0.04] pt-5">
                      <SubtaskList ticketId={ticket.id} />
                    </section>

                    {/* Tickets vinculados */}
                    <section className="mb-6 border-t border-white/[0.04] pt-5">
                      <LinkedTickets ticketId={ticket.id} />
                    </section>

                    {/* Atividade */}
                    <section className="border-t border-white/[0.04] pt-5">
                      <button onClick={() => setActivityOpen(!activityOpen)} className="mb-3 flex items-center gap-1.5 text-[14px] font-semibold text-slate-200">
                        {activityOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        Atividade
                      </button>
                      {activityOpen && <ActivityTimeline ticketId={ticket.id} />}
                    </section>
                  </div>

                  {/* Right sidebar */}
                  <div className="w-[320px] shrink-0 overflow-y-auto border-l border-white/[0.06] bg-[#1a1d21] px-5 py-5">
                    <TicketSidebar ticket={ticket} onUpdate={updateField} />
                    <div className="mt-4">
                      <TimeTracker ticketId={ticket.id} />
                    </div>
                    <div className="mt-6 space-y-1 text-[11px] text-slate-500">
                      <p>Criado {ticket.created_at}</p>
                      <p>Atualizado {ticket.updated_at}</p>
                    </div>
                    <button className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300">
                      <Settings2 size={12} />
                      Configurar
                    </button>
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
