'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';

interface PasswordPromptProps {
  slug: string;
  error?: boolean;
}

export default function PasswordPrompt({ slug, error }: PasswordPromptProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setSubmitting(true);
    const target = `/share/${slug}?auth=${encodeURIComponent(password.trim())}`;
    router.push(target as any);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="card-premium w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15">
            <Lock size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Link protegido</h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Informe a senha para acessar este painel.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="input-premium w-full"
          />

          {error && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
              Senha incorreta.
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !password.trim()}
            className="btn-premium btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Validando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[10px] uppercase tracking-wider text-slate-600">
          Powered by Bahboard
        </p>
      </div>
    </div>
  );
}
