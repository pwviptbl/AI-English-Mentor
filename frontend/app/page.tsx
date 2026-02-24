"use client";

import { useEffect, useMemo, useState } from "react";

import { AuthPanel } from "@/components/AuthPanel";
import { AppHomePanel } from "@/components/AppHomePanel";
import { AdminPanel } from "@/components/AdminPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { ConversationsPanel } from "@/components/ConversationsPanel";
import { NewConversationPanel } from "@/components/NewConversationPanel";
import { ProfilePanel } from "@/components/ProfilePanel";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { ReviewPanel } from "@/components/ReviewPanel";
import { ShadowingPanel } from "@/components/ShadowingPanel";
import { deleteSession, listMessages, listSessions, me } from "@/lib/api";
import { useMentorStore } from "@/store/useMentorStore";

type AppScreen = "home" | "conversations" | "new-conversation" | "review" | "chat" | "progress" | "shadowing" | "profile" | "admin";

export default function HomePage() {
  const {
    accessToken,
    currentUser,
    sessions,
    activeSessionId,
    messagesBySession,
    setCurrentUser,
    logout,
    setSessions,
    setActiveSessionId,
    setMessages,
    removeSession,
  } = useMentorStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<AppScreen>("home");
  const [menuOpen, setMenuOpen] = useState(false);

  async function reloadProfileAndSessions() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [profile, sessionList] = await Promise.all([me(accessToken), listSessions(accessToken)]);
      setCurrentUser(profile);
      setSessions(sessionList);
      if (!activeSessionId && sessionList[0]) {
        setActiveSessionId(sessionList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      logout();
    } finally {
      setLoading(false);
    }
  }

  async function reloadSessions() {
    if (!accessToken) return;
    const sessionList = await listSessions(accessToken);
    setSessions(sessionList);
  }

  async function reloadMessages(sessionId: string) {
    if (!accessToken) return;
    const msgs = await listMessages(accessToken, sessionId);
    setMessages(sessionId, msgs);
  }

  async function openSessionChat(sessionId: string) {
    setActiveSessionId(sessionId);
    await reloadMessages(sessionId);
    setScreen("chat");
  }

  async function onSessionCreated(sessionId: string) {
    await reloadSessions();
    await openSessionChat(sessionId);
  }

  async function handleDeleteSession(sessionId: string) {
    if (!accessToken) return;
    await deleteSession(accessToken, sessionId);
    removeSession(sessionId);
  }

  useEffect(() => {
    if (accessToken) {
      reloadProfileAndSessions();
    }
  }, [accessToken]);

  const activeMessages = useMemo(() => {
    if (!activeSessionId) return [];
    return messagesBySession[activeSessionId] || [];
  }, [activeSessionId, messagesBySession]);

  const activeSessionTopic = useMemo(() => {
    if (!activeSessionId) return null;
    const active = sessions.find((session) => session.id === activeSessionId);
    return active?.topic || null;
  }, [activeSessionId, sessions]);

  if (!accessToken || !currentUser) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 sm:p-8">
        <div className="w-full">
          <AuthPanel />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* ── Top Bar (fixo, compacto) ── */}
        <header className="rounded-2xl border border-emerald-900/20 bg-panel shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between p-3 sm:p-4">
            <h1 className="text-lg font-bold sm:text-2xl">AI English Mentor</h1>

            {/* Nav desktop (hidden em mobile) */}
            <nav className="hidden items-center gap-1.5 md:flex">
              {([
                ["home", "Início"],
                ["conversations", "Conversas"],
                ["new-conversation", "Nova conversa"],
                ["review", "Revisão"],
                ["progress", "📊 Progresso"],
                ["shadowing", "🔁 Shadowing"],
                ["profile", "👤 Perfil"],
                ...(currentUser.is_admin ? [["admin", "🛡️ Admin"]] as const : []),
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${screen === key ? "bg-accent text-white" : "bg-emerald-900/10 text-ink hover:bg-emerald-900/15"
                    }`}
                  type="button"
                  onClick={() => setScreen(key as AppScreen)}
                >
                  {label}
                </button>
              ))}
              <button
                className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white"
                type="button"
                onClick={logout}
              >
                Logout
              </button>
            </nav>

            {/* Botão hambúrguer (mobile only) */}
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-900/10 transition hover:bg-emerald-900/20 md:hidden"
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              {menuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>

          {/* Painel slide-down (mobile) */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out md:hidden ${menuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
              }`}
          >
            <div className="border-t border-emerald-900/10 p-4">
              {/* Info do usuário */}
              <div className="mb-4 rounded-xl bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-ink">{currentUser.full_name}</p>
                <p className="text-xs text-ink/50">{currentUser.email}</p>
              </div>

              {/* Links de navegação */}
              <nav className="flex flex-col gap-1.5">
                {([
                  ["home", "🏠", "Início"],
                  ["conversations", "💬", "Conversas"],
                  ["new-conversation", "✨", "Nova conversa"],
                  ["review", "📝", "Revisão"],
                  ["progress", "📊", "Progresso"],
                  ["shadowing", "🔁", "Shadowing"],                ["profile", "👤", "Meu Perfil"],
                ...(currentUser.is_admin ? [["admin", "🛡️", "Admin"]] as const : []),                ] as const).map(([key, icon, label]) => (
                  <button
                    key={key}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${screen === key
                      ? "bg-accent text-white"
                      : "text-ink hover:bg-emerald-900/8"
                      }`}
                    type="button"
                    onClick={() => {
                      setScreen(key as AppScreen);
                      setMenuOpen(false);
                    }}
                  >
                    <span className="text-base">{icon}</span>
                    {label}
                  </button>
                ))}
                <div className="my-1.5 border-t border-emerald-900/10" />
                <button
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition"
                  type="button"
                  onClick={logout}
                >
                  <span className="text-base">🚪</span>
                  Sair
                </button>
              </nav>
            </div>
          </div>
        </header>

        {loading ? <p className="text-sm">Loading workspace...</p> : null}
        {error ? <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

        {screen === "home" ? (
          <AppHomePanel
            currentUser={currentUser}
            hasActiveConversation={Boolean(activeSessionId)}
            onOpenConversations={() => setScreen("conversations")}
            onOpenNewConversation={() => setScreen("new-conversation")}
            onOpenReview={() => setScreen("review")}
            onOpenProfile={() => setScreen("profile")}
            onOpenAdmin={() => setScreen("admin")}
          />
        ) : null}

        {screen === "conversations" ? (
          <ConversationsPanel
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={openSessionChat}
            onDeleteSession={handleDeleteSession}
            onGoToActiveConversation={() => setScreen("chat")}
            onOpenNewConversation={() => setScreen("new-conversation")}
          />
        ) : null}

        {screen === "new-conversation" ? (
          <NewConversationPanel token={accessToken} onSessionCreated={onSessionCreated} />
        ) : null}

        {screen === "review" ? (
          <div className="space-y-3">
            {activeSessionId ? (
              <button
                className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white"
                type="button"
                onClick={() => setScreen("chat")}
              >
                Voltar para conversa ativa
              </button>
            ) : null}
            <ReviewPanel token={accessToken} />
          </div>
        ) : null}

        {screen === "chat" ? (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-900/20 bg-panel p-3">
              <button
                className="rounded-xl bg-emerald-900/10 px-3 py-2 text-sm font-medium text-ink"
                type="button"
                onClick={() => setScreen("conversations")}
              >
                Ver conversas
              </button>
              <button
                className="rounded-xl bg-ember px-3 py-2 text-sm font-medium text-white"
                type="button"
                onClick={() => setScreen("new-conversation")}
              >
                Nova conversa
              </button>
              <button
                className="rounded-xl bg-sky-700 px-3 py-2 text-sm font-medium text-white"
                type="button"
                onClick={() => setScreen("review")}
              >
                Ir para revisão
              </button>
              <p className="text-sm text-ink/65">
                {activeSessionTopic ? `Sessão atual: ${activeSessionTopic}` : "Nenhuma sessão ativa"}
              </p>
            </div>

            {activeSessionId ? (
              <ChatPanel
                token={accessToken}
                sessionId={activeSessionId}
                messages={activeMessages}
                reloadMessages={reloadMessages}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-emerald-900/25 bg-panel p-8 text-center">
                <p className="text-sm text-ink/70">
                  Nenhuma conversa ativa. Crie uma nova sessão para começar.
                </p>
                <button
                  className="mt-3 rounded-xl bg-ember px-4 py-2 text-sm font-medium text-white"
                  type="button"
                  onClick={() => setScreen("new-conversation")}
                >
                  Criar nova conversa
                </button>
              </div>
            )}
          </section>
        ) : null}
        {screen === "progress" ? (
          <ProgressDashboard token={accessToken} />
        ) : null}

        {screen === "shadowing" ? (
          <ShadowingPanel token={accessToken} sessionMessages={activeMessages} />
        ) : null}

        {screen === "profile" ? (
          <ProfilePanel
            token={accessToken}
            currentUser={currentUser}
            onUserUpdated={(updated) => setCurrentUser(updated)}
          />
        ) : null}

        {screen === "admin" && currentUser.is_admin ? (
          <AdminPanel token={accessToken} currentUserId={currentUser.id} />
        ) : null}
      </div>
    </main>
  );
}
