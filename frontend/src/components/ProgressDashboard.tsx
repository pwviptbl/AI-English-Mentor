"use client";

import { useEffect, useState } from "react";

import { progressOverview, reviewHistory } from "@/lib/api";
import type { DailyReviewStat, ProgressOverview } from "@/lib/types";

type Props = {
    token: string;
};

function BarChart({ data }: { data: DailyReviewStat[] }) {
    const max = Math.max(...data.map((d) => d.count), 1);
    return (
        <div className="bar-chart">
            {data.map((d) => (
                <div key={d.date} className="bar-chart__col">
                    <div
                        className="bar-chart__bar"
                        style={{ height: `${Math.round((d.count / max) * 80)}px` }}
                        title={`${d.date}: ${d.count} revisões (${Math.round(d.accuracy * 100)}% acerto)`}
                    />
                    <span className="bar-chart__label">{d.date.slice(5)}</span>
                </div>
            ))}
        </div>
    );
}

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

    if (loading) return <p className="loading">Carregando progresso…</p>;
    if (error) return <p className="error-msg">{error}</p>;
    if (!overview) return null;

    return (
        <div className="progress-dashboard">
            <h2 className="progress-dashboard__title">📊 Meu Progresso</h2>

            {/* Cartões de estatísticas */}
            <div className="progress-stats">
                <div className="stat-card">
                    <span className="stat-card__icon">🔥</span>
                    <span className="stat-card__value">{overview.streak_days}</span>
                    <span className="stat-card__label">dias seguidos</span>
                </div>
                <div className="stat-card">
                    <span className="stat-card__icon">📚</span>
                    <span className="stat-card__value">{overview.total_learned}</span>
                    <span className="stat-card__label">palavras aprendidas</span>
                </div>
                <div className="stat-card">
                    <span className="stat-card__icon">🎯</span>
                    <span className="stat-card__value">{Math.round(overview.accuracy_rate * 100)}%</span>
                    <span className="stat-card__label">taxa de acerto</span>
                </div>
                <div className="stat-card">
                    <span className="stat-card__icon">📅</span>
                    <span className="stat-card__value">{overview.reviews_today}</span>
                    <span className="stat-card__label">revisões hoje</span>
                </div>
            </div>

            {/* Gráfico de barras dos últimos 14 dias */}
            <div className="progress-chart-wrapper">
                <h3 className="progress-chart-wrapper__heading">Revisões — últimos 14 dias</h3>
                {history.length === 0 ? (
                    <p className="progress-chart-wrapper__empty">Nenhuma revisão ainda. Comece a praticar! 🚀</p>
                ) : (
                    <BarChart data={history} />
                )}
            </div>
        </div>
    );
}
