"use client";

import { useEffect, useMemo, useState } from "react";

import { progressOverview, readingProgressOverview, reviewHistory } from "@/lib/api";
import type { DailyReadingStat, DailyReviewStat, ProgressOverview, ReadingProgressOverview } from "@/lib/types";

type Props = {
  token: string;
};

type SectionKey = "words" | "reading" | "general";

type SummaryCardProps = {
  label: string;
  value: string | number;
  hint: string;
};

type MetricTileProps = {
  label: string;
  value: string | number;
  accent: string;
};

const SECTION_COPY: Record<SectionKey, { title: string; subtitle: string; empty: string; chartLabel: string }> = {
  general: {
    title: "Progresso geral",
    subtitle: "Visao consolidada entre vocabulario e interpretacao textual.",
    empty: "O consolidado usa as duas frentes para montar sua visao geral.",
    chartLabel: "pratica",
  },
  words: {
    title: "Progresso de palavras",
    subtitle: "Desempenho em revisao e evolucao do vocabulario.",
    empty: "Nenhuma revisao registrada nos ultimos 14 dias.",
    chartLabel: "revisoes",
  },
  reading: {
    title: "Progresso de interpretacao textual",
    subtitle: "Acertos e volume de pratica nas questoes de leitura.",
    empty: "Nenhuma atividade de interpretacao registrada nos ultimos 14 dias.",
    chartLabel: "leituras",
  },
};

function AccuracyRing({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const radius = 54;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - value * circumference;

  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="currentColor" className="text-emerald-100" strokeWidth={stroke} />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="z-10 text-center">
        <span className="text-3xl font-bold text-ink">{pct}%</span>
        <p className="text-[10px] font-medium uppercase tracking-wider text-ink/50">acerto</p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, hint }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">{label}</p>
      <p className="mt-3 text-3xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink/55">{hint}</p>
    </div>
  );
}

function MetricTile({ label, value, accent }: MetricTileProps) {
  return (
    <div className="rounded-2xl border border-emerald-900/10 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">{label}</p>
      <p className={`mt-3 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function SectionSelector({
  active,
  onSelect,
}: {
  active: SectionKey;
  onSelect: (section: SectionKey) => void;
}) {
  const items: Array<{ key: SectionKey; label: string; hint: string }> = [
    { key: "general", label: "Geral", hint: "Resumo combinado" },
    { key: "words", label: "Palavras", hint: "Revisao de vocabulario" },
    { key: "reading", label: "Interpretacao", hint: "Questoes de leitura" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const selected = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={`rounded-2xl border px-4 py-4 text-left transition ${
              selected
                ? "border-sky-500 bg-sky-50 shadow-[0_10px_30px_rgba(14,116,144,0.14)]"
                : "border-emerald-900/10 bg-white hover:border-sky-200 hover:bg-sky-50/40"
            }`}
          >
            <p className={`text-sm font-semibold ${selected ? "text-sky-800" : "text-ink"}`}>{item.label}</p>
            <p className={`mt-1 text-xs ${selected ? "text-sky-700/75" : "text-ink/55"}`}>{item.hint}</p>
          </button>
        );
      })}
    </div>
  );
}

function BarChart({ data, label }: { data: Array<DailyReviewStat | DailyReadingStat>; label: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ minHeight: 140 }}>
      {data.map((d) => {
        const h = Math.max(Math.round((d.count / max) * 96), 6);
        const acc = Math.round(d.accuracy * 100);
        const barColor = acc >= 70 ? "from-teal-400 to-teal-600" : "from-amber-400 to-amber-600";

        return (
          <div key={`${label}-${d.date}`} className="flex min-w-[34px] flex-1 flex-col items-center gap-2">
            <span className="text-[10px] font-semibold text-ink/55">{d.count > 0 ? d.count : ""}</span>
            <div
              className={`w-full rounded-t-xl bg-gradient-to-t ${barColor} transition-all duration-500 ease-out`}
              style={{ height: h }}
              title={`${d.date}: ${d.count} ${label} (${acc}% acerto)`}
            />
            <span className="text-[10px] text-ink/40">{d.date.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ProgressDashboard({ token }: Props) {
  const [wordsOverview, setWordsOverview] = useState<ProgressOverview | null>(null);
  const [wordsHistory, setWordsHistory] = useState<DailyReviewStat[]>([]);
  const [readingOverviewData, setReadingOverviewData] = useState<ReadingProgressOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>("general");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [wordStats, wordHistory, readingStats] = await Promise.all([
          progressOverview(token),
          reviewHistory(token, 14),
          readingProgressOverview(token, 14),
        ]);
        setWordsOverview(wordStats);
        setWordsHistory(wordHistory);
        setReadingOverviewData(readingStats);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [token]);

  const generalOverview = useMemo(() => {
    if (!wordsOverview || !readingOverviewData) return null;

    const reviewWeight = wordsOverview.reviews_today + wordsOverview.total_learned;
    const readingWeight = readingOverviewData.total_questions_answered + readingOverviewData.completed_activities;
    const combinedWeight = reviewWeight + readingWeight;
    const combinedAccuracy = combinedWeight
      ? ((wordsOverview.accuracy_rate * reviewWeight) + (readingOverviewData.accuracy_rate * readingWeight)) / combinedWeight
      : 0;

    return {
      accuracy_rate: combinedAccuracy,
      total_actions: wordsOverview.reviews_today + readingOverviewData.total_questions_answered,
      completed_units: wordsOverview.total_learned + readingOverviewData.completed_activities,
      today_actions: wordsOverview.reviews_today + readingOverviewData.activities_today,
      streak_days: wordsOverview.streak_days,
    };
  }, [wordsOverview, readingOverviewData]);

  const detailContent = useMemo(() => {
    if (!wordsOverview || !readingOverviewData || !generalOverview) return null;

    if (activeSection === "words") {
      return {
        ringValue: wordsOverview.accuracy_rate,
        metrics: [
          { label: "Palavras aprendidas", value: wordsOverview.total_learned, accent: "text-amber-700" },
          { label: "Acerto", value: `${Math.round(wordsOverview.accuracy_rate * 100)}%`, accent: "text-sky-700" },
          { label: "Revisoes hoje", value: wordsOverview.reviews_today, accent: "text-violet-700" },
          { label: "Sequencia", value: `${wordsOverview.streak_days} dias`, accent: "text-teal-700" },
        ],
        history: wordsHistory,
      };
    }

    if (activeSection === "reading") {
      return {
        ringValue: readingOverviewData.accuracy_rate,
        metrics: [
          { label: "Leituras concluidas", value: readingOverviewData.completed_activities, accent: "text-sky-700" },
          { label: "Questoes certas", value: readingOverviewData.correct_answers, accent: "text-emerald-700" },
          { label: "Questoes respondidas", value: readingOverviewData.total_questions_answered, accent: "text-amber-700" },
          { label: "Leituras hoje", value: readingOverviewData.activities_today, accent: "text-violet-700" },
        ],
        history: readingOverviewData.daily_history,
      };
    }

    return {
      ringValue: generalOverview.accuracy_rate,
      metrics: [
        { label: "Acerto geral", value: `${Math.round(generalOverview.accuracy_rate * 100)}%`, accent: "text-emerald-700" },
        { label: "Acoes totais", value: generalOverview.total_actions, accent: "text-sky-700" },
        { label: "Unidades concluidas", value: generalOverview.completed_units, accent: "text-amber-700" },
        { label: "Acoes hoje", value: generalOverview.today_actions, accent: "text-violet-700" },
      ],
      history: [],
    };
  }, [activeSection, generalOverview, readingOverviewData, wordsHistory, wordsOverview]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-emerald-900/10 bg-panel p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
          <p className="text-sm text-ink/60">Carregando progresso...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!wordsOverview || !readingOverviewData || !generalOverview || !detailContent) return null;

  const copy = SECTION_COPY[activeSection];

  return (
    <div className="animate-rise space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-emerald-900/10 bg-panel shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
        <div className="bg-[linear-gradient(135deg,rgba(14,116,144,0.08),rgba(245,158,11,0.08))] px-5 py-6 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">Progress Tracker</p>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h2 className="text-2xl font-bold text-ink">Seu progresso ficou dividido por area</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
                Agora voce consegue alternar entre palavras, interpretacao textual e uma visao geral sem perder contexto.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard label="Palavras" value={wordsOverview.total_learned} hint="itens aprendidos" />
              <SummaryCard label="Leituras" value={readingOverviewData.completed_activities} hint="atividades concluidas" />
              <SummaryCard label="Acerto geral" value={`${Math.round(generalOverview.accuracy_rate * 100)}%`} hint="media ponderada" />
              <SummaryCard label="Sequencia" value={`${generalOverview.streak_days} dias`} hint="baseada em vocabulario" />
            </div>
          </div>
        </div>
      </section>

      <SectionSelector active={activeSection} onSelect={setActiveSection} />

      <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[28px] border border-emerald-900/10 bg-panel p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">Foco atual</p>
          <h3 className="mt-3 text-xl font-bold text-ink">{copy.title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink/65">{copy.subtitle}</p>

          <div className="mt-6 flex justify-center">
            <AccuracyRing value={detailContent.ringValue} />
          </div>

          <div className="mt-5 rounded-2xl bg-white p-4 text-sm text-ink/70">
            {activeSection === "general" ? (
              <>
                <p>O progresso geral combina revisao de palavras com desempenho em interpretacao textual.</p>
                <p className="mt-2">O calculo da mais peso para a frente em que voce praticou mais, deixando o consolidado mais fiel ao uso real.</p>
              </>
            ) : (
              <p>{copy.subtitle}</p>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-emerald-900/10 bg-panel p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="grid gap-3 sm:grid-cols-2">
            {detailContent.metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} accent={metric.accent} />
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-ink">Historico dos ultimos 14 dias</h4>
                <p className="mt-1 text-xs text-ink/50">
                  {activeSection === "general" ? "Use os seletores acima para ver o historico especifico de cada frente." : "Volume diario e qualidade da pratica recente."}
                </p>
              </div>
            </div>

            <div className="mt-4">
              {detailContent.history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-emerald-900/10 bg-stone-50 px-4 py-8 text-center text-sm text-ink/55">
                  {copy.empty}
                </div>
              ) : (
                <BarChart data={detailContent.history} label={copy.chartLabel} />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
