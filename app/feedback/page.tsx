import FeedbackForm from './FeedbackForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Enviar feedback — Bah!Flow',
  description: 'Compartilhe sua sugestão, pedido ou problema com nossa equipe.',
};

export default function FeedbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-[22px] font-bold text-primary">Conte pra gente</h1>
          <p className="mt-2 text-[13px] text-secondary-muted">
            Sugestão, pedido ou problema — tudo é bem-vindo. Seu feedback ajuda a priorizar o que
            construímos a seguir.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--modal-bg)] p-6 shadow-2xl shadow-black/30">
          <FeedbackForm />
        </div>

        <p className="mt-6 text-center text-[10px] uppercase tracking-wider text-tertiary-muted">
          Powered by Bah!Flow
        </p>
      </div>
    </div>
  );
}
