"use client";

import { FormEvent, useMemo, useState } from "react";

import { addFlashcard, analyzeMessage, lookupDictionaryWord, sendChat } from "@/lib/api";
import type { AnalysisResponse, Message, TokenInfo } from "@/lib/types";
import { useMentorStore } from "@/store/useMentorStore";

import { AnalysisModal } from "./AnalysisModal";

type Props = {
  token: string;
  sessionId: string | null;
  messages: Message[];
  reloadMessages: (sessionId: string) => Promise<void>;
};

export function ChatPanel({ token, sessionId, messages, reloadMessages }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState(0.8);

  const appendMessages = useMentorStore((state) => state.appendMessages);

  const activeMessages = useMemo(() => messages, [messages]);

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!sessionId || !text.trim()) return;

    setSending(true);
    setError(null);

    try {
      const response = await sendChat(token, sessionId, text.trim());

      appendMessages(sessionId, [
        {
          id: response.user_message_id,
          role: "user",
          content_raw: text.trim(),
          content_corrected: response.corrected_text,
          content_final: response.corrected_text,
          provider: response.correction_meta.provider,
          model: response.correction_meta.model,
          created_at: new Date().toISOString(),
        },
        {
          id: response.assistant_message_id,
          role: "assistant",
          content_raw: null,
          content_corrected: null,
          content_final: response.assistant_reply,
          provider: response.provider_used,
          model: response.model_used,
          created_at: new Date().toISOString(),
        },
      ]);
      setText("");
      await reloadMessages(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function openAnalysis(messageId: string) {
    setAnalysisOpen(true);
    setAnalysisLoading(true);
    setAnalysis(null);
    try {
      const response = await analyzeMessage(token, messageId);
      setAnalysis(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze message");
      setAnalysisOpen(false);
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function addTokenToDeck(tokenInfo: {
    token: string;
    lemma: string | null;
    pos: string | null;
    translation: string | null;
    definition: string | null;
  }, sentence: string) {
    await addFlashcard(token, {
      word: tokenInfo.token,
      lemma: tokenInfo.lemma,
      pos: tokenInfo.pos,
      translation: tokenInfo.translation,
      definition: tokenInfo.definition,
      context_sentence: sentence,
    });
  }

  async function lookupToken(word: string): Promise<TokenInfo> {
    return lookupDictionaryWord(token, word);
  }

  function speak(textToSpeak: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "en-US";
    utterance.rate = speechRate;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <section className="rounded-2xl border border-emerald-900/20 bg-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Conversation</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink/60" htmlFor="speech-rate">
            Voice speed
          </label>
          <select
            id="speech-rate"
            className="rounded-md border border-emerald-900/20 bg-white px-2 py-1 text-xs"
            value={speechRate}
            onChange={(event) => setSpeechRate(Number(event.target.value))}
          >
            <option value={0.7}>Slow</option>
            <option value={0.8}>Study</option>
            <option value={1}>Normal</option>
          </select>
          {sessionId ? <span className="text-xs text-ink/50">Session active</span> : null}
        </div>
      </div>

      <div className="mt-3 h-[420px] overflow-y-auto rounded-xl border border-emerald-900/10 bg-white p-3">
        {activeMessages.length === 0 ? (
          <p className="text-sm text-ink/60">Start sending a message to begin.</p>
        ) : (
          <ul className="space-y-3">
            {activeMessages.map((message) => (
              <li key={message.id} className="animate-rise">
                <div
                  className={`rounded-xl border p-3 ${
                    message.role === "assistant"
                      ? "border-emerald-900/15 bg-emerald-50"
                      : "border-amber-900/15 bg-amber-50"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-ink/60">
                    <span>{message.role}</span>
                    <span>{new Date(message.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{message.content_final}</p>
                  <div className="mt-3 flex gap-2">
                    {message.role === "assistant" ? (
                      <button
                        className="rounded-md bg-accent px-2 py-1 text-xs text-white"
                        onClick={() => openAnalysis(message.id)}
                      >
                        Analyze
                      </button>
                    ) : null}
                    <button
                      className="rounded-md bg-emerald-900/10 px-2 py-1 text-xs"
                      onClick={() => speak(message.content_final)}
                    >
                      Speak
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={onSend} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className="flex-1 rounded-xl border border-emerald-900/20 bg-white px-3 py-2"
          placeholder="Write in PT/EN/mixed..."
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={!sessionId || sending}
          required
        />
        <button
          className="rounded-xl bg-ember px-4 py-2 font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={!sessionId || sending}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      <AnalysisModal
        open={analysisOpen}
        analysis={analysis}
        loading={analysisLoading}
        onClose={() => setAnalysisOpen(false)}
        onAddToken={addTokenToDeck}
        onLookupToken={lookupToken}
      />
    </section>
  );
}
