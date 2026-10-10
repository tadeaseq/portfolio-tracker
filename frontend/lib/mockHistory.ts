/**
 * Deterministic mock price history.
 *
 * The backend does not store historical prices yet (Position only has
 * quantity + avg_buy_price, see backend/app/models/models.py), so the
 * value-over-time chart has nothing real to plot. This generates a stable,
 * seeded fake price path per ticker instead of random noise on every
 * render. The window length is variable: it's normally 90 days, but the
 * chart extends it when "show buy events" needs to reach further back to
 * a real purchase date.
 *
 * TODO: once the backend exposes a real price/history endpoint, delete
 * this file and feed the chart from that instead.
 */

const DEFAULT_HISTORY_DAYS = 90;

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

/** Relative price multipliers for a ticker across `days` days, ending at 1.0 */
export function relHistory(ticker: string, days: number = DEFAULT_HISTORY_DAYS): number[] {
  const key = `${ticker}:${days}`;
  if (historyCache[key]) return historyCache[key];
  const rnd = mulberry32(hashSeed(ticker));
  const vals = [0.82 + rnd() * 0.18];
  for (let i = 1; i < days; i++) {
    const drift = (rnd() - 0.47) * 0.035;
    vals.push(Math.max(0.4, vals[i - 1] * (1 + drift)));
  }
  const scale = 1 / vals[vals.length - 1];
  historyCache[key] = vals.map((v) => v * scale);
  return historyCache[key];
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

export const HISTORY_DAYS_COUNT = DEFAULT_HISTORY_DAYS;

export function dateLabelAt(indexFromEnd: number, days: number = DEFAULT_HISTORY_DAYS): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1 - indexFromEnd));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Maps a real calendar date into a 0..days-1 index of the window ending today. */
export function dayIndexOf(date: Date, days: number): number | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
  const idx = days - 1 - diffDays;
  if (idx < 0 || idx > days - 1) return null;
  return idx;
}
