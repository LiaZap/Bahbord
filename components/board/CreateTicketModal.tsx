'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Minus, Maximize2, MoreHorizontal, AlertTriangle, ChevronDown, Sparkles } from 'lucide-react';
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
    const searchParams = useSearchParams();
    const urlBoardId = searchParams.get('board_id');
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
    const [aiLoading, setAiLoading] = useState(false);

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
          // Resolve project_id from context or board_id
          let projectIdForSprints: string | null = currentProjectId || null;
          const boardIdForLookup = currentBoardId || urlBoardId;
          if (!projectIdForSprints && boardIdForLookup) {
            try {
              const bRes = await fetch(`/api/options?type=boards`);
              if (bRes.ok) {
                const allBoards = await bRes.json();
                const match = allBoards.find((b: any) => b.id === boardIdForLookup);
                if (match?.project_id) projectIdForSprints = match.project_id;
              }
            } catch {}
          }
          const sprintsUrl = projectIdForSprints
            ? `/api/options?type=sprints&project_id=${projectIdForSprints}`
            : `/api/options?type=sprints`;

          const [mRes, cRes, sRes, svRes, clRes] = await Promise.all([
            fetch('/api/options?type=members'),
            fetch('/api/options?type=categories'),
            fetch(sprintsUrl),
            fetch('/api/options?type=services'),
            fetch('/api/options?type=clients'),
          ]);
          if (mRes.ok) {
            const allMembers = await mRes.json();
            // Filter members by project access if in project context
            if (currentBoardId || currentProjectId) {
              try {
                const url = currentBoardId
                  ? `/api/members/by-access?board_id=${currentBoardId}`
                  : `/api/members/by-access?project_id=${currentProjectId}`;
                const accessRes = await fetch(url);
                if (accessRes.ok) {
                  setMembers(await accessRes.json());
                } else {
                  setMembers(allMembers);
                }
              } catch {
                setMembers(allMembers);
              }
            } else {
              setMembers(allMembers);
            }
          }
          if (cRes.ok) setCategories(await cRes.json());
          if (sRes.ok) {
            const sprintList = await sRes.json();
            setSprints(sprintList);
            // Auto-select active sprint
            const activeSprint = sprintList.find((s: any) => s.is_active);
            if (activeSprint && !sprintId) setSprintId(activeSprint.id);
          }
          if (svRes.ok) {
            const svcList = await svRes.json();
            setAllServices(svcList);
            // Auto-select BAHTECH if empty
            if (!serviceId) {
              const bahtech = svcList.find((s: any) => s.name === 'BAHTECH');
              if (bahtech) setServiceId(bahtech.id);
            }
          }
          // Determine project name + auto-select client if external project
          if (currentProjectId) {
            const allProjRes = await fetch('/api/options?type=projects');
            if (allProjRes.ok) {
              const allProjs = await allProjRes.json();
              const currentProj = allProjs.find((p: any) => p.id === currentProjectId);
              const isExternal = currentProj && currentProj.name !== 'Bah!Company';

              // For external projects, auto-fill client with project name
              if (isExternal && clRes.ok && !clientId) {
                const allClients = await clRes.json();
                const matchClient = allClients.find((c: any) => c.name === currentProj.name);
                if (matchClient) {
                  setClientId(matchClient.id);
                  setClients([matchClient]);
                } else {
                  setClients(allClients);
                }
              } else if (clRes.ok) {
                setClients(await clRes.json());
              }
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

      setIsSubmitting(true);
      try {
        const response = await fetch('/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket_type_id: ticketTypeId,
            status_id: statusId,
            service_id: serviceId || null,
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
            board_id: urlBoardId || currentBoardId || null,
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
    const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-secondary';
    const requiredDot = <span className="text-[var(--danger)] ml-0.5">*</span>;

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="create-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 flex items-stretch md:items-start justify-center bg-black/70 md:pt-[4vh]"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex max-h-screen md:max-h-[92vh] w-full max-w-[540px] mx-0 md:mx-3 flex-col rounded-none md:rounded-lg border-0 md:border md:border-[var(--card-border)] bg-[var(--modal-bg)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header — editorial */}
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--card-border)] px-5 py-3">
                <h2 className="font-serif text-[18px] font-medium text-primary tracking-tight">{modalTitle}</h2>
                <div className="flex items-center gap-0.5">
                  <button type="button" className="rounded p-1.5 text-secondary transition hover:bg-[var(--overlay-hover)] hover:text-primary"><Minus size={13} /></button>
                  <button type="button" className="rounded p-1.5 text-secondary transition hover:bg-[var(--overlay-hover)] hover:text-primary"><Maximize2 size={13} /></button>
                  <button type="button" className="rounded p-1.5 text-secondary transition hover:bg-[var(--overlay-hover)] hover:text-primary"><MoreHorizontal size={13} /></button>
                  <button type="button" onClick={() => setIsOpen(false)} className="rounded p-1.5 text-secondary transition hover:bg-[var(--overlay-hover)] hover:text-primary"><X size={13} /></button>
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

                  <p className="text-[11px] text-secondary">Os campos obrigatórios estão marcados com asterisco <span className="text-[var(--danger)]">*</span></p>

                  {/* Espaço */}
                  <div>
                    <label className={labelClass}>Espaço {requiredDot}</label>
                    <div className="flex items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary">
                      <img src="/logo-bahtech.svg" alt="" className="h-3.5 object-contain dark:invert-0 invert" />
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
                      className="input-premium w-full !text-[14px] !font-medium !py-2.5"
                      placeholder="Resumo do ticket"
                      autoFocus
                    />
                  </div>

                  {/* Descrição */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className={labelClass + ' mb-0'}>Descrição</label>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!title.trim()) { setError('Digite o título primeiro'); return; }
                          setAiLoading(true);
                          try {
                            const res = await fetch('/api/ai/generate-description', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ title }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setDescription(data.description);
                            }
                          } finally {
                            setAiLoading(false);
                          }
                        }}
                        disabled={aiLoading}
                        className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 disabled:opacity-50"
                      >
                        <Sparkles size={12} className={aiLoading ? 'animate-pulse' : ''} />
                        {aiLoading ? 'Gerando...' : 'Gerar descrição com IA'}
                      </button>
                    </div>
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
                <div className="sticky bottom-0 flex items-center justify-between border-t border-[var(--card-border)] bg-[var(--modal-bg)] px-5 py-2.5">
                  <label className="flex items-center gap-2 text-[12.5px] text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createAnother}
                      onChange={(e) => setCreateAnother(e.target.checked)}
                      className="rounded border-[var(--card-border)] bg-[var(--overlay-subtle)] accent-[var(--accent)]"
                    />
                    Criar outro
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="btn-premium btn-ghost"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-premium btn-primary disabled:opacity-50"
                    >
                      {isSubmitting ? 'Criando...' : 'Criar ticket'}
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
