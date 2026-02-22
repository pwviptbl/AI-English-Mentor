"use client";

import { FormEvent, useRef, useState } from "react";

import { addFlashcard, analyzeMessage, lookupDictionaryWord, sendChat, sendChatStream } from "@/lib/api";
import type { AnalysisResponse, CorrectionMeta, Message, TokenInfo } from "@/lib/types";

import { AnalysisModal } from "./AnalysisModal";
import { VoiceInput } from "./VoiceInput";

type Props = {
  token: string;
  sessionId: string | null;
  messages: Message[];
  reloadMessages: (sessionId: string) => Promise<void>;
};

// Badge de categoria de correção (ex: "tempo verbal", "preposição")
const CATEGORY_COLORS: Record<string, string> = {
  "tempo verbal": "#e53e3e",
  "preposição": "#d69e2e",
  "ortografia": "#3182ce",
  "vocabulário": "#805ad5",
  "gramática": "#dd6b20",
  "pronominal": "#38a169",
};

function CategoryBadges({ categories }: { categories: string[] }) {
  if (!categories || categories.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
      {categories.map((cat) => (
        <span
          key={cat}
          style={{
            backgroundColor: (CATEGORY_COLORS[cat] ?? "#718096") + "22",
            color: CATEGORY_COLORS[cat] ?? "#718096",
            border: `1px solid ${(CATEGORY_COLORS[cat] ?? "#718096")}55`,
            borderRadius: 12,
            padding: "1px 8px",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {cat}
        </span>
      ))}
    </div>
  );
}

export function ChatPanel({ token, sessionId, messages, reloadMessages }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [useStream, setUseStream] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [correctionMeta, setCorrectionMeta] = useState<(CorrectionMeta & { corrected_text?: string }) | null>(null);

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);
  const [analysisMessageId, setAnalysisMessageId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);


  // Todas as mensagens já vêm filtradas pela sessão ativa via props
  const sessionMessages = messages;

  function scrollToBottom() {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || !sessionId || loading) return;

    setInput("");
    setError(null);
    setCorrectionMeta(null);
    setLoading(true);
    setStreamingText("");

    try {
      if (useStream) {
        // ── Modo SSE streaming ──────────────────────────────────────
        let accumulated = "";

        await sendChatStream(
          token,
          sessionId,
          text,
          (chunk) => {
            accumulated += chunk;
            setStreamingText(accumulated);
            scrollToBottom();
          },
          (meta) => {
            setCorrectionMeta({
              changed: meta.changed,
              notes: meta.notes,
              categories: meta.categories,
              provider: meta.provider,
              model: meta.model,
              corrected_text: meta.corrected_text,
            });
          },
        );

        setStreamingText("");
        await reloadMessages(sessionId);
        scrollToBottom();
      } else {
        // ── Modo síncrono (fallback) ─────────────────────────────────
        const response = await sendChat(token, sessionId, text);
        setCorrectionMeta({
          ...response.correction_meta,
          corrected_text: response.corrected_text,
        });
        await reloadMessages(sessionId);
        speak(response.assistant_reply);
        scrollToBottom();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze(messageId: string) {
    if (analysisLoading) return;
    setAnalysisMessageId(messageId);
    setAnalysisData(null);
    setAnalysisOpen(true);
    setAnalysisLoading(true);
    try {
      const data = await analyzeMessage(token, messageId);
      setAnalysisData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setAnalysisOpen(false);
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function handleAddToken(tokenItem: TokenInfo, sentence: string) {
    await addFlashcard(token, {
      word: tokenItem.token,
      lemma: tokenItem.lemma,
      pos: tokenItem.pos,
      translation: tokenItem.translation,
      definition: tokenItem.definition,
      context_sentence: sentence,
    });
  }

  async function handleLookup(word: string): Promise<TokenInfo> {
    return lookupDictionaryWord(token, word);
  }

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center text-ink/40">
        Selecione ou crie uma conversa para começar.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {sessionMessages.map((m) => {
          const isUser = m.role === "user";
          const corrected = m.content_corrected;
          const wasChanged = corrected && corrected !== m.content_raw;
          const msgMeta = m.meta_json;

          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${isUser ? "bg-accent text-white" : "bg-white border border-amber-800/15"
                  }`}
              >
                <p>{isUser ? m.content_raw : m.content_final}</p>

                {/* Correção inline + categorias de erro */}
                {isUser && wasChanged && (
                  <div className="mt-1.5">
                    <p className="text-[11px] opacity-80">
                      ✏️ <em>{corrected}</em>
                    </p>
                    {msgMeta?.categories && msgMeta.categories.length > 0 && (
                      <CategoryBadges categories={msgMeta.categories} />
                    )}
                    {msgMeta?.notes && (
                      <p className="mt-1 text-[11px] opacity-70">💡 {msgMeta.notes}</p>
                    )}
                  </div>
                )}

                {/* Botões de ação na mensagem */}
                <div className="mt-2 flex items-center gap-2">
                  {!isUser && (
                    <button
                      className="text-xs opacity-60 hover:opacity-100"
                      onClick={() => speak(m.content_final)}
                      type="button"
                      title="Ouvir"
                    >
                      🔊
                    </button>
                  )}
                  <button
                    className="text-xs opacity-60 hover:opacity-100"
                    onClick={() => handleAnalyze(m.id)}
                    type="button"
                    title="Analisar sentença"
                  >
                    🔬
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming em tempo real */}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl bg-white border border-amber-800/15 px-4 py-3 text-sm">
              <p>{streamingText}<span className="animate-pulse">▌</span></p>
            </div>
          </div>
        )}

        {/* Correção exibida enquanto aguarda reply */}
        {loading && correctionMeta && correctionMeta.changed && (
          <div className="text-xs text-center text-ink/50">
            ✏️ <em>{correctionMeta.corrected_text}</em>
            {correctionMeta.categories && <CategoryBadges categories={correctionMeta.categories} />}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Erros */}
      {error && <p className="px-4 py-1 text-sm text-red-600">{error}</p>}

      {/* Formulário de input */}
      <form
        onSubmit={handleSend}
        className="border-t border-amber-800/10 bg-white px-4 py-3 flex gap-2 items-center"
      >
        {/* Botão de modo: stream / sync */}
        <button
          type="button"
          title={useStream ? "Modo streaming (SSE)" : "Modo síncrono"}
          className="text-xs rounded px-2 py-1 border border-gray-200 text-ink/50 hover:border-accent transition"
          onClick={() => setUseStream(!useStream)}
        >
          {useStream ? "⚡" : "📦"}
        </button>

        {/* Input de voz */}
        <VoiceInput
          onTranscript={(text) => setInput((prev) => prev ? prev + " " + text : text)}
          disabled={loading}
        />

        <input
          className="flex-1 rounded-xl border border-amber-800/20 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-accent"
          placeholder="Type in English (or Portuguese)…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend(e as unknown as FormEvent);
            }
          }}
        />

        <button
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          type="submit"
          disabled={loading || !input.trim()}
        >
          {loading ? "…" : "Enviar"}
        </button>
      </form>

      {/* Modal de análise */}
      <AnalysisModal
        open={analysisOpen}
        analysis={analysisData}
        loading={analysisLoading}
        onClose={() => setAnalysisOpen(false)}
        onAddToken={handleAddToken}
        onLookupToken={handleLookup}
      />
    </div>
  );
}
