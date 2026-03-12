import type { MutableRefObject } from "react";

import { synthesizeSpeech } from "@/lib/api";

export const EDGE_TTS_VOICE_OPTIONS = [
  { value: "en-US-JennyNeural", label: "English (US) - Jenny" },
  { value: "en-US-AriaNeural", label: "English (US) - Aria" },
  { value: "en-US-GuyNeural", label: "English (US) - Guy" },
  { value: "en-US-DavisNeural", label: "English (US) - Davis" },
  { value: "en-GB-SoniaNeural", label: "English (UK) - Sonia" },
  { value: "en-GB-RyanNeural", label: "English (UK) - Ryan" },
  { value: "en-AU-NatashaNeural", label: "English (AU) - Natasha" },
  { value: "en-AU-WilliamNeural", label: "English (AU) - William" },
] as const;

type PlaybackRefs = {
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  audioUrlRef: MutableRefObject<string | null>;
};

function releaseAudio(refs: PlaybackRefs) {
  if (refs.audioRef.current) {
    refs.audioRef.current.pause();
    refs.audioRef.current.src = "";
    refs.audioRef.current = null;
  }
  if (refs.audioUrlRef.current) {
    URL.revokeObjectURL(refs.audioUrlRef.current);
    refs.audioUrlRef.current = null;
  }
}

export function stopTtsPlayback(refs: PlaybackRefs) {
  releaseAudio(refs);
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

async function playEdgeAudio(blob: Blob, refs: PlaybackRefs) {
  const url = URL.createObjectURL(blob);
  refs.audioUrlRef.current = url;
  const audio = new Audio(url);
  refs.audioRef.current = audio;

  const cleanup = () => {
    if (refs.audioRef.current === audio) {
      refs.audioRef.current = null;
    }
    if (refs.audioUrlRef.current === url) {
      URL.revokeObjectURL(url);
      refs.audioUrlRef.current = null;
    }
  };

  audio.onended = cleanup;
  audio.onerror = cleanup;
  await audio.play();
}

export async function speakWithEdgeTtsFallback(params: {
  token: string;
  text: string;
  rate: number;
  refs: PlaybackRefs;
  fallbackLang?: string;
  onGeneratingChange?: (value: boolean) => void;
}) {
  const { token, text, rate, refs, fallbackLang = "en-US", onGeneratingChange } = params;
  if (!text.trim()) return;

  stopTtsPlayback(refs);
  onGeneratingChange?.(true);

  try {
    const blob = await synthesizeSpeech(token, text, rate);
    onGeneratingChange?.(false);
    if (blob.size > 0) {
      await playEdgeAudio(blob, refs);
      return;
    }
  } catch (error) {
    onGeneratingChange?.(false);
    console.warn("Edge TTS unavailable, falling back to browser speech.", error);
  }

  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = fallbackLang;
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}