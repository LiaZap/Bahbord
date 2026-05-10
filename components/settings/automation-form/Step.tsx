'use client';

import type { ReactNode } from 'react';

/**
 * Shell visual de um passo (Quando / Se / Faça) do AutomationFormModal.
 * Mantemos isolado pra os 3 sub-componentes herdarem o mesmo layout.
 */
export default function Step({
  number,
  icon,
  title,
  subtitle,
  children,
}: {
  number: number;
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
      <header className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
          {number}
        </span>
        <span className="text-accent">{icon}</span>
        <h4 className="text-sm font-semibold text-primary">{title}</h4>
      </header>
      <p className="mb-3 text-[12px] text-tertiary-muted">{subtitle}</p>
      {children}
    </section>
  );
}
