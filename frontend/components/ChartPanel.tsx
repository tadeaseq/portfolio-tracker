"use client";

import { useMemo, useRef, useState } from "react";
import type { Position, Transaction } from "@/lib/api";
import { relHistory, currentPriceOf, dateLabelAt, dayIndexOf } from "@/lib/mockHistory";

const MIN_WINDOW_DAYS = 90;
const MAX_WINDOW_DAYS = 1825; // 5y cap, just to keep the mock walk sane

interface ChartPanelProps {
  positions: Position[];
  transactions: Transaction[];
}

interface MarkerInfo {
  x: number;
  y: number;
  ticker: string;
  dateLabel: string;
  quantity: number;
  price: number;
  currency: string;
}

export default function ChartPanel({ positions, transactions }: ChartPanelProps) {
  const tickers = useMemo(() => [...new Set(positions.map((p) => p.ticker))], [positions]);
  const [selected, setSelected] = useState<Set<string> | null>(null); // null = all
  const [showEvents, setShowEvents] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverMarker, setHoverMarker] = useState<MarkerInfo | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const chartPositions = positions.filter((p) => selected === null || selected.has(p.ticker));
  const chartTickers = new Set(chartPositions.map((p) => p.ticker));

  const buyEvents = useMemo(
    () => transactions.filter((t) => t.side === "BUY" && chartTickers.has(t.ticker)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, [...chartTickers].join(",")]
  );

  const days = useMemo(() => {
    if (!showEvents || buyEvents.length === 0) return MIN_WINDOW_DAYS;
    const today = new Date();
    let maxAge = 0;
    for (const tx of buyEvents) {
      const age = Math.round((today.getTime() - new Date(tx.executed_at).getTime()) / 86400000);
      if (age > maxAge) maxAge = age;
    }
    return Math.min(MAX_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, maxAge + 5));
  }, [showEvents, buyEvents]);

  const series = useMemo(() => {
    const out: number[] = [];
    for (let d = 0; d < days; d++) {
      let v = 0;
      for (const p of chartPositions) {
        const price = currentPriceOf(p.ticker, p.avg_buy_price);
        v += p.quantity * price * relHistory(p.ticker, days)[d];
      }
      out.push(v);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartPositions.map((p) => `${p.ticker}:${p.quantity}`).join(","), days]);

  function toggleTicker(ticker: string | null) {
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
    padB = 34; // extra bottom padding leaves room for the marker row
  const min = series.length ? Math.min(...series) : 0;
  const max = series.length ? Math.max(...series) : 1;
  const span = max - min || 1;
  const x = (i: number) => padL + (i / (days - 1)) * (w - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / span) * (h - padT - padB - 12);
  const markerY = h - padB + 10;

  const linePath = series.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const areaPath = series.length
    ? `${linePath} L${x(days - 1).toFixed(1)},${(h - padB - 12).toFixed(1)} L${x(0).toFixed(1)},${(h - padB - 12).toFixed(1)} Z`
    : "";

  const latest = series[series.length - 1] ?? 0;
  const first = series[0] ?? 0;
  const deltaPct = first ? ((latest - first) / first) * 100 : 0;

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = (e.clientX - rect.left) / rect.width;
    const i = Math.max(0, Math.min(days - 1, Math.round(relX * (days - 1))));
    setHoverIdx(i);
  }

  const markers = showEvents
    ? buyEvents
        .map((tx) => {
          const idx = dayIndexOf(new Date(tx.executed_at), days);
          if (idx === null) return null;
          return {
            idx,
            x: x(idx),
            ticker: tx.ticker,
            dateLabel: new Date(tx.executed_at).toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" }),
            quantity: tx.quantity,
            price: tx.price,
            currency: tx.currency,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null)
    : [];

  return (
    <div className="bg-paper-raised border border-line px-5 pt-5 pb-3 mb-7">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-3">
        <div>
          <h2 className="font-serif font-semibold text-[1.05rem] mb-0.5">
            Portfolio value — last {days} days
          </h2>
          <p className="text-[0.78rem] text-ink-soft m-0">
            Filter which holdings count toward the line below.
          </p>
        </div>
        <div className="text-right font-mono">
          <div className="text-[1.3rem]">{latest.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
          <div className={`text-[0.8rem] mt-0.5 ${deltaPct >= 0 ? "text-gain" : "text-loss"}`}>
            {deltaPct >= 0 ? "+" : ""}
            {deltaPct.toFixed(1)}% over {days}d
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <button
          onClick={() => toggleTicker(null)}
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
              onClick={() => toggleTicker(t)}
              className={`font-mono text-[0.72rem] px-2.5 py-1 border ${
                on ? "border-gold bg-gold-soft text-ink" : "border-line text-ink-soft"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-[0.78rem] text-ink-soft mb-3.5 cursor-pointer select-none w-fit">
        <input
          type="checkbox"
          checked={showEvents}
          onChange={(e) => setShowEvents(e.target.checked)}
          className="accent-[var(--gold)]"
        />
        Show buy events (when / how many / at what price)
      </label>

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
          <line
            x1={padL}
            y1={h - padB - 12}
            x2={w - padR}
            y2={h - padB - 12}
            stroke="var(--line)"
            strokeWidth={1}
          />
          {areaPath && <path d={areaPath} fill="var(--gold-soft)" opacity={0.6} stroke="none" />}
          {linePath && <path d={linePath} fill="none" stroke="var(--gold)" strokeWidth={2} />}
          <text x={padL} y={h - 6} fontSize={10} fill="var(--ink-soft)" fontFamily="var(--font-mono)">
            {dateLabelAt(0, days)}
          </text>
          <text
            x={w - padR}
            y={h - 6}
            fontSize={10}
            fill="var(--ink-soft)"
            fontFamily="var(--font-mono)"
            textAnchor="end"
          >
            {dateLabelAt(days - 1, days)}
          </text>
          {hoverIdx !== null && series[hoverIdx] !== undefined && (
            <circle cx={x(hoverIdx)} cy={y(series[hoverIdx])} r={3.5} fill="var(--gold)" />
          )}

          {markers.map((m, i) => (
            <g
              key={i}
              onMouseEnter={() =>
                setHoverMarker({
                  x: m.x,
                  y: markerY,
                  ticker: m.ticker,
                  dateLabel: m.dateLabel,
                  quantity: m.quantity,
                  price: m.price,
                  currency: m.currency,
                })
              }
              onMouseLeave={() => setHoverMarker(null)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={m.x} cy={markerY} r={6} fill="transparent" />
              <path
                d={`M${m.x - 4},${markerY + 4} L${m.x + 4},${markerY + 4} L${m.x},${markerY - 4} Z`}
                fill="var(--ink)"
                opacity={0.75}
              />
            </g>
          ))}
        </svg>

        {hoverIdx !== null && series[hoverIdx] !== undefined && !hoverMarker && (
          <div
            className="absolute -translate-x-1/2 -translate-y-[110%] bg-ink text-paper font-mono text-[0.72rem] px-2 py-1 rounded-sm pointer-events-none whitespace-nowrap"
            style={{ left: `${(x(hoverIdx) / w) * 100}%`, top: `${(y(series[hoverIdx]) / h) * 100}%` }}
          >
            {dateLabelAt(hoverIdx, days)} · {series[hoverIdx].toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </div>
        )}

        {hoverMarker && (
          <div
            className="absolute -translate-x-1/2 -translate-y-[130%] bg-ink text-paper font-mono text-[0.72rem] px-2 py-1 rounded-sm pointer-events-none whitespace-nowrap"
            style={{ left: `${(hoverMarker.x / w) * 100}%`, top: `${(hoverMarker.y / h) * 100}%` }}
          >
            {hoverMarker.ticker} · {hoverMarker.dateLabel} · {hoverMarker.quantity} ks @{" "}
            {hoverMarker.price.toFixed(2)} {hoverMarker.currency}
          </div>
        )}
      </div>
    </div>
  );
}
