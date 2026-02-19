"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Web Speech API não é exportada como tipos no tsconfig padrão do Next.js

type Props = {
    onTranscript: (text: string) => void;
    disabled?: boolean;
};

function getSpeechRecognition(): any | null {
    if (typeof window === "undefined") return null;
    const w = window as any;
    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRec) return null;
    return new SpeechRec();
}

type RecordingState = "idle" | "recording" | "error" | "unsupported";

export function VoiceInput({ onTranscript, disabled }: Props) {
    const [state, setState] = useState<RecordingState>("idle");
    const recRef = useRef<any | null>(null);

    useEffect(() => {
        return () => {
            // Limpa ao desmontar
            recRef.current?.abort();
        };
    }, []);

    function toggle() {
        if (disabled) return;

        if (state === "recording") {
            recRef.current?.stop();
            setState("idle");
            return;
        }

        const rec = getSpeechRecognition();
        if (!rec) {
            setState("unsupported");
            return;
        }

        rec.lang = "en-US";
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 1;

        rec.onresult = (e: any) => {
            const transcript: string = e.results[0]?.[0]?.transcript || "";
            onTranscript(transcript);
            setState("idle");
        };

        rec.onerror = () => {
            setState("error");
            setTimeout(() => setState("idle"), 2000);
        };

        rec.onend = () => {
            if (state !== "error") setState("idle");
        };

        try {
            rec.start();
            recRef.current = rec;
            setState("recording");
        } catch {
            setState("error");
            setTimeout(() => setState("idle"), 2000);
        }
    }

    if (state === "unsupported") {
        return (
            <span title="Navegador não suporta microfone" className="voice-btn voice-btn--unsupported">
                🚫
            </span>
        );
    }

    const title =
        state === "recording"
            ? "Gravando… clique para parar"
            : state === "error"
                ? "Erro ao ativar microfone"
                : "Falar em inglês";

    return (
        <button
            type="button"
            onClick={toggle}
            disabled={disabled}
            title={title}
            aria-label={title}
            className={`voice-btn ${state === "recording" ? "voice-btn--recording" : ""} ${state === "error" ? "voice-btn--error" : ""}`}
        >
            {state === "recording" ? "🔴" : state === "error" ? "❌" : "🎤"}
        </button>
    );
}
