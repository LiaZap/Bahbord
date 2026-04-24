'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import { X, Minus, Maximize2, MoreHorizontal, AlertTriangle, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import RichTextEditor from '@/components/editor/RichTextEditor';
import TicketTypeIcon from '@/components/ui/TicketTypeIcon';
import { useProject } from '@/lib/project-context';

interface SelectItem { id: string; name: string; icon?: string; color?: string; display_name?: string; is_active?: boolean }

interface CreateTicketModalProps {
  services: SelectItem[];
  statuses: SelectItem[];
  ticketTypes: SelectItem[];
}

export interface CreateTicketModalRef {
  open: (presetStatusId?: string) => void;
}

const priorityOptions = [
  { id: 'urgent', label: 'Urgente', color: '#ef4444' },
  { id: 'high', label: 'Alta', color: '#f97316' },
  { id: 'medium', label: 'Média', color: '#eab308' },
  { id: 'low', label: 'Baixa', color: '#60a5fa' },
];

const descriptionTemplates: Record<string, string> = {
  'história': '<p><strong>História de usuário:</strong></p><p></p><p><strong>Critério de aceitação:</strong></p><p></p><p><strong>Observação:</strong></p>',
  'tarefa': '<p><strong>Descrição da tarefa:</strong></p><p></p><p><strong>Passo a passo:</strong></p>',
  'bug': '<p><strong>Passos para reproduzir:</strong></p><p></p><p><strong>Comportamento esperado:</strong></p><p></p><p><strong>Comportamento atual:</strong></p>',
  'epic': '<p><strong>Objetivo:</strong></p><p></p><p><strong>Escopo:</strong></p><p></p><p><strong>Critério de sucesso:</strong></p>',
};

const CreateTicketModal = forwardRef<CreateTicketModalRef, CreateTicketModalProps>(
  function CreateTicketModal({ services: initialServices, statuses: initialStatuses, ticketTypes: initialTicketTypes }, ref) {
    const router = useRouter();
    const { toast } = useToast();
    const { currentProjectId, currentBoardId } = useProject();
    const [isOpen, setIsOpen] = useState(false);

    // Form fields
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [serviceId, setServiceId] = useState('');
    const [statusId, setStatusId] = useState(initialStatuses[0]?.id ?? '');
    const [ticketTypeId, setTicketTypeId] = useState(initialTicketTypes[0]?.id ?? '');
    const [priority, setPriority] = useState('medium');
    const [dueDate, setDueDate] = useState('');
    const [assigneeId, setAssigneeId] = useState('');
    const [reporterId, setReporterId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [sprintId, setSprintId] = useState('');
    const [clientId, setClientId] = useState('');
    const [createAnother, setCreateAnother] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Options from API
    const [members, setMembers] = useState<SelectItem[]>([]);
    const [categories, setCategories] = useState<SelectItem[]>([]);
    const [sprints, setSprints] = useState<SelectItem[]>([]);
    const [allServices, setAllServices] = useState<SelectItem[]>(initialServices);
    const [clients, setClients] = useState<SelectItem[]>([]);

    useImperativeHandle(ref, () => ({
      open: (presetStatusId?: string) => {
        if (presetStatusId) setStatusId(presetStatusId);
        setIsOpen(true);
      }
    }));

    // Fetch options when modal opens
    useEffect(() => {
      if (!isOpen) return;
      async function load() {
        try {
          const [mRes, cRes, sRes, svRes, clRes] = await Promise.all([
            fetch('/api/options?type=members'),
            fetch('/api/options?type=categories'),
            fetch('/api/options?type=sprints'),
            fetch('/api/options?type=services'),
            fetch('/api/options?type=clients'),
          ]);
          if (mRes.ok) setMembers(await mRes.json());
          if (cRes.ok) setCategories(await cRes.json());
          if (sRes.ok) {
            const sprintList = await sRes.json();
            setSprints(sprintList);
            // Auto-select active sprint
            const activeSprint = sprintList.find((s: any) => s.is_active);
            if (activeSprint && !sprintId) setSprintId(activeSprint.id);
          }
          if (svRes.ok) setAllServices(await svRes.json());
          // Filter clients by project context if available
          if (currentProjectId) {
            const byProjRes = await fetch(`/api/clients/by-project?project_id=${currentProjectId}`);
            if (byProjRes.ok) {
              const projClients = await byProjRes.json();
              setClients(projClients);
            } else if (clRes.ok) {
              setClients(await clRes.json());
            }
          } else if (clRes.ok) {
            setClients(await clRes.json());
          }

          // Auto-set reporter to current user
          if (!reporterId) {
            try {
              const meRes = await fetch('/api/auth/me');
              if (meRes.ok) {
                const me = await meRes.json();
                if (me?.member?.id) setReporterId(me.member.id);
              }
            } catch {}
          }
        } catch (err) { console.error('Erro ao carregar opções:', err); }
      }
      load();
    }, [isOpen]);

    // Set template when type changes
    const selectedType = initialTicketTypes.find((t) => t.id === ticketTypeId);
    const typeName = selectedType?.name?.toLowerCase() || 'história';

    function handleTypeChange(newTypeId: string) {
      setTicketTypeId(newTypeId);
      const newType = initialTicketTypes.find((t) => t.id === newTypeId);
      const template = descriptionTemplates[newType?.name?.toLowerCase() || ''] || '';
      setDescription(template);
    }

    // Set initial template
    useEffect(() => {
      if (isOpen && !description) {
        const template = descriptionTemplates[typeName] || '';
        setDescription(template);
      }
    }, [isOpen]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setError('');
      if (!title.trim()) { setError('O resumo do ticket é obrigatório.'); return; }
      if (!serviceId) { setError('BAH! Serviço/Produto é necessário.'); return; }

      setIsSubmitting(true);
      try {
        const response = await fetch('/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket_type_id: ticketTypeId,
            status_id: statusId,
            service_id: serviceId,
            assignee_id: assigneeId || null,
            reporter_id: reporterId || null,
            title: title.trim(),
            description: description.trim(),
            priority,
            due_date: dueDate || null,
            client_id: clientId || null,
            category_id: categoryId || null,
            sprint_id: sprintId || null,
            project_id: currentProjectId || null,
            board_id: currentBoardId || null,
          })
        });

        if (!response.ok) {
          const result = await response.json();
          setError(result?.error || 'Erro ao criar ticket.');
          return;
        }

        toast('Ticket criado com sucesso', 'success');

        if (createAnother) {
          setTitle('');
          setDescription(descriptionTemplates[typeName] || '');
          setError('');
        } else {
          resetForm();
          setIsOpen(false);
        }
        router.refresh();
      } catch {
        setError('Erro de conexão ao criar ticket.');
      } finally {
        setIsSubmitting(false);
      }
    }

    function resetForm() {
      setTitle('');
      setDescription('');
      setServiceId('');
      setPriority('medium');
      setDueDate('');
      setAssigneeId('');
      setReporterId('');
      setCategoryId('');
      setSprintId('');
      setClientId('');
      setError('');
    }

    const activeSprint = sprints.find((s: any) => s.is_active);
    const showSprintWarning = sprintId && activeSprint && sprintId === activeSprint.id;

    const modalTitle = `Criar ${selectedType?.name || 'Ticket'}`;

    const selectClass = 'input-premium w-full';
    const labelClass = 'mb-1.5 block text-[12px] font-semibold text-slate-400';
    const requiredDot = <span className="text-red-400 ml-0.5">*</span>;

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="create-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[4vh] backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="glass flex max-h-[92vh] w-full max-w-[520px] mx-3 md:mx-0 flex-col rounded-2xl shadow-2xl shadow-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
                <h2 className="text-[16px] font-semibold text-white">{modalTitle}</h2>
                <div className="flex items-center gap-1">
                  <button type="button" className="rounded p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"><Minus size={14} /></button>
                  <button type="button" className="rounded p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"><Maximize2 size={14} /></button>
                  <button type="button" className="rounded p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"><MoreHorizontal size={14} /></button>
                  <button type="button" onClick={() => setIsOpen(false)} className="rounded p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"><X size={14} /></button>
                </div>
              </div>

              {/* Body — scrollable */}
              <form className="flex-1 overflow-y-auto" onSubmit={handleSubmit}>
                <div className="space-y-4 px-5 py-4">
                  {/* Error banner */}
                  {error && (
                    <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3">
                      <AlertTriangle size={16} className="shrink-0 text-red-400" />
                      <span className="text-[13px] text-red-300">{error}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500">Os campos obrigatórios estão marcados com asterisco <span className="text-red-400">*</span></p>

                  {/* Espaço */}
                  <div>
                    <label className={labelClass}>Espaço {requiredDot}</label>
                    <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-slate-300">
                      <img src="/logo-bahtech.svg" alt="" className="h-3.5 object-contain" />
                      Bah!Company (BAH)
                    </div>
                  </div>

                  {/* Tipo do ticket */}
                  <div>
                    <label className={labelClass}>Tipo do ticket {requiredDot}</label>
                    <div className="flex items-center gap-2">
                      <TicketTypeIcon typeName={selectedType?.name} size="md" />
                      <select
                        value={ticketTypeId}
                        onChange={(e) => handleTypeChange(e.target.value)}
                        className={selectClass + ' flex-1'}
                      >
                        {initialTicketTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className={labelClass}>Status</label>
                    <select value={statusId} onChange={(e) => setStatusId(e.target.value)} className={selectClass}>
                      {initialStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-600">Este é o status inicial após a criação</p>
                  </div>

                  {/* Resumo */}
                  <div>
                    <label className={labelClass}>Resumo {requiredDot}</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-md border-2 border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[14px] font-medium text-white outline-none transition focus:border-blue-500/60"
                      placeholder="Resumo do ticket"
                      autoFocus
                    />
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className={labelClass}>Descrição</label>
                    <RichTextEditor
                      content={description}
                      onChange={setDescription}
                      placeholder="Adicione detalhes..."
                    />
                  </div>

                  {/* Data limite */}
                  <div>
                    <label className={labelClass}>Data limite</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={selectClass}
                    />
                  </div>

                  {/* Responsável */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={labelClass}>Responsável</label>
                      <button type="button" className="text-[11px] text-blue-400 hover:text-blue-300">Atribuir a mim</button>
                    </div>
                    <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={selectClass}>
                      <option value="">Automático</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.display_name || m.name}</option>)}
                    </select>
                  </div>

                  {/* BAH! Serviço/Produto */}
                  <div>
                    <label className={labelClass}>BAH! Serviço/Produto {requiredDot}</label>
                    <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={selectClass}>
                      <option value="">Select...</option>
                      {allServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  {/* Cliente — filtrado por projeto do contexto */}
                  {clients.length > 0 && (
                    <div>
                      <label className={labelClass}>Cliente</label>
                      <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={selectClass}>
                        <option value="">Selecionar cliente</option>
                        {Array.from(new Map(clients.map((c) => [c.name, c])).values()).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Categorias */}
                  <div>
                    <label className={labelClass}>Categorias</label>
                    <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClass}>
                      <option value="">Selecionar categoria</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* Sprint */}
                  <div>
                    <label className={labelClass}>Sprint</label>
                    <select value={sprintId} onChange={(e) => setSprintId(e.target.value)} className={selectClass}>
                      <option value="">Nenhum</option>
                      {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {showSprintWarning && (
                      <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                        <span className="text-[12px] text-amber-300">A criação desse ticket vai afetar o escopo do sprint ativo</span>
                      </div>
                    )}
                  </div>

                  {/* Relator */}
                  <div>
                    <label className={labelClass}>Relator {requiredDot}</label>
                    <select value={reporterId} onChange={(e) => setReporterId(e.target.value)} className={selectClass}>
                      <option value="">Selecionar</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.display_name || m.name}</option>)}
                    </select>
                  </div>

                  {/* Prioridade */}
                  <div>
                    <label className={labelClass}>Prioridade</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectClass}>
                      {priorityOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 flex items-center justify-between border-t border-white/[0.06] bg-[var(--modal-bg)] px-5 py-3">
                  <label className="flex items-center gap-2 text-[13px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createAnother}
                      onChange={(e) => setCreateAnother(e.target.checked)}
                      className="rounded border-white/[0.1] bg-white/[0.03]"
                    />
                    Criar outro
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="rounded-md px-4 py-2 text-[13px] font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-md bg-blue-600 px-5 py-2 text-[13px] font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSubmitting ? 'Criando...' : 'Criar'}
                    </button>
                  </div>
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
