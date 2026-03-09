"use client";

import { useEffect, useMemo, useState } from "react";

import { adminGetMetrics } from "@/lib/api";
import type { AdminMetrics, DailyActivity, UserMetric } from "@/lib/types";

type Props = {
  token: string;
};

type SortKey =
  | "last_active"
  | "total_messages"
  | "total_sessions"
  | "total_reviews"
  | "total_reading_activities"
  | "total_reading_questions"
  | "full_name";

type SortDir = "asc" | "desc";
type ChartSerie = "messages" | "sessions" | "reviews" | "reading_activities";

function fmtDatetime(iso: string | null): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Nunca";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtShortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

function tierBadge(tier: string): string {
  return tier === "pro"
    ? "bg-amber-100 text-amber-700 border-amber-400"
    : "bg-gray-100 text-gray-600 border-gray-300";
}

function BarChart({ data }: { data: DailyActivity[] }) {
  const W = 700;
  const H = 160;
  const PAD = { top: 12, right: 8, bottom: 36, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map((d) => d.messages), 1);
  const barW = data.length > 0 ? Math.max(4, (chartW / data.length) * 0.65) : 12;
  const gap = data.length > 0 ? chartW / data.length : chartW;

  const gridLines = [0, 0.5, 1].map((pct) => {
    const y = PAD.top + chartH * (1 - pct);
    const val = Math.round(maxVal * pct);
    return { y, val };
  });

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-ink/40">
        Nenhuma atividade no periodo
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} aria-label="Grafico de atividade" role="img">
      {gridLines.map(({ y, val }) => (
        <g key={y}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
          <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
            {val}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const bh = Math.max(2, (d.messages / maxVal) * chartH);
        const x = PAD.left + gap * i + (gap - barW) / 2;
        const y = PAD.top + chartH - bh;
        const labelStep = data.length > 20 ? Math.ceil(data.length / 10) : 1;
        const showLabel = i % labelStep === 0;
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={bh} rx={3} fill="url(#barGrad)" opacity={0.9}>
              <title>{`${fmtShortDate(d.date)}: ${d.messages}`}</title>
            </rect>
            {showLabel ? (
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
                {fmtShortDate(d.date)}
              </text>
            ) : null}
          </g>
        );
      })}

      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: string; label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm">
      <span className="text-2xl">{icon}</span>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs font-medium text-ink/60">{label}</p>
      {sub ? <p className="text-xs text-ink/40">{sub}</p> : null}
    </div>
  );
}

export function AdminMetricsPanel({ token }: Props) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("last_active");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [chartSerie, setChartSerie] = useState<ChartSerie>("messages");

  useEffect(() => {
    void loadMetrics();
  }, [days]);

  async function loadMetrics() {
    setLoading(true);
    setError(null);
    try {
      const result = await adminGetMetrics(token, days);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar metricas.");
    } finally {
      setLoading(false);
    }
  }

  const chartData: DailyActivity[] = useMemo(() => {
    if (!data) return [];
    return data.daily_activity.map((d) => ({
      ...d,
      messages: d[chartSerie],
    }));
  }, [data, chartSerie]);

  const sortedUsers: UserMetric[] = useMemo(() => {
    if (!data) return [];
    return [...data.user_metrics].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "last_active") {
        const da = a.last_active ? new Date(a.last_active).getTime() : 0;
        const db = b.last_active ? new Date(b.last_active).getTime() : 0;
        cmp = da - db;
      } else if (sortKey === "full_name") {
        cmp = a.full_name.localeCompare(b.full_name);
      } else {
        cmp = a[sortKey] - b[sortKey];
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortDir, sortKey]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const periodOptions = [7, 14, 30] as const;
  const serieOptions: Array<{ key: ChartSerie; label: string }> = [
    { key: "messages", label: "Msgs" },
    { key: "sessions", label: "Sessoes" },
    { key: "reviews", label: "Reviews" },
    { key: "reading_activities", label: "Leituras" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-ink">Metricas de Uso</h3>
          <p className="text-xs text-ink/50">Agora incluindo conversas, revisoes e interpretacao textual.</p>
        </div>
        <div className="flex gap-1">
          {periodOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${days === option ? "bg-accent text-white" : "bg-emerald-900/10 text-ink hover:bg-emerald-900/15"}`}
            >
              {option}d
            </button>
          ))}
          <button
            type="button"
            onClick={() => void loadMetrics()}
            title="Atualizar"
            className="ml-1 rounded-xl bg-emerald-900/10 px-2 py-1.5 text-sm text-ink transition hover:bg-emerald-900/15"
          >
            ↻
          </button>
        </div>
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p> : null}

      {loading || !data ? (
        <div className="flex h-48 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-ink/40">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-accent" />
            <span className="text-sm">Carregando metricas...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <KpiCard icon="👥" label="Usuarios ativos" value={data.active_users} sub={`${data.inactive_users} inativos`} />
            <KpiCard icon="💬" label={`Mensagens (${days}d)`} value={data.messages_period} sub={`+${data.new_users_period} novos usuarios`} />
            <KpiCard icon="📚" label={`Sessoes (${days}d)`} value={data.sessions_period} />
            <KpiCard icon="🔄" label={`Reviews (${days}d)`} value={data.reviews_period} />
            <KpiCard icon="📝" label={`Leituras (${days}d)`} value={data.reading_activities_period} />
            <KpiCard icon="✅" label={`Questoes certas (${days}d)`} value={data.reading_correct_answers_period} sub={`${data.reading_questions_answered_period} respondidas`} />
          </div>

          <div className="rounded-2xl border border-emerald-900/10 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Atividade diaria - ultimos {days} dias</p>
              <div className="flex gap-1">
                {serieOptions.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setChartSerie(key)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${chartSerie === key ? "bg-accent text-white" : "bg-emerald-900/10 text-ink hover:bg-emerald-900/15"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <BarChart data={chartData} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white">
            <div className="flex items-center justify-between border-b border-emerald-900/10 px-5 py-3">
              <p className="text-sm font-semibold text-ink">
                Uso por aluno
                <span className="ml-2 text-xs font-normal text-ink/40">({sortedUsers.length} usuarios)</span>
              </p>
              <p className="text-xs text-ink/40">Clique no cabecalho para ordenar</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-ink/50">
                  <tr>
                    <th className="cursor-pointer px-4 py-3 hover:text-ink select-none" onClick={() => handleSort("full_name")}>Aluno <SortIcon k="full_name" /></th>
                    <th className="px-4 py-3">Plano</th>
                    <th className="cursor-pointer px-4 py-3 text-right hover:text-ink select-none" onClick={() => handleSort("total_sessions")}>Sessoes <SortIcon k="total_sessions" /></th>
                    <th className="cursor-pointer px-4 py-3 text-right hover:text-ink select-none" onClick={() => handleSort("total_messages")}>Msgs <SortIcon k="total_messages" /></th>
                    <th className="cursor-pointer px-4 py-3 text-right hover:text-ink select-none" onClick={() => handleSort("total_reviews")}>Reviews <SortIcon k="total_reviews" /></th>
                    <th className="cursor-pointer px-4 py-3 text-right hover:text-ink select-none" onClick={() => handleSort("total_reading_activities")}>Leituras <SortIcon k="total_reading_activities" /></th>
                    <th className="cursor-pointer px-4 py-3 text-right hover:text-ink select-none" onClick={() => handleSort("total_reading_questions")}>Questoes <SortIcon k="total_reading_questions" /></th>
                    <th className="cursor-pointer px-4 py-3 hover:text-ink select-none" onClick={() => handleSort("last_active")}>Ultimo acesso <SortIcon k="last_active" /></th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedUsers.map((user) => {
                    const isIdleUser =
                      user.total_messages === 0 &&
                      user.total_reviews === 0 &&
                      user.total_sessions === 0 &&
                      user.total_reading_activities === 0;

                    return (
                      <tr key={user.id} className={`transition ${isIdleUser ? "bg-orange-50/50 hover:bg-orange-50" : "bg-white hover:bg-gray-50"}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{user.full_name}</p>
                          <p className="text-xs text-ink/50">{user.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${tierBadge(user.tier)}`}>
                            {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-ink">{user.total_sessions}</td>
                        <td className="px-4 py-3 text-right font-medium text-ink">{user.total_messages}</td>
                        <td className="px-4 py-3 text-right font-medium text-ink">{user.total_reviews}</td>
                        <td className="px-4 py-3 text-right font-medium text-ink">{user.total_reading_activities}</td>
                        <td className="px-4 py-3 text-right font-medium text-ink">{user.total_reading_questions}</td>
                        <td className="px-4 py-3 text-xs text-ink/60">{fmtDatetime(user.last_active)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                            {user.is_active ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
