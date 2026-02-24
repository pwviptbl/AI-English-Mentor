"use client";

import { FormEvent, useState } from "react";
import { updateProfile } from "@/lib/api";
import type { User } from "@/lib/types";

type Props = {
  token: string;
  currentUser: User;
  onUserUpdated: (user: User) => void;
};

const TIER_LABEL: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "bg-gray-100 text-gray-600 border-gray-300" },
  pro:  { label: "Pro ✨", color: "bg-amber-100 text-amber-700 border-amber-400" },
};

export function ProfilePanel({ token, currentUser, onUserUpdated }: Props) {
  const [fullName, setFullName] = useState(currentUser.full_name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tier = TIER_LABEL[currentUser.tier] ?? TIER_LABEL.free;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const payload: { full_name?: string; current_password?: string; new_password?: string } = {};

    if (fullName.trim() !== currentUser.full_name) {
      payload.full_name = fullName.trim();
    }

    if (newPassword) {
      if (newPassword !== confirmPassword) {
        setError("As senhas não coincidem.");
        return;
      }
      if (newPassword.length < 8) {
        setError("A nova senha precisa ter ao menos 8 caracteres.");
        return;
      }
      payload.current_password = currentPassword;
      payload.new_password = newPassword;
    }

    if (!Object.keys(payload).length) {
      setError("Nenhuma alteração detectada.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile(token, payload);
      onUserUpdated(updated);
      setSuccess("Perfil atualizado com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-900/20 bg-panel p-6 shadow-[0_20px_45px_rgba(0,0,0,0.08)] max-w-lg mx-auto">
      <h2 className="text-2xl font-semibold text-ink mb-1">Meu Perfil</h2>
      <p className="text-sm text-ink/60 mb-6">Gerencie suas informações pessoais e senha.</p>

      {/* Tipo de conta */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm text-ink/70">Plano:</span>
        <span className={`inline-block rounded-full border px-3 py-0.5 text-xs font-semibold ${tier.color}`}>
          {tier.label}
        </span>
        {currentUser.is_admin && (
          <span className="inline-block rounded-full border border-violet-400 bg-violet-100 px-3 py-0.5 text-xs font-semibold text-violet-700">
            Admin 🛡️
          </span>
        )}
      </div>

      {/* Info estática */}
      <div className="mb-6 rounded-xl bg-gray-50 px-4 py-3 text-sm">
        <p className="text-ink/50 mb-1">E-mail</p>
        <p className="font-medium text-ink">{currentUser.email}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Nome completo</label>
          <input
            className="w-full rounded-xl border border-amber-800/20 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-accent"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            minLength={2}
            maxLength={120}
            required
          />
        </div>

        <hr className="border-gray-100" />
        <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">Alterar senha (opcional)</p>

        {/* Senha atual */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Senha atual</label>
          <input
            type="password"
            className="w-full rounded-xl border border-amber-800/20 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-accent"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Deixe em branco para não alterar"
            autoComplete="current-password"
          />
        </div>

        {/* Nova senha */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Nova senha</label>
          <input
            type="password"
            className="w-full rounded-xl border border-amber-800/20 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-accent"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
          />
        </div>

        {/* Confirmar senha */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Confirmar nova senha</label>
          <input
            type="password"
            className="w-full rounded-xl border border-amber-800/20 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-accent"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
          />
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {success && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-accent py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
      </form>
    </section>
  );
}
