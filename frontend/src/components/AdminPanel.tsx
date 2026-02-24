"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  adminDeleteUser,
  adminGetTierLimits,
  adminListUsers,
  adminUpdateTierLimits,
  adminUpdateUser,
} from "@/lib/api";
import type { AdminUser, TierLimits } from "@/lib/types";

type Props = {
  token: string;
  currentUserId: string;
};

type Tab = "users" | "limits";

const TIER_OPTIONS = ["free", "pro"] as const;

const TIER_BADGE: Record<string, string> = {
  free: "bg-gray-100 text-gray-600 border-gray-300",
  pro:  "bg-amber-100 text-amber-700 border-amber-400",
};

export function AdminPanel({ token, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>("users");

  // ── Users ──────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // ── Tier limits ────────────────────────────────────────────────────────────
  const [limits, setLimits] = useState<TierLimits[]>([]);
  const [loadingLimits, setLoadingLimits] = useState(true);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [limitDraft, setLimitDraft] = useState<Record<string, { chat: number; analysis: number }>>({});
  const [savingLimit, setSavingLimit] = useState<string | null>(null);
  const [limitSuccess, setLimitSuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadUsers();
    void loadLimits();
  }, []);

  async function loadUsers() {
    setLoadingUsers(true);
    setUserError(null);
    try {
      const data = await adminListUsers(token);
      setUsers(data);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Erro ao carregar usuários.");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadLimits() {
    setLoadingLimits(true);
    setLimitError(null);
    try {
      const data = await adminGetTierLimits(token);
      setLimits(data);
      const draft: Record<string, { chat: number; analysis: number }> = {};
      data.forEach((l) => { draft[l.tier] = { chat: l.daily_chat_limit, analysis: l.daily_analysis_limit }; });
      setLimitDraft(draft);
    } catch (err) {
      setLimitError(err instanceof Error ? err.message : "Erro ao carregar limites.");
    } finally {
      setLoadingLimits(false);
    }
  }

  async function handleToggleAdmin(user: AdminUser) {
    const action = user.is_admin ? "Remover privilégios de admin" : "Tornar admin";
    if (!window.confirm(`${action} de "${user.full_name}"?`)) return;
    setUpdatingUser(user.id);
    try {
      const updated = await adminUpdateUser(token, user.id, { is_admin: !user.is_admin });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Erro ao atualizar usuário.");
    } finally {
      setUpdatingUser(null);
    }
  }

  async function handleToggleActive(user: AdminUser) {
    const action = user.is_active ? "Bloquear" : "Ativar";
    if (!window.confirm(`${action} a conta de "${user.full_name}" (${user.email})?`)) return;
    setUpdatingUser(user.id);
    try {
      const updated = await adminUpdateUser(token, user.id, { is_active: !user.is_active });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Erro ao atualizar usuário.");
    } finally {
      setUpdatingUser(null);
    }
  }

  async function handleDeleteUser(userId: string) {
    setUpdatingUser(userId);
    setConfirmDelete(null);
    try {
      await adminDeleteUser(token, userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir usuário.";
      // Se já não existe no banco, apenas remove da lista local
      if (msg.toLowerCase().includes("not found") || msg.includes("404")) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        setUserError(msg);
      }
    } finally {
      setUpdatingUser(null);
    }
  }

  async function handleChangeTier(user: AdminUser, tier: string) {
    setUpdatingUser(user.id);
    try {
      const updated = await adminUpdateUser(token, user.id, { tier });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Erro ao atualizar tier.");
    } finally {
      setUpdatingUser(null);
    }
  }

  async function handleSaveLimits(e: FormEvent, tier: string) {
    e.preventDefault();
    setSavingLimit(tier);
    setLimitSuccess(null);
    setLimitError(null);
    const draft = limitDraft[tier];
    if (!draft) return;
    try {
      await adminUpdateTierLimits(token, tier, {
        daily_chat_limit: draft.chat,
        daily_analysis_limit: draft.analysis,
      });
      setLimitSuccess(`Limites do plano "${tier}" salvos com sucesso!`);
      void loadLimits();
    } catch (err) {
      setLimitError(err instanceof Error ? err.message : "Erro ao salvar limites.");
    } finally {
      setSavingLimit(null);
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-900/20 bg-panel p-6 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-2xl">🛡️</span>
        <div>
          <h2 className="text-2xl font-semibold text-ink">Painel Admin</h2>
          <p className="text-sm text-ink/60">Gerencie usuários e limites de uso por plano.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["users", "limits"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === t ? "bg-accent text-white" : "bg-emerald-900/10 text-ink hover:bg-emerald-900/15"
            }`}
          >
            {t === "users" ? "👥 Usuários" : "⚙️ Limites por Plano"}
          </button>
        ))}
      </div>

      {/* Tab: Usuários */}
      {tab === "users" && (
        <div>
          {userError && (
            <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{userError}</p>
          )}
          {loadingUsers ? (
            <p className="text-sm text-ink/50">Carregando usuários…</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-emerald-900/10">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold text-ink/50 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Nome / Email</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Plano</th>
                    <th className="px-4 py-3">Admin</th>
                    <th className="px-4 py-3">Criado em</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className={`transition ${u.is_active ? "bg-white hover:bg-gray-50" : "bg-red-50/60 hover:bg-red-50"}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{u.full_name}</p>
                        <p className="text-xs text-ink/50">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            u.is_active
                              ? "bg-emerald-100 text-emerald-700 border-emerald-400"
                              : "bg-red-100 text-red-600 border-red-300"
                          }`}
                        >
                          {u.is_active ? "Ativo" : "Bloqueado"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.tier}
                          disabled={updatingUser === u.id}
                          onChange={(e) => void handleChangeTier(u, e.target.value)}
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold appearance-none cursor-pointer focus:outline-none ${
                            TIER_BADGE[u.tier] ?? TIER_BADGE.free
                          }`}
                        >
                          {TIER_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            u.is_admin
                              ? "bg-violet-100 text-violet-700 border-violet-400"
                              : "bg-gray-100 text-gray-500 border-gray-300"
                          }`}
                        >
                          {u.is_admin ? "Sim" : "Não"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink/50">
                        {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        {confirmDelete === u.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-600 font-medium mr-1">Confirmar?</span>
                            <button
                              type="button"
                              onClick={() => void handleDeleteUser(u.id)}
                              className="rounded-lg px-2 py-1 text-xs font-semibold bg-red-600 text-white hover:bg-red-700"
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-lg px-2 py-1 text-xs font-medium bg-gray-100 text-ink hover:bg-gray-200"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              type="button"
                              disabled={updatingUser === u.id || u.id === currentUserId}
                              onClick={() => void handleToggleAdmin(u)}
                              title={u.id === currentUserId ? "Não é possível alterar seu próprio admin" : ""}
                              className={`rounded-lg px-2 py-1 text-xs font-medium transition disabled:opacity-40 ${
                                u.is_admin
                                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                                  : "bg-violet-50 text-violet-700 hover:bg-violet-100"
                              }`}
                            >
                              {updatingUser === u.id ? "…" : u.is_admin ? "- Admin" : "+ Admin"}
                            </button>
                            <button
                              type="button"
                              disabled={updatingUser === u.id || u.id === currentUserId}
                              onClick={() => void handleToggleActive(u)}
                              className={`rounded-lg px-2 py-1 text-xs font-medium transition disabled:opacity-40 ${
                                u.is_active
                                  ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {u.is_active ? "Bloquear" : "Ativar"}
                            </button>
                            <button
                              type="button"
                              disabled={updatingUser === u.id || u.id === currentUserId}
                              onClick={() => setConfirmDelete(u.id)}
                              title={u.id === currentUserId ? "Não é possível excluir sua própria conta" : ""}
                              className="rounded-lg px-2 py-1 text-xs font-medium transition disabled:opacity-40 bg-red-50 text-red-600 hover:bg-red-100"
                            >
                              Excluir
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Limites por plano */}
      {tab === "limits" && (
        <div className="space-y-6">
          {limitError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{limitError}</p>
          )}
          {limitSuccess && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{limitSuccess}</p>
          )}
          {loadingLimits ? (
            <p className="text-sm text-ink/50">Carregando limites…</p>
          ) : (
            limits.map((lim) => {
              const draft = limitDraft[lim.tier] ?? { chat: lim.daily_chat_limit, analysis: lim.daily_analysis_limit };
              return (
                <form
                  key={lim.tier}
                  onSubmit={(e) => void handleSaveLimits(e, lim.tier)}
                  className="rounded-2xl border border-emerald-900/10 bg-white p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span
                      className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${
                        TIER_BADGE[lim.tier] ?? TIER_BADGE.free
                      }`}
                    >
                      {lim.tier.charAt(0).toUpperCase() + lim.tier.slice(1)}
                    </span>
                    <span className="text-sm font-semibold text-ink">Limites diários</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-ink/60 mb-1">
                        Mensagens de chat / dia
                        <span className="ml-1 text-ink/40">(2 chamadas LLM por envio)</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        value={draft.chat}
                        onChange={(e) =>
                          setLimitDraft((prev) => ({
                            ...prev,
                            [lim.tier]: { ...draft, chat: Number(e.target.value) },
                          }))
                        }
                        className="w-full rounded-xl border border-amber-800/20 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink/60 mb-1">
                        Análises / dia
                        <span className="ml-1 text-ink/40">(🔬 por mensagem)</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        value={draft.analysis}
                        onChange={(e) =>
                          setLimitDraft((prev) => ({
                            ...prev,
                            [lim.tier]: { ...draft, analysis: Number(e.target.value) },
                          }))
                        }
                        className="w-full rounded-xl border border-amber-800/20 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={savingLimit === lim.tier}
                    className="mt-4 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {savingLimit === lim.tier ? "Salvando…" : "Salvar"}
                  </button>
                </form>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
