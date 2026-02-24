"use client";

import { FormEvent, useState } from "react";

import { login, me, register } from "@/lib/api";
import { useMentorStore } from "@/store/useMentorStore";

export function AuthPanel() {
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const setAuth = useMentorStore((state) => state.setAuth);
  const setCurrentUser = useMentorStore((state) => state.setCurrentUser);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await register(fullName.trim(), email, password);
        setRegistered(true);
        setLoading(false);
        return;
      }
      const tokens = await login(email, password);
      setAuth(tokens.access_token, tokens.refresh_token);
      const profile = await me(tokens.access_token);
      setCurrentUser(profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md animate-rise rounded-2xl border border-emerald-800/20 bg-panel p-6 shadow-[0_14px_32px_rgba(0,0,0,0.08)]">
      <h1 className="text-2xl font-semibold text-ink">AI English Mentor</h1>
      <p className="mt-1 text-sm text-ink/70">Login to start correction-first conversation training.</p>

      {registered ? (
        <div className="mt-5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-4 text-sm text-emerald-800">
          <p className="font-semibold mb-1">✅ Conta criada com sucesso!</p>
          <p>Sua conta está aguardando ativação pelo administrador. Você receberá acesso em breve.</p>
          <button
            type="button"
            className="mt-3 text-xs text-emerald-700 underline"
            onClick={() => { setRegistered(false); setIsRegister(false); }}
          >
            Voltar ao login
          </button>
        </div>
      ) : (
        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          {isRegister ? (
            <input
              className="w-full rounded-xl border border-emerald-900/20 bg-white px-3 py-2 outline-none focus:border-accent"
              placeholder="Full name"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              minLength={2}
              maxLength={120}
            />
          ) : null}
          <input
            className="w-full rounded-xl border border-emerald-900/20 bg-white px-3 py-2 outline-none focus:border-accent"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-emerald-900/20 bg-white px-3 py-2 outline-none focus:border-accent"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />

          <button
            type="submit"
            className="w-full rounded-xl bg-accent px-4 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Processing..." : isRegister ? "Create Account" : "Login"}
          </button>
        </form>
      )}

      {error ? <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      {!registered && (
        <button
          type="button"
          className="mt-4 text-sm font-medium text-ember underline"
          onClick={() => setIsRegister((value) => !value)}
        >
          {isRegister ? "Already have account? Login" : "Need account? Register"}
        </button>
      )}
    </section>
  );
}
