'use client';

import { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils/cn';
import { Pencil, Save, X, Trash2, Clock, User } from 'lucide-react';
import RichTextEditor from '@/components/editor/RichTextEditor';

interface PageData {
  id: string;
  title: string;
  content: string;
  created_by_name: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
  is_published: boolean;
}

interface PageEditorProps {
  pageId: string | null;
  onDeleted?: () => void;
}

export default function PageEditor({ pageId, onDeleted }: PageEditorProps) {
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPage = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/docs/pages?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setPage(data);
        setEditTitle(data.title);
        setEditContent(data.content || '');
      }
    } catch (err) { console.error('Error loading page:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (pageId) {
      setEditing(false);
      loadPage(pageId);
    } else {
      setPage(null);
    }
  }, [pageId, loadPage]);

  async function savePage() {
    if (!page) return;
    setSaving(true);
    try {
      const res = await fetch('/api/docs/pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: page.id, title: editTitle, content: editContent }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPage({ ...page, ...updated });
        setEditing(false);
      }
    } catch (err) { console.error('Error saving page:', err); }
    finally { setSaving(false); }
  }

  async function deletePage() {
    if (!page || !window.confirm('Excluir esta página? Esta ação não pode ser desfeita.')) return;
    try {
      await fetch(`/api/docs/pages?id=${page.id}`, { method: 'DELETE' });
      setPage(null);
      onDeleted?.();
    } catch (err) { console.error('Error deleting page:', err); }
  }

  function formatTimeAgo(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `${diffMins}m atrás`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d atrás`;
    return d.toLocaleDateString('pt-BR');
  }

  // Empty state
  if (!pageId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04]">
            <Pencil size={24} className="text-slate-600" />
          </div>
          <h3 className="text-sm font-medium text-slate-400">Selecione uma página</h3>
          <p className="mt-1 text-xs text-slate-600">Escolha um documento na barra lateral para visualizar</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!page) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {page.updated_by_name && (
            <>
              <User size={12} />
              <span>{page.updated_by_name}</span>
              <span className="text-slate-700">|</span>
            </>
          )}
          <Clock size={12} />
          <span>{formatTimeAgo(page.updated_at)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <button onClick={savePage} disabled={saving}
                className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-blue-500 disabled:opacity-50">
                <Save size={13} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => { setEditing(false); setEditTitle(page.title); setEditContent(page.content || ''); }}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[12px] text-slate-400 transition hover:bg-white/[0.06]">
                <X size={13} />
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1 rounded-md bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-slate-300 transition hover:bg-white/[0.1]">
                <Pencil size={13} />
                Editar
              </button>
              <button onClick={deletePage}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[12px] text-red-400/70 transition hover:bg-white/[0.06] hover:text-red-400">
                <Trash2 size={13} />
                Excluir
              </button>
            </>
          )}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-8 py-6">
          {editing ? (
            <>
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="mb-4 w-full bg-transparent text-2xl font-bold text-white outline-none placeholder:text-slate-600"
                placeholder="Título da página"
              />
              <RichTextEditor
                content={editContent}
                onChange={setEditContent}
                placeholder="Comece a escrever..."
                editable
              />
            </>
          ) : (
            <>
              <h1 className="mb-6 text-2xl font-bold text-white">{page.title}</h1>
              {page.content ? (
                <div
                  className="prose prose-invert prose-sm max-w-none text-slate-300
                    prose-headings:text-white prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                    prose-code:text-blue-300 prose-code:bg-white/[0.06] prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                    prose-pre:bg-[#0d0d0d] prose-pre:border prose-pre:border-white/[0.06]
                    prose-hr:border-white/[0.08]
                    prose-li:marker:text-slate-600"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content) }}
                />
              ) : (
                <p className="text-sm text-slate-600 italic">Página vazia. Clique em Editar para adicionar conteúdo.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
