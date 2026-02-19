"use client";

import { useEffect, useMemo, useState } from "react";

import { AuthPanel } from "@/components/AuthPanel";
import { AppHomePanel } from "@/components/AppHomePanel";
import { ChatPanel } from "@/components/ChatPanel";
import { ConversationsPanel } from "@/components/ConversationsPanel";
import { NewConversationPanel } from "@/components/NewConversationPanel";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { ReviewPanel } from "@/components/ReviewPanel";
import { ShadowingPanel } from "@/components/ShadowingPanel";
import { listMessages, listSessions, me } from "@/lib/api";
import { useMentorStore } from "@/store/useMentorStore";

type AppScreen = "home" | "conversations" | "new-conversation" | "review" | "chat" | "progress" | "shadowing";

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
  } = useMentorStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<AppScreen>("home");

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
      <main className="min-h-screen p-4 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <AuthPanel />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl border border-emerald-900/20 bg-panel p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">AI English Mentor</h1>
              <p className="text-sm text-ink/65">
                {currentUser.full_name} ({currentUser.email}) | provider: {currentUser.preferred_ai_provider}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={`rounded-xl px-3 py-2 text-sm font-medium ${screen === "home" ? "bg-accent text-white" : "bg-emerald-900/10 text-ink"
                  }`}
                type="button"
                onClick={() => setScreen("home")}
              >
                Início
              </button>
              <button
                className={`rounded-xl px-3 py-2 text-sm font-medium ${screen === "conversations" ? "bg-accent text-white" : "bg-emerald-900/10 text-ink"
                  }`}
                type="button"
                onClick={() => setScreen("conversations")}
              >
                Conversas
              </button>
              <button
                className={`rounded-xl px-3 py-2 text-sm font-medium ${screen === "new-conversation" ? "bg-accent text-white" : "bg-emerald-900/10 text-ink"
                  }`}
                type="button"
                onClick={() => setScreen("new-conversation")}
              >
                Nova conversa
              </button>
              <button
                className={`rounded-xl px-3 py-2 text-sm font-medium ${screen === "review" ? "bg-accent text-white" : "bg-emerald-900/10 text-ink"
                  }`}
                type="button"
                onClick={() => setScreen("review")}
              >
                Revisão
              </button>
              <button
                className={`rounded-xl px-3 py-2 text-sm font-medium ${screen === "progress" ? "bg-accent text-white" : "bg-emerald-900/10 text-ink"
                  }`}
                type="button"
                onClick={() => setScreen("progress")}
              >
                📊 Progresso
              </button>
              <button
                className={`rounded-xl px-3 py-2 text-sm font-medium ${screen === "shadowing" ? "bg-accent text-white" : "bg-emerald-900/10 text-ink"
                  }`}
                type="button"
                onClick={() => setScreen("shadowing")}
              >
                🔁 Shadowing
              </button>
              <button className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white" onClick={logout}>
                Logout
              </button>
            </div>
          </div>
        </header>

        {loading ? <p className="text-sm">Loading workspace...</p> : null}
        {error ? <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

        {screen === "home" ? (
          <AppHomePanel
            hasActiveConversation={Boolean(activeSessionId)}
            onOpenConversations={() => setScreen("conversations")}
            onOpenNewConversation={() => setScreen("new-conversation")}
            onOpenReview={() => setScreen("review")}
          />
        ) : null}

        {screen === "conversations" ? (
          <ConversationsPanel
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={openSessionChat}
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
      </div>
    </main>
  );
}
