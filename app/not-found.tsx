import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-surface text-primary">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <img src="/logo-bahtech.svg" alt="BahTech" className="h-10 object-contain dark:invert-0 invert" />
        </div>
        <h1 className="text-6xl font-bold text-white">404</h1>
        <p className="mt-2 text-lg text-slate-400">Página não encontrada</p>
        <p className="mt-1 text-sm text-slate-500">A página que você procura não existe ou foi movida.</p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            <Home size={16} />
            Dashboard
          </Link>
          <Link
            href="/board"
            className="flex items-center gap-2 rounded-lg border border-border/40 bg-surface2 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-input/40"
          >
            <ArrowLeft size={16} />
            Board
          </Link>
        </div>
      </div>
    </div>
  );
}
