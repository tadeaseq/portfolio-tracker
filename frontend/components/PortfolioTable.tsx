"use client";

import { useMemo, useState } from "react";
import type { Position } from "@/lib/api";

type SortKey = "ticker" | "broker" | "quantity" | "avg_buy_price" | "currency" | "cost";

const columns: { key: SortKey; label: string }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "broker", label: "Broker" },
  { key: "quantity", label: "Qty" },
  { key: "avg_buy_price", label: "Avg. buy price" },
  { key: "currency", label: "Ccy" },
  { key: "cost", label: "Cost basis" },
];

const costOf = (p: Position) => p.quantity * p.avg_buy_price;

export default function PortfolioTable({ positions }: { positions: Position[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("cost");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const sorted = useMemo(() => {
    return [...positions].sort((a, b) => {
      const av = sortKey === "cost" ? costOf(a) : a[sortKey];
      const bv = sortKey === "cost" ? costOf(b) : b[sortKey];
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * sortDir;
      return ((av as number) - (bv as number)) * sortDir;
    });
  }, [positions, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  if (positions.length === 0) {
    return (
      <div className="border border-dashed border-line p-14 text-center text-ink-soft">
        <strong className="block font-serif text-ink text-[1.1rem] mb-1.5 font-semibold">No positions yet</strong>
        Upload a T212 export or connect a broker to get started.
      </div>
    );
  }

  const maxCost = Math.max(...sorted.map(costOf));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.88rem] border-collapse">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => handleSort(c.key)}
                className="text-left font-medium text-ink-soft text-xs pb-2.5 px-3 border-b border-ink cursor-pointer whitespace-nowrap select-none hover:text-ink"
              >
                {c.label}
                {sortKey === c.key && (
                  <span className="text-gold ml-0.5 text-[0.65rem]">{sortDir === 1 ? "▲" : "▼"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const cost = costOf(p);
            const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
            return (
              <tr key={`${p.ticker}-${p.broker}-${i}`} className="hover:bg-paper-raised">
                <td className="py-2.5 px-3 border-b border-line font-semibold">{p.ticker}</td>
                <td className="py-2.5 px-3 border-b border-line">
                  <span className="inline-block px-1.5 py-0.5 border border-line font-mono text-[0.68rem] text-ink-soft">
                    {p.broker}
                  </span>
                </td>
                <td className="py-2.5 px-3 border-b border-line font-mono text-right">{p.quantity}</td>
                <td className="py-2.5 px-3 border-b border-line font-mono text-right">{p.avg_buy_price.toFixed(2)}</td>
                <td className="py-2.5 px-3 border-b border-line font-mono text-right">{p.currency}</td>
                <td className="py-2.5 px-3 border-b border-line font-mono text-right">
                  {cost.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  <div className="h-[3px] bg-line mt-1.5 relative overflow-hidden">
                    <span className="absolute left-0 top-0 bottom-0 bg-gold" style={{ width: `${pct}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
