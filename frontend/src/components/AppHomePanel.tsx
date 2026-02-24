"use client";

import type { User } from "@/lib/types";

type Props = {
  currentUser: User;
  onOpenConversations: () => void;
  onOpenNewConversation: () => void;
  onOpenReview: () => void;
  onOpenProfile: () => void;
  onOpenAdmin: () => void;
  hasActiveConversation: boolean;
};

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "bg-gray-100 text-gray-600 border-gray-300" },
  pro:  { label: "Pro ✨", color: "bg-amber-100 text-amber-700 border-amber-400" },
};

export function AppHomePanel({
  currentUser,
  onOpenConversations,
  onOpenNewConversation,
  onOpenReview,
  onOpenProfile,
  onOpenAdmin,
  hasActiveConversation,
}: Props) {
  const tier = TIER_BADGE[currentUser.tier] ?? TIER_BADGE.free;

  return (
    <section className="rounded-3xl border border-emerald-900/20 bg-panel p-6 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Olá, {currentUser.full_name.split(" ")[0]}!</h2>
          <p className="text-sm text-ink/65">
            Escolha o que deseja fazer agora: continuar conversas, iniciar um novo cenário ou revisar seu deck.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${tier.color}`}>
            {tier.label}
          </span>
          {currentUser.is_admin && (
            <span className="rounded-full border border-violet-400 bg-violet-100 px-3 py-0.5 text-xs font-semibold text-violet-700">
              Admin 🛡️
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
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

        <button
          className="rounded-2xl border border-violet-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-400"
          onClick={onOpenProfile}
          type="button"
        >
          <p className="text-lg font-bold text-ink">👤 Meu Perfil</p>
          <p className="mt-1 text-sm font-medium text-ink/80">Altere nome, senha e veja seu plano.</p>
        </button>

        {currentUser.is_admin && (
          <button
            className="rounded-2xl border border-violet-300 bg-violet-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-500"
            onClick={onOpenAdmin}
            type="button"
          >
            <p className="text-lg font-bold text-violet-700">🛡️ Painel Admin</p>
            <p className="mt-1 text-sm font-medium text-violet-600/80">
              Gerencie usuários e limites de uso por plano.
            </p>
          </button>
        )}
      </div>
    </section>
  );
}
