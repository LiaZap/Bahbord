'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Pencil,
  Save,
  X,
  Link2,
  Lock,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/components/ui/Toast';
import RichTextEditor from '@/components/editor/RichTextEditor';

export interface SpecBacklink {
  ticket_id: string;
  ticket_key: string;
  title: string;
  status_name: string | null;
  status_color: string | null;
  is_done: boolean | null;
}

interface InitialSpec {
  contentHtml: string;
  contentText: string;
  version: number;
  updatedAt: string | null;
  updatedByName: string | null;
}

interface Props {
  projectId: string;
  projectName: string;
  projectPrefix: string;
  projectArchived: boolean;
  initialSpec: InitialSpec;
  initialBacklinks: SpecBacklink[];
  isAdmin: boolean;
}

/**
 * Tab Spec do projeto. Read-only por default; admins entram em edit mode pelo
 * botão "Editar". Save é manual (PUT) com detecção de conflito otimista via
 * `version`. Auto-save foi descartado pra Sprint 4 — ver REPORT.
 */
export default function ProjectSpecEditor({
  projectId,
  projectName,
  projectPrefix,
  projectArchived,
  initialSpec,
  initialBacklinks,
  isAdmin,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [spec, setSpec] = useState(initialSpec);
  const [backlinks, setBacklinks] = useState<SpecBacklink[]>(initialBacklinks);

  const [editing, setEditing] = useState(false);
  const [draftHtml, setDraftHtml] = useState(initialSpec.contentHtml);
  const [saving, setSaving] = useState(false);

  // Container oculto pra extrair texto plain do HTML do TipTap. Usar createElement
  // direto evita acoplar o componente a uma lib HTML→text adicional.
  const plainTextRef = useRef<HTMLDivElement | null>(null);

  const canEdit = isAdmin && !projectArchived;

  const lastUpdatedLabel = useMemo(() => {
    if (!spec.updatedAt) return 'Ainda não foi editado';
    try {
      const ago = formatDistanceToNow(new Date(spec.updatedAt), {
        locale: ptBR,
        addSuffix: true,
      });
      return spec.updatedByName
        ? `Editado ${ago} por ${spec.updatedByName}`
        : `Editado ${ago}`;
    } catch {
      return 'Última edição desconhecida';
    }
  }, [spec.updatedAt, spec.updatedByName]);

  const startEdit = useCallback(() => {
    if (!canEdit) return;
    setDraftHtml(spec.contentHtml);
    setEditing(true);
  }, [canEdit, spec.contentHtml]);

  const cancelEdit = useCallback(() => {
    setDraftHtml(spec.contentHtml);
    setEditing(false);
  }, [spec.contentHtml]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);

    // Extrai plain text do HTML pra busca/preview futuras (gratuíto via DOM).
    let plainText = '';
    if (plainTextRef.current) {
      plainTextRef.current.innerHTML = draftHtml;
      plainText = (plainTextRef.current.textContent ?? '').trim();
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/spec`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_html: draftHtml,
          content_text: plainText,
          version: spec.version,
        }),
      });

      if (res.status === 409) {
        toast(
          'Outro admin editou este spec primeiro. Recarregando…',
          'warning',
        );
        // Pequeno delay pra o toast aparecer antes do refresh.
        setTimeout(() => router.refresh(), 600);
        return;
      }

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error || 'Falha ao salvar spec');
      }

      const data = (await res.json()) as {
        version: number;
        updated_at: string;
        updated_by_name: string | null;
      };

      setSpec({
        contentHtml: draftHtml,
        contentText: plainText,
        version: data.version,
        updatedAt: data.updated_at,
        updatedByName: data.updated_by_name,
      });
      setEditing(false);
      toast('Spec salvo', 'success');

      // Recarrega backlinks (foram regravados no backend).
      const blRes = await fetch(`/api/projects/${projectId}/spec`, {
        cache: 'no-store',
      });
      if (blRes.ok) {
        const fresh = (await blRes.json()) as { backlinks: SpecBacklink[] };
        setBacklinks(fresh.backlinks);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }, [draftHtml, projectId, router, saving, spec.version, toast]);

  const isEmpty = !spec.contentHtml.trim();

  return (
    <div className="space-y-6">
      {/* Container invisível pra extração de plain text. */}
      <div ref={plainTextRef} className="hidden" aria-hidden="true" />

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-[12px] text-tertiary-muted"
      >
        <button
          onClick={() => router.push('/projects')}
          className="inline-flex items-center gap-1 transition hover:text-primary"
        >
          <ArrowLeft size={12} />
          Projetos
        </button>
        <ChevronRight size={12} />
        <span className="text-secondary-muted">{projectName}</span>
        <ChevronRight size={12} />
        <span className="text-primary font-medium">Spec</span>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <p className="page-eyebrow">
            {projectPrefix} · documento do projeto
          </p>
          <h1 className="page-title">
            {projectName}{' '}
            <span className="em">— spec inline.</span>
          </h1>
          <p className="text-[13px] text-secondary-muted max-w-[560px]">
            {lastUpdatedLabel}.{' '}
            {canEdit
              ? 'Mencione tickets como BAH-123 — eles aparecem como backlinks na coluna ao lado.'
              : projectArchived
                ? 'Este projeto está arquivado, o spec ficou somente leitura.'
                : 'Apenas admins podem editar o spec.'}
          </p>
        </div>

        {!editing && canEdit && (
          <button
            type="button"
            onClick={startEdit}
            className="btn-premium btn-primary"
          >
            <Pencil size={13} strokeWidth={2.5} />
            Editar
          </button>
        )}

        {editing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-surface2 px-3 py-1.5 text-[12px] font-medium text-secondary transition hover:text-primary disabled:opacity-50"
            >
              <X size={13} />
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-premium btn-primary"
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Salvando…
                </>
              ) : (
                <>
                  <Save size={13} strokeWidth={2.5} />
                  Salvar
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Layout 2 colunas: editor + sidebar backlinks */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Editor / preview */}
        <div className="space-y-3">
          {editing ? (
            <RichTextEditor
              content={draftHtml}
              onChange={setDraftHtml}
              placeholder="Comece escrevendo o spec do projeto. Mencione tickets como BAH-123 pra criar backlinks…"
              editable
            />
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/40 bg-surface2/30 py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface2 text-tertiary-muted">
                <FileText size={24} />
              </div>
              <h3 className="text-sm font-semibold text-secondary">
                Nenhum spec ainda
              </h3>
              <p className="mt-1 max-w-sm text-xs text-tertiary-muted">
                {canEdit
                  ? 'Clique em “Editar” pra começar a documentar este projeto.'
                  : 'Quando um admin editar, o conteúdo aparece aqui.'}
              </p>
            </div>
          ) : (
            <article
              className="prose prose-invert prose-sm max-w-none rounded-lg border border-border/40 bg-surface px-5 py-4 text-primary"
              dangerouslySetInnerHTML={{ __html: spec.contentHtml }}
            />
          )}
        </div>

        {/* Sidebar backlinks */}
        <aside className="space-y-3">
          <div className="rounded-lg border border-border/40 bg-surface2/40 p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-tertiary-muted">
              <Link2 size={12} />
              Backlinks
              <span className="ml-auto rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-secondary-muted">
                {backlinks.length}
              </span>
            </div>

            {backlinks.length === 0 ? (
              <p className="text-[12px] text-tertiary-muted">
                Mencione tickets no formato{' '}
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px] text-secondary">
                  {projectPrefix}-001
                </code>{' '}
                pra vê-los aqui.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {backlinks.map((b) => (
                  <li key={b.ticket_id}>
                    <Link
                      href={`/backlog?ticket=${b.ticket_key}`}
                      className="group flex items-start gap-2 rounded px-2 py-1.5 transition hover:bg-surface"
                      title={b.title}
                    >
                      <span
                        className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            b.status_color || 'var(--text-tertiary)',
                        }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block font-mono text-[11px] tabular-nums text-tertiary-muted group-hover:text-accent">
                          {b.ticket_key}
                        </span>
                        <span className="block truncate text-[12px] text-secondary group-hover:text-primary">
                          {b.title}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!canEdit && !projectArchived && !isAdmin && (
            <p className="flex items-center gap-1.5 text-[11px] text-tertiary-muted">
              <Lock size={11} />
              Somente admins podem editar.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
