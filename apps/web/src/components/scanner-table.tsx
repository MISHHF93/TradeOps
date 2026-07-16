'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatBps, formatMoney } from '../lib/money';
import type { ScannerRow } from '../lib/terminal-api';

type SortKey = keyof ScannerRow | 'stale';

function isStale(iso: string, maxAgeHours = 24): boolean {
  const ageMs = Date.now() - new Date(iso).getTime();
  return ageMs > maxAgeHours * 3600_000;
}

export function ScannerTable({ rows }: { rows: ScannerRow[] }) {
  const [query, setQuery] = useState('');
  const [signal, setSignal] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

  const signals = useMemo(
    () => ['ALL', ...Array.from(new Set(rows.map((r) => r.currentSignal))).sort()],
    [rows],
  );

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th>
      <button type="button" className="th-sort" onClick={() => toggleSort(k)}>
        {children}
        {sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  return (
    <div>
      <div className="scanner-filters">
        <input
          type="search"
          placeholder="Filter product, category, supplier…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={signal} onChange={(e) => setSignal(e.target.value)}>
          {signals.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All signals' : s}
            </option>
          ))}
        </select>
        <span className="meta">
          {filtered.length} / {rows.length} rows
        </span>
      </div>

      <div className="table-wrap">
        <table className="scanner-table">
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
                return (
                  <tr key={r.productId} className={stale ? 'row-stale' : undefined}>
                    <td>
                      <span className={`signal signal-${r.currentSignal}`}>{r.currentSignal}</span>
                    </td>
                    <td>{r.score}</td>
                    <td>
                      <Link href={`/terminal/products/${r.productId}`}>{r.product}</Link>
                    </td>
                    <td>{r.category}</td>
                    <td>{r.sourcePlatform}</td>
                    <td>{r.supplier}</td>
                    <td>{formatMoney(r.supplierCostMinor, r.currency)}</td>
                    <td>{formatMoney(r.shippingCostMinor, r.currency)}</td>
                    <td>{formatMoney(r.estimatedMarketplaceFeesMinor, r.currency)}</td>
                    <td>{formatMoney(r.estimatedAdvertisingAllowanceMinor, r.currency)}</td>
                    <td>{formatMoney(r.targetSellingPriceMinor, r.currency)}</td>
                    <td>{formatMoney(r.expectedNetProfitMinor, r.currency)}</td>
                    <td>{formatBps(r.expectedMarginBps)}</td>
                    <td>{r.demandScore}</td>
                    <td>{r.trendScore}</td>
                    <td>{r.competitionScore}</td>
                    <td>{r.supplierReliability}</td>
                    <td>{r.shippingReliability}</td>
                    <td>{r.reviewHealth}</td>
                    <td>{r.returnRiskScore}</td>
                    <td>{r.policyRiskScore}</td>
                    <td>{(r.forecastConfidence * 100).toFixed(0)}%</td>
                    <td>{new Date(r.lastDataUpdate).toLocaleString()}</td>
                    <td>
                      {stale ? (
                        <span className="badge degraded">STALE</span>
                      ) : (
                        <span className="badge up">OK</span>
                      )}
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
