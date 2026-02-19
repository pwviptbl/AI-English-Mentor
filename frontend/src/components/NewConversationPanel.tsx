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
  cefr_level: string;
};

const SUGGESTED_SCENARIOS: SuggestedScenario[] = [
  {
    topic: "Job Interview",
    subtitle: "Confident interview answers",
    cefr_level: "B2",
    persona_prompt:
      "You are a professional interviewer. Ask clear behavioral and technical questions and give short feedback.",
  },
  {
    topic: "Travel Support",
    subtitle: "Airport, hotel, and city situations",
    cefr_level: "A2",
    persona_prompt:
      "You are a friendly travel assistant helping the learner handle airport, hotel check-in, and directions.",
  },
  {
    topic: "Tech Daily",
    subtitle: "Daily standup and engineering conversations",
    cefr_level: "B2",
    persona_prompt:
      "You are a senior engineer. Simulate daily standups, blockers discussion, and technical planning.",
  },
  {
    topic: "Coffee Shop Chat",
    subtitle: "Small talk and ordering drinks",
    cefr_level: "A1",
    persona_prompt:
      "You are a friendly barista in a coffee shop. Keep the conversation simple and welcoming.",
  },
  {
    topic: "Doctor Visit",
    subtitle: "Describe symptoms and understand advice",
    cefr_level: "B1",
    persona_prompt:
      "You are a kind doctor. Help the learner describe symptoms and understand basic medical advice.",
  },
  {
    topic: "Academic Discussion",
    subtitle: "University seminars and debates",
    cefr_level: "C1",
    persona_prompt:
      "You are a university professor leading a seminar. Engage with advanced academic vocabulary and nuanced ideas.",
  },
  {
    topic: "Supermarket Run",
    subtitle: "Basic shopping and asking for help",
    cefr_level: "A1",
    persona_prompt:
      "You are a helpful supermarket employee. Use very simple English to assist the learner.",
  },
  {
    topic: "Negotiating a Raise",
    subtitle: "Professional assertiveness and negotiation",
    cefr_level: "C1",
    persona_prompt:
      "You are a manager. The learner is trying to negotiate a salary raise. Be professional but somewhat resistant.",
  },
  {
    topic: "Making New Friends",
    subtitle: "Introductions and casual topics",
    cefr_level: "A2",
    persona_prompt:
      "You are a friendly local meeting a newcomer. Use simple, encouraging English and ask about hobbies and hometown.",
  },
  {
    topic: "Emergency Call",
    subtitle: "Report an emergency to services",
    cefr_level: "B1",
    persona_prompt:
      "You are an emergency dispatcher. Help the learner calmly report an emergency situation.",
  },
  {
    topic: "Business Email Review",
    subtitle: "Proofread and improve professional emails",
    cefr_level: "B2",
    persona_prompt:
      "You are a business writing coach. Help the learner refine professional emails for clarity and tone.",
  },
  {
    topic: "Philosophy Debate",
    subtitle: "Abstract and complex argumentation",
    cefr_level: "C2",
    persona_prompt:
      "You are a philosopher. Engage in deep, nuanced debate on topics like ethics, consciousness, and free will.",
  },
];

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const CEFR_COLORS: Record<string, string> = {
  A1: "#4CAF50",
  A2: "#8BC34A",
  B1: "#FFC107",
  B2: "#FF9800",
  C1: "#F44336",
  C2: "#9C27B0",
};

export function NewConversationPanel({ token, onSessionCreated }: Props) {
  const [topic, setTopic] = useState("");
  const [persona, setPersona] = useState("");
  const [cefrFilter, setCefrFilter] = useState<string | null>(null);
  const [customCefr, setCustomCefr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredScenarios = cefrFilter
    ? SUGGESTED_SCENARIOS.filter((s) => s.cefr_level === cefrFilter)
    : SUGGESTED_SCENARIOS;

  async function createSuggestedScenario(scenario: SuggestedScenario) {
    setError(null);
    setLoading(true);
    try {
      const session = await createSession(token, scenario.topic, scenario.persona_prompt, scenario.cefr_level);
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
      const session = await createSession(token, topic.trim(), persona.trim() || undefined, customCefr);
      setTopic("");
      setPersona("");
      setCustomCefr(null);
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

      {/* Filtro CEFR */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink/50">Nível:</span>
        <button
          type="button"
          onClick={() => setCefrFilter(null)}
          className={`rounded-full px-3 py-0.5 text-xs font-semibold border transition ${cefrFilter === null ? "bg-accent text-white border-accent" : "bg-white border-gray-300 text-ink/60 hover:border-accent"}`}
        >
          Todos
        </button>
        {CEFR_LEVELS.map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => setCefrFilter(cefrFilter === lvl ? null : lvl)}
            className={`rounded-full px-3 py-0.5 text-xs font-bold border transition`}
            style={{
              backgroundColor: cefrFilter === lvl ? CEFR_COLORS[lvl] : "white",
              borderColor: CEFR_COLORS[lvl],
              color: cefrFilter === lvl ? "white" : CEFR_COLORS[lvl],
            }}
          >
            {lvl}
          </button>
        ))}
      </div>

      {/* Grid de cenários */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {filteredScenarios.map((scenario) => (
          <button
            key={scenario.topic}
            className="rounded-2xl border border-amber-800/20 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-ember disabled:opacity-60"
            type="button"
            onClick={() => createSuggestedScenario(scenario)}
            disabled={loading}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-bold text-ink">{scenario.topic}</p>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  backgroundColor: CEFR_COLORS[scenario.cefr_level] + "22",
                  color: CEFR_COLORS[scenario.cefr_level],
                  border: `1px solid ${CEFR_COLORS[scenario.cefr_level]}44`,
                }}
              >
                {scenario.cefr_level}
              </span>
            </div>
            <p className="mt-0.5 text-sm font-medium text-ink/80">{scenario.subtitle}</p>
          </button>
        ))}
      </div>

      {/* Cenário personalizado */}
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
        {/* Seletor CEFR para cenário personalizado */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink/50">Nível CEFR:</span>
          {CEFR_LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setCustomCefr(customCefr === lvl ? null : lvl)}
              className="rounded-full px-2 py-0.5 text-xs font-bold border transition"
              style={{
                backgroundColor: customCefr === lvl ? CEFR_COLORS[lvl] : "white",
                borderColor: CEFR_COLORS[lvl],
                color: customCefr === lvl ? "white" : CEFR_COLORS[lvl],
              }}
            >
              {lvl}
            </button>
          ))}
        </div>
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
