export const BPS = 10_000n;
export const ONE = 10n ** 18n;
export const FEE_SCALE = 10_000_000n;
export const DEFAULT_PROTOCOL_FEE = 5_000; // 5 bps, 1e7 scale
export const DEFAULT_STALENESS = 3_600;

export type Mode = 0 | 1 | 2; // Grid, Buy, Sell
export type Tier = 0 | 1; // Flexible, Committed

export type GridPreview = {
  levels: bigint[];
  bids: bigint[];
  asks: bigint[];
  spacing: bigint;
  halfSpread: bigint;
  low: bigint;
  high: bigint;
  floor: bigint;
  ceiling: bigint;
  roundTripBps: number;
};

export function mulBps(value: bigint, bps: number | bigint): bigint {
  return (value * BigInt(bps)) / BPS;
}

export function previewGrid(spot: bigint, rangeBps: number, envelopeBps: number, rungs: number): GridPreview {
  const low = mulBps(spot, BPS - BigInt(rangeBps));
  const high = mulBps(spot, BPS + BigInt(rangeBps));
  const n = BigInt(Math.max(2, rungs));
  const spacing = (high - low) / (n - 1n);
  const halfSpread = spacing / 2n;
  const levels: bigint[] = [];
  const bids: bigint[] = [];
  const asks: bigint[] = [];
  for (let i = 0; i < rungs; i++) {
    const level = low + spacing * BigInt(i);
    levels.push(level);
    bids.push(level - halfSpread);
    asks.push(level + halfSpread);
  }
  const roundTripBps = spot === 0n ? 0 : Number((halfSpread * 2n * BPS) / spot);
  return {
    levels,
    bids,
    asks,
    spacing,
    halfSpread,
    low,
    high,
    floor: mulBps(spot, BPS - BigInt(envelopeBps)),
    ceiling: mulBps(spot, BPS + BigInt(envelopeBps)),
    roundTripBps,
  };
}

/** Worst-case inventory if every bid fills down to the bottom of the range. */
export function worstCaseInventory(
  ethBalance: bigint,
  usdcBalance: bigint,
  commitBps: number,
  _rungs: number,
  spot: bigint,
): { worstEth: bigint; worstUsdc: bigint } {
  const ethCommit = mulBps(ethBalance, BigInt(commitBps));
  const usdcCommit = mulBps(usdcBalance, BigInt(commitBps));
  if (spot === 0n) return { worstEth: ethCommit, worstUsdc: 0n };
  const usdcAsEth = (usdcCommit * ONE * ONE) / (spot * 10n ** 6n);
  return {
    worstEth: ethCommit + usdcAsEth,
    worstUsdc: 0n,
  };
}
