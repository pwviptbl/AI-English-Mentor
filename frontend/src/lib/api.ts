import type {
  AnalysisResponse,
  ChatResponse,
  Flashcard,
  Message,
  ReviewStats,
  Session,
  User,
} from "./types";

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

  // Handle localhost/127.0.0.1 resolution differences in some environments.
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

export async function listSessions(token: string): Promise<Session[]> {
  return request<Session[]>("/sessions", {}, token);
}

export async function createSession(token: string, topic: string, persona_prompt?: string): Promise<Session> {
  return request<Session>("/sessions", {
    method: "POST",
    body: JSON.stringify({ topic, persona_prompt }),
  }, token);
}

export async function listMessages(token: string, sessionId: string): Promise<Message[]> {
  return request<Message[]>(`/sessions/${sessionId}/messages`, {}, token);
}

export async function sendChat(token: string, session_id: string, text_raw: string): Promise<ChatResponse> {
  return request<ChatResponse>("/chat/send", {
    method: "POST",
    body: JSON.stringify({ session_id, text_raw }),
  }, token);
}

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
