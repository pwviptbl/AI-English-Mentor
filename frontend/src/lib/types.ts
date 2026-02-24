export type User = {
  id: string;
  full_name: string;
  email: string;
  preferred_ai_provider: string;
  tier: string;       // "free" | "pro"
  is_admin: boolean;
  created_at: string;
};

export type AdminUser = {
  id: string;
  full_name: string;
  email: string;
  tier: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
};

export type TierLimits = {
  tier: string;
  daily_chat_limit: number;
  daily_analysis_limit: number;
};

export type Session = {
  id: string;
  topic: string;
  persona_prompt: string | null;
  cefr_level: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content_raw: string | null;
  content_corrected: string | null;
  content_final: string;
  meta_json?: {
    changed?: boolean;
    notes?: string;
    categories?: string[];
  } | null;
  provider: string | null;
  model: string | null;
  created_at: string;
};

export type CorrectionMeta = {
  changed: boolean;
  notes: string;
  categories: string[];
  provider: string;
  model: string;
};

export type ChatResponse = {
  user_message_id: string;
  corrected_text: string;
  correction_meta: CorrectionMeta;
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
  stability: number;
  difficulty: number;
};

export type ReviewStats = {
  total_cards: number;
  due_now: number;
  reviews_today: number;
};

export type DailyReviewStat = {
  date: string;
  count: number;
  accuracy: number;
};

export type ProgressOverview = {
  streak_days: number;
  total_learned: number;
  accuracy_rate: number;
  reviews_today: number;
  daily_history: DailyReviewStat[];
};
