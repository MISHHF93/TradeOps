'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { listClientDestinations } from '../../lib/nav-catalog';

type Cmd = { id: string; label: string; href: string; group: string; kbd?: string };

const COMMANDS: Cmd[] = listClientDestinations().map((d) => ({
  id: d.id,
  label: d.label,
  href: d.href,
  group: d.group,
  kbd:
    d.href === '/terminal'
      ? 'G S'
      : d.href === '/terminal/ai'
        ? 'G A'
        : d.href === '/terminal/workspace'
          ? 'G T'
          : undefined,
}));

/**
 * Command palette — AI gateway / visual centerpiece (§12).
 * Dark surface · accent cursor · accent match · accent selection.
 * Open: Ctrl/Cmd+K or custom trigger.
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

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return COMMANDS;
    return COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(query) ||
        c.group.toLowerCase().includes(query) ||
        c.href.includes(query),
    );
  }, [q]);

  useEffect(() => {
    setActive(0);
  }, [q, open]);

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
            placeholder="Jump to a command, workspace, or AI surface…"
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
          <Link href="/terminal/ai" onClick={onClose}>
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
