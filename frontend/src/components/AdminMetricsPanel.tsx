"use client";

import { useEffect, useMemo, useState } from "react";
import { adminGetMetrics } from "@/lib/api";
import type { AdminMetrics, DailyActivity, UserMetric } from "@/lib/types";

// ─── Tipos auxiliares ──────────────────────────────────────────────────────────
type Props = {
    token: string;
};

type SortKey = "last_active" | "total_messages" | "total_sessions" | "total_reviews" | "full_name";
type SortDir = "asc" | "desc";

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Formata data ISO para dd/mm/yyyy hh:mm, exibindo "Nunca" quando nulo. */
function fmtDatetime(iso: string | null): string {
    if (!iso) return "Nunca";
    const d = new Date(iso);
    // Verifica se é data válida
    if (isNaN(d.getTime())) return "Nunca";
    return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** Formata data ISO para dd/mm (rótulo curto do gráfico). */
function fmtShortDate(iso: string): string {
    const [, month, day] = iso.split("-");
    return `${day}/${month}`;
}

/** Retorna cor do badge de tier. */
function tierBadge(tier: string): string {
    return tier === "pro"
        ? "bg-amber-100 text-amber-700 border-amber-400"
        : "bg-gray-100 text-gray-600 border-gray-300";
}

// ─── Gráfico de barras SVG ─────────────────────────────────────────────────────

function BarChart({ data }: { data: DailyActivity[] }) {
    const W = 700;
    const H = 160;
    const PAD = { top: 12, right: 8, bottom: 36, left: 36 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    const maxVal = Math.max(...data.map((d) => d.messages), 1);
    const barW = data.length > 0 ? Math.max(4, (chartW / data.length) * 0.65) : 12;
    const gap = data.length > 0 ? chartW / data.length : chartW;

    // Linhas de grade (0%, 50%, 100%)
    const gridLines = [0, 0.5, 1].map((pct) => {
        const y = PAD.top + chartH * (1 - pct);
        const val = Math.round(maxVal * pct);
        return { y, val };
    });

    if (data.length === 0) {
        return (
            <div className="flex h-40 items-center justify-center text-sm text-ink/40">
                Nenhuma atividade no período
            </div>
        );
    }

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ height: H }}
            aria-label="Gráfico de mensagens por dia"
            role="img"
        >
            {/* Linhas de grade */}
            {gridLines.map(({ y, val }) => (
                <g key={y}>
                    <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                    <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
                        {val}
                    </text>
                </g>
            ))}

            {/* Barras */}
            {data.map((d, i) => {
                const bh = Math.max(2, (d.messages / maxVal) * chartH);
                const x = PAD.left + gap * i + (gap - barW) / 2;
                const y = PAD.top + chartH - bh;
                const labelStep = data.length > 20 ? Math.ceil(data.length / 10) : 1;
                const showLabel = i % labelStep === 0;
                return (
                    <g key={d.date}>
                        <rect
                            x={x}
                            y={y}
                            width={barW}
                            height={bh}
                            rx={3}
                            fill="url(#barGrad)"
                            opacity={0.9}
                        >
                            <title>{`${fmtShortDate(d.date)}: ${d.messages} msgs, ${d.sessions} sessões, ${d.reviews} reviews`}</title>
                        </rect>
                        {showLabel && (
                            <text
                                x={x + barW / 2}
                                y={H - 6}
                                textAnchor="middle"
                                fontSize={9}
                                fill="#9ca3af"
                            >
                                {fmtShortDate(d.date)}
                            </text>
                        )}
                    </g>
                );
            })}

            {/* Gradiente das barras */}
            <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                </linearGradient>
            </defs>
        </svg>
    );
}

// ─── Card KPI ──────────────────────────────────────────────────────────────────

function KpiCard({
    icon,
    label,
    value,
    sub,
    accent,
}: {
    icon: string;
    label: string;
    value: number | string;
    sub?: string;
    accent?: string;
}) {
    return (
        <div
            className={`rounded-2xl border p-5 flex flex-col gap-1 shadow-sm ${accent ?? "border-emerald-900/10 bg-white"
                }`}
        >
            <span className="text-2xl">{icon}</span>
            <p className="text-2xl font-bold text-ink">{value}</p>
            <p className="text-xs font-medium text-ink/60">{label}</p>
            {sub && <p className="text-xs text-ink/40">{sub}</p>}
        </div>
    );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function AdminMetricsPanel({ token }: Props) {
    const [days, setDays] = useState(30);
    const [data, setData] = useState<AdminMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Ordenação da tabela de usuários
    const [sortKey, setSortKey] = useState<SortKey>("last_active");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    // Qual série mostrar no gráfico
    const [chartSerie, setChartSerie] = useState<"messages" | "sessions" | "reviews">("messages");

    useEffect(() => {
        void loadMetrics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [days]);

    async function loadMetrics() {
        setLoading(true);
        setError(null);
        try {
            const result = await adminGetMetrics(token, days);
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao carregar métricas.");
        } finally {
            setLoading(false);
        }
    }

    /** Dados do gráfico mapeados para a série selecionada. */
    const chartData: DailyActivity[] = useMemo(() => {
        if (!data) return [];
        // Remapeia para que o gráfico sempre use o campo "messages" como altura da barra
        return data.daily_activity.map((d) => ({
            ...d,
            // Sobrescreve messages com o valor da série escolhida para reutilizar o componente SVG
            messages: d[chartSerie],
        }));
    }, [data, chartSerie]);

    /** Usuários ordenados conforme coluna e direção escolhidas. */
    const sortedUsers: UserMetric[] = useMemo(() => {
        if (!data) return [];
        return [...data.user_metrics].sort((a, b) => {
            let cmp = 0;
            if (sortKey === "last_active") {
                const da = a.last_active ? new Date(a.last_active).getTime() : 0;
                const db2 = b.last_active ? new Date(b.last_active).getTime() : 0;
                cmp = da - db2;
            } else if (sortKey === "full_name") {
                cmp = a.full_name.localeCompare(b.full_name);
            } else {
                cmp = a[sortKey] - b[sortKey];
            }
            return sortDir === "asc" ? cmp : -cmp;
        });
    }, [data, sortKey, sortDir]);

    function handleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    }

    function SortIcon({ k }: { k: SortKey }) {
        if (sortKey !== k) return <span className="ml-1 opacity-30">↕</span>;
        return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
    }

    const PERIOD_OPTIONS = [7, 14, 30] as const;

    const SERIE_OPTIONS: { key: "messages" | "sessions" | "reviews"; label: string }[] = [
        { key: "messages", label: "💬 Msgs" },
        { key: "sessions", label: "📚 Sessões" },
        { key: "reviews", label: "🔄 Reviews" },
    ];

    return (
        <div className="space-y-6">
            {/* Cabeçalho + filtro de período */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                    <h3 className="text-base font-semibold text-ink">Métricas de Uso</h3>
                    <p className="text-xs text-ink/50">
                        Acompanhe a atividade dos alunos sem ver o conteúdo das conversas.
                    </p>
                </div>
                <div className="flex gap-1">
                    {PERIOD_OPTIONS.map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => setDays(d)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${days === d
                                    ? "bg-accent text-white"
                                    : "bg-emerald-900/10 text-ink hover:bg-emerald-900/15"
                                }`}
                        >
                            {d}d
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => void loadMetrics()}
                        title="Atualizar"
                        className="ml-1 rounded-xl px-2 py-1.5 text-sm bg-emerald-900/10 text-ink hover:bg-emerald-900/15 transition"
                    >
                        ↺
                    </button>
                </div>
            </div>

            {error && (
                <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
            )}

            {loading || !data ? (
                <div className="flex h-48 items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-ink/40">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-accent" />
                        <span className="text-sm">Carregando métricas…</span>
                    </div>
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <KpiCard
                            icon="👥"
                            label="Usuários Ativos"
                            value={data.active_users}
                            sub={`${data.inactive_users} inativos · ${data.total_users} total`}
                        />
                        <KpiCard
                            icon="💬"
                            label={`Mensagens (${days}d)`}
                            value={data.messages_period}
                            sub={`+${data.new_users_period} novos alunos`}
                        />
                        <KpiCard
                            icon="📚"
                            label={`Sessões (${days}d)`}
                            value={data.sessions_period}
                        />
                        <KpiCard
                            icon="🔄"
                            label={`Reviews (${days}d)`}
                            value={data.reviews_period}
                        />
                    </div>

                    {/* Gráfico de atividade */}
                    <div className="rounded-2xl border border-emerald-900/10 bg-white p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <p className="text-sm font-semibold text-ink">
                                Atividade diária — últimos {days} dias
                            </p>
                            <div className="flex gap-1">
                                {SERIE_OPTIONS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setChartSerie(key)}
                                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${chartSerie === key
                                                ? "bg-accent text-white"
                                                : "bg-emerald-900/10 text-ink hover:bg-emerald-900/15"
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <BarChart data={chartData} />
                    </div>

                    {/* Tabela por usuário */}
                    <div className="rounded-2xl border border-emerald-900/10 bg-white overflow-hidden">
                        <div className="px-5 py-3 border-b border-emerald-900/10 flex items-center justify-between">
                            <p className="text-sm font-semibold text-ink">
                                Uso por aluno
                                <span className="ml-2 text-xs font-normal text-ink/40">
                                    ({sortedUsers.length} usuários)
                                </span>
                            </p>
                            <p className="text-xs text-ink/40">Clique no cabeçalho para ordenar</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-left text-xs font-semibold text-ink/50 uppercase tracking-wide">
                                    <tr>
                                        <th
                                            className="px-4 py-3 cursor-pointer hover:text-ink select-none"
                                            onClick={() => handleSort("full_name")}
                                        >
                                            Aluno <SortIcon k="full_name" />
                                        </th>
                                        <th className="px-4 py-3">Plano</th>
                                        <th
                                            className="px-4 py-3 text-right cursor-pointer hover:text-ink select-none"
                                            onClick={() => handleSort("total_sessions")}
                                        >
                                            Sessões <SortIcon k="total_sessions" />
                                        </th>
                                        <th
                                            className="px-4 py-3 text-right cursor-pointer hover:text-ink select-none"
                                            onClick={() => handleSort("total_messages")}
                                        >
                                            Msgs <SortIcon k="total_messages" />
                                        </th>
                                        <th
                                            className="px-4 py-3 text-right cursor-pointer hover:text-ink select-none"
                                            onClick={() => handleSort("total_reviews")}
                                        >
                                            Reviews <SortIcon k="total_reviews" />
                                        </th>
                                        <th
                                            className="px-4 py-3 cursor-pointer hover:text-ink select-none"
                                            onClick={() => handleSort("last_active")}
                                        >
                                            Último Acesso <SortIcon k="last_active" />
                                        </th>
                                        <th className="px-4 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedUsers.map((u) => {
                                        // Sinaliza usuários sem nenhuma atividade
                                        const isIdleUser =
                                            u.total_messages === 0 && u.total_reviews === 0 && u.total_sessions === 0;

                                        return (
                                            <tr
                                                key={u.id}
                                                className={`transition ${isIdleUser
                                                        ? "bg-orange-50/50 hover:bg-orange-50"
                                                        : "bg-white hover:bg-gray-50"
                                                    }`}
                                            >
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-ink">{u.full_name}</p>
                                                    <p className="text-xs text-ink/50">{u.email}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${tierBadge(u.tier)}`}
                                                    >
                                                        {u.tier.charAt(0).toUpperCase() + u.tier.slice(1)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-sm">
                                                    {u.total_sessions}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-sm">
                                                    {u.total_messages}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-sm">
                                                    {u.total_reviews}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-ink/60">
                                                    {fmtDatetime(u.last_active)}
                                                    {isIdleUser && (
                                                        <span className="ml-1 inline-block rounded-full bg-orange-100 text-orange-600 px-1.5 py-0.5 text-xs font-semibold">
                                                            ⚠ Sem uso
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${u.is_active
                                                                ? "bg-emerald-100 text-emerald-700 border-emerald-400"
                                                                : "bg-red-100 text-red-600 border-red-300"
                                                            }`}
                                                    >
                                                        {u.is_active ? "Ativo" : "Bloqueado"}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {sortedUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink/40">
                                                Nenhum usuário encontrado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
