'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { submitFeedback } from './actions';

export default function FeedbackForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    customer_email: '',
    customer_name: '',
    request_text: '',
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const sourceUrl = typeof window !== 'undefined' ? window.location.href : undefined;

    startTransition(async () => {
      const result = await submitFeedback({
        customer_email: form.customer_email,
        customer_name: form.customer_name || undefined,
        request_text: form.request_text,
        source_url: sourceUrl,
      });

      if (!result.ok) {
        setError(result.error || 'Erro ao enviar. Tente novamente.');
        return;
      }
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
          <CheckCircle2 size={28} strokeWidth={2} />
        </div>
        <h2 className="text-[16px] font-semibold text-primary">Obrigado pelo feedback!</h2>
        <p className="max-w-xs text-[13px] text-secondary-muted">
          Recebemos sua mensagem. Nossa equipe vai analisar e, se fizer sentido, transformar em
          melhoria do produto.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setForm({ customer_email: '', customer_name: '', request_text: '' });
          }}
          className="mt-2 text-[12px] text-blue-400 hover:underline"
        >
          Enviar outro feedback
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-[12px] font-medium text-secondary-muted">
          E-mail <span className="text-red-400">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={form.customer_email}
          onChange={(e) => setForm((s) => ({ ...s, customer_email: e.target.value }))}
          placeholder="voce@exemplo.com"
          className="w-full rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary outline-none placeholder:text-tertiary-muted focus:border-blue-500/40"
        />
      </div>

      <div>
        <label htmlFor="name" className="mb-1 block text-[12px] font-medium text-secondary-muted">
          Nome <span className="text-tertiary-muted">(opcional)</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          value={form.customer_name}
          onChange={(e) => setForm((s) => ({ ...s, customer_name: e.target.value }))}
          placeholder="Como podemos te chamar"
          className="w-full rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary outline-none placeholder:text-tertiary-muted focus:border-blue-500/40"
        />
      </div>

      <div>
        <label
          htmlFor="message"
          className="mb-1 block text-[12px] font-medium text-secondary-muted"
        >
          Sua mensagem <span className="text-red-400">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          maxLength={5000}
          value={form.request_text}
          onChange={(e) => setForm((s) => ({ ...s, request_text: e.target.value }))}
          placeholder="Conte o que precisa, o que está pegando ou o que poderia ser melhor..."
          className="w-full resize-none rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-[13px] text-primary outline-none placeholder:text-tertiary-muted focus:border-blue-500/40"
        />
        <div className="mt-1 text-right text-[10px] text-tertiary-muted tabular-nums">
          {form.request_text.length}/5000
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !form.customer_email || !form.request_text.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send size={13} />
            Enviar feedback
          </>
        )}
      </button>
    </form>
  );
}
