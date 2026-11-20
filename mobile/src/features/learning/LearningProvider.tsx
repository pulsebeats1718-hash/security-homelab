import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { randomId } from "../../lib/id";
import { api, ApiError } from "../../services/api/client";
import type { CoachReport } from "../../services/api/types";
import { initialData, learningReducer, toPersisted, type LearningAction } from "./reducer";
import type { ExpressionEntry, LearningData, SessionRecord, Settings } from "./types";

const STORAGE_KEY = "sophie.learning.v1";

interface LearningContextValue {
  data: LearningData;
  hydrated: boolean;
  updateSettings(patch: Partial<Settings>): void;
  addSession(session: SessionRecord): void;
  requestReview(sessionId: string): Promise<void>;
  saveExpression(expression: CoachReport["expressions"][number], sessionId?: string): void;
  removeExpression(id: string): void;
  markPractised(id: string): void;
  deleteTranscripts(): void;
  resetAll(): Promise<void>;
}

const LearningContext = createContext<LearningContextValue | null>(null);

export function LearningProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(learningReducer, undefined, () => initialData(randomId(), Date.now()));
  const [hydrated, setHydrated] = useState(false);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Load once.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as LearningData;
        if (parsed?.version === 1 && typeof parsed.deviceId === "string") {
          // Calls interrupted mid-review shouldn't stay "loading" forever.
          const sessions = parsed.sessions.map((s) => (s.review.status === "loading" ? { ...s, review: { status: "idle" as const } } : s));
          dispatch({ type: "hydrate", data: { ...parsed, sessions } });
        }
      })
      .catch((error) => console.warn("Couldn't load learning data", error))
      .finally(() => !cancelled && setHydrated(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist (debounced) after hydration.
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPersisted(data))).catch((error) => console.warn("Couldn't save learning data", error));
    }, 300);
    return () => clearTimeout(timer);
  }, [data, hydrated]);

  const act = useCallback((action: LearningAction) => dispatch(action), []);

  const requestReview = useCallback(async (sessionId: string) => {
    const current = dataRef.current;
    const session = current.sessions.find((s) => s.id === sessionId);
    if (!session || session.review.status === "loading" || session.review.status === "ready") return;
    const turns = session.turns.filter((t) => t.text.trim()).map((t) => ({ role: t.role, text: t.text.trim().slice(0, 2_000) }));
    if (!turns.some((t) => t.role === "user")) {
      dispatch({
        type: "set-review",
        sessionId,
        now: Date.now(),
        review: { status: "error", code: "nothing_to_review", message: "There wasn't enough of your speech in this call to review." },
      });
      return;
    }
    dispatch({ type: "set-review", sessionId, now: Date.now(), review: { status: "loading" } });
    try {
      const report = await api.reviewConversation({
        deviceId: current.deviceId,
        correctionStyle: current.settings.correctionStyle,
        turns: turns.slice(-120),
      });
      dispatch({ type: "set-review", sessionId, now: Date.now(), review: { status: "ready", report } });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "unknown";
      const message = error instanceof Error ? error.message : "The review couldn't be created.";
      dispatch({ type: "set-review", sessionId, now: Date.now(), review: { status: "error", code, message } });
    }
  }, []);

  const value = useMemo<LearningContextValue>(
    () => ({
      data,
      hydrated,
      updateSettings: (patch) => act({ type: "update-settings", patch }),
      addSession: (session) => act({ type: "add-session", session }),
      requestReview,
      saveExpression: (expression, sessionId) => {
        const entry: ExpressionEntry = {
          id: randomId(12),
          phrase: expression.phrase,
          kind: expression.kind,
          meaning: expression.meaning,
          example: expression.example,
          synonyms: expression.synonyms,
          savedAt: Date.now(),
          origin: "conversation",
          sessionId,
          practised: 0,
        };
        act({ type: "save-expression", entry });
      },
      removeExpression: (id) => act({ type: "remove-expression", id }),
      markPractised: (id) => act({ type: "practised-expression", id }),
      deleteTranscripts: () => act({ type: "delete-transcripts" }),
      resetAll: async () => {
        await AsyncStorage.removeItem(STORAGE_KEY);
        act({ type: "reset", deviceId: randomId(), now: Date.now() });
      },
    }),
    [act, data, hydrated, requestReview],
  );

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearning(): LearningContextValue {
  const value = useContext(LearningContext);
  if (!value) throw new Error("useLearning must be used inside <LearningProvider>");
  return value;
}
