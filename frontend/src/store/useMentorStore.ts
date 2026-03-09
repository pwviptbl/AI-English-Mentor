"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { Message, ReadingPracticeState, Session, ThemeMode, User } from "@/lib/types";

const defaultReadingPracticeState: ReadingPracticeState = {
  selectedTheme: "Technology",
  customTheme: "",
  cefrLevel: "B1",
  questionLanguage: "en",
  activity: null,
  answers: {},
  currentQuestionIndex: 0,
  submitted: false,
  resultRecorded: false,
};

type MentorState = {
  accessToken: string | null;
  refreshToken: string | null;
  currentUser: User | null;
  sessions: Session[];
  activeSessionId: string | null;
  messagesBySession: Record<string, Message[]>;
  readingPractice: ReadingPracticeState;
  readingPracticeUserId: string | null;
  themeMode: ThemeMode;
  setAuth: (accessToken: string, refreshToken: string) => void;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
  setSessions: (sessions: Session[]) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  setMessages: (sessionId: string, messages: Message[]) => void;
  appendMessages: (sessionId: string, messages: Message[]) => void;
  removeSession: (sessionId: string) => void;
  setReadingPractice: (payload: Partial<ReadingPracticeState>) => void;
  resetReadingPractice: () => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  toggleThemeMode: () => void;
};

export const useMentorStore = create<MentorState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      currentUser: null,
      sessions: [],
      activeSessionId: null,
      messagesBySession: {},
      readingPractice: defaultReadingPracticeState,
      readingPracticeUserId: null,
      themeMode: "light",
      setAuth: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setCurrentUser: (currentUser) =>
        set((state) => {
          if (!currentUser) {
            return { currentUser: null };
          }

          if (state.readingPracticeUserId && state.readingPracticeUserId !== currentUser.id) {
            return {
              currentUser,
              readingPractice: defaultReadingPracticeState,
              readingPracticeUserId: currentUser.id,
            };
          }

          return {
            currentUser,
            readingPracticeUserId: currentUser.id,
          };
        }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          currentUser: null,
          sessions: [],
          activeSessionId: null,
          messagesBySession: {},
        }),
      setSessions: (sessions) => set({ sessions }),
      setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
      setMessages: (sessionId, messages) =>
        set((state) => ({
          messagesBySession: { ...state.messagesBySession, [sessionId]: messages },
        })),
      appendMessages: (sessionId, messages) =>
        set((state) => {
          const current = state.messagesBySession[sessionId] || [];
          return {
            messagesBySession: {
              ...state.messagesBySession,
              [sessionId]: [...current, ...messages],
            },
          };
        }),
      removeSession: (sessionId) =>
        set((state) => {
          const { [sessionId]: _, ...rest } = state.messagesBySession;
          return {
            sessions: state.sessions.filter((s) => s.id !== sessionId),
            activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
            messagesBySession: rest,
          };
        }),
      setReadingPractice: (payload) =>
        set((state) => ({
          readingPractice: {
            ...state.readingPractice,
            ...payload,
          },
          readingPracticeUserId: state.currentUser?.id ?? state.readingPracticeUserId,
        })),
      resetReadingPractice: () =>
        set((state) => ({
          readingPractice: defaultReadingPracticeState,
          readingPracticeUserId: state.currentUser?.id ?? null,
        })),
      setThemeMode: (themeMode) => set({ themeMode }),
      toggleThemeMode: () =>
        set((state) => ({
          themeMode: state.themeMode === "dark" ? "light" : "dark",
        })),
    }),
    {
      name: "ai-english-mentor-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        currentUser: state.currentUser,
        readingPractice: state.readingPractice,
        readingPracticeUserId: state.readingPracticeUserId,
        themeMode: state.themeMode,
      }),
    },
  ),
);
