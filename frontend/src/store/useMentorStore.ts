"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { Message, Session, User } from "@/lib/types";

type MentorState = {
  accessToken: string | null;
  refreshToken: string | null;
  currentUser: User | null;
  sessions: Session[];
  activeSessionId: string | null;
  messagesBySession: Record<string, Message[]>;
  setAuth: (accessToken: string, refreshToken: string) => void;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
  setSessions: (sessions: Session[]) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  setMessages: (sessionId: string, messages: Message[]) => void;
  appendMessages: (sessionId: string, messages: Message[]) => void;
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
      setAuth: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setCurrentUser: (currentUser) => set({ currentUser }),
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
    }),
    {
      name: "ai-english-mentor-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        currentUser: state.currentUser,
      }),
    },
  ),
);
