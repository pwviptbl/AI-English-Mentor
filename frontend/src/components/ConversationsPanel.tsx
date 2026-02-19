"use client";

import { useState } from "react";
import type { Session } from "@/lib/types";

type Props = {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onGoToActiveConversation: () => void;
  onOpenNewConversation: () => void;
};

export function ConversationsPanel({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onGoToActiveConversation,
  onOpenNewConversation,
}: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleDelete(sessionId: string) {
    setDeletingId(sessionId);
    try {
      await onDeleteSession(sessionId);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

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
            <li key={session.id} className="relative">
              <button
                className={`w-full rounded-2xl border p-4 text-left transition ${session.id === activeSessionId
                    ? "border-accent bg-emerald-50"
                    : "border-emerald-900/10 bg-white hover:border-emerald-900/30"
                  }`}
                type="button"
                onClick={() => onSelectSession(session.id)}
              >
                <p className="pr-8 text-base font-semibold">{session.topic}</p>
                <p className="mt-1 line-clamp-2 text-xs text-ink/65">
                  {session.persona_prompt || "Sem persona customizada"}
                </p>
                <p className="mt-3 text-xs text-ink/50">
                  Criada em {new Date(session.created_at).toLocaleString()}
                </p>
              </button>

              {/* Botão de excluir no canto superior direito */}
              {confirmId === session.id ? (
                <div className="absolute right-2 top-2 flex items-center gap-1 rounded-xl bg-red-50 border border-red-200 px-2 py-1">
                  <span className="text-xs text-red-700">Excluir?</span>
                  <button
                    className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    type="button"
                    disabled={deletingId === session.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(session.id);
                    }}
                  >
                    {deletingId === session.id ? "..." : "Sim"}
                  </button>
                  <button
                    className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmId(null);
                    }}
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  className="absolute right-2 top-2 rounded-lg p-1.5 text-ink/30 hover:bg-red-50 hover:text-red-500 transition"
                  type="button"
                  title="Excluir conversa"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmId(session.id);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
