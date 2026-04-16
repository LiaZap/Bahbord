'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  BookOpen, Folder, FolderOpen, FileText, ChevronRight, ChevronDown,
  Plus, MoreHorizontal, Pencil, Trash2, FilePlus, FolderPlus, PanelLeftClose, PanelLeft
} from 'lucide-react';

interface Space {
  id: string;
  name: string;
  description: string | null;
  icon: string;
}

interface DocFolder {
  id: string;
  space_id: string;
  parent_id: string | null;
  name: string;
}

interface Page {
  id: string;
  space_id: string;
  folder_id: string | null;
  title: string;
}

interface DocsSidebarProps {
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onRefresh?: number;
}

export default function DocsSidebar({ selectedPageId, onSelectPage, onRefresh }: DocsSidebarProps) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [foldersByParent, setFoldersByParent] = useState<Record<string, DocFolder[]>>({});
  const [pagesByParent, setPagesByParent] = useState<Record<string, Page[]>>({});
  const [menuTarget, setMenuTarget] = useState<{ type: 'space' | 'folder' | 'page'; id: string; spaceId: string; parentId?: string | null } | null>(null);
  const [renaming, setRenaming] = useState<{ type: string; id: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newSpaceMode, setNewSpaceMode] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  // Load spaces
  const loadSpaces = useCallback(async () => {
    try {
      const res = await fetch('/api/docs/spaces');
      if (res.ok) {
        const data = await res.json();
        setSpaces(data);
        // Auto-expand first space
        if (data.length > 0 && expandedSpaces.size === 0) {
          setExpandedSpaces(new Set([data[0].id]));
        }
      }
    } catch (err) { console.error('Error loading spaces:', err); }
  }, []);

  useEffect(() => { loadSpaces(); }, [loadSpaces, onRefresh]);

  // Load folders + pages for a space
  const loadSpaceContent = useCallback(async (spaceId: string) => {
    try {
      const [foldersRes, pagesRes] = await Promise.all([
        fetch(`/api/docs/folders?space_id=${spaceId}`),
        fetch(`/api/docs/pages?space_id=${spaceId}`),
      ]);
      if (foldersRes.ok) {
        const folders = await foldersRes.json();
        setFoldersByParent(prev => ({ ...prev, [`space:${spaceId}`]: folders }));
      }
      if (pagesRes.ok) {
        const pages = await pagesRes.json();
        setPagesByParent(prev => ({ ...prev, [`space:${spaceId}`]: pages }));
      }
    } catch (err) { console.error('Error loading space content:', err); }
  }, []);

  // Load subfolder content
  const loadFolderContent = useCallback(async (folderId: string, spaceId: string) => {
    try {
      const [foldersRes, pagesRes] = await Promise.all([
        fetch(`/api/docs/folders?space_id=${spaceId}&parent_id=${folderId}`),
        fetch(`/api/docs/pages?space_id=${spaceId}&folder_id=${folderId}`),
      ]);
      if (foldersRes.ok) {
        const folders = await foldersRes.json();
        setFoldersByParent(prev => ({ ...prev, [`folder:${folderId}`]: folders }));
      }
      if (pagesRes.ok) {
        const pages = await pagesRes.json();
        setPagesByParent(prev => ({ ...prev, [`folder:${folderId}`]: pages }));
      }
    } catch (err) { console.error('Error loading folder content:', err); }
  }, []);

  // When a space is expanded, load its content
  useEffect(() => {
    expandedSpaces.forEach(spaceId => {
      loadSpaceContent(spaceId);
    });
  }, [expandedSpaces, loadSpaceContent, onRefresh]);

  // When a folder is expanded, load its content
  useEffect(() => {
    expandedFolders.forEach(folderId => {
      // Find space for this folder
      for (const [key, folders] of Object.entries(foldersByParent)) {
        const folder = folders.find(f => f.id === folderId);
        if (folder) {
          loadFolderContent(folderId, folder.space_id);
          break;
        }
      }
    });
  }, [expandedFolders, loadFolderContent]);

  function toggleSpace(spaceId: string) {
    setExpandedSpaces(prev => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId); else next.add(spaceId);
      return next;
    });
  }

  function toggleFolder(folderId: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  }

  // CRUD actions
  async function createSpace() {
    if (!newSpaceName.trim()) return;
    try {
      await fetch('/api/docs/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSpaceName.trim() }),
      });
      setNewSpaceMode(false);
      setNewSpaceName('');
      loadSpaces();
    } catch (err) { console.error(err); }
  }

  async function createFolder(spaceId: string, parentId?: string | null) {
    const name = window.prompt('Nome da pasta:');
    if (!name?.trim()) return;
    try {
      await fetch('/api/docs/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ space_id: spaceId, parent_id: parentId || null, name: name.trim() }),
      });
      if (parentId) {
        loadFolderContent(parentId, spaceId);
        setExpandedFolders(prev => new Set(prev).add(parentId));
      } else {
        loadSpaceContent(spaceId);
      }
    } catch (err) { console.error(err); }
  }

  async function createPage(spaceId: string, folderId?: string | null) {
    const title = window.prompt('Titulo da pagina:');
    if (!title?.trim()) return;
    try {
      const res = await fetch('/api/docs/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ space_id: spaceId, folder_id: folderId || null, title: title.trim() }),
      });
      if (res.ok) {
        const page = await res.json();
        if (folderId) {
          loadFolderContent(folderId, spaceId);
        } else {
          loadSpaceContent(spaceId);
        }
        onSelectPage(page.id);
      }
    } catch (err) { console.error(err); }
  }

  async function deleteItem(type: string, id: string, spaceId: string) {
    const label = type === 'space' ? 'espaço' : type === 'folder' ? 'pasta' : 'página';
    if (!window.confirm(`Excluir ${label}? Esta ação não pode ser desfeita.`)) return;
    try {
      const endpoint = type === 'space' ? 'spaces' : type === 'folder' ? 'folders' : 'pages';
      await fetch(`/api/docs/${endpoint}?id=${id}`, { method: 'DELETE' });
      if (type === 'space') loadSpaces();
      else loadSpaceContent(spaceId);
    } catch (err) { console.error(err); }
    setMenuTarget(null);
  }

  async function renameItem() {
    if (!renaming || !renameValue.trim()) { setRenaming(null); return; }
    try {
      const endpoint = renaming.type === 'space' ? 'spaces' : renaming.type === 'folder' ? 'folders' : 'pages';
      const body: Record<string, string> = { id: renaming.id };
      if (renaming.type === 'page') body.title = renameValue.trim();
      else body.name = renameValue.trim();
      await fetch(`/api/docs/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      loadSpaces();
    } catch (err) { console.error(err); }
    setRenaming(null);
  }

  // Context menu
  function ContextMenu() {
    if (!menuTarget) return null;
    return (
      <div className="fixed inset-0 z-50" onClick={() => setMenuTarget(null)}>
        <div
          className="absolute left-[180px] top-[40%] w-44 rounded-lg border border-border/60 bg-surface2 py-1 shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          {menuTarget.type !== 'page' && (
            <>
              <button onClick={() => { createFolder(menuTarget.spaceId, menuTarget.type === 'folder' ? menuTarget.id : null); setMenuTarget(null); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]">
                <FolderPlus size={13} /> Nova pasta
              </button>
              <button onClick={() => { createPage(menuTarget.spaceId, menuTarget.type === 'folder' ? menuTarget.id : null); setMenuTarget(null); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]">
                <FilePlus size={13} /> Nova página
              </button>
              <div className="mx-2 my-1 h-px bg-border/30" />
            </>
          )}
          <button onClick={() => {
            const item = menuTarget.type === 'space'
              ? spaces.find(s => s.id === menuTarget.id)
              : menuTarget.type === 'folder'
                ? Object.values(foldersByParent).flat().find(f => f.id === menuTarget.id)
                : Object.values(pagesByParent).flat().find(p => p.id === menuTarget.id);
            const currentName = menuTarget.type === 'page' ? (item as Page)?.title : (item as Space | DocFolder)?.name;
            setRenaming({ type: menuTarget.type, id: menuTarget.id });
            setRenameValue(currentName || '');
            setMenuTarget(null);
          }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]">
            <Pencil size={13} /> Renomear
          </button>
          <button onClick={() => deleteItem(menuTarget.type, menuTarget.id, menuTarget.spaceId)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-white/[0.06]">
            <Trash2 size={13} /> Excluir
          </button>
        </div>
      </div>
    );
  }

  // Render tree items
  function renderPages(pages: Page[]) {
    return pages.map(page => (
      <button
        key={page.id}
        onClick={() => onSelectPage(page.id)}
        onContextMenu={e => { e.preventDefault(); setMenuTarget({ type: 'page', id: page.id, spaceId: page.space_id }); }}
        className={cn(
          'group flex w-full items-center gap-1.5 rounded px-2 py-[5px] text-[12px] transition',
          selectedPageId === page.id
            ? 'bg-accent/10 text-accent'
            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
        )}
      >
        <FileText size={13} className="shrink-0 text-slate-600" />
        {renaming?.id === page.id ? (
          <input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={renameItem}
            onKeyDown={e => { if (e.key === 'Enter') renameItem(); if (e.key === 'Escape') setRenaming(null); }}
            className="flex-1 bg-transparent text-xs text-slate-200 outline-none"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate text-left">{page.title}</span>
        )}
        <button
          onClick={e => { e.stopPropagation(); setMenuTarget({ type: 'page', id: page.id, spaceId: page.space_id }); }}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-300"
        >
          <MoreHorizontal size={13} />
        </button>
      </button>
    ));
  }

  function renderFolders(folders: DocFolder[], depth: number) {
    return folders.map(folder => {
      const isExpanded = expandedFolders.has(folder.id);
      const subFolders = foldersByParent[`folder:${folder.id}`] || [];
      const subPages = pagesByParent[`folder:${folder.id}`] || [];
      const FolderIcon = isExpanded ? FolderOpen : Folder;
      const ChevIcon = isExpanded ? ChevronDown : ChevronRight;

      return (
        <div key={folder.id}>
          <button
            onClick={() => toggleFolder(folder.id)}
            onContextMenu={e => { e.preventDefault(); setMenuTarget({ type: 'folder', id: folder.id, spaceId: folder.space_id, parentId: folder.parent_id }); }}
            className="group flex w-full items-center gap-1.5 rounded px-2 py-[5px] text-[12px] text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200"
          >
            <ChevIcon size={11} className="shrink-0 text-slate-600" />
            <FolderIcon size={13} className="shrink-0 text-amber-500/70" />
            {renaming?.id === folder.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={renameItem}
                onKeyDown={e => { if (e.key === 'Enter') renameItem(); if (e.key === 'Escape') setRenaming(null); }}
                className="flex-1 bg-transparent text-xs text-slate-200 outline-none"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="flex-1 truncate text-left">{folder.name}</span>
            )}
            <button
              onClick={e => { e.stopPropagation(); setMenuTarget({ type: 'folder', id: folder.id, spaceId: folder.space_id, parentId: folder.parent_id }); }}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-300"
            >
              <MoreHorizontal size={13} />
            </button>
          </button>
          {isExpanded && (
            <div className="ml-3 border-l border-white/[0.06] pl-1.5">
              {renderFolders(subFolders, depth + 1)}
              {renderPages(subPages)}
            </div>
          )}
        </div>
      );
    });
  }

  if (collapsed) {
    return (
      <div className="flex w-[48px] shrink-0 flex-col items-center border-r border-white/[0.06] bg-sidebar py-3 gap-2">
        <button onClick={() => setCollapsed(false)} className="rounded p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300" title="Expandir">
          <PanelLeft size={16} />
        </button>
        {spaces.map(space => (
          <button key={space.id} onClick={() => { setCollapsed(false); toggleSpace(space.id); }}
            className="rounded p-1.5 text-lg hover:bg-white/[0.04]" title={space.name}>
            {space.icon}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex w-[260px] shrink-0 flex-col border-r border-white/[0.06] bg-sidebar">
      <ContextMenu />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
        <span className="text-[13px] font-semibold text-white flex items-center gap-1.5">
          <BookOpen size={15} className="text-blue-400" />
          Documentos
        </span>
        <button onClick={() => setCollapsed(true)} className="rounded p-1 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300" title="Recolher">
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {spaces.map(space => {
          const isExpanded = expandedSpaces.has(space.id);
          const rootFolders = foldersByParent[`space:${space.id}`] || [];
          const rootPages = pagesByParent[`space:${space.id}`] || [];

          return (
            <div key={space.id}>
              <button
                onClick={() => toggleSpace(space.id)}
                onContextMenu={e => { e.preventDefault(); setMenuTarget({ type: 'space', id: space.id, spaceId: space.id }); }}
                className="group flex w-full items-center gap-1.5 rounded-md px-2 py-[6px] text-[12px] font-medium text-slate-300 transition hover:bg-white/[0.04]"
              >
                {isExpanded ? <ChevronDown size={12} className="shrink-0 text-slate-500" /> : <ChevronRight size={12} className="shrink-0 text-slate-500" />}
                <span className="shrink-0 text-sm">{space.icon}</span>
                {renaming?.id === space.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={renameItem}
                    onKeyDown={e => { if (e.key === 'Enter') renameItem(); if (e.key === 'Escape') setRenaming(null); }}
                    className="flex-1 bg-transparent text-xs text-slate-200 outline-none"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate text-left">{space.name}</span>
                )}
                <div className="shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100">
                  <button onClick={e => { e.stopPropagation(); createPage(space.id); }} className="rounded p-0.5 text-slate-600 hover:text-slate-300" title="Nova pagina">
                    <FilePlus size={12} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); createFolder(space.id); }} className="rounded p-0.5 text-slate-600 hover:text-slate-300" title="Nova pasta">
                    <FolderPlus size={12} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setMenuTarget({ type: 'space', id: space.id, spaceId: space.id }); }}
                    className="rounded p-0.5 text-slate-600 hover:text-slate-300">
                    <MoreHorizontal size={12} />
                  </button>
                </div>
              </button>
              {isExpanded && (
                <div className="ml-3 border-l border-white/[0.06] pl-1.5 space-y-0.5">
                  {renderFolders(rootFolders, 0)}
                  {renderPages(rootPages)}
                  {rootFolders.length === 0 && rootPages.length === 0 && (
                    <div className="px-2 py-3 text-center text-[11px] text-slate-600">
                      Vazio. Crie uma pasta ou pagina.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New space */}
      <div className="border-t border-white/[0.06] px-2 py-2">
        {newSpaceMode ? (
          <div className="flex gap-1">
            <input
              autoFocus
              value={newSpaceName}
              onChange={e => setNewSpaceName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createSpace(); if (e.key === 'Escape') setNewSpaceMode(false); }}
              placeholder="Nome do espaço"
              className="flex-1 rounded bg-surface px-2 py-1 text-xs text-slate-200 outline-none border border-border/40 focus:border-accent/50"
            />
            <button onClick={createSpace} className="rounded bg-accent/20 px-2 py-1 text-[10px] font-medium text-accent hover:bg-accent/30">
              Criar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setNewSpaceMode(true)}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-[6px] text-[12px] text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300"
          >
            <Plus size={13} />
            Novo espaço
          </button>
        )}
      </div>
    </div>
  );
}
