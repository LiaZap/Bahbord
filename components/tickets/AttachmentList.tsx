'use client';

import { useState, useEffect, useCallback } from 'react';
import { Paperclip, Upload, Trash2, FileText, Image, File, Film, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface Attachment {
  id: string;
  file_name: string;
  file_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  uploaded_by_name: string | null;
}

interface AttachmentListProps {
  ticketId: string;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mime: string | null) {
  if (!mime) return File;
  if (mime.startsWith('image/')) return Image;
  if (mime.startsWith('video/')) return Film;
  return FileText;
}

export default function AttachmentList({ ticketId }: AttachmentListProps) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/attachments?ticket_id=${ticketId}`);
      if (res.ok) setAttachments(await res.json());
    } catch (err) { console.error('Erro ao carregar anexos:', err); }
  }, [ticketId]);

  useEffect(() => { fetchAttachments(); }, [fetchAttachments]);

  async function handleFiles(files: FileList) {
    let uploaded = 0;
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ticket_id', ticketId);

      const res = await fetch('/api/attachments/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        uploaded++;
      } else {
        // Fallback: salvar só metadados se upload falhar
        await fetch('/api/attachments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket_id: ticketId,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
          }),
        });
        uploaded++;
      }
    }
    toast(`${uploaded} arquivo${uploaded > 1 ? 's' : ''} adicionado${uploaded > 1 ? 's' : ''}`, 'success');
    await fetchAttachments();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este anexo?')) return;
    try {
      const res = await fetch(`/api/attachments?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast('Arquivo removido', 'success');
      } else {
        toast('Erro ao remover arquivo', 'error');
      }
    } catch {
      toast('Erro de conexão', 'error');
    }
    await fetchAttachments();
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  return (
    <section className="rounded-lg border border-border/40 bg-surface2 p-5">
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Paperclip size={13} />
        Anexos
        {attachments.length > 0 && <span className="text-slate-600">({attachments.length})</span>}
      </h2>

      {/* File list */}
      {attachments.length > 0 && (
        <div className="mb-3 space-y-1">
          {attachments.map((a) => {
            const Icon = getFileIcon(a.mime_type);
            return (
              <div key={a.id} className="group flex items-center gap-2 rounded px-2 py-1.5 transition hover:bg-surface">
                {a.mime_type?.startsWith('image/') && a.file_url ? (
                  <img
                    src={a.file_url}
                    alt={a.file_name}
                    className="h-8 w-8 shrink-0 cursor-pointer rounded object-cover hover:ring-2 hover:ring-accent"
                    onClick={() => setPreview(a)}
                  />
                ) : a.mime_type?.startsWith('video/') && a.file_url ? (
                  <button onClick={() => setPreview(a)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-700 hover:ring-2 hover:ring-accent">
                    <Film size={14} className="text-slate-400" />
                  </button>
                ) : (
                  <Icon size={14} className="shrink-0 text-slate-500" />
                )}
                <div className="flex-1 min-w-0">
                  {a.file_url ? (
                    <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-accent hover:underline block">{a.file_name}</a>
                  ) : (
                    <p className="truncate text-xs text-slate-300">{a.file_name}</p>
                  )}
                  <p className="text-[10px] text-slate-600">
                    {formatSize(a.file_size)}
                    {a.uploaded_by_name && ` - ${a.uploaded_by_name}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="shrink-0 opacity-0 transition hover:text-danger group-hover:opacity-100"
                >
                  <Trash2 size={13} className="text-slate-600 hover:text-danger" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 transition ${
          dragging
            ? 'border-accent bg-accent/5'
            : 'border-border/40 hover:border-border/60'
        }`}
      >
        <Upload size={20} className="text-slate-500" />
        <p className="text-xs text-slate-500">
          Arraste arquivos aqui ou{' '}
          <label className="cursor-pointer text-accent hover:text-blue-400">
            escolha do computador
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
          </label>
        </p>
      </div>
      {/* Preview modal for images and videos */}
      {preview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreview(null)} className="absolute -right-3 -top-3 z-10 rounded-full bg-slate-800 p-1.5 text-white hover:bg-slate-700">
              <X size={16} />
            </button>
            {preview.mime_type?.startsWith('image/') ? (
              <img src={preview.file_url!} alt={preview.file_name} className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain" />
            ) : preview.mime_type?.startsWith('video/') ? (
              <video src={preview.file_url!} controls autoPlay className="max-h-[85vh] max-w-[85vw] rounded-lg" />
            ) : null}
            <p className="mt-2 text-center text-sm text-slate-400">{preview.file_name}</p>
          </div>
        </div>
      )}
    </section>
  );
}
