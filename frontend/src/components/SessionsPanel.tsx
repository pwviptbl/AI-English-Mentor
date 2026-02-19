"use client";

import { FormEvent, useState } from "react";

import { createSession } from "@/lib/api";
import type { Session } from "@/lib/types";

type Props = {
  token: string;
  sessions: Session[];
  activeSessionId: string | null;
  onSessionsChanged: () => Promise<void>;
  onSelectSession: (sessionId: string) => Promise<void>;
};

export function SessionsPanel({ token, sessions, activeSessionId, onSessionsChanged, onSelectSession }: Props) {
  const [topic, setTopic] = useState("");
  const [persona, setPersona] = useState("");
  const [loading, setLoading] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    try {
      const session = await createSession(token, topic.trim(), persona.trim() || undefined);
      setTopic("");
      setPersona("");
      await onSessionsChanged();
      await onSelectSession(session.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-900/20 bg-panel p-4">
      <h2 className="text-lg font-semibold">Sessions</h2>

      <form onSubmit={create} className="mt-3 space-y-2">
        <input
          className="w-full rounded-lg border border-emerald-900/20 bg-white px-3 py-2 text-sm"
          placeholder="Topic (e.g. Job Interview)"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          required
        />
        <textarea
          className="w-full rounded-lg border border-emerald-900/20 bg-white px-3 py-2 text-sm"
          placeholder="Persona prompt (optional)"
          value={persona}
          onChange={(event) => setPersona(event.target.value)}
          rows={2}
        />
        <button
          className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Session"}
        </button>
      </form>

      <ul className="mt-4 space-y-2">
        {sessions.map((session) => (
          <li key={session.id}>
            <button
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                activeSessionId === session.id
                  ? "border-accent bg-emerald-50"
                  : "border-emerald-900/10 bg-white hover:border-emerald-900/30"
              }`}
              type="button"
              onClick={() => onSelectSession(session.id)}
            >
              <p className="font-medium">{session.topic}</p>
              <p className="text-xs text-ink/60">{new Date(session.created_at).toLocaleString()}</p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
