"use client";

import { useEffect, useMemo, useState } from "react";
import { getLots, type Lot, type LotMethod } from "@/lib/api";

const MS_PER_DAY = 86400000;
const DAYS_PER_YEAR = 365.25;

export default function TaxLotsTable({
  brokerFilter,
  refreshKey = 0,
}: {
  brokerFilter: string;
  refreshKey?: number; // bump to re-fetch lots (e.g. after an upload)
}) {
  const [method, setMethod] = useState<LotMethod>("fifo");
  const [thresholdYears, setThresholdYears] = useState(3);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLots(method)
      .then((data) => {
        if (!cancelled) {
          setLots(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load lots from the backend.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [method, refreshKey]);

  const thresholdDays = Math.round(thresholdYears * DAYS_PER_YEAR);

  const rows = useMemo(() => {
    const now = Date.now();
    const filtered = brokerFilter === "ALL" ? lots : lots.filter((l) => l.broker === brokerFilter);
    return filtered
      .map((lot) => {
        const boughtAt = new Date(lot.bought_at);
        const heldDays = Math.floor((now - boughtAt.getTime()) / MS_PER_DAY);
        return { lot, boughtAt, heldDays, eligible: heldDays >= thresholdDays };
      })
      .sort((a, b) => b.heldDays - a.heldDays);
  }, [lots, brokerFilter, thresholdDays]);

  const eligibleCount = rows.filter((r) => r.eligible).length;

  return (
    <div className="bg-paper-raised border border-line px-5 pt-5 pb-5 mt-7">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-1">
        <div>
          <h2 className="font-serif font-semibold text-[1.05rem] mb-0.5">Holding period</h2>
          <p className="text-[0.78rem] text-ink-soft m-0 max-w-[46ch]">
            Simplified time-test by purchase date — not tax advice. Check the actual rules
            (and any per-year gain threshold) for your situation before relying on this.
          </p>
        </div>
        <div className="font-mono text-[0.78rem] text-ink-soft text-right">
          {eligibleCount} / {rows.length} lots past the threshold
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-5 my-4">
        <label className="flex flex-col gap-1 text-[0.74rem] text-ink-soft">
          Sell method
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as LotMethod)}
            className="font-mono text-[0.82rem] bg-paper border border-line px-2 py-1.5 text-ink"
          >
            <option value="fifo">FIFO — oldest shares sold first</option>
            <option value="lifo">LIFO — newest shares sold first</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[0.74rem] text-ink-soft">
          Threshold (years)
          <input
            type="number"
            min={0}
            step={0.5}
            value={thresholdYears}
            onChange={(e) => setThresholdYears(Math.max(0, Number(e.target.value) || 0))}
            className="font-mono text-[0.82rem] bg-paper border border-line px-2 py-1.5 w-24 text-ink"
          />
        </label>
      </div>

      {loading && <p className="text-[0.82rem] text-ink-soft">Loading lots…</p>}
      {error && <p className="text-[0.82rem] text-loss">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="text-[0.82rem] text-ink-soft">No open lots for this broker filter.</p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[0.86rem] border-collapse">
            <thead>
              <tr>
                {["Ticker", "Broker", "Qty", "Buy price", "Bought", "Held", "Status"].map((label) => (
                  <th
                    key={label}
                    className="text-left font-medium text-ink-soft text-xs pb-2 px-3 border-b border-ink whitespace-nowrap"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const years = (r.heldDays / DAYS_PER_YEAR).toFixed(1);
                const remaining = thresholdDays - r.heldDays;
                return (
                  <tr key={i} className="hover:bg-paper">
                    <td className="py-2 px-3 border-b border-line font-semibold">{r.lot.ticker}</td>
                    <td className="py-2 px-3 border-b border-line">
                      <span className="inline-block px-1.5 py-0.5 border border-line font-mono text-[0.68rem] text-ink-soft">
                        {r.lot.broker}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-b border-line font-mono text-right">{r.lot.quantity}</td>
                    <td className="py-2 px-3 border-b border-line font-mono text-right">
                      {r.lot.buy_price.toFixed(2)} {r.lot.currency}
                    </td>
                    <td className="py-2 px-3 border-b border-line font-mono text-right">
                      {r.boughtAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-2 px-3 border-b border-line font-mono text-right">
                      {r.heldDays}d <span className="text-ink-soft">({years}y)</span>
                    </td>
                    <td className="py-2 px-3 border-b border-line">
                      {r.eligible ? (
                        <span className="inline-block px-2 py-0.5 text-[0.72rem] font-mono bg-gain-bg text-gain">
                          tax-free
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-[0.72rem] font-mono bg-loss-bg text-loss">
                          {remaining}d left
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
