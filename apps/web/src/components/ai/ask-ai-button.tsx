'use client';

import { useAiOperator } from '../../lib/ai-operator-context';

/**
 * Opens the persistent AI rail with an objective bound to the current object.
 * Prefer this over navigating to /terminal/objectives for launch.
 */
export function AskAiButton({
  objective,
  commerceCaseId,
  label = 'Ask AI',
  className = 'btn ai',
  variant = 'ai',
}: {
  objective: string;
  commerceCaseId?: string | null;
  label?: string;
  className?: string;
  variant?: 'ai' | 'primary' | 'secondary' | 'ghost';
}) {
  const { openWithObjective, setCommerceCaseId, setOpen } = useAiOperator();
  const cls =
    className ||
    (variant === 'ai'
      ? 'btn ai'
      : variant === 'primary'
        ? 'btn primary'
        : variant === 'secondary'
          ? 'btn secondary'
          : 'btn ghost');

  return (
    <button
      type="button"
      className={cls}
      onClick={() => {
        if (commerceCaseId) setCommerceCaseId(commerceCaseId);
        openWithObjective(objective);
        setOpen(true);
      }}
    >
      {label}
    </button>
  );
}
