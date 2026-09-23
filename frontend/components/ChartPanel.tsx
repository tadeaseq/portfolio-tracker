"use client";

import { useMemo, useRef, useState } from "react";
import type { Position } from "@/lib/api";
import { relHistory, currentPriceOf, HISTORY_DAYS_COUNT, dateLabelAt } from "@/lib/mockHistory";

export default function ChartPanel({ positions }: { positions: Position[] }) {
  const tickers = useMemo(() => [...new Set(positions.map((p) => p.ticker))], [positions]);
  // null = all tickers included
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const chartPositions = positions.filter((p) => selected === null || selected.has(p.ticker));

  const series = useMemo(() => {
    const out: number[] = [];
    for (let d = 0; d < HISTORY_DAYS_COUNT; d++) {
      let v = 0;
      for (const p of chartPositions) {
        const price = currentPriceOf(p.ticker, p.avg_buy_price);
        v += p.quantity * price * relHistory(p.ticker)[d];
      }
      out.push(v);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartPositions.map((p) => `${p.ticker}:${p.quantity}`).join(",")]);

  function toggle(ticker: string | null) {
    if (ticker === null) {
      setSelected(null);
      return;
    }
    setSelected((prev) => {
      const base = prev === null ? new Set(tickers) : new Set(prev);
      if (base.has(ticker)) base.delete(ticker);
      else base.add(ticker);
      return base.size === tickers.length ? null : base;
    });
  }

  const w = 720,
    h = 220,
    padL = 4,
    padR = 4,
    padT = 14,
    padB = 22;
  const min = series.length ? Math.min(...series) : 0;
  const max = series.length ? Math.max(...series) : 1;
  const span = max - min || 1;
  const x = (i: number) => padL + (i / (HISTORY_DAYS_COUNT - 1)) * (w - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / span) * (h - padT - padB);

  const linePath = series.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const areaPath = series.length
    ? `${linePath} L${x(HISTORY_DAYS_COUNT - 1).toFixed(1)},${(h - padB).toFixed(1)} L${x(0).toFixed(1)},${(h - padB).toFixed(1)} Z`
    : "";

  const latest = series[series.length - 1] ?? 0;
  const first = series[0] ?? 0;
  const deltaPct = first ? ((latest - first) / first) * 100 : 0;

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = (e.clientX - rect.left) / rect.width;
    const i = Math.max(0, Math.min(HISTORY_DAYS_COUNT - 1, Math.round(relX * (HISTORY_DAYS_COUNT - 1))));
    setHoverIdx(i);
  }

  return (
    <div className="bg-paper-raised border border-line px-5 pt-5 pb-3 mb-7">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-3">
        <div>
          <h2 className="font-serif font-semibold text-[1.05rem] mb-0.5">Portfolio value — last 90 days</h2>
          <p className="text-[0.78rem] text-ink-soft m-0">Filter which holdings count toward the line below.</p>
        </div>
        <div className="text-right font-mono">
          <div className="text-[1.3rem]">{latest.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
          <div className={`text-[0.8rem] mt-0.5 ${deltaPct >= 0 ? "text-gain" : "text-loss"}`}>
            {deltaPct >= 0 ? "+" : ""}
            {deltaPct.toFixed(1)}% over 90d
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3.5">
        <button
          onClick={() => toggle(null)}
          className={`font-mono text-[0.72rem] px-2.5 py-1 border border-dashed ${
            selected === null ? "border-gold bg-gold-soft text-ink" : "border-line text-ink-soft"
          }`}
        >
          All holdings
        </button>
        {tickers.map((t) => {
          const on = selected === null || selected.has(t);
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              className={`font-mono text-[0.72rem] px-2.5 py-1 border ${
                on ? "border-gold bg-gold-soft text-ink" : "border-line text-ink-soft"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          width="100%"
          height={220}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <line x1={padL} y1={h - padB} x2={w - padR} y2={h - padB} stroke="var(--line)" strokeWidth={1} />
          {areaPath && <path d={areaPath} fill="var(--gold-soft)" opacity={0.6} stroke="none" />}
          {linePath && <path d={linePath} fill="none" stroke="var(--gold)" strokeWidth={2} />}
          <text x={padL} y={h - 6} fontSize={10} fill="var(--ink-soft)" fontFamily="var(--font-mono)">
            {dateLabelAt(0)}
          </text>
          <text
            x={w - padR}
            y={h - 6}
            fontSize={10}
            fill="var(--ink-soft)"
            fontFamily="var(--font-mono)"
            textAnchor="end"
          >
            {dateLabelAt(HISTORY_DAYS_COUNT - 1)}
          </text>
          {hoverIdx !== null && series[hoverIdx] !== undefined && (
            <circle cx={x(hoverIdx)} cy={y(series[hoverIdx])} r={3.5} fill="var(--gold)" />
          )}
        </svg>
        {hoverIdx !== null && series[hoverIdx] !== undefined && (
          <div
            className="absolute -translate-x-1/2 -translate-y-[110%] bg-ink text-paper font-mono text-[0.72rem] px-2 py-1 rounded-sm pointer-events-none whitespace-nowrap"
            style={{ left: `${(x(hoverIdx) / w) * 100}%`, top: `${(y(series[hoverIdx]) / h) * 100}%` }}
          >
            {dateLabelAt(hoverIdx)} · {series[hoverIdx].toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
        )}
      </div>
    </div>
  );
}
