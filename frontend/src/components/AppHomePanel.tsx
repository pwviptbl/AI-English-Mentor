"use client";

type Props = {
  onOpenConversations: () => void;
  onOpenNewConversation: () => void;
  onOpenReview: () => void;
  hasActiveConversation: boolean;
};

export function AppHomePanel({
  onOpenConversations,
  onOpenNewConversation,
  onOpenReview,
  hasActiveConversation,
}: Props) {
  return (
    <section className="rounded-3xl border border-emerald-900/20 bg-panel p-6 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-ink">Welcome back</h2>
        <p className="text-sm text-ink/65">
          Choose what you want to do now: continue conversations, start a new scenario, or review your deck.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button
          className="rounded-2xl border border-emerald-900/20 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-accent"
          onClick={onOpenConversations}
          type="button"
        >
          <p className="text-lg font-bold text-ink">Conversas</p>
          <p className="mt-1 text-sm font-medium text-ink/80">Veja suas sessões e retome qualquer conversa.</p>
          {hasActiveConversation ? (
            <p className="mt-3 inline-block rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
              Conversa ativa disponível
            </p>
          ) : null}
        </button>

        <button
          className="rounded-2xl border border-amber-800/20 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-ember"
          onClick={onOpenNewConversation}
          type="button"
        >
          <p className="text-lg font-bold text-ink">Nova Conversa</p>
          <p className="mt-1 text-sm font-medium text-ink/80">
            Escolha cenários sugeridos ou crie seu próprio tópico de treino.
          </p>
        </button>

        <button
          className="rounded-2xl border border-sky-800/20 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-sky-600"
          onClick={onOpenReview}
          type="button"
        >
          <p className="text-lg font-bold text-ink">Revisão</p>
          <p className="mt-1 text-sm font-medium text-ink/80">Revise palavras pendentes com o sistema SRS.</p>
        </button>
      </div>
    </section>
  );
}
