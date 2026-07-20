'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AskAiButton } from '../ai/ask-ai-button';

const STORAGE_KEY = 'tradeops.merchantWizard.v1';

type WizardState = {
  dismissed: boolean;
  doneResearch: boolean;
  doneCases: boolean;
  doneConnect: boolean;
};

const defaultState: WizardState = {
  dismissed: false,
  doneResearch: false,
  doneCases: false,
  doneConnect: false,
};

/**
 * Cycle 6 — merchant first-run wizard (local, dismissible).
 * Guides: AI research → Save as Cases → Connect Shopify when ready.
 */
export function MerchantWizard({
  researchObjective,
}: {
  researchObjective?: string;
}) {
  const [state, setState] = useState<WizardState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WizardState>;
        setState({ ...defaultState, ...parsed });
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  function persist(next: WizardState) {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function mark(key: keyof WizardState) {
    persist({ ...state, [key]: true });
  }

  // SSR + first paint show wizard (smoke can detect it). After hydrate, honor dismiss.
  if (hydrated && state.dismissed) return null;

  const stepsDone =
    Number(state.doneResearch) + Number(state.doneCases) + Number(state.doneConnect);
  const allDone = stepsDone === 3;

  const objective =
    researchObjective?.trim() ||
    'Suggest 4 concrete products worth reselling online with rough price bands and sources';

  return (
    <article className="panel merchant-wizard" aria-label="Merchant setup wizard">
      <header className="merchant-wizard__head">
        <div>
          <span className="object-workspace__type">First run · Cycle 6</span>
          <h2 className="merchant-wizard__title">
            {allDone ? 'You’re set up' : 'Merchant setup (3 steps)'}
          </h2>
          <p className="meta" style={{ margin: 0 }}>
            {allDone
              ? 'Wizard complete. Dismiss anytime — you can re-open from Connections.'
              : 'Research with AI first (no OAuth). Save winners as Cases. Connect Shopify when you leave demo mode.'}
          </p>
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() => persist({ ...state, dismissed: true })}
        >
          Dismiss
        </button>
      </header>

      <ol className="merchant-wizard__steps">
        <li className={state.doneResearch ? 'is-done' : ''}>
          <div className="merchant-wizard__step-copy">
            <strong>1. Research with AI</strong>
            <span className="meta">Live web + Cohere — no store connection required</span>
          </div>
          <div className="merchant-wizard__step-actions">
            <AskAiButton
              objective={objective}
              label="Open AI research"
              className="btn primary"
            />
            <button
              type="button"
              className="btn ghost"
              onClick={() => mark('doneResearch')}
            >
              {state.doneResearch ? 'Done' : 'Mark done'}
            </button>
          </div>
        </li>
        <li className={state.doneCases ? 'is-done' : ''}>
          <div className="merchant-wizard__step-copy">
            <strong>2. Decide + draft listing</strong>
            <span className="meta">
              In the AI rail: review Decision brief, Save as Cases, then{' '}
              <strong>Draft listing for #1</strong> (internal draft — not published). Source ={' '}
              <code>ai-research</code>.
            </span>
          </div>
          <div className="merchant-wizard__step-actions">
            <Link className="btn secondary" href="/terminal/process">
              Open Cases
            </Link>
            <button
              type="button"
              className="btn ghost"
              onClick={() => mark('doneCases')}
            >
              {state.doneCases ? 'Done' : 'Mark done'}
            </button>
          </div>
        </li>
        <li className={state.doneConnect ? 'is-done' : ''}>
          <div className="merchant-wizard__step-copy">
            <strong>3. Launch to Shopify</strong>
            <span className="meta">
              Prepare → DRAFT push → optional <strong>Publish ACTIVE</strong> → optional{' '}
              <strong>inventory + collection</strong> (qty 10 · TradeOps Research). Never silent.
            </span>
          </div>
          <div className="merchant-wizard__step-actions">
            <Link
              className="btn secondary"
              href="/terminal/connectors#shopify-path"
            >
              Shopify path
            </Link>
            <Link className="btn ghost" href="/terminal/approvals">
              Approvals
            </Link>
            <button
              type="button"
              className="btn ghost"
              onClick={() => mark('doneConnect')}
            >
              {state.doneConnect ? 'Done' : 'Mark done'}
            </button>
          </div>
        </li>
      </ol>

      <p className="meta merchant-wizard__progress">
        Progress {stepsDone}/3
        {allDone ? (
          <>
            {' · '}
            <button
              type="button"
              className="btn ghost"
              style={{ minHeight: 24, padding: '2px 8px' }}
              onClick={() => persist({ ...state, dismissed: true })}
            >
              Hide wizard
            </button>
          </>
        ) : null}
      </p>
    </article>
  );
}
