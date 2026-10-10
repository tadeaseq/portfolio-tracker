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

export interface Transaction {
  ticker: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  currency: string;
  fee: number;
  executed_at: string; // ISO datetime
  broker: string;
}

export interface Lot {
  ticker: string;
  broker: string;
  quantity: number;
  buy_price: number;
  currency: string;
  bought_at: string; // ISO datetime
}

export interface BrokerAccount {
  id: string;
  broker: string; // "T212" | "XTB" | "IBKR"
  display_name: string | null;
}

export interface UploadResult {
  imported_transactions: number;
  positions: number;
}

export type LotMethod = "fifo" | "lifo";

export async function getPortfolio(): Promise<PortfolioSummary> {
  const res = await fetch(`${API_BASE_URL}/portfolio`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch portfolio: ${res.status}`);
  }
  return res.json();
}

export async function getBrokerAccounts(): Promise<BrokerAccount[]> {
  const res = await fetch(`${API_BASE_URL}/portfolio/accounts`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch broker accounts: ${res.status}`);
  }
  return res.json();
}

export async function getTransactions(): Promise<Transaction[]> {
  const res = await fetch(`${API_BASE_URL}/portfolio/transactions`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch transactions: ${res.status}`);
  }
  return res.json();
}

export async function getLots(method: LotMethod): Promise<Lot[]> {
  const res = await fetch(`${API_BASE_URL}/portfolio/lots?method=${method}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch lots: ${res.status}`);
  }
  return res.json();
}

export async function uploadT212Csv(brokerAccountId: string, file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${API_BASE_URL}/portfolio/upload/t212?broker_account_id=${encodeURIComponent(brokerAccountId)}`,
    { method: "POST", body: formData }
  );
  if (!res.ok) {
    // surface the backend's explanation (e.g. "CSV is missing expected columns")
    let message = `Upload failed: ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }
  return res.json();
}
