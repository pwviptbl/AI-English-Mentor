import type {
  AnalysisResponse,
  ChatResponse,
  DailyReviewStat,
  Flashcard,
  Message,
  ProgressOverview,
  ReviewStats,
  Session,
  User,
} from "./types";
import { useMentorStore } from "@/store/useMentorStore";

function getApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configured && configured.trim()) {
    return configured.trim();
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
  }

  return "http://localhost:8000/api/v1";
}

function buildApiBaseCandidates(): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  function add(base: string) {
    const value = base.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    candidates.push(value);
  }

  const primary = getApiBase();
  add(primary);
  add(primary.replace("://localhost:", "://127.0.0.1:"));
  add(primary.replace("://127.0.0.1:", "://localhost:"));

  if (typeof window !== "undefined") {
    add(`${window.location.protocol}//${window.location.hostname}:8000/api/v1`);
  }

  return candidates;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptTokenRefresh(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const state = useMentorStore.getState();
  const currentRefreshToken = state.refreshToken;
  if (!currentRefreshToken) return null;

  const apiBases = buildApiBaseCandidates();
  let lastError: unknown = null;

  for (const apiBase of apiBases) {
    try {
      const response = await fetch(`${apiBase}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: currentRefreshToken }),
        cache: "no-store",
      });
      if (!response.ok) {
        lastError = new Error(`refresh failed: ${response.status}`);
        continue;
      }
      const payload = await response.json() as { access_token: string; refresh_token: string };
      if (!payload.access_token || !payload.refresh_token) {
        lastError = new Error("refresh response missing tokens");
        continue;
      }
      useMentorStore.getState().setAuth(payload.access_token, payload.refresh_token);
      return payload.access_token;
    } catch (err) {
      lastError = err;
    }
  }

  console.warn("Token refresh failed", lastError);
  return null;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const apiBases = buildApiBaseCandidates();
  let response: Response | null = null;
  let lastNetworkError: unknown = null;
  let lastTriedUrl = "";
  const retryDelaysMs = [0, 250, 600, 1200];

  for (const apiBase of apiBases) {
    for (let attempt = 0; attempt < retryDelaysMs.length; attempt++) {
      try {
        const delay = retryDelaysMs[attempt];
        if (delay > 0) {
          await wait(delay);
        }
        lastTriedUrl = `${apiBase}${path}`;
        response = await fetch(lastTriedUrl, {
          ...options,
          headers,
          cache: "no-store",
        });
        break;
      } catch (err) {
        lastNetworkError = err;
      }
    }
    if (response) break;
  }

  if (!response) {
    const reason = lastNetworkError instanceof Error ? ` (${lastNetworkError.message})` : "";
    throw new Error(
      `Nao foi possivel conectar ao backend (${lastTriedUrl || `${apiBases[0]}${path}`})${reason}. Verifique se a API esta no ar e o NEXT_PUBLIC_API_BASE_URL.`,
    );
  }

  if (response.status === 401 && token) {
    const refreshedAccessToken = await attemptTokenRefresh();
    if (!refreshedAccessToken) {
      useMentorStore.getState().logout();
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    const retriedHeaders = new Headers(options.headers || {});
    retriedHeaders.set("Content-Type", "application/json");
    retriedHeaders.set("Authorization", `Bearer ${refreshedAccessToken}`);
    response = await fetch(lastTriedUrl || `${apiBases[0]}${path}`, {
      ...options,
      headers: retriedHeaders,
      cache: "no-store",
    });
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => null);
      if (payload && typeof payload === "object") {
        const detail = (payload as { detail?: unknown }).detail;
        if (typeof detail === "string" && detail.trim()) {
          throw new Error(detail);
        }
      }
    }
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ─── Autenticação ─────────────────────────────────────────────────────────────

export async function register(full_name: string, email: string, password: string): Promise<User> {
  return request<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ full_name, email, password }),
  });
}

export async function login(email: string, password: string): Promise<{ access_token: string; refresh_token: string }> {
  return request<{ access_token: string; refresh_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function me(token: string): Promise<User> {
  return request<User>("/auth/me", {}, token);
}

// ─── Sessões ──────────────────────────────────────────────────────────────────

export async function listSessions(token: string): Promise<Session[]> {
  return request<Session[]>("/sessions", {}, token);
}

export async function createSession(
  token: string,
  topic: string,
  persona_prompt?: string,
  cefr_level?: string | null,
): Promise<Session> {
  return request<Session>("/sessions", {
    method: "POST",
    body: JSON.stringify({ topic, persona_prompt, cefr_level }),
  }, token);
}

export async function deleteSession(token: string, sessionId: string): Promise<void> {
  const apiBases = buildApiBaseCandidates();
  let response: Response | null = null;
  let lastError: unknown = null;

  for (const apiBase of apiBases) {
    try {
      response = await fetch(`${apiBase}/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!response) {
    throw new Error("Não foi possível conectar ao backend para excluir a sessão.");
  }
  if (!response.ok && response.status !== 204) {
    throw new Error(`Falha ao excluir sessão: ${response.status}`);
  }
}

// ─── Mensagens ────────────────────────────────────────────────────────────────

export async function listMessages(token: string, sessionId: string): Promise<Message[]> {
  return request<Message[]>(`/sessions/${sessionId}/messages`, {}, token);
}

export async function sendChat(token: string, session_id: string, text_raw: string): Promise<ChatResponse> {
  return request<ChatResponse>("/chat/send", {
    method: "POST",
    body: JSON.stringify({ session_id, text_raw }),
  }, token);
}

/**
 * Versão SSE do sendChat — chama onChunk por cada pedaço do reply do assistente.
 * Retorna o `ChatResponse` reconstruído quando o stream terminar.
 */
export async function sendChatStream(
  token: string,
  session_id: string,
  text_raw: string,
  onChunk: (chunk: string) => void,
  onCorrection: (meta: ChatResponse["correction_meta"] & { user_message_id: string; corrected_text: string }) => void,
): Promise<{ assistant_message_id: string; full_reply: string }> {
  const apiBase = getApiBase();
  const url = `${apiBase}/chat/stream`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ session_id, text_raw }),
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat stream falhou: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = { assistant_message_id: "", full_reply: "" };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;

      try {
        const event = JSON.parse(raw) as {
          type: string;
          text?: string;
          user_message_id?: string;
          corrected_text?: string;
          changed?: boolean;
          notes?: string;
          categories?: string[];
          provider?: string;
          model?: string;
          assistant_message_id?: string;
          full_reply?: string;
        };

        if (event.type === "correction") {
          onCorrection({
            user_message_id: event.user_message_id ?? "",
            corrected_text: event.corrected_text ?? "",
            changed: event.changed ?? false,
            notes: event.notes ?? "",
            categories: event.categories ?? [],
            provider: event.provider ?? "",
            model: event.model ?? "",
          });
        } else if (event.type === "chunk" && event.text) {
          onChunk(event.text);
        } else if (event.type === "done") {
          result = {
            assistant_message_id: event.assistant_message_id ?? "",
            full_reply: event.full_reply ?? "",
          };
        }
      } catch {
        // ignora eventos malformados
      }
    }
  }

  return result;
}

// ─── Análise ──────────────────────────────────────────────────────────────────

export async function analyzeMessage(token: string, messageId: string): Promise<AnalysisResponse> {
  return request<AnalysisResponse>(`/messages/${messageId}/analysis`, {
    method: "POST",
  }, token);
}

export async function lookupDictionaryWord(token: string, word: string): Promise<{
  token: string;
  lemma: string | null;
  pos: string | null;
  translation: string | null;
  definition: string | null;
}> {
  return request(`/dictionary/lookup?word=${encodeURIComponent(word)}`, {}, token);
}

// ─── SRS / Flashcards ─────────────────────────────────────────────────────────

export async function addFlashcard(token: string, payload: {
  word: string;
  lemma?: string | null;
  pos?: string | null;
  translation?: string | null;
  definition?: string | null;
  context_sentence?: string | null;
}): Promise<Flashcard> {
  return request<Flashcard>("/flashcards", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function dueFlashcards(token: string): Promise<Flashcard[]> {
  return request<Flashcard[]>("/flashcards/due", {}, token);
}

export async function reviewFlashcard(
  token: string,
  flashcard_id: string,
  rating: "again" | "hard" | "good" | "easy",
): Promise<unknown> {
  return request("/reviews", {
    method: "POST",
    body: JSON.stringify({ flashcard_id, rating }),
  }, token);
}

export async function reviewStats(token: string): Promise<ReviewStats> {
  return request<ReviewStats>("/reviews/stats", {}, token);
}

// ─── Progresso / Dashboard ────────────────────────────────────────────────────

export async function progressOverview(token: string): Promise<ProgressOverview> {
  return request<ProgressOverview>("/stats/overview", {}, token);
}

export async function reviewHistory(token: string, days = 14): Promise<DailyReviewStat[]> {
  return request<DailyReviewStat[]>(`/reviews/history?days=${days}`, {}, token);
}
