"use client";

interface BrokerNavProps {
  brokers: string[];
  counts: Record<string, number>;
  active: string;
  onSelect: (broker: string) => void;
}

export default function BrokerNav({ brokers, counts, active, onSelect }: BrokerNavProps) {
  const items = ["ALL", ...brokers];

  return (
    <nav className="md:border-r border-line md:pr-5 pb-5 md:pb-0 border-b md:border-b-0 border-line flex flex-col">
      <div className="text-[0.72rem] text-ink-soft mb-2.5">Broker accounts</div>
      {items.map((b) => (
        <button
          key={b}
          onClick={() => onSelect(b)}
          className={`flex justify-between w-full text-left py-2 text-sm ${
            b === active ? "text-gold font-medium" : "text-ink"
          }`}
        >
          <span>{b === "ALL" ? "All accounts" : b}</span>
          <span className="font-mono text-ink-soft text-xs">{counts[b] ?? 0}</span>
        </button>
      ))}
    </nav>
  );
}
