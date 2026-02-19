export type User = {
  id: string;
  full_name: string;
  email: string;
  preferred_ai_provider: string;
  created_at: string;
};

export type Session = {
  id: string;
  topic: string;
  persona_prompt: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content_raw: string | null;
  content_corrected: string | null;
  content_final: string;
  provider: string | null;
  model: string | null;
  created_at: string;
};

export type ChatResponse = {
  user_message_id: string;
  corrected_text: string;
  correction_meta: {
    changed: boolean;
    notes: string;
    provider: string;
    model: string;
  };
  assistant_message_id: string;
  assistant_reply: string;
  provider_used: string;
  model_used: string;
  latency_ms: number;
};

export type TokenInfo = {
  token: string;
  lemma: string | null;
  pos: string | null;
  translation: string | null;
  definition: string | null;
};

export type AnalysisResponse = {
  original_en: string;
  translation_pt: string;
  tokens: TokenInfo[];
};

export type Flashcard = {
  id: string;
  word: string;
  lemma: string | null;
  pos: string | null;
  translation: string | null;
  definition: string | null;
  context_sentence: string | null;
  next_review: string;
  interval_days: number;
  repetitions: number;
  ease_factor: number;
  lapses: number;
};

export type ReviewStats = {
  total_cards: number;
  due_now: number;
  reviews_today: number;
};
