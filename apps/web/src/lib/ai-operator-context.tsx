'use client';

/**
 * Shared client state for the persistent AI Operator rail.
 * Backend remains source of truth for completed runs.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type AiRailMode = 'closed' | 'compact' | 'standard' | 'expanded';

const RAIL_KEY = 'tradeops.ai.railMode';
const DRAFT_KEY = 'tradeops.ai.draftObjective';
const RUN_KEY = 'tradeops.ai.lastRunId';

type AiOperatorContextValue = {
  railMode: AiRailMode;
  setRailMode: (m: AiRailMode) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  draftObjective: string;
  setDraftObjective: (v: string) => void;
  /** Prefill composer and open rail (contextual actions) */
  openWithObjective: (objective: string) => void;
  lastRunId: string | null;
  setLastRunId: (id: string | null) => void;
  commerceCaseId: string | null;
  setCommerceCaseId: (id: string | null) => void;
};

const AiOperatorContext = createContext<AiOperatorContextValue | null>(null);

function readMode(): AiRailMode {
  if (typeof window === 'undefined') return 'standard';
  try {
    const v = localStorage.getItem(RAIL_KEY);
    if (v === 'closed' || v === 'compact' || v === 'standard' || v === 'expanded') return v;
  } catch {
    /* ignore */
  }
  return 'standard';
}

export function AiOperatorProvider({ children }: { children: ReactNode }) {
  const [railMode, setRailModeState] = useState<AiRailMode>('standard');
  const [draftObjective, setDraftState] = useState('');
  const [lastRunId, setLastRunState] = useState<string | null>(null);
  const [commerceCaseId, setCommerceCaseId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRailModeState(readMode());
    try {
      setDraftState(sessionStorage.getItem(DRAFT_KEY) ?? '');
      setLastRunState(sessionStorage.getItem(RUN_KEY));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const setRailMode = useCallback((m: AiRailMode) => {
    setRailModeState(m);
    try {
      localStorage.setItem(RAIL_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const setDraftObjective = useCallback((v: string) => {
    setDraftState(v);
    try {
      if (v.trim()) sessionStorage.setItem(DRAFT_KEY, v);
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const setLastRunId = useCallback((id: string | null) => {
    setLastRunState(id);
    try {
      if (id) sessionStorage.setItem(RUN_KEY, id);
      else sessionStorage.removeItem(RUN_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const open = railMode !== 'closed';
  const setOpen = useCallback(
    (v: boolean) => {
      if (v) setRailMode(railMode === 'closed' ? 'standard' : railMode);
      else setRailMode('closed');
    },
    [railMode, setRailMode],
  );

  const openWithObjective = useCallback(
    (objective: string) => {
      setDraftObjective(objective);
      if (railMode === 'closed') setRailMode('standard');
    },
    [railMode, setDraftObjective, setRailMode],
  );

  const value = useMemo(
    () => ({
      railMode: hydrated ? railMode : 'standard',
      setRailMode,
      open: hydrated ? open : true,
      setOpen,
      draftObjective,
      setDraftObjective,
      openWithObjective,
      lastRunId,
      setLastRunId,
      commerceCaseId,
      setCommerceCaseId,
    }),
    [
      hydrated,
      railMode,
      setRailMode,
      open,
      setOpen,
      draftObjective,
      setDraftObjective,
      openWithObjective,
      lastRunId,
      setLastRunId,
      commerceCaseId,
    ],
  );

  return <AiOperatorContext.Provider value={value}>{children}</AiOperatorContext.Provider>;
}

export function useAiOperator(): AiOperatorContextValue {
  const ctx = useContext(AiOperatorContext);
  if (!ctx) {
    // Safe fallback when used outside provider (tests / isolated pages)
    return {
      railMode: 'standard',
      setRailMode: () => undefined,
      open: true,
      setOpen: () => undefined,
      draftObjective: '',
      setDraftObjective: () => undefined,
      openWithObjective: () => undefined,
      lastRunId: null,
      setLastRunId: () => undefined,
      commerceCaseId: null,
      setCommerceCaseId: () => undefined,
    };
  }
  return ctx;
}
