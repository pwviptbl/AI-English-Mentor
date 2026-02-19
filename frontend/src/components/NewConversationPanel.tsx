"use client";

import { FormEvent, useState } from "react";

import { createSession } from "@/lib/api";

type Props = {
  token: string;
  onSessionCreated: (sessionId: string) => Promise<void>;
};

type SuggestedScenario = {
  topic: string;
  persona_prompt: string;
  subtitle: string;
};

const SUGGESTED_SCENARIOS: SuggestedScenario[] = [
  {
    topic: "Job Interview",
    subtitle: "Practice confident interview answers",
    persona_prompt:
      "You are a professional interviewer. Ask clear behavioral and technical questions and give short feedback.",
  },
  {
    topic: "Travel Support",
    subtitle: "Airport, hotel, and city situations",
    persona_prompt:
      "You are a friendly travel assistant helping the learner handle airport, hotel check-in, and directions.",
  },
  {
    topic: "Tech Daily",
    subtitle: "Daily standup and engineering conversations",
    persona_prompt:
      "You are a senior engineer. Simulate daily standups, blockers discussion, and technical planning in natural English.",
  },
];

export function NewConversationPanel({ token, onSessionCreated }: Props) {
  const [topic, setTopic] = useState("");
  const [persona, setPersona] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createSuggestedScenario(scenario: SuggestedScenario) {
    setError(null);
    setLoading(true);
    try {
      const session = await createSession(token, scenario.topic, scenario.persona_prompt);
      await onSessionCreated(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create suggested scenario");
    } finally {
      setLoading(false);
    }
  }

  async function createCustomScenario(event: FormEvent) {
    event.preventDefault();
    if (!topic.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const session = await createSession(token, topic.trim(), persona.trim() || undefined);
      setTopic("");
      setPersona("");
      await onSessionCreated(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create custom scenario");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-amber-800/20 bg-panel p-5">
      <div>
        <h2 className="text-xl font-semibold">Nova conversa</h2>
        <p className="text-sm text-ink/65">
          Escolha um cenário sugerido ou monte seu próprio tópico com persona personalizada.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {SUGGESTED_SCENARIOS.map((scenario) => (
          <button
            key={scenario.topic}
            className="rounded-2xl border border-amber-800/20 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-ember disabled:opacity-60"
            type="button"
            onClick={() => createSuggestedScenario(scenario)}
            disabled={loading}
          >
            <p className="text-base font-semibold">{scenario.topic}</p>
            <p className="mt-1 text-sm text-ink/60">{scenario.subtitle}</p>
          </button>
        ))}
      </div>

      <form onSubmit={createCustomScenario} className="mt-6 space-y-3 rounded-2xl border border-emerald-900/15 bg-white p-4">
        <p className="text-sm font-semibold">Criar cenário personalizado</p>
        <input
          className="w-full rounded-xl border border-emerald-900/20 bg-white px-3 py-2 text-sm outline-none focus:border-accent"
          placeholder="Tema da conversa (ex: Security Incident Call)"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          required
        />
        <textarea
          className="w-full rounded-xl border border-emerald-900/20 bg-white px-3 py-2 text-sm outline-none focus:border-accent"
          placeholder="Persona (opcional): quem o mentor deve interpretar"
          value={persona}
          onChange={(event) => setPersona(event.target.value)}
          rows={3}
        />
        <button
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? "Criando..." : "Criar e iniciar conversa"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
