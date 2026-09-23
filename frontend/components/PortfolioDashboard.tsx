"use client";

import { useMemo, useState } from "react";
import type { Position } from "@/lib/api";
import BrokerNav from "./BrokerNav";
import ChartPanel from "./ChartPanel";
import PortfolioTable from "./PortfolioTable";

export default function PortfolioDashboard({ positions }: { positions: Position[] }) {
  const [activeBroker, setActiveBroker] = useState("ALL");

  const brokers = useMemo(() => [...new Set(positions.map((p) => p.broker))], [positions]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: positions.length };
    brokers.forEach((b) => (c[b] = positions.filter((p) => p.broker === b).length));
    return c;
  }, [positions, brokers]);

  const filtered = activeBroker === "ALL" ? positions : positions.filter((p) => p.broker === activeBroker);

  const totalCost = filtered.reduce((s, p) => s + p.quantity * p.avg_buy_price, 0);
  const currencies = [...new Set(filtered.map((p) => p.currency))];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line mb-7">
        <SummaryCell label="Positions" value={filtered.length} />
        <SummaryCell label="Total cost basis" value={totalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })} />
        <SummaryCell label="Currencies" value={currencies.join(" / ") || "—"} />
        <SummaryCell label="Brokers connected" value={brokers.length} />
      </div>

      <ChartPanel positions={filtered} />

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 items-start">
        <BrokerNav brokers={brokers} counts={counts} active={activeBroker} onSelect={setActiveBroker} />
        <PortfolioTable positions={filtered} />
      </div>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-paper-raised px-[18px] py-4">
      <div className="text-[0.72rem] text-ink-soft mb-1.5">{label}</div>
      <div className="font-mono text-[1.25rem] font-medium">{value}</div>
    </div>
  );
}
