'use client';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Root error:', error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-surface p-6 text-center">
      <div className="rounded-full bg-red-500/10 p-4 mb-5">
        <AlertTriangle size={40} className="text-red-400" />
      </div>
      <h2 className="text-2xl font-bold text-primary">Algo deu errado</h2>
      <p className="mt-2 max-w-md text-sm text-secondary">
        Ocorreu um erro inesperado. Tente recarregar a página ou voltar ao dashboard.
      </p>
      {error.digest && (
        <code className="mt-4 rounded bg-surface2 px-3 py-1.5 text-[11px] text-slate-500">
          ID: {error.digest}
        </code>
      )}
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn-premium btn-primary">
          <RefreshCw size={14} /> Tentar novamente
        </button>
        <Link href="/" className="btn-premium btn-secondary">
          <Home size={14} /> Dashboard
        </Link>
      </div>
    </div>
  );
}
