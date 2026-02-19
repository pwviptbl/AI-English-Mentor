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
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const card = cards[0];

  return (
    <section className="rounded-2xl border border-emerald-900/20 bg-panel p-4">
      <h2 className="text-lg font-semibold">Daily SRS Review</h2>

      {stats ? (
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-white p-2">
            <p className="text-xs text-ink/60">Total</p>
            <p className="font-semibold">{stats.total_cards}</p>
          </div>
          <div className="rounded-lg bg-white p-2">
            <p className="text-xs text-ink/60">Due now</p>
            <p className="font-semibold">{stats.due_now}</p>
          </div>
          <div className="rounded-lg bg-white p-2">
            <p className="text-xs text-ink/60">Today</p>
            <p className="font-semibold">{stats.reviews_today}</p>
          </div>
        </div>
      ) : null}

      {loading ? <p className="mt-3 text-sm">Loading review deck...</p> : null}

      {!loading && card ? (
        <div className="mt-4 rounded-xl border border-ember/20 bg-amber-50 p-3">
          <p className="text-xl font-semibold">{card.word}</p>
          <p className="text-sm text-ink/70">{card.translation || "No translation"}</p>
          <p className="mt-2 text-sm">{card.definition || "No definition"}</p>
          <p className="mt-2 text-xs text-ink/60">Context: {card.context_sentence || "-"}</p>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button className="rounded-lg bg-red-500 px-2 py-2 text-xs font-medium text-white" onClick={() => review("again")} disabled={busy}>Again</button>
            <button className="rounded-lg bg-orange-500 px-2 py-2 text-xs font-medium text-white" onClick={() => review("hard")} disabled={busy}>Hard</button>
            <button className="rounded-lg bg-emerald-600 px-2 py-2 text-xs font-medium text-white" onClick={() => review("good")} disabled={busy}>Good</button>
            <button className="rounded-lg bg-blue-600 px-2 py-2 text-xs font-medium text-white" onClick={() => review("easy")} disabled={busy}>Easy</button>
          </div>
        </div>
      ) : null}

      {!loading && !card ? <p className="mt-3 text-sm text-ink/70">No cards due right now.</p> : null}
    </section>
  );
}
