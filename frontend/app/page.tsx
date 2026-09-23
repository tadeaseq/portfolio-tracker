import { getPortfolio } from "@/lib/api";
import PortfolioDashboard from "@/components/PortfolioDashboard";

export default async function DashboardPage() {
  let summary = { total_positions: 0, positions: [] };
  let error: string | null = null;

  try {
    summary = await getPortfolio();
  } catch (e) {
    error = "Could not reach the backend. Is it running on localhost:8000?";
  }

  return (
    <main className="max-w-[1080px] mx-auto px-6 py-10 pb-20">
      <header className="flex justify-between items-end gap-4 flex-wrap border-b border-line pb-5 mb-7">
        <div>
          <h1 className="font-serif font-semibold text-[2rem] tracking-tight mb-1">Your Portfolio</h1>
          <p className="text-ink-soft text-sm m-0">Aggregated across all connected brokers.</p>
        </div>
        <div className="font-mono text-[0.78rem] text-ink-soft text-right">
          Cost-basis view
          <br />
          <strong className="text-ink font-medium">
            {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}
          </strong>
        </div>
      </header>

      {error ? (
        <p className="text-loss text-sm">{error}</p>
      ) : (
        <PortfolioDashboard positions={summary.positions} />
      )}
    </main>
  );
}
