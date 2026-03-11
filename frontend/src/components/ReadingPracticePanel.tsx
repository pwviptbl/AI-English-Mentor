"use client";

import { useMemo, useState } from "react";

import { AnalysisModal } from "@/components/AnalysisModal";
import { addFlashcard, analyzeText, generateReadingActivity, lookupDictionaryWord, saveReadingAttempt } from "@/lib/api";
import type { AnalysisResponse, TokenInfo } from "@/lib/types";
import { useMentorStore } from "@/store/useMentorStore";

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
const QUESTION_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
] as const;

type Props = {
  token: string;
};

export function ReadingPracticePanel({ token }: Props) {
  const { readingPractice, setReadingPractice } = useMentorStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState(0.8);

  const selectedTheme = readingPractice.selectedTheme;
  const customTheme = readingPractice.customTheme;
  const cefrLevel = readingPractice.cefrLevel;
  const questionLanguage = readingPractice.questionLanguage;
  const activity = readingPractice.activity;
  const answers = readingPractice.answers;
  const currentQuestionIndex = readingPractice.currentQuestionIndex;
  const submitted = readingPractice.submitted;
  const resultRecorded = readingPractice.resultRecorded;

  const finalTheme = useMemo(() => customTheme.trim() || selectedTheme, [customTheme, selectedTheme]);
  const answeredCount = Object.keys(answers).length;
  const questionLanguageLabel = questionLanguage === "pt" ? "Português" : "English";
  const activityQuestionLanguageLabel = activity?.question_language === "pt" ? "Português" : "English";

  const score = activity
    ? activity.questions.reduce((total, question, index) => {
        return total + (answers[index] === question.correct_option ? 1 : 0);
      }, 0)
    : 0;

  const currentQuestion = activity?.questions[currentQuestionIndex] ?? null;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setAnalysisOpen(false);
    setAnalysisData(null);
    setAnalysisError(null);

    try {
      const result = await generateReadingActivity(token, {
        theme: finalTheme,
        cefr_level: cefrLevel,
        question_language: questionLanguage,
      });
      setReadingPractice({
        activity: result,
        answers: {},
        currentQuestionIndex: 0,
        submitted: false,
        resultRecorded: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar atividade de interpretação.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAnswers() {
    if (!activity || submitted || answeredCount !== activity.questions.length) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await saveReadingAttempt(token, {
        title: activity.title,
        theme: activity.theme,
        question_language: activity.question_language,
        total_questions: activity.questions.length,
        correct_answers: score,
      });
      setReadingPractice({ submitted: true, resultRecorded: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar resultado da atividade.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyzeText() {
    if (!activity?.passage || analysisLoading) return;

    setAnalysisOpen(true);
    setAnalysisLoading(true);
    setAnalysisData(null);
    setAnalysisError(null);

    try {
      const result = await analyzeText(token, activity.passage);
      setAnalysisData(result);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Falha ao analisar texto.");
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function handleAddToken(tokenItem: TokenInfo, text: string) {
    await addFlashcard(token, {
      word: tokenItem.token,
      lemma: tokenItem.lemma,
      pos: tokenItem.pos,
      translation: tokenItem.translation,
      definition: tokenItem.definition,
      context_sentence: text,
    });
  }

  async function handleLookup(word: string): Promise<TokenInfo> {
    return lookupDictionaryWord(token, word);
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = speechRate;
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  }

  return (
    <>
      <section className="rounded-3xl border border-sky-900/20 bg-panel p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold text-ink">Interpretação de texto</h2>
            <p className="text-sm text-ink/65">
              Gere um texto novo com IA, escolha o tema e responda questões de interpretação logo em seguida.
            </p>
          </div>
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
                      onClick={() => setReadingPractice({ selectedTheme: theme })}
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
                onChange={(event) => setReadingPractice({ customTheme: event.target.value })}
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
                    onClick={() => setReadingPractice({ cefrLevel: level })}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${cefrLevel === level ? "border-amber-500 bg-amber-500 text-white" : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400"}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink">Idioma das questões</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUESTION_LANGUAGES.map((language) => (
                  <button
                    key={language.value}
                    type="button"
                    onClick={() => setReadingPractice({ questionLanguage: language.value })}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${questionLanguage === language.value ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400"}`}
                  >
                    {language.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-ink px-4 py-4 text-white">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Tema atual</p>
              <p className="mt-2 text-lg font-semibold">{finalTheme}</p>
              <p className="mt-1 text-sm text-white/70">A IA vai criar um texto original e 4 perguntas de interpretação em {questionLanguageLabel}.</p>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !finalTheme.trim()}
              className="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Gerando atividade..." : activity ? "Gerar novo texto e questões" : "Gerar texto e questões"}
            </button>

            {activity ? (
              <p className="text-xs text-ink/55">
                Esta atividade fica salva para voce continuar depois ate gerar uma nova.
              </p>
            ) : null}

            {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </div>

          <div className="rounded-2xl border border-emerald-900/10 bg-white p-4">
            {!activity ? (
              <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-sky-200 bg-sky-50/60 p-6 text-center text-sm text-ink/60">
                Escolha um tema e gere a atividade. O texto vai aparecer aqui junto com as perguntas.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink/40">Leitura</p>
                    <h3 className="mt-1 text-2xl font-semibold text-ink">{activity.title}</h3>
                    <p className="mt-1 text-sm text-ink/55">Tema: {activity.theme}</p>
                    <p className="mt-1 text-sm text-ink/55">Questões em: {activityQuestionLanguageLabel}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => speak(activity.passage)}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100"
                      title="Ouvir texto em ingles"
                    >
                      Ouvir texto
                    </button>
                    <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-2 py-2" title="Velocidade da fala">
                      <span className="text-xs text-ink/50">🔊</span>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.1"
                        value={speechRate}
                        onChange={(event) => setSpeechRate(Number(event.target.value))}
                        className="h-1 w-20 accent-sky-700"
                        title={`Velocidade: ${speechRate.toFixed(1)}x`}
                      />
                      <span className="w-7 text-[10px] text-ink/50">{speechRate.toFixed(1)}x</span>
                    </div>
                    <button
                      type="button"
                      onClick={stopSpeaking}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-100"
                      title="Parar audio"
                    >
                      Parar audio
                    </button>

                    <button
                      type="button"
                      onClick={handleAnalyzeText}
                      className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:border-sky-400 hover:bg-sky-100"
                    >
                      Analisar texto
                    </button>
                  </div>
                </div>

                <article className="max-h-[320px] overflow-y-auto rounded-2xl bg-stone-50 p-4 text-sm leading-7 text-ink whitespace-pre-line">
                  {activity.passage}
                </article>

                {currentQuestion ? (
                  <div className="space-y-4 rounded-2xl border border-emerald-900/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">
                        Questão {currentQuestionIndex + 1} de {activity.questions.length}
                      </p>
                      <div className="flex gap-1.5">
                        {activity.questions.map((_, index) => {
                          const answered = Boolean(answers[index]);
                          const active = index === currentQuestionIndex;
                          return (
                            <button
                              key={`step-${index}`}
                              type="button"
                              onClick={() => setReadingPractice({ currentQuestionIndex: index })}
                              className={`h-2.5 w-2.5 rounded-full transition ${active ? "bg-sky-700" : answered ? "bg-emerald-500" : "bg-emerald-900/15"}`}
                              aria-label={`Ir para questão ${index + 1}`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-base font-semibold text-ink">
                      {currentQuestionIndex + 1}. {currentQuestion.question}
                    </p>

                    <div className="space-y-2">
                      {currentQuestion.options.map((option) => {
                        const selected = answers[currentQuestionIndex];
                        const active = selected === option;
                        const showCorrect = submitted && option === currentQuestion.correct_option;
                        const showWrong = submitted && active && option !== currentQuestion.correct_option;

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              if (submitted) return;
                              setReadingPractice({ answers: { ...answers, [currentQuestionIndex]: option } });
                            }}
                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${active ? "border-sky-600 bg-sky-50 text-sky-800" : "border-emerald-900/10 bg-white text-ink hover:border-sky-300"} ${showCorrect ? "border-emerald-500 bg-emerald-50 text-emerald-800" : ""} ${showWrong ? "border-red-400 bg-red-50 text-red-700" : ""}`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>

                    {submitted ? (
                      <div className={`rounded-xl px-3 py-2 text-sm ${answers[currentQuestionIndex] === currentQuestion.correct_option ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                        <p className="font-semibold">
                          {answers[currentQuestionIndex] === currentQuestion.correct_option ? "Resposta correta" : `Resposta correta: ${currentQuestion.correct_option}`}
                        </p>
                        <p className="mt-1">{currentQuestion.explanation}</p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-emerald-900/10 pt-3">
                      <button
                        type="button"
                        onClick={() => setReadingPractice({ currentQuestionIndex: Math.max(0, currentQuestionIndex - 1) })}
                        disabled={currentQuestionIndex === 0}
                        className="rounded-xl border border-emerald-900/15 px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <p className="text-sm text-ink/60">
                        {answeredCount}/{activity.questions.length} respondidas
                      </p>
                      <button
                        type="button"
                        onClick={() => setReadingPractice({ currentQuestionIndex: Math.min(activity.questions.length - 1, currentQuestionIndex + 1) })}
                        disabled={currentQuestionIndex === activity.questions.length - 1}
                        className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSubmitAnswers}
                    disabled={loading || submitted || answeredCount !== activity.questions.length}
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Salvando resultado..." : "Corrigir respostas"}
                  </button>
                  {submitted ? (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-ink">Resultado: {score}/{activity.questions.length}</p>
                      <p className="text-xs text-ink/55">{resultRecorded ? "Resultado salvo no progresso." : "Resultado corrigido localmente."}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-ink/60">Responda todas as perguntas para corrigir.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <AnalysisModal
        open={analysisOpen}
        analysis={analysisData}
        loading={analysisLoading}
        error={analysisError}
        title="Text Analysis"
        description="Click any word in the reading passage to inspect it, hear it and add it to your deck."
        sourceLabel="Reading Text (EN)"
        sourceTextEmptyHint="Click any word in the reading text to see translation, hear pronunciation and add it to your deck."
        onClose={() => {
          setAnalysisOpen(false);
          setAnalysisError(null);
        }}
        onAddToken={handleAddToken}
        onLookupToken={handleLookup}
      />
    </>
  );
}
