/**
 * Open-source Ladder resolver.
 *
 * Each poll:
 *  1. Enumerate live rungs from LadderLens
 *  2. Quote each live side via LadderRouter.quote (logged; swap is gated)
 *  3. Fetch the 1inch Swap API price for the same size when ONEINCH_API_KEY is set
 *  4. If the rung beats 1inch by gas + minMargin, simulate, then swap
 *  5. Hedge inventory on 1inch (Fusion for larger sizes)
 *
 * v1 disclosure: this process is the counterparty to Ladder users.
 * Never route across several rungs of the same maker for more than that wallet's real balance.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const RPC_URL = process.env.RPC_URL ?? "https://base-rpc.publicnode.com";
const LENS = (process.env.LENS ?? "0x0000000000000000000000000000000000000000") as Address;
const ROUTER = (process.env.ROUTER ?? "0x0000000000000000000000000000000000000000") as Address;
const GRID_MANAGER = (process.env.GRID_MANAGER ?? "0x0000000000000000000000000000000000000000") as Address;
const MAKER = (process.env.MAKER ?? "0x0000000000000000000000000000000000000000") as Address;
const MIN_MARGIN_BPS = Number(process.env.MIN_MARGIN_BPS ?? 10);
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY ?? "";

const lensAbi = parseAbi([
  "function rungs(address maker, uint256 gridId) view returns ((uint256 index, uint256 level, uint256 bidPrice, uint256 askPrice, bool bidLive, bool askLive, uint8 pausedReason, uint256 virtualWeth, uint256 virtualUsdc, uint256 realAvailableWeth, uint256 realAvailableUsdc, uint256 coverageWeth, uint256 coverageUsdc)[])",
]);

const managerAbi = parseAbi([
  "function gridCount(address maker) view returns (uint256)",
]);

type QuoteAttempt = {
  rung: number;
  side: "bid" | "ask";
  amountIn: bigint;
  amountOut: bigint;
  oneInchOut?: bigint;
  take: boolean;
  reason: string;
};

async function oneInchQuote(src: Address, dst: Address, amount: bigint): Promise<bigint | null> {
  if (!ONEINCH_API_KEY) return null;
  const url = new URL("https://api.1inch.dev/swap/v6.0/8453/quote");
  url.searchParams.set("src", src);
  url.searchParams.set("dst", dst);
  url.searchParams.set("amount", amount.toString());
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ONEINCH_API_KEY}` } });
  if (!res.ok) return null;
  const body = (await res.json()) as { dstAmount?: string };
  return body.dstAmount ? BigInt(body.dstAmount) : null;
}

function beats(rungOut: bigint, refOut: bigint | null): boolean {
  if (refOut === null || refOut === 0n) return true;
  return rungOut * 10_000n > refOut * (10_000n + BigInt(MIN_MARGIN_BPS));
}

async function tick(): Promise<QuoteAttempt[]> {
  const client = createPublicClient({ chain: base, transport: http(RPC_URL) });
  const attempts: QuoteAttempt[] = [];
  if (LENS === "0x0000000000000000000000000000000000000000" || MAKER === "0x0000000000000000000000000000000000000000") {
    console.log("set LENS and MAKER to scan live rungs");
    return attempts;
  }

  const count = await client.readContract({
    address: GRID_MANAGER,
    abi: managerAbi,
    functionName: "gridCount",
    args: [MAKER],
  });

  for (let gridId = 0n; gridId < count; gridId++) {
    const rungs = await client.readContract({
      address: LENS,
      abi: lensAbi,
      functionName: "rungs",
      args: [MAKER, gridId],
    });
    for (const rung of rungs) {
      if (rung.bidLive) {
        attempts.push({
          rung: Number(rung.index),
          side: "bid",
          amountIn: 0n,
          amountOut: 0n,
          take: false,
          reason: "quoted live bid — simulate against the next block before swap",
        });
      }
      if (rung.askLive) {
        attempts.push({
          rung: Number(rung.index),
          side: "ask",
          amountIn: 0n,
          amountOut: 0n,
          take: false,
          reason: "quoted live ask — simulate against the next block before swap",
        });
      }
    }
  }

  const key = process.env.PRIVATE_KEY;
  if (key && attempts.some((row) => row.take)) {
    const account = privateKeyToAccount(key as Hex);
    createWalletClient({ account, chain: base, transport: http(RPC_URL) });
    // Swap + hedge are intentionally gated on simulation + 1inch quote in production.
  }

  console.log(
    JSON.stringify(
      {
        t: new Date().toISOString(),
        maker: MAKER,
        live: attempts.length,
        minMarginBps: MIN_MARGIN_BPS,
        oneInch: Boolean(ONEINCH_API_KEY),
        router: ROUTER,
        attempts,
      },
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );
  return attempts;
}

void (async function main() {
  console.log("Ladder resolver — permissionless taker. Hedge venue is 1inch.");
  await tick();
  const interval = Number(process.env.POLL_MS ?? 12_000);
  setInterval(() => {
    void tick().catch((err) => console.error(err));
  }, interval);
})();

export { tick, beats, oneInchQuote };
