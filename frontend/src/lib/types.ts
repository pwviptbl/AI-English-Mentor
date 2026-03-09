export type User = {
  id: string;
  full_name: string;
  email: string;
  preferred_ai_provider: string;
  tier: string;
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

export type ReadingQuestion = {
  question: string;
  options: string[];
  correct_option: string;
  explanation: string;
};

export type ReadingActivity = {
  title: string;
  theme: string;
  passage: string;
  question_language: "en" | "pt";
  questions: ReadingQuestion[];
  provider_used: string;
  model_used: string;
};

export type ReadingPracticeState = {
  selectedTheme: string;
  customTheme: string;
  cefrLevel: string;
  questionLanguage: "en" | "pt";
  activity: ReadingActivity | null;
  answers: Record<number, string>;
  currentQuestionIndex: number;
  submitted: boolean;
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

export type UserMetric = {
  id: string;
  full_name: string;
  email: string;
  tier: string;
  is_active: boolean;
  created_at: string;
  total_sessions: number;
  total_messages: number;
  total_reviews: number;
  last_active: string | null;
};

export type DailyActivity = {
  date: string;
  messages: number;
  sessions: number;
  reviews: number;
};

export type AdminMetrics = {
  period_days: number;
  total_users: number;
  active_users: number;
  inactive_users: number;
  new_users_period: number;
  messages_period: number;
  sessions_period: number;
  reviews_period: number;
  daily_activity: DailyActivity[];
  user_metrics: UserMetric[];
};
