import { slacFromRungs, type HeuristicScore } from "@/lib/collision";
import { formatSlac, formatToken, formatUsd } from "@/lib/format";

export type RiskInput = {
  spot: bigint;
  ethBal: bigint;
  usdcBal: bigint;
  commitPct: number;
  rangePct: number;
  envelopePct: number;
  rungs: number;
  coveragePct: number;
  quotedSlac: number;
  roundTripBps: number;
  worstEth: bigint;
  score: HeuristicScore;
  isContract: boolean;
};

/** Deterministic copy. Does not hold a key. Does not price a swap. */
export function explainRisk(input: RiskInput): string[] {
  const walk = input.roundTripBps > 0 ? (input.rangePct * 100) / input.roundTripBps : 0;
  const roundTrips = walk / 2;
  const envelopeClosesA15 = input.envelopePct < 15;
  const quotedWad = slacFromRungs(input.rungs, input.commitPct);
  const overSafe = quotedWad > input.score.maxSafeSlac;

  return [
    "This text is a function of the sliders. It does not hold a key and it does not price a swap. A wrong collision number costs a taker one reverted simulation.",
    `You hold ${formatToken(input.ethBal, 18, 3)} WETH and ${formatToken(input.usdcBal, 6, 0)} USDC. If ETH drops 15% from ${formatUsd(input.spot, 0)}, the coins stay in the wallet. Worst-case inventory if every bid fills to the bottom of the ±${input.rangePct}% range is about ${formatToken(input.worstEth, 18, 3)} ETH.`,
    envelopeClosesA15
      ? `The envelope is Chainlink ±${input.envelopePct}%, tighter than a 15% print, so rungs go dark before that mark. On 8 Nov 2022 (FTX) ETH sold off more than 20% in hours — the envelope would have paused the grid; it would not have removed the inventory already taken.`
      : `The envelope is Chainlink ±${input.envelopePct}%. A 15% dump still quotes until price exits that band. On 8 Nov 2022 (FTX) ETH sold off more than 20% in hours; once the feed printed outside the envelope, every rung would have gone dark.`,
    `Half-spread is priced so a round trip is ${input.roundTripBps.toFixed(1)} bps. Walking the ±${input.rangePct}% range once is about ${roundTrips.toFixed(1)} round trips of 2s — only if the pair actually trades that path.`,
    `Quoted SLAC is ${input.quotedSlac.toFixed(1)}× with a ${input.coveragePct}% coverage floor, ${input.rungs} rungs, ${input.commitPct}% commit, ${input.isContract ? "contract" : "EOA"} wallet. The collision heuristic (quadratic in SLAC−1, ~3.2× → 1% under the test-17 pattern) supports about ${formatSlac(input.score.maxSafeSlac)} for this wallet. Predicted fill ${ (input.score.predictedFillBps / 100).toFixed(1) }%. Treat both as a method demonstration, not a bound you can take to production.${overSafe ? " Quoted SLAC is above that demo band." : ""}`,
  ];
}
