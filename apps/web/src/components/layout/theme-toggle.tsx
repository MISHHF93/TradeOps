'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';
type Density = 'compact' | 'comfortable';

const THEME_KEY = 'tradeops-theme';
const DENSITY_KEY = 'tradeops-density';

function apply(theme: Theme, density: Density) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-density', density);
}

/**
 * Midnight Exchange theme + density control (theme.md §4, §17).
 * Persists locally; dark is default.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [density, setDensity] = useState<Density>('compact');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = (localStorage.getItem(THEME_KEY) as Theme | null) ?? 'dark';
    const d = (localStorage.getItem(DENSITY_KEY) as Density | null) ?? 'compact';
    setTheme(t === 'light' ? 'light' : 'dark');
    setDensity(d === 'comfortable' ? 'comfortable' : 'compact');
    apply(t === 'light' ? 'light' : 'dark', d === 'comfortable' ? 'comfortable' : 'compact');
    setReady(true);
  }, []);

  function setT(next: Theme) {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    apply(next, density);
  }

  function setD(next: Density) {
    setDensity(next);
    localStorage.setItem(DENSITY_KEY, next);
    apply(theme, next);
  }

  if (!ready) {
    return <span className="theme-toggle" aria-hidden />;
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <div className="theme-toggle" role="group" aria-label="Theme">
        <button type="button" aria-pressed={theme === 'dark'} onClick={() => setT('dark')}>
          Dark
        </button>
        <button type="button" aria-pressed={theme === 'light'} onClick={() => setT('light')}>
          Light
        </button>
      </div>
      <div className="theme-toggle" role="group" aria-label="Density">
        <button type="button" aria-pressed={density === 'compact'} onClick={() => setD('compact')}>
          Compact
        </button>
        <button
          type="button"
          aria-pressed={density === 'comfortable'}
          onClick={() => setD('comfortable')}
        >
          Comfort
        </button>
      </div>
    </div>
  );
}

/** Inline script to avoid flash of wrong theme — place in layout head. */
export const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('${THEME_KEY}') || 'dark';
    var d = localStorage.getItem('${DENSITY_KEY}') || 'compact';
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
    document.documentElement.setAttribute('data-density', d === 'comfortable' ? 'comfortable' : 'compact');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-density', 'compact');
  }
})();
`;
