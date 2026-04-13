'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const shortcuts = [
  { key: 'g d', label: 'Dashboard', route: '/' },
  { key: 'g b', label: 'Board', route: '/board' },
  { key: 'g l', label: 'Lista', route: '/list' },
  { key: 'g k', label: 'Backlog', route: '/backlog' },
  { key: 'g s', label: 'Sprints', route: '/sprints' },
  { key: 'g t', label: 'Cronograma', route: '/timeline' },
  { key: 'g h', label: 'Timesheet', route: '/timesheet' },
  { key: 'g ,', label: 'Configurações', route: '/settings' },
  { key: '?', label: 'Mostrar atalhos', route: null },
  { key: 'Ctrl+K', label: 'Busca global', route: null },
];

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);
  const [pendingG, setPendingG] = useState(false);

  useEffect(() => {
    let gTimeout: ReturnType<typeof setTimeout> | null = null;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      if (isInput) return;

      // ? para mostrar atalhos
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }

      // Escape fecha help
      if (e.key === 'Escape') {
        setShowHelp(false);
        return;
      }

      // g + tecla para navegar
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        setPendingG(true);
        if (gTimeout) clearTimeout(gTimeout);
        gTimeout = setTimeout(() => setPendingG(false), 1000);
        return;
      }

      if (pendingG) {
        setPendingG(false);
        if (gTimeout) clearTimeout(gTimeout);

        const routeMap: Record<string, string> = {
          d: '/',
          b: '/board',
          l: '/list',
          k: '/backlog',
          s: '/sprints',
          t: '/timeline',
          h: '/timesheet',
          ',': '/settings',
        };

        if (routeMap[e.key]) {
          e.preventDefault();
          router.push(routeMap[e.key] as any);
        }
      }

      // c para criar ticket (dispara o botão Novo se existir)
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
        const createBtn = document.querySelector<HTMLButtonElement>('button[class*="bg-accent"]');
        if (createBtn?.textContent?.includes('Novo')) {
          e.preventDefault();
          createBtn.click();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gTimeout) clearTimeout(gTimeout);
    };
  }, [pendingG, router]);

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border/60 bg-surface2 p-6 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-white">Atalhos de teclado</h2>

        <div className="space-y-1">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Navegação</div>
          {shortcuts.filter((s) => s.key.startsWith('g')).map((s) => (
            <div key={s.key} className="flex items-center justify-between py-1">
              <span className="text-xs text-slate-300">{s.label}</span>
              <div className="flex gap-1">
                {s.key.split(' ').map((k, i) => (
                  <kbd key={i} className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-slate-400">{k}</kbd>
                ))}
              </div>
            </div>
          ))}

          <div className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ações</div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-slate-300">Busca global</span>
            <div className="flex gap-1">
              <kbd className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-slate-400">Ctrl</kbd>
              <kbd className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-slate-400">K</kbd>
            </div>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-slate-300">Criar ticket</span>
            <kbd className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-slate-400">c</kbd>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-slate-300">Comentar (no ticket)</span>
            <kbd className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-slate-400">m</kbd>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-slate-300">Mostrar atalhos</span>
            <kbd className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-slate-400">?</kbd>
          </div>
        </div>

        <p className="mt-4 text-[10px] text-slate-600">
          Pressione <kbd className="rounded bg-surface px-1 py-0.5 text-[9px]">Esc</kbd> para fechar
        </p>
      </div>
    </div>
  );
}
