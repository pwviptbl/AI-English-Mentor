"use client";

import { useMemo, useState } from "react";

import { generateReadingActivity } from "@/lib/api";
import type { ReadingActivity } from "@/lib/types";

const THEME_OPTIONS = [
  "Technology",
  "Travel",
  "Work",
  "Health",
  "Environment",
  "Education",
  "Culture",
  "Sports",
];

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

type Props = {
  token: string;
};

export function ReadingPracticePanel({ token }: Props) {
  const [selectedTheme, setSelectedTheme] = useState<string>(THEME_OPTIONS[0]);
  const [customTheme, setCustomTheme] = useState("");
  const [cefrLevel, setCefrLevel] = useState<string>("B1");
  const [activity, setActivity] = useState<ReadingActivity | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalTheme = useMemo(() => {
    return customTheme.trim() || selectedTheme;
  }, [customTheme, selectedTheme]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSubmitted(false);
    setAnswers({});

    try {
      const result = await generateReadingActivity(token, {
        theme: finalTheme,
        cefr_level: cefrLevel,
      });
      setActivity(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar atividade de interpretação.");
    } finally {
      setLoading(false);
    }
  }

  const score = activity
    ? activity.questions.reduce((total, question, index) => {
        return total + (answers[index] === question.correct_option ? 1 : 0);
      }, 0)
    : 0;

  return (
    <section className="rounded-3xl border border-sky-900/20 bg-panel p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">Interpretação de texto</h2>
          <p className="text-sm text-ink/65">
            Gere um texto novo com IA, escolha o tema e responda questões de interpretação logo em seguida.
          </p>
        </div>
        {activity ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700">
            IA: {activity.provider_used} · Modelo: {activity.model_used}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-2xl border border-sky-900/10 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Temas sugeridos</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {THEME_OPTIONS.map((theme) => {
                const active = !customTheme.trim() && selectedTheme === theme;
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => setSelectedTheme(theme)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${active ? "border-sky-700 bg-sky-700 text-white" : "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-400"}`}
                  >
                    {theme}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-ink">Ou escreva um tema específico</span>
            <input
              value={customTheme}
              onChange={(event) => setCustomTheme(event.target.value)}
              placeholder="Ex: cybersecurity in small businesses"
              className="mt-2 w-full rounded-xl border border-emerald-900/20 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
          </label>

          <div>
            <p className="text-sm font-semibold text-ink">Nível do texto</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CEFR_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setCefrLevel(level)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${cefrLevel === level ? "border-amber-500 bg-amber-500 text-white" : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400"}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-ink px-4 py-4 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Tema atual</p>
            <p className="mt-2 text-lg font-semibold">{finalTheme}</p>
            <p className="mt-1 text-sm text-white/70">A IA vai criar um texto original e 4 perguntas de interpretação.</p>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !finalTheme.trim()}
            className="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Gerando atividade..." : "Gerar texto e questões"}
          </button>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="rounded-2xl border border-emerald-900/10 bg-white p-4">
          {!activity ? (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-sky-200 bg-sky-50/60 p-6 text-center text-sm text-ink/60">
              Escolha um tema e gere a atividade. O texto vai aparecer aqui junto com as perguntas.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-ink/40">Leitura</p>
                <h3 className="mt-1 text-2xl font-semibold text-ink">{activity.title}</h3>
                <p className="mt-1 text-sm text-ink/55">Tema: {activity.theme}</p>
              </div>

              <article className="rounded-2xl bg-stone-50 p-4 text-sm leading-7 text-ink whitespace-pre-line">
                {activity.passage}
              </article>

              <div className="space-y-4">
                {activity.questions.map((question, index) => {
                  const selected = answers[index];
                  const isCorrect = selected === question.correct_option;
                  return (
                    <div key={`${question.question}-${index}`} className="rounded-2xl border border-emerald-900/10 p-4">
                      <p className="text-sm font-semibold text-ink">
                        {index + 1}. {question.question}
                      </p>

                      <div className="mt-3 space-y-2">
                        {question.options.map((option) => {
                          const active = selected === option;
                          const showCorrect = submitted && option === question.correct_option;
                          const showWrong = submitted && active && option !== question.correct_option;

                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                if (submitted) return;
                                setAnswers((current) => ({ ...current, [index]: option }));
                              }}
                              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${active ? "border-sky-600 bg-sky-50 text-sky-800" : "border-emerald-900/10 bg-white text-ink hover:border-sky-300"} ${showCorrect ? "border-emerald-500 bg-emerald-50 text-emerald-800" : ""} ${showWrong ? "border-red-400 bg-red-50 text-red-700" : ""}`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>

                      {submitted ? (
                        <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${isCorrect ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                          <p className="font-semibold">
                            {isCorrect ? "Resposta correta" : `Resposta correta: ${question.correct_option}`}
                          </p>
                          <p className="mt-1">{question.explanation_pt}</p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSubmitted(true)}
                  disabled={submitted || Object.keys(answers).length !== activity.questions.length}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Corrigir respostas
                </button>
                {submitted ? (
                  <p className="text-sm font-semibold text-ink">
                    Resultado: {score}/{activity.questions.length}
                  </p>
                ) : (
                  <p className="text-sm text-ink/60">Responda todas as perguntas para corrigir.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
