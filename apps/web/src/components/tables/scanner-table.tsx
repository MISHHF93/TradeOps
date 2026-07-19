'use client';

import Link from 'next/link';
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { FreshnessBadge } from '../commerce/freshness-badge';
import { ConfidenceMeter, Money } from '../commerce/money';
import { SignalBadge } from '../commerce/signal-badge';
import { formatBps, formatMoney } from '../../lib/money';
import type { ScannerRow } from '../../lib/terminal-api';

type SortKey = keyof ScannerRow | 'stale';
type ViewMode = 'table' | 'cards';

function isStale(iso: string, maxAgeHours = 24): boolean {
  const ageMs = Date.now() - new Date(iso).getTime();
  return ageMs > maxAgeHours * 3600_000;
}

/**
 * Opportunity book — accent only on hover / select / sort / filter / compare (§6).
 * Rows stay neutral; selected row gets accent left border only.
 */
export function ScannerTable({ rows }: { rows: ScannerRow[] }) {
  const [query, setQuery] = useState('');
  const [signal, setSignal] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [view, setView] = useState<ViewMode>('table');

  const filtered = useMemo(() => {
    let list = rows;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) =>
          r.product.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.supplier.toLowerCase().includes(q) ||
          r.sourcePlatform.toLowerCase().includes(q),
      );
    }
    if (signal !== 'ALL') {
      list = list.filter((r) => r.currentSignal === signal);
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'stale') {
        return (Number(isStale(a.lastDataUpdate)) - Number(isStale(b.lastDataUpdate))) * dir;
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, query, signal, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'product' || key === 'category' ? 'asc' : 'desc');
    }
  }

  function selectRow(id: string, e?: MouseEvent | KeyboardEvent) {
    const multi = e && ('metaKey' in e || 'ctrlKey' in e) && (e.metaKey || e.ctrlKey);
    if (multi) {
      setCompareIds((prev) => {
        const has = prev.includes(id);
        const next = has ? prev.filter((x) => x !== id) : [...prev, id].slice(-4);
        return next;
      });
      setSelectedId(id);
      return;
    }
    setSelectedId(id);
    setCompareIds([]);
  }

  const signals = useMemo(
    () => ['ALL', ...Array.from(new Set(rows.map((r) => r.currentSignal))).sort()],
    [rows],
  );

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th data-sorted={sortKey === k ? 'true' : undefined} scope="col">
      <button
        type="button"
        className={`th-sort ${sortKey === k ? 'is-active' : ''}`}
        onClick={() => toggleSort(k)}
        aria-sort={
          sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
        }
      >
        {children}
        {sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  return (
    <div className="scanner-root">
      <div className="scanner-filters" role="search" aria-label="Scanner filters">
        <input
          type="search"
          className={query ? 'filter-active' : undefined}
          placeholder="Filter product, category, supplier…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter rows"
        />
        <div className="ai-quick-row" role="group" aria-label="Signal filter">
          {signals.map((s) => (
            <button
              key={s}
              type="button"
              className={`filter-chip ${signal === s ? 'active' : ''}`}
              aria-pressed={signal === s}
              onClick={() => setSignal(s)}
            >
              {s === 'ALL' ? 'All signals' : s}
            </button>
          ))}
        </div>
        <div className="scanner-view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={`object-workspace-tab ${view === 'table' ? 'is-active' : ''}`}
            aria-pressed={view === 'table'}
            onClick={() => setView('table')}
          >
            Table
          </button>
          <button
            type="button"
            className={`object-workspace-tab ${view === 'cards' ? 'is-active' : ''}`}
            aria-pressed={view === 'cards'}
            onClick={() => setView('cards')}
          >
            Cards
          </button>
        </div>
        <span className="meta" aria-live="polite">
          {filtered.length} / {rows.length} rows
          {selectedId ? ' · selected' : ''}
          {compareIds.length > 1 ? ` · comparing ${compareIds.length}` : ''}
          {query || signal !== 'ALL' ? ' · filtered' : ''}
        </span>
        <span className="meta" style={{ marginLeft: 'auto' }}>
          <kbd className="kbd-hint">⌘/Ctrl+click</kbd> compare
        </span>
      </div>

      {view === 'cards' ? (
        <div className="scanner-card-grid" role="list">
          {filtered.length === 0 ? (
            <p className="meta">No rows match filters. Import fixture supplier if empty.</p>
          ) : (
            filtered.map((r) => {
              const stale = isStale(r.lastDataUpdate);
              const selected = selectedId === r.productId;
              const comparing = compareIds.includes(r.productId);
              return (
                <article
                  key={r.productId}
                  role="listitem"
                  className={[
                    'scanner-card',
                    stale ? 'is-stale' : '',
                    selected ? 'is-selected' : '',
                    comparing ? 'is-compare' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={(e) => selectRow(r.productId, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectRow(r.productId, e);
                    }
                  }}
                  tabIndex={0}
                >
                  <Link
                    href={`/terminal/products/${r.productId}`}
                    className="scanner-card__media"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.primaryImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.primaryImageUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="scanner-card__placeholder">
                        {(r.product || '?').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    {r.mediaCount ? (
                      <span className="scanner-card__media-count">{r.mediaCount} media</span>
                    ) : null}
                  </Link>
                  <div className="scanner-card__body">
                    <div className="scanner-card__top">
                      <SignalBadge
                        signal={r.currentSignal}
                        href={`/terminal/products/${r.productId}`}
                      />
                      <strong className="scanner-card__score">{r.score}</strong>
                    </div>
                    <Link
                      href={`/terminal/products/${r.productId}`}
                      className="scanner-card__title"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.product}
                    </Link>
                    <p className="meta scanner-card__meta">
                      {r.brand ? `${r.brand} · ` : ''}
                      {r.category}
                      {typeof r.rating === 'number' && r.rating > 0
                        ? ` · ★ ${r.rating.toFixed(1)}`
                        : ''}
                    </p>
                    <p className="scanner-card__econ">
                      <Money minor={r.expectedNetProfitMinor} currency={r.currency} signed />
                      <span className="meta"> · {formatBps(r.expectedMarginBps)} margin</span>
                    </p>
                    <p className="meta">
                      {r.supplier} · {r.sourcePlatform}
                      {stale ? ' · STALE' : ''}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </div>
      ) : null}

      <div className="table-wrap" hidden={view === 'cards'}>
        <table className="scanner-table" aria-label="Market scanner opportunities">
          <thead>
            <tr>
              <Th k="currentSignal">Signal</Th>
              <Th k="score">Score</Th>
              <Th k="product">Product</Th>
              <Th k="category">Category</Th>
              <Th k="sourcePlatform">Source</Th>
              <Th k="supplier">Supplier</Th>
              <Th k="supplierCostMinor">Cost</Th>
              <Th k="shippingCostMinor">Ship</Th>
              <Th k="estimatedMarketplaceFeesMinor">Fees</Th>
              <Th k="estimatedAdvertisingAllowanceMinor">Ads</Th>
              <Th k="targetSellingPriceMinor">Price</Th>
              <Th k="expectedNetProfitMinor">Exp. profit*</Th>
              <Th k="expectedMarginBps">Margin</Th>
              <Th k="demandScore">Demand</Th>
              <Th k="trendScore">Trend</Th>
              <Th k="competitionScore">Comp</Th>
              <Th k="supplierReliability">Sup</Th>
              <Th k="shippingReliability">ShipR</Th>
              <Th k="reviewHealth">Reviews</Th>
              <Th k="returnRiskScore">Return</Th>
              <Th k="policyRiskScore">Policy</Th>
              <Th k="forecastConfidence">Conf</Th>
              <Th k="lastDataUpdate">Updated</Th>
              <Th k="stale">Fresh</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={24} className="empty">
                  No rows match filters. Import fixture supplier if empty.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const stale = isStale(r.lastDataUpdate);
                const selected = selectedId === r.productId;
                const comparing = compareIds.includes(r.productId);
                return (
                  <tr
                    key={r.productId}
                    className={[
                      stale ? 'row-stale' : '',
                      selected ? 'is-selected' : '',
                      comparing ? 'is-compare' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    data-selected={selected ? 'true' : undefined}
                    data-compare={comparing ? 'true' : undefined}
                    tabIndex={0}
                    onClick={(e) => selectRow(r.productId, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectRow(r.productId, e);
                      }
                    }}
                    aria-selected={selected || comparing}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <SignalBadge
                        signal={r.currentSignal}
                        href={`/terminal/products/${r.productId}`}
                      />
                    </td>
                    <td>{r.score}</td>
                    <td>
                      <div className="scanner-product-cell">
                        {r.primaryImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className="scanner-product-cell__thumb"
                            src={r.primaryImageUrl}
                            alt=""
                            width={40}
                            height={40}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="scanner-product-cell__thumb scanner-product-cell__thumb--empty" aria-hidden>
                            {(r.product || '?').slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div className="scanner-product-cell__text">
                          <Link href={`/terminal/products/${r.productId}`}>{r.product}</Link>
                          {r.isFixture ||
                          (r.sourcePlatform && r.sourcePlatform.startsWith('fixture')) ? (
                            <div className="meta" style={{ margin: 0, color: 'var(--warning, #c90)' }}>
                              TEST FIXTURE — not live marketplace data
                            </div>
                          ) : null}
                          {r.brand ? (
                            <div className="meta" style={{ margin: 0 }}>
                              {r.brand}
                            </div>
                          ) : null}
                          {typeof r.rating === 'number' && r.rating > 0 ? (
                            <div className="meta">
                              ★ {r.rating.toFixed(1)}
                              {r.reviewCount != null ? ` · ${r.reviewCount} reviews` : ''}
                              {r.mediaCount ? ` · ${r.mediaCount} media` : ''}
                            </div>
                          ) : r.mediaCount ? (
                            <div className="meta">{r.mediaCount} media</div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>{r.category}</td>
                    <td>
                      {r.sourcePlatform}
                      {r.isFixture || r.sourcePlatform?.startsWith('fixture') ? (
                        <div className="meta" style={{ margin: 0 }}>
                          fixture
                        </div>
                      ) : null}
                    </td>
                    <td>{r.supplier}</td>
                    <td>{formatMoney(r.supplierCostMinor, r.currency)}</td>
                    <td>{formatMoney(r.shippingCostMinor, r.currency)}</td>
                    <td>{formatMoney(r.estimatedMarketplaceFeesMinor, r.currency)}</td>
                    <td>{formatMoney(r.estimatedAdvertisingAllowanceMinor, r.currency)}</td>
                    <td>{formatMoney(r.targetSellingPriceMinor, r.currency)}</td>
                    <td>
                      <Money minor={r.expectedNetProfitMinor} currency={r.currency} signed />
                    </td>
                    <td
                      className={
                        r.expectedMarginBps > 0
                          ? 'money-positive'
                          : r.expectedMarginBps < 0
                            ? 'money-negative'
                            : undefined
                      }
                    >
                      {formatBps(r.expectedMarginBps)}
                    </td>
                    <td>{r.demandScore}</td>
                    <td>{r.trendScore}</td>
                    <td>{r.competitionScore}</td>
                    <td>{r.supplierReliability}</td>
                    <td>{r.shippingReliability}</td>
                    <td>{r.reviewHealth}</td>
                    <td>{r.returnRiskScore}</td>
                    <td
                      className={
                        r.policyRiskScore >= 70
                          ? 'text-blocked'
                          : r.policyRiskScore >= 40
                            ? 'text-warning'
                            : undefined
                      }
                    >
                      {r.policyRiskScore}
                    </td>
                    <td>
                      <ConfidenceMeter value={r.forecastConfidence} />
                    </td>
                    <td>{new Date(r.lastDataUpdate).toLocaleString()}</td>
                    <td>
                      <FreshnessBadge iso={r.lastDataUpdate} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
