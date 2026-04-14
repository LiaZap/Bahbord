'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import RichTextEditor from '@/components/editor/RichTextEditor';

interface SelectItem { id: string; name: string }

interface CreateTicketModalProps {
  services: SelectItem[];
  statuses: SelectItem[];
  ticketTypes: SelectItem[];
}

export interface CreateTicketModalRef {
  open: () => void;
}

const CreateTicketModal = forwardRef<CreateTicketModalRef, CreateTicketModalProps>(
  function CreateTicketModal({ services, statuses, ticketTypes }, ref) {
    const router = useRouter();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
    const [statusId, setStatusId] = useState(statuses[0]?.id ?? '');
    const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? '');
    const [priority, setPriority] = useState('medium');
    const [dueDate, setDueDate] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useImperativeHandle(ref, () => ({ open: () => setIsOpen(true) }));

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setError('');
      if (!title.trim()) { setError('O resumo do ticket é obrigatório.'); return; }

      setIsSubmitting(true);
      try {
        const response = await fetch('/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_slug: 'bahcompany',
            ticket_type_id: ticketTypeId,
            status_id: statusId,
            service_id: serviceId,
            assignee_id: null,
            reporter_id: null,
            title: title.trim(),
            description: description.trim(),
            priority,
            due_date: dueDate || null
          })
        });

        if (!response.ok) {
          const result = await response.json();
          setError(result?.error || 'Erro ao criar ticket.');
          return;
        }

        const created = await response.json();
        toast(`Ticket criado com sucesso`, 'success');
        setTitle('');
        setDescription('');
        setPriority('medium');
        setDueDate('');
        setIsOpen(false);
        router.refresh();
      } catch {
        setError('Erro de conexão ao criar ticket.');
      } finally {
        setIsSubmitting(false);
      }
    }

    const selectClass = 'w-full rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-slate-200 outline-none transition focus:border-blue-500/40 focus:bg-white/[0.05]';

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[8vh] backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="w-full max-w-lg rounded-xl border border-white/[0.08] bg-[#1e2126] shadow-2xl shadow-black/50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
                <h2 className="text-[14px] font-semibold text-white">Criar ticket</h2>
                <button onClick={() => setIsOpen(false)} className="rounded-md p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300">
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <form className="space-y-4 p-5" onSubmit={handleSubmit}>
                <div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-transparent text-[16px] font-semibold text-white outline-none placeholder:text-slate-600"
                    placeholder="Título do ticket"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Tipo</label>
                    <select value={ticketTypeId} onChange={(e) => setTicketTypeId(e.target.value)} className={selectClass}>
                      {ticketTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Serviço</label>
                    <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={selectClass}>
                      {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Prioridade</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectClass}>
                      <option value="urgent">Urgente</option>
                      <option value="high">Alta</option>
                      <option value="medium">Média</option>
                      <option value="low">Baixa</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Status</label>
                    <select value={statusId} onChange={(e) => setStatusId(e.target.value)} className={selectClass}>
                      {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Data limite</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={selectClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Descrição</label>
                  <RichTextEditor
                    content={description}
                    onChange={setDescription}
                    placeholder="Detalhes, critérios e observações..."
                    minimal
                  />
                </div>

                {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-[12px] text-red-400">{error}</p>}

                <div className="flex items-center gap-2 border-t border-white/[0.06] pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-md bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Criando...' : 'Criar ticket'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-md px-4 py-2 text-[13px] text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

export default CreateTicketModal;
