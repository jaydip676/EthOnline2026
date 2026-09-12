/** Collision heuristic. Method demonstration, not a validated predictor. */

export const WAD = 10n ** 18n;
export const BPS = 10_000n;
export const HAZARD_QUAD = 21n;
export const TARGET_HAZARD_BPS = 100n;
export const COVERAGE_REF = 4_000n;

export type HeuristicArgs = {
  reliabilityBps: number;
  slacWad: bigint;
  minCoverageBps: number;
  isContract: boolean;
  sizeBpsOfAvailable: number;
};

export type HeuristicScore = {
  predictedFillBps: number;
  maxSafeSlac: bigint;
  collisionHazardBps: number;
};

function minBig(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function slacFromRungs(rungs: number, commitPct: number): bigint {
  return BigInt(rungs * commitPct) * 10n ** 16n;
}

export function rawHazardBps(slacWad: bigint): bigint {
  if (slacWad <= WAD) return 0n;
  const capped = slacWad > 9n * WAD ? 9n * WAD : slacWad;
  const x = capped - WAD;
  const h = (HAZARD_QUAD * x * x) / (WAD * WAD);
  return minBig(BPS, h);
}

export function collisionHazardBps(a: HeuristicArgs): bigint {
  let h = rawHazardBps(a.slacWad);
  if (!a.isContract) h = (h * 5n) / 4n;
  const cov = BigInt(a.minCoverageBps);
  if (cov > 0n && cov < COVERAGE_REF) h = (h * COVERAGE_REF) / cov;
  if (a.sizeBpsOfAvailable > 5_000) h += BigInt(a.sizeBpsOfAvailable - 5_000) / 10n;
  return minBig(BPS, h);
}

export function score(a: HeuristicArgs): HeuristicScore {
  const h = collisionHazardBps(a);
  const fill = (BigInt(a.reliabilityBps) * (BPS - h)) / BPS;
  return {
    predictedFillBps: Number(fill),
    maxSafeSlac: maxSafeSlac(a),
    collisionHazardBps: Number(h),
  };
}

export function maxSafeSlac(a: HeuristicArgs): bigint {
  let lo = WAD;
  let hi = 9n * WAD;
  let best = WAD;
  for (let i = 0; i < 24 && lo < hi; i++) {
    const mid = (lo + hi) / 2n;
    const probe = { ...a, slacWad: mid };
    if (collisionHazardBps(probe) <= TARGET_HAZARD_BPS) {
      best = mid;
      lo = mid + 1n;
    } else {
      hi = mid;
    }
  }
  return best;
}
