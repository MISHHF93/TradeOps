'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';
import { commandPaletteEntries } from '../../lib/terminal-routes';

type Cmd = {
  id: string;
  label: string;
  href: string;
  group: string;
  kbd?: string;
  imageUrl?: string | null;
  summary?: string;
};

/**
 * ⌘K directory — driven by terminal-routes registry (no legacy / duplicate paths).
 */
const COMMANDS: Cmd[] = [
  { id: 'ws-switch', label: 'Switch persona', href: '/terminal/workspace?switch=1', group: 'Workspace', kbd: 'G W' },
  { id: 'ws-r', label: 'Researcher home', href: '/terminal/workspace/researcher', group: 'Workspace' },
  { id: 'ws-o', label: 'Operator home', href: '/terminal/workspace/operator', group: 'Workspace' },
  { id: 'ws-e', label: 'Executive home', href: '/terminal/workspace/executive', group: 'Workspace' },
  { id: 'ws-a', label: 'Analyst home', href: '/terminal/workspace/analyst', group: 'Workspace' },
  { id: 'ws-d', label: 'Developer home', href: '/terminal/workspace/developer', group: 'Workspace' },
  { id: 'ws-adm', label: 'Administrator home', href: '/terminal/workspace/administrator', group: 'Workspace' },
  ...commandPaletteEntries().map((e) => ({
    ...e,
    kbd: e.id === 'discover' ? 'G D' : e.id === 'process' ? 'G C' : e.id === 'ai' ? 'G A' : undefined,
  })),
  // Outside terminal (not in registry, still jump targets)
  { id: 'billing', label: 'SaaS billing', href: '/app/billing', group: 'Govern' },
  { id: 'sys', label: 'System / settings', href: '/app', group: 'Govern' },
  { id: 'status', label: 'Capability honesty board', href: '/status', group: 'Govern' },
  { id: 'onboard', label: 'Onboarding', href: '/onboarding', group: 'Govern' },
];

/**
 * Command palette — jump to any terminal destination.
 * Open: Ctrl/Cmd+K.
 */
export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [liveHits, setLiveHits] = useState<Cmd[]>([]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setLiveHits([]);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/api/v1/search?q=${encodeURIComponent(query)}`,
          { credentials: 'include', headers: { Accept: 'application/json' } },
        );
        if (!res.ok) {
          setLiveHits([]);
          return;
        }
        const body = (await res.json()) as {
          hits?: Array<{
            id: string;
            objectType: string;
            title: string;
            summary: string;
            href: string;
            evidence?: { imageUrl?: string };
          }>;
        };
        setLiveHits(
          (body.hits ?? []).slice(0, 6).map((h) => ({
            id: `hit-${h.objectType}-${h.id}`,
            label: h.title,
            href: h.href,
            group: 'Live results',
            summary: h.summary,
            imageUrl: h.evidence?.imageUrl ?? null,
          })),
        );
      } catch {
        setLiveHits([]);
      }
    }, 160);
    return () => window.clearTimeout(t);
  }, [q, open]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const cmds = !query
      ? COMMANDS
      : COMMANDS.filter(
          (c) =>
            c.label.toLowerCase().includes(query) ||
            c.group.toLowerCase().includes(query) ||
            c.href.includes(query),
        );
    // Live object hits first when searching
    return query.length >= 2 ? [...liveHits, ...cmds] : cmds;
  }, [q, liveHits]);

  useEffect(() => {
    setActive(0);
  }, [q, open, liveHits]);

  const go = useCallback(
    (href: string) => {
      onClose();
      setQ('');
      router.push(href);
    },
    [onClose, router],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[active]) {
        e.preventDefault();
        go(filtered[active]!.href);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active, go, onClose]);

  if (!open) return null;

  return (
    <div className="cmd-palette-overlay" role="presentation" onClick={onClose}>
      <div
        className="cmd-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cmd-palette-search">
          <span className="cmd-palette-cursor" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to workspace, cases, finance, AI…"
            aria-label="Command search"
          />
          <kbd className="kbd-hint">ESC</kbd>
        </div>
        <ul className="cmd-palette-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="cmd-palette-empty meta">No matching commands</li>
          ) : (
            filtered.map((c, i) => {
              const isActive = i === active;
              if (c.group === 'Live results') {
                return (
                  <li
                    key={c.id}
                    role="option"
                    aria-selected={isActive}
                    className={`cmd-palette-item cmd-palette-item--hit ${isActive ? 'is-active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(c.href)}
                  >
                    <span className="cmd-search-hit__thumb">
                      {c.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="cmd-search-hit__letter">
                          {(c.label || '?').slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="cmd-palette-item__body">
                      <span className="cmd-palette-item__label">{c.label}</span>
                      <span className="meta">{c.summary ?? c.group}</span>
                    </span>
                  </li>
                );
              }
              const matchIdx = q.trim()
                ? c.label.toLowerCase().indexOf(q.trim().toLowerCase())
                : -1;
              return (
                <li key={c.id} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    className={`cmd-palette-item ${isActive ? 'is-active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(c.href)}
                  >
                    <span className="cmd-palette-group">{c.group}</span>
                    <span className="cmd-palette-label">
                      {matchIdx >= 0 && q.trim() ? (
                        <>
                          {c.label.slice(0, matchIdx)}
                          <mark className="cmd-match">
                            {c.label.slice(matchIdx, matchIdx + q.trim().length)}
                          </mark>
                          {c.label.slice(matchIdx + q.trim().length)}
                        </>
                      ) : (
                        c.label
                      )}
                    </span>
                    {c.kbd ? <kbd className="kbd-hint">{c.kbd}</kbd> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="cmd-palette-footer meta">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <Link href="/terminal/objectives" onClick={onClose}>
            AI workspace
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Global Ctrl/Cmd+K binder + trigger button */
export function CommandPaletteHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        className="btn ghost cmd-palette-trigger"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K Meta+K"
        title="Command palette (Ctrl/Cmd+K)"
      >
        <span className="cmd-trigger-icon" aria-hidden />
        Commands
        <kbd className="kbd-hint">⌘K</kbd>
      </button>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
