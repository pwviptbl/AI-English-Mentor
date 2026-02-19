"use client";

import type { Session } from "@/lib/types";

type Props = {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => Promise<void>;
  onGoToActiveConversation: () => void;
  onOpenNewConversation: () => void;
};

export function ConversationsPanel({
  sessions,
  activeSessionId,
  onSelectSession,
  onGoToActiveConversation,
  onOpenNewConversation,
}: Props) {
  return (
    <section className="rounded-3xl border border-emerald-900/20 bg-panel p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Suas conversas</h2>
          <p className="text-sm text-ink/65">Escolha uma sessão para retomar o treino.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeSessionId ? (
            <button
              className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white"
              type="button"
              onClick={onGoToActiveConversation}
            >
              Voltar para conversa ativa
            </button>
          ) : null}
          <button
            className="rounded-xl bg-ember px-3 py-2 text-sm font-medium text-white"
            type="button"
            onClick={onOpenNewConversation}
          >
            Nova conversa
          </button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-emerald-900/25 bg-white p-6 text-center">
          <p className="text-sm text-ink/70">Nenhuma sessão criada ainda.</p>
          <button
            className="mt-3 rounded-xl bg-ember px-4 py-2 text-sm font-medium text-white"
            type="button"
            onClick={onOpenNewConversation}
          >
            Criar primeira conversa
          </button>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  session.id === activeSessionId
                    ? "border-accent bg-emerald-50"
                    : "border-emerald-900/10 bg-white hover:border-emerald-900/30"
                }`}
                type="button"
                onClick={() => onSelectSession(session.id)}
              >
                <p className="text-base font-semibold">{session.topic}</p>
                <p className="mt-1 line-clamp-2 text-xs text-ink/65">
                  {session.persona_prompt || "Sem persona customizada"}
                </p>
                <p className="mt-3 text-xs text-ink/50">
                  Criada em {new Date(session.created_at).toLocaleString()}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
