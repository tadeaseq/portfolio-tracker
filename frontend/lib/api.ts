const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Position {
  ticker: string;
  quantity: number;
  avg_buy_price: number;
  currency: string;
  broker: string;
}

export interface PortfolioSummary {
  total_positions: number;
  positions: Position[];
}

export async function getPortfolio(): Promise<PortfolioSummary> {
  const res = await fetch(`${API_BASE_URL}/portfolio`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch portfolio: ${res.status}`);
  }
  return res.json();
}

export async function uploadT212Csv(brokerAccountId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${API_BASE_URL}/portfolio/upload/t212?broker_account_id=${brokerAccountId}`,
    { method: "POST", body: formData }
  );
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }
  return res.json();
}
