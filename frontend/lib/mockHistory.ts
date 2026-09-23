/**
 * Deterministic mock price history.
 *
 * The backend does not store historical prices yet (Position only has
 * quantity + avg_buy_price, see backend/app/models/models.py), so the
 * value-over-time chart has nothing real to plot. This generates a stable,
 * seeded fake price path per ticker instead of random noise on every
 * render.
 *
 * TODO: once the backend exposes a real price/history endpoint, delete
 * this file and feed the chart from that instead.
 */

const HISTORY_DAYS = 90;

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const historyCache: Record<string, number[]> = {};

/** Relative price multipliers for a ticker across HISTORY_DAYS, ending at 1.0 */
export function relHistory(ticker: string): number[] {
  if (historyCache[ticker]) return historyCache[ticker];
  const rnd = mulberry32(hashSeed(ticker));
  const vals = [0.82 + rnd() * 0.18];
  for (let i = 1; i < HISTORY_DAYS; i++) {
    const drift = (rnd() - 0.47) * 0.035;
    vals.push(Math.max(0.4, vals[i - 1] * (1 + drift)));
  }
  const scale = 1 / vals[vals.length - 1];
  historyCache[ticker] = vals.map((v) => v * scale);
  return historyCache[ticker];
}

const priceCache: Record<string, number> = {};

/** Deterministic mock "current price", derived from the position's avg buy price. */
export function currentPriceOf(ticker: string, avgBuyPrice: number): number {
  if (priceCache[ticker] != null) return priceCache[ticker];
  const rnd = mulberry32(hashSeed(ticker + "|px"));
  const price = avgBuyPrice * (0.85 + rnd() * 0.45);
  priceCache[ticker] = price;
  return price;
}

export const HISTORY_DAYS_COUNT = HISTORY_DAYS;

export function dateLabelAt(indexFromEnd: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (HISTORY_DAYS - 1 - indexFromEnd));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
