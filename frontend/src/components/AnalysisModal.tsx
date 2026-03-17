"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { AnalysisResponse, TokenInfo } from "@/lib/types";

type Props = {
  open: boolean;
  analysis: AnalysisResponse | null;
  loading: boolean;
  error?: string | null;
  title?: string;
  description?: string;
  sourceLabel?: string;
  sourceTextEmptyHint?: string;
  onClose: () => void;
  onAddToken: (token: TokenInfo, sourceText: string) => Promise<void>;
  onLookupToken?: (word: string) => Promise<TokenInfo>;
};

type SelectedToken = {
  clickedWord: string;
  token: TokenInfo;
};

const WORD_REGEX = /^[A-Za-z][A-Za-z'-]*$/;

function isWord(part: string): boolean {
  return WORD_REGEX.test(part);
}

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "").replace(/[^a-z']/g, "");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AnalysisModal({
  open,
  analysis,
  loading,
  error,
  title = "Sentence Analysis",
  description = "Click one word to inspect and add to deck.",
  sourceLabel = "Original (EN)",
  sourceTextEmptyHint = "Click a word in the English text to see translation and add it to your deck.",
  onClose,
  onAddToken,
  onLookupToken,
}: Props) {
  const [selected, setSelected] = useState<SelectedToken | null>(null);
  const [adding, setAdding] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [deckFeedback, setDeckFeedback] = useState<{ type: "success" | "warning" | "error"; text: string } | null>(
    null,
  );
  const [wordInDeck, setWordInDeck] = useState(false);
  const [isFullTranslationOpen, setIsFullTranslationOpen] = useState(false);
  const addInFlightRef = useRef(false);

  useEffect(() => {
    setSelected(null);
    setLookupLoading(false);
    setLookupError(null);
    setDeckFeedback(null);
    setWordInDeck(false);
    setIsFullTranslationOpen(false);
  }, [analysis?.original_en, open]);

  const textParts = useMemo(() => {
    if (!analysis?.original_en) return [];
    return analysis.original_en.match(/([A-Za-z][A-Za-z'-]*|[^A-Za-z]+)/g) || [analysis.original_en];
  }, [analysis?.original_en]);

  const tokenLookup = useMemo(() => {
    const map = new Map<string, TokenInfo>();
    if (!analysis) return map;

    for (const token of analysis.tokens) {
      const key = normalizeWord(token.token);
      if (key && !map.has(key)) {
        map.set(key, token);
      }
    }

    return map;
  }, [analysis]);

  async function handleWordClick(word: string) {
    const key = normalizeWord(word);
    if (!key) return;

    const token =
      tokenLookup.get(key) ||
      ({
        token: word,
        lemma: null,
        pos: null,
        translation: null,
        definition: null,
      } satisfies TokenInfo);

    setLookupError(null);
    setDeckFeedback(null);
    setWordInDeck(false);
    setSelected({ clickedWord: word, token });

    const needsLookup = !token.translation;
    if (!needsLookup || !onLookupToken) {
      return;
    }

    setLookupLoading(true);
    try {
      const lookedUp = await onLookupToken(word);
      setSelected((prev) => {
        if (!prev || normalizeWord(prev.clickedWord) !== key) {
          return prev;
        }
        return {
          ...prev,
          token: {
            token: prev.clickedWord,
            lemma: lookedUp.lemma,
            pos: lookedUp.pos,
            translation: lookedUp.translation,
            definition: lookedUp.definition,
          },
        };
      });
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Dictionary lookup failed");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleAddToDeck() {
    if (!analysis || !selected || adding || wordInDeck || lookupLoading || addInFlightRef.current) return;
    addInFlightRef.current = true;
    const tokenForDeck: TokenInfo = {
      ...selected.token,
      token: selected.clickedWord,
    };

    setAdding(true);
    try {
      try {
        await onAddToken(tokenForDeck, analysis.original_en);
      } catch (err) {
        const message = err instanceof Error ? err.message.toLowerCase() : "";
        if (message.includes("nao foi possivel conectar ao backend")) {
          await wait(700);
          await onAddToken(tokenForDeck, analysis.original_en);
        } else {
          throw err;
        }
      }
      setDeckFeedback({ type: "success", text: `\"${selected.clickedWord}\" added to deck.` });
      setWordInDeck(true);
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : "";
      if (message.includes("already in deck")) {
        setDeckFeedback({ type: "warning", text: `\"${selected.clickedWord}\" is already in your deck.` });
        setWordInDeck(true);
      } else {
        const friendly = err instanceof Error && err.message.trim()
          ? err.message
          : "Could not add to deck. Please try again.";
        setDeckFeedback({ type: "error", text: friendly });
      }
    } finally {
      setAdding(false);
      addInFlightRef.current = false;
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-panel p-5 shadow-xl animate-rise">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-ink/60">{description}</p>
          </div>
          <button className="rounded-lg bg-emerald-900/10 px-3 py-1 text-sm" onClick={onClose}>
            Close
          </button>
        </div>

        {loading ? <p className="mt-5 text-sm text-ink/60">Analyzing...</p> : null}

        {!loading && error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4">
            <span className="text-2xl leading-none">!</span>
            <div>
              <p className="text-sm font-semibold text-orange-800">Analysis limit reached</p>
              <p className="mt-1 text-xs leading-relaxed text-orange-700">{error}</p>
            </div>
          </div>
        )}

        {!loading && analysis ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-emerald-900/15 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-ink/50">{sourceLabel}</p>
              <p className="mt-2 max-h-[260px] overflow-y-auto leading-relaxed whitespace-pre-line">
                {textParts.map((part, index) => {
                  if (!isWord(part)) {
                    return <span key={`sep-${index}`}>{part}</span>;
                  }

                  const selectedKey = normalizeWord(selected?.clickedWord || "");
                  const partKey = normalizeWord(part);
                  const isSelected = selectedKey && selectedKey === partKey;

                  return (
                    <button
                      key={`word-${index}-${part}`}
                      type="button"
                      className={`mx-[1px] rounded px-1 py-[1px] text-left transition ${isSelected ? "bg-accent text-white" : "bg-emerald-50 hover:bg-emerald-100"}`}
                      onClick={() => handleWordClick(part)}
                    >
                      {part}
                    </button>
                  );
                })}
              </p>
            </div>

            {deckFeedback ? (
              <div
                role="status"
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${deckFeedback.type === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : deckFeedback.type === "warning"
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-red-300 bg-red-50 text-red-800"}`}
              >
                {deckFeedback.text}
              </div>
            ) : null}

            <div className="rounded-xl border border-emerald-900/15 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-ink/50">Selected Word</p>
              {selected ? (
                <div className="mt-2 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold">{selected.clickedWord}</p>
                      <button
                        title="Listen pronunciation"
                        className="rounded-full p-1 text-indigo-600 transition-colors hover:bg-indigo-100 active:scale-90"
                        onClick={() => {
                          const utterance = new SpeechSynthesisUtterance(selected.clickedWord);
                          utterance.lang = "en-US";
                          utterance.rate = 0.85;
                          window.speechSynthesis.cancel();
                          window.speechSynthesis.speak(utterance);
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                          <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                          <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
                        </svg>
                      </button>
                    </div>
                    <button
                      className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                      onClick={handleAddToDeck}
                      disabled={adding || wordInDeck || lookupLoading}
                    >
                      {adding ? "Adding..." : wordInDeck ? "Already in Deck" : "Add to Deck"}
                    </button>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">Translation:</span> {selected.token.translation || "-"}
                  </p>
                  {lookupLoading ? <p className="text-xs text-ink/60">Looking up dictionary...</p> : null}
                  {lookupError ? <p className="text-xs text-red-700">{lookupError}</p> : null}
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink/65">{sourceTextEmptyHint}</p>
              )}
            </div>

            <fieldset className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <legend className="w-full">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setIsFullTranslationOpen((prev) => !prev)}
                  aria-expanded={isFullTranslationOpen}
                >
                  <span>
                    <span className="block text-xs uppercase tracking-wide text-ink/50">Full Translation (PT)</span>
                    <span className="mt-1 block text-xs text-ink/60">
                      {isFullTranslationOpen ? "Hide full text translation" : "Show full text translation"}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-amber-700">
                    {isFullTranslationOpen ? "−" : "+"}
                  </span>
                </button>
              </legend>

              {isFullTranslationOpen ? (
                <p className="mt-3 max-h-[260px] overflow-y-auto whitespace-pre-line leading-relaxed">
                  {analysis.translation_pt || "-"}
                </p>
              ) : null}
            </fieldset>
          </div>
        ) : null}
      </div>
    </div>
  );
}

