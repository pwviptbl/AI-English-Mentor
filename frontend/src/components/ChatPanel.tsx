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

function friendlyError(raw: string): { icon: string; title: string; detail: string } {
  const r = raw.toLowerCase();
  if (r.includes("429") || r.includes("quota") || r.includes("rate"))
    return { icon: "⏳", title: "Limite de requisições atingido", detail: "Sua cota será redefinida 24 horas após sua primeira mensagem de hoje." };
  if (r.includes("403") || r.includes("pending activation"))
    return { icon: "🔒", title: "Conta não ativada", detail: "Sua conta aguarda ativação pelo administrador." };
  if (r.includes("401") || r.includes("sessão expirada") || r.includes("expirada"))
    return { icon: "🔐", title: "Sessão expirada", detail: "Faça login novamente para continuar." };
  if (r.includes("limit") || r.includes("limite diario") || r.includes("daily"))
    return { icon: "📊", title: "Limite diário atingido", detail: "Você atingiu o limite de mensagens do seu plano hoje." };
  if (r.includes("network") || r.includes("conectar") || r.includes("backend"))
    return { icon: "📵", title: "Sem conexão", detail: "Não foi possível conectar ao servidor. Verifique sua conexão." };
  if (r.includes("500") || r.includes("server error"))
    return { icon: "⚠️", title: "Erro interno", detail: "Ocorreu um erro no servidor. Tente novamente em instantes." };
  return { icon: "⚠️", title: "Algo deu errado", detail: raw };
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
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [speechRate, setSpeechRate] = useState(0.8); // Velocidade da fala (0.5 = lento, 1.0 = normal, 1.5 = rápido)

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
    utterance.rate = speechRate;
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
    setAnalysisError(null);
    setAnalysisOpen(true);
    setAnalysisLoading(true);
    try {
      const data = await analyzeMessage(token, messageId);
      setAnalysisData(data);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Analysis failed");
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
      {error && (() => {
        const { icon, title, detail } = friendlyError(error);
        return (
          <div className="mx-3 mb-2 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-lg leading-none mt-0.5">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-700">{title}</p>
              <p className="text-xs text-red-500 mt-0.5">{detail}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0"
              aria-label="Fechar erro"
            >
              ×
            </button>
          </div>
        );
      })()}

      {/* Formulário de input */}
      <form
        onSubmit={handleSend}
        className="border-t border-amber-800/10 bg-white rounded-t-2xl px-4 pt-2 pb-3 flex flex-col gap-2"
      >
        {/* Linha 1 — ferramentas de saída (modo + velocidade da fala) */}
        <div className="flex items-center gap-2">
          {/* Botão de modo: stream / sync */}
          <button
            type="button"
            title={useStream ? "Modo streaming (SSE)" : "Modo síncrono"}
            className="text-xs rounded px-2 py-1 border border-gray-200 text-ink/50 hover:border-accent transition"
            onClick={() => setUseStream(!useStream)}
          >
            {useStream ? "⚡" : "📦"}
          </button>

          {/* Controle de velocidade da fala */}
          <div className="flex items-center gap-1.5 border border-gray-200 rounded px-2 py-1" title="Velocidade da fala">
            <span className="text-xs text-ink/50">🔊</span>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={speechRate}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
              className="w-20 h-1 accent-accent"
              title={`Velocidade: ${speechRate.toFixed(1)}x`}
            />
            <span className="text-[10px] text-ink/50 w-7">{speechRate.toFixed(1)}x</span>
          </div>
        </div>

        {/* Linha 2 — ferramentas de entrada (voz + texto + enviar) */}
        <div className="flex gap-2 items-center">
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
        </div>
      </form>

      {/* Modal de análise */}
      <AnalysisModal
        open={analysisOpen}
        analysis={analysisData}
        loading={analysisLoading}
        error={analysisError}
        onClose={() => { setAnalysisOpen(false); setAnalysisError(null); }}
        onAddToken={handleAddToken}
        onLookupToken={handleLookup}
      />
    </div>
  );
}
