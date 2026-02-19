"use client";

import { useEffect, useState } from "react";

import { progressOverview, reviewHistory } from "@/lib/api";
import type { DailyReviewStat, ProgressOverview } from "@/lib/types";

type Props = {
    token: string;
};

/* ── Anel circular SVG para exibir porcentagem ── */
function AccuracyRing({ value }: { value: number }) {
    const pct = Math.round(value * 100);
    const radius = 54;
    const stroke = 10;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value * circumference);

    return (
        <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 128 128">
                {/* trilha de fundo */}
                <circle
                    cx="64" cy="64" r={radius}
                    fill="none" stroke="currentColor"
                    className="text-emerald-100"
                    strokeWidth={stroke}
                />
                {/* arco de progresso */}
                <circle
                    cx="64" cy="64" r={radius}
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

/* ── Gráfico de barras dos últimos 14 dias ── */
function BarChart({ data }: { data: DailyReviewStat[] }) {
    const max = Math.max(...data.map((d) => d.count), 1);

    return (
        <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ minHeight: 120 }}>
            {data.map((d) => {
                const h = Math.max(Math.round((d.count / max) * 90), 4);
                const acc = Math.round(d.accuracy * 100);
                // Cor baseada na acurácia: verde se >= 70%, âmbar se < 70%
                const barColor = acc >= 70
                    ? "from-teal-400 to-teal-600"
                    : "from-amber-400 to-amber-600";

                return (
                    <div key={d.date} className="flex flex-1 flex-col items-center gap-1" style={{ minWidth: 28 }}>
                        <span className="text-[9px] font-semibold text-ink/50">{d.count > 0 ? d.count : ""}</span>
                        <div
                            className={`w-full rounded-t-lg bg-gradient-to-t ${barColor} transition-all duration-500 ease-out`}
                            style={{ height: h }}
                            title={`${d.date}: ${d.count} revisões (${acc}% acerto)`}
                        />
                        <span className="text-[9px] text-ink/40">{d.date.slice(5)}</span>
                    </div>
                );
            })}
        </div>
    );
}

/* ── Card de estatística individual ── */
function StatCard({
    icon,
    value,
    label,
    gradient,
}: {
    icon: string;
    value: string | number;
    label: string;
    gradient: string;
}) {
    return (
        <div
            className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-lg ${gradient}`}
        >
            {/* Círculo decorativo de fundo */}
            <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
            <div className="absolute -right-1 -top-1 h-8 w-8 rounded-full bg-white/10" />

            <span className="text-2xl">{icon}</span>
            <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-white/75">{label}</p>
        </div>
    );
}

/* ── Componente principal ── */
export function ProgressDashboard({ token }: Props) {
    const [overview, setOverview] = useState<ProgressOverview | null>(null);
    const [history, setHistory] = useState<DailyReviewStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const [ov, hist] = await Promise.all([
                    progressOverview(token),
                    reviewHistory(token, 14),
                ]);
                setOverview(ov);
                setHistory(hist);
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Erro ao carregar dados");
            } finally {
                setLoading(false);
            }
        }
        void load();
    }, [token]);

    /* Estados de carregamento e erro */
    if (loading) {
        return (
            <div className="flex items-center justify-center rounded-3xl border border-emerald-900/10 bg-panel p-12">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
                    <p className="text-sm text-ink/60">Carregando progresso…</p>
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

    if (!overview) return null;

    const accuracyPct = Math.round(overview.accuracy_rate * 100);

    return (
        <div className="animate-rise space-y-5">
            {/* Cabeçalho */}
            <div className="rounded-3xl border border-emerald-900/10 bg-panel p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                <h2 className="text-xl font-bold text-ink">📊 Meu Progresso</h2>
                <p className="mt-1 text-xs text-ink/50">Visão geral do seu desempenho de aprendizado.</p>
            </div>

            {/* Grid de Stat Cards — 2×2 em mobile, 4 em desktop */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                    icon="🔥"
                    value={overview.streak_days}
                    label="dias seguidos"
                    gradient="bg-gradient-to-br from-teal-500 to-teal-700"
                />
                <StatCard
                    icon="📚"
                    value={overview.total_learned}
                    label="palavras"
                    gradient="bg-gradient-to-br from-amber-500 to-amber-700"
                />
                <StatCard
                    icon="🎯"
                    value={`${accuracyPct}%`}
                    label="acerto"
                    gradient="bg-gradient-to-br from-blue-500 to-blue-700"
                />
                <StatCard
                    icon="📅"
                    value={overview.reviews_today}
                    label="revisões hoje"
                    gradient="bg-gradient-to-br from-violet-500 to-violet-700"
                />
            </div>

            {/* Seção média: Anel de acurácia + mini-stats */}
            <div className="rounded-3xl border border-emerald-900/10 bg-panel p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink/50">
                    Taxa de acerto
                </h3>
                <AccuracyRing value={overview.accuracy_rate} />
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-teal-50 p-2">
                        <p className="text-lg font-bold text-teal-700">{overview.streak_days}</p>
                        <p className="text-[10px] text-teal-600/70">Streak</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-2">
                        <p className="text-lg font-bold text-amber-700">{overview.total_learned}</p>
                        <p className="text-[10px] text-amber-600/70">Aprendidas</p>
                    </div>
                    <div className="rounded-xl bg-violet-50 p-2">
                        <p className="text-lg font-bold text-violet-700">{overview.reviews_today}</p>
                        <p className="text-[10px] text-violet-600/70">Hoje</p>
                    </div>
                </div>
            </div>

            {/* Gráfico de barras — últimos 14 dias */}
            <div className="rounded-3xl border border-emerald-900/10 bg-panel p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink/50">
                    Revisões — últimos 14 dias
                </h3>
                {history.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <span className="text-4xl">🚀</span>
                        <p className="text-sm text-ink/60">
                            Nenhuma revisão ainda. Comece a praticar!
                        </p>
                    </div>
                ) : (
                    <BarChart data={history} />
                )}
            </div>
        </div>
    );
}
