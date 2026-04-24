'use client';

import { useState, useEffect } from 'react';
import { Clock, LogOut } from 'lucide-react';
import { useClerk } from '@clerk/nextjs';

export default function ApprovalGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'approved' | 'pending'>('loading');
  const { signOut } = useClerk();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) {
          setStatus('pending');
        } else if (data.member?.is_approved === false) {
          setStatus('pending');
        } else {
          setStatus('approved');
        }
      })
      .catch(() => setStatus('approved'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-surface text-center p-6">
        <img src="/logo-bahtech.svg" alt="BahTech" className="h-8 mb-8 object-contain dark:invert-0 invert" />
        <div className="rounded-full bg-amber-500/10 p-5 mb-5">
          <Clock size={40} className="text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-primary">Aguardando aprovação</h2>
        <p className="mt-3 max-w-md text-sm text-secondary leading-relaxed">
          Seu acesso está sendo analisado pelo administrador da organização.
          Você será notificado quando for aprovado.
        </p>
        <button
          onClick={() => signOut({ redirectUrl: '/sign-in' })}
          className="btn-premium btn-secondary mt-8"
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
