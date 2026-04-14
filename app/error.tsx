'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('BahBoard error:', error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#1a1c1e] text-[#c5c8c6]">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
            <AlertTriangle size={28} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">Algo deu errado</h1>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          Ocorreu um erro inesperado. Tente recarregar a página ou voltar ao dashboard.
        </p>
        {error.message && (
          <p className="mt-3 rounded-lg border border-border/40 bg-surface2 px-4 py-2 text-xs font-mono text-slate-500">
            {error.message}
          </p>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            <RefreshCw size={16} />
            Tentar novamente
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg border border-border/40 bg-surface2 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-input/40"
          >
            <Home size={16} />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
