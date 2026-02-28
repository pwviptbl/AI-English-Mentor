"use client";

import { useEffect, useState } from "react";

import { dueFlashcards, reviewFlashcard, reviewStats } from "@/lib/api";
import type { Flashcard, ReviewStats } from "@/lib/types";

type Props = {
  token: string;
};

export function ReviewPanel({ token }: Props) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [due, summary] = await Promise.all([dueFlashcards(token), reviewStats(token)]);
      setCards(due);
      setStats(summary);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, [token]);

  async function review(rating: "again" | "hard" | "good" | "easy") {
    if (!cards[0]) return;
    setBusy(true);
    try {
      await reviewFlashcard(token, cards[0].id, rating);
      setShowAnswer(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const card = cards[0];

  return (
    <section className="rounded-2xl border border-emerald-900/20 bg-panel p-4">
      <h2 className="text-lg font-semibold">Revisão</h2>

      {stats ? (
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-white p-2">
            <p className="text-xs text-ink/60">Total</p>
            <p className="font-semibold">{stats.total_cards}</p>
          </div>
          <div className="rounded-lg bg-white p-2">
            <p className="text-xs text-ink/60">Pendentes</p>
            <p className="font-semibold">{stats.due_now}</p>
          </div>
          <div className="rounded-lg bg-white p-2">
            <p className="text-xs text-ink/60">Hoje</p>
            <p className="font-semibold">{stats.reviews_today}</p>
          </div>
        </div>
      ) : null}

      {loading ? <p className="mt-3 text-sm">Carregando cartões de revisão...</p> : null}

      {!loading && card ? (
        <div className="mt-4 rounded-xl border border-ember/20 bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <p className="text-xl font-semibold">{card.word}</p>
            <button
              title="Ouvir pronúncia"
              className="rounded-full p-1 text-indigo-600 transition-colors hover:bg-indigo-100 active:scale-90"
              onClick={() => {
                // Usa a Web Speech API nativa para pronunciar em inglês
                const utterance = new SpeechSynthesisUtterance(card.word);
                utterance.lang = "en-US";
                utterance.rate = 0.85;
                window.speechSynthesis.cancel(); // cancela fala anterior
                window.speechSynthesis.speak(utterance);
              }}
            >
              {/* Ícone de alto-falante (SVG inline) */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>
          </div>

          {!showAnswer ? (
            <button
              className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              onClick={() => setShowAnswer(true)}
            >
              Mostrar tradução
            </button>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink/70">{card.translation || "Sem tradução"}</p>
              <p className="mt-2 text-sm">{card.definition || "Sem definição"}</p>
              <p className="mt-2 text-xs text-ink/60">Contexto: {card.context_sentence || "-"}</p>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button className="rounded-lg bg-red-500 px-2 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90" onClick={() => review("again")} disabled={busy}>Novamente</button>
                <button className="rounded-lg bg-orange-500 px-2 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90" onClick={() => review("hard")} disabled={busy}>Difícil</button>
                <button className="rounded-lg bg-emerald-500 px-2 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90" onClick={() => review("good")} disabled={busy}>Bom</button>
                <button className="rounded-lg bg-blue-500 px-2 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90" onClick={() => review("easy")} disabled={busy}>Fácil</button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {!loading && !card ? <p className="mt-3 text-sm text-ink/70">Nenhum cartão para revisão no momento.</p> : null}
    </section>
  );
}
