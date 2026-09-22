import { getPortfolio } from "@/lib/api";
import PortfolioTable from "@/components/PortfolioTable";

export default async function DashboardPage() {
  let summary = { total_positions: 0, positions: [] };
  let error: string | null = null;

  try {
    summary = await getPortfolio();
  } catch (e) {
    error = "Could not reach the backend. Is it running on localhost:8000?";
  }

  return (
    <main className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-semibold mb-1">Your Portfolio</h1>
      <p className="text-gray-500 mb-8">Aggregated across all connected brokers.</p>

      {error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : (
        <PortfolioTable positions={summary.positions} />
      )}
    </main>
  );
}
