"use client";

import { useEffect, useState } from "react";

import type { Message } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Web Speech API não é exportada como tipos no tsconfig padrão do Next.js

type Props = {
    token: string;
    sessionMessages: Message[];
};

// Similaridade simples por número de palavras comuns
function computeSimilarity(original: string, spoken: string): number {
    const normalize = (s: string) =>
        s.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    const orig = normalize(original);
    const spok = normalize(spoken);
    if (orig.length === 0) return 0;
    const origSet = new Set(orig);
    const matches = spok.filter((w) => origSet.has(w)).length;
    return Math.round((matches / Math.max(orig.length, spok.length)) * 100);
}

// Destaca palavras diferentes entre original e transcrito
function DiffView({ original, spoken }: { original: string; spoken: string }) {
    const normalize = (s: string) =>
        s.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    const origWords = normalize(original);
    const spokSet = new Set(normalize(spoken));

    return (
        <div className="shadowing-diff">
            {origWords.map((w, i) => (
                <span
                    key={i}
                    className={spokSet.has(w) ? "shadowing-diff__word--match" : "shadowing-diff__word--miss"}
                >
                    {w}{" "}
                </span>
            ))}
        </div>
    );
}

function startSpeechRecognition(onResult: (text: string) => void, onError: () => void): () => void {
    const w = window as any;
    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRec) { onError(); return () => { }; }

    const rec: any = new SpeechRec();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => onResult((e.results[0]?.[0]?.transcript as string) || "");
    rec.onerror = () => onError();
    rec.start();
    return () => rec.abort();
}

export function ShadowingPanel({ sessionMessages }: Props) {
    const assistantMessages = sessionMessages.filter((m) => m.role === "assistant");
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [spoken, setSpoken] = useState("");
    const [listening, setListening] = useState(false);
    const [similarity, setSimilarity] = useState<number | null>(null);
    const [stopFn, setStopFn] = useState<(() => void) | null>(null);

    const selected = assistantMessages[selectedIdx] ?? null;

    useEffect(() => {
        // Limpa ao trocar de frase
        setSpoken("");
        setSimilarity(null);
    }, [selectedIdx]);

    function speakPhrase() {
        if (!selected) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(selected.content_final);
        utterance.lang = "en-US";
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }

    function startListening() {
        if (listening) {
            stopFn?.();
            setListening(false);
            return;
        }
        setSpoken("");
        setSimilarity(null);
        setListening(true);

        const stop = startSpeechRecognition(
            (text) => {
                setSpoken(text);
                setListening(false);
                if (selected) setSimilarity(computeSimilarity(selected.content_final, text));
            },
            () => setListening(false),
        );
        setStopFn(() => stop);
    }

    if (assistantMessages.length === 0) {
        return (
            <div className="shadowing-panel">
                <h2>🔁 Shadowing</h2>
                <p className="shadowing-panel__empty">
                    Inicie uma conversa primeiro para praticar shadowing das frases do mentor.
                </p>
            </div>
        );
    }

    const score = similarity ?? null;

    return (
        <div className="shadowing-panel">
            <h2>🔁 Modo Shadowing</h2>
            <p className="shadowing-panel__desc">
                Ouça a frase do mentor, repita em voz alta e veja o seu score de similaridade.
            </p>

            {/* Seletor de frase */}
            <div className="shadowing-selector">
                <label htmlFor="shadow-select">Frase do mentor:</label>
                <select
                    id="shadow-select"
                    value={selectedIdx}
                    onChange={(e) => setSelectedIdx(Number(e.target.value))}
                >
                    {assistantMessages.map((m, i) => (
                        <option key={m.id} value={i}>
                            {m.content_final.slice(0, 60)}…
                        </option>
                    ))}
                </select>
            </div>

            {/* Frase selecionada */}
            {selected && (
                <blockquote className="shadowing-quote">{selected.content_final}</blockquote>
            )}

            {/* Controles */}
            <div className="shadowing-controls">
                <button type="button" className="btn btn--secondary" onClick={speakPhrase}>
                    🔊 Ouvir
                </button>
                <button
                    type="button"
                    className={`btn ${listening ? "btn--danger" : "btn--primary"}`}
                    onClick={startListening}
                >
                    {listening ? "⏹ Parar" : "🎤 Falar"}
                </button>
            </div>

            {/* Resultado */}
            {spoken && (
                <div className="shadowing-result">
                    <p className="shadowing-result__label">Você disse:</p>
                    <p className="shadowing-result__spoken">&quot;{spoken}&quot;</p>

                    {score !== null && (
                        <>
                            <div className="shadowing-score">
                                <span
                                    className={
                                        score >= 80
                                            ? "shadowing-score__badge shadowing-score__badge--great"
                                            : score >= 50
                                                ? "shadowing-score__badge shadowing-score__badge--ok"
                                                : "shadowing-score__badge shadowing-score__badge--low"
                                    }
                                >
                                    {score}% de similaridade
                                </span>
                            </div>
                            <DiffView original={selected?.content_final ?? ""} spoken={spoken} />
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
