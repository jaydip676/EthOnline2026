/**
 * Open-source Ladder resolver.
 *
 * Each poll:
 *  1. Enumerate live rungs from LadderLens
 *  2. Quote each live side via LadderRouter.quote
 *  3. Fetch the 1inch Swap API price for the same size when ONEINCH_API_KEY is set
 *  4. If the rung beats 1inch by minMargin, simulate against the next block
 *  5. Swap at most one fill per poll when TAKE_FILLS=1 (never more than spendableNow)
 *  6. Optionally hedge inventory on 1inch (HEDGE=1)
 *
 * v1 disclosure: this process is the counterparty to Ladder users.
 * It holds a key because it is a taker, not a model. It never prices a swap with an LLM.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  maxUint256,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, sepolia } from "viem/chains";
import { erc20Abi, lensAbi, managerAbi, routerAbi } from "./abi";

loadDotEnv();

const ZERO = "0x0000000000000000000000000000000000000000" as Address;
const deployments = readDeployments();
const RPC_URL = process.env.RPC_URL ?? "https://base-rpc.publicnode.com";
const LENS = addr(process.env.LENS, deployments.lens);
const ROUTER = addr(process.env.ROUTER, deployments.router);
const GRID_MANAGER = addr(process.env.GRID_MANAGER, deployments.gridManager);
const MAKER = addr(process.env.MAKER);
const WETH = addr(process.env.WETH, deployments.weth);
const USDC = addr(process.env.USDC, deployments.usdc);
const MIN_MARGIN_BPS = BigInt(process.env.MIN_MARGIN_BPS ?? 10);
const FILL_WETH = BigInt(process.env.FILL_WETH ?? "1000000000000000"); // 0.001
const FILL_USDC = BigInt(process.env.FILL_USDC ?? "1000000"); // 1
const TAKE_FILLS = flag("TAKE_FILLS");
const HEDGE = flag("HEDGE");
const ALLOW_UNREFERENCED = flag("ALLOW_UNREFERENCED");
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY ?? "";
const CHAIN_ID = Number(process.env.CHAIN_ID ?? deployments.chainId ?? 8453);
const chain = CHAIN_ID === 11155111 ? sepolia : base;

export type QuoteAttempt = {
  gridId: string;
  rung: number;
  side: "bid" | "ask";
  amountIn: string;
  amountOut: string;
  oneInchOut?: string;
  take: boolean;
  simulated: boolean;
  reason: string;
};

function loadDotEnv() {
  try {
    const text = readFileSync(resolve(import.meta.dirname, "../.env"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i < 0) continue;
      const key = trimmed.slice(0, i).trim();
      const value = trimmed.slice(i + 1).trim();
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env is optional; process.env is enough in CI.
  }
}

function readDeployments(): {
  chainId: number;
  lens: string;
  router: string;
  gridManager: string;
  weth: string;
  usdc: string;
} {
  try {
    return JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../../frontend/lib/deployments.json"), "utf8"),
    ) as {
      chainId: number;
      lens: string;
      router: string;
      gridManager: string;
      weth: string;
      usdc: string;
    };
  } catch {
    return {
      chainId: 8453,
      lens: ZERO,
      router: ZERO,
      gridManager: ZERO,
      weth: "0x4200000000000000000000000000000000000006",
      usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    };
  }
}

function flag(name: string): boolean {
  const v = (process.env[name] ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function addr(value?: string, fallback: string = ZERO): Address {
  if (value && value.length === 42 && value.toLowerCase() !== ZERO) return value as Address;
  if (fallback.length === 42 && fallback.toLowerCase() !== ZERO) return fallback as Address;
  return ZERO;
}

function isZero(value: Address): boolean {
  return value.toLowerCase() === ZERO;
}

export function beats(rungOut: bigint, refOut: bigint | null, allowUnreferenced = false): boolean {
  if (refOut === null || refOut === 0n) return allowUnreferenced;
  return rungOut * 10_000n > refOut * (10_000n + MIN_MARGIN_BPS);
}

export async function oneInchQuote(src: Address, dst: Address, amount: bigint): Promise<bigint | null> {
  if (!ONEINCH_API_KEY || CHAIN_ID !== 8453) return null;
  const url = new URL(`https://api.1inch.dev/swap/v6.0/${CHAIN_ID}/quote`);
  url.searchParams.set("src", src);
  url.searchParams.set("dst", dst);
  url.searchParams.set("amount", amount.toString());
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ONEINCH_API_KEY}` } });
  if (!res.ok) return null;
  const body = (await res.json()) as { dstAmount?: string };
  return body.dstAmount ? BigInt(body.dstAmount) : null;
}

async function oneInchSwapTx(src: Address, dst: Address, amount: bigint, from: Address) {
  const url = new URL(`https://api.1inch.dev/swap/v6.0/${CHAIN_ID}/swap`);
  url.searchParams.set("src", src);
  url.searchParams.set("dst", dst);
  url.searchParams.set("amount", amount.toString());
  url.searchParams.set("from", from);
  url.searchParams.set("slippage", "1");
  url.searchParams.set("disableEstimate", "true");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ONEINCH_API_KEY}` } });
  if (!res.ok) throw new Error(`1inch swap ${res.status}`);
  const body = (await res.json()) as {
    tx?: { to: Address; data: Hex; value: string };
    dstAmount?: string;
  };
  if (!body.tx) throw new Error("1inch swap missing tx");
  return body.tx;
}

export async function tick(): Promise<QuoteAttempt[]> {
  const attempts: QuoteAttempt[] = [];
  if (isZero(LENS) || isZero(MAKER) || isZero(ROUTER) || isZero(GRID_MANAGER)) {
    console.log("set LENS, ROUTER, GRID_MANAGER and MAKER (or deploy so deployments.json is filled)");
    return attempts;
  }

  const client = createPublicClient({ chain, transport: http(RPC_URL) });
  const key = process.env.PRIVATE_KEY;
  const account = key && key.length > 10 ? privateKeyToAccount(key as Hex) : undefined;
  const taker = (account?.address ?? ZERO) as Address;
  const wethIsA = WETH.toLowerCase() < USDC.toLowerCase();

  const count = await client.readContract({
    address: GRID_MANAGER,
    abi: managerAbi,
    functionName: "gridCount",
    args: [MAKER],
  });

  type Candidate = QuoteAttempt & {
    gridIdN: bigint;
    order: { maker: Address; traits: bigint; data: Hex };
    td: Hex;
    amount: bigint;
    tokenIn: Address;
    tokenOut: Address;
    amountInN: bigint;
    amountOutN: bigint;
  };
  const live: Candidate[] = [];
  let spendWeth = 0n;
  let spendUsdc = 0n;

  for (let gridId = 0n; gridId < count; gridId++) {
    const view = await client.readContract({
      address: LENS,
      abi: lensAbi,
      functionName: "gridView",
      args: [MAKER, gridId],
    });
    if (!view.active) continue;
    spendWeth = view.spendableWeth;
    spendUsdc = view.spendableUsdc;

    const grid = await client.readContract({
      address: GRID_MANAGER,
      abi: managerAbi,
      functionName: "getGrid",
      args: [MAKER, gridId],
    });
    const rungs = await client.readContract({
      address: LENS,
      abi: lensAbi,
      functionName: "rungs",
      args: [MAKER, gridId],
    });

    for (const rung of rungs) {
      const sides: { side: "bid" | "ask"; live: boolean; amount: bigint; tokenIn: Address; tokenOut: Address; available: bigint }[] =
        [
          {
            side: "bid",
            live: rung.bidLive,
            amount: FILL_WETH,
            tokenIn: WETH,
            tokenOut: USDC,
            available: rung.realAvailableUsdc,
          },
          {
            side: "ask",
            live: rung.askLive,
            amount: FILL_USDC,
            tokenIn: USDC,
            tokenOut: WETH,
            available: rung.realAvailableWeth,
          },
        ];
      for (const row of sides) {
        if (!row.live || row.available === 0n) continue;
        const isAToB = row.side === "bid" ? wethIsA : !wethIsA;
        const order = await client.readContract({
          address: GRID_MANAGER,
          abi: managerAbi,
          functionName: "buildRungOrder",
          args: [grid.params, rung.index],
        });
        const td = await client.readContract({
          address: GRID_MANAGER,
          abi: managerAbi,
          functionName: "buildTakerData",
          args: [taker, true, isAToB, true],
        });
        try {
          const [amountIn, amountOut] = await client.readContract({
            address: ROUTER,
            abi: routerAbi,
            functionName: "quote",
            args: [order, row.amount, td],
            account: taker === ZERO ? undefined : taker,
          });
          if (amountIn === 0n || amountOut === 0n) continue;
          if (amountOut > row.available) {
            attempts.push({
              gridId: gridId.toString(),
              rung: Number(rung.index),
              side: row.side,
              amountIn: amountIn.toString(),
              amountOut: amountOut.toString(),
              take: false,
              simulated: false,
              reason: "quote exceeds realAvailable on this rung",
            });
            continue;
          }
          const spendable = row.side === "bid" ? spendUsdc : spendWeth;
          if (amountOut > spendable) {
            attempts.push({
              gridId: gridId.toString(),
              rung: Number(rung.index),
              side: row.side,
              amountIn: amountIn.toString(),
              amountOut: amountOut.toString(),
              take: false,
              simulated: false,
              reason: "would take more than spendableNow across rungs",
            });
            continue;
          }
          const ref = await oneInchQuote(row.tokenIn, row.tokenOut, amountIn);
          const edge = beats(amountOut, ref, ALLOW_UNREFERENCED);
          const attempt: Candidate = {
            gridId: gridId.toString(),
            gridIdN: gridId,
            rung: Number(rung.index),
            side: row.side,
            amountIn: amountIn.toString(),
            amountOut: amountOut.toString(),
            oneInchOut: ref === null ? undefined : ref.toString(),
            take: edge,
            simulated: false,
            reason: edge
              ? "rung beats the 1inch reference (or unreferenced demo)"
              : "rung does not beat 1inch by minMargin",
            order,
            td,
            amount: row.amount,
            tokenIn: row.tokenIn,
            tokenOut: row.tokenOut,
            amountInN: amountIn,
            amountOutN: amountOut,
          };
          attempts.push(attempt);
          live.push(attempt);
        } catch (err) {
          attempts.push({
            gridId: gridId.toString(),
            rung: Number(rung.index),
            side: row.side,
            amountIn: "0",
            amountOut: "0",
            take: false,
            simulated: false,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  const best = live.filter((row) => row.take).sort((a, b) => (a.amountOutN > b.amountOutN ? -1 : 1))[0];
  for (const row of live) {
    if (row !== best) row.take = false;
  }
  if (best && account) {
    try {
      await client.simulateContract({
        address: ROUTER,
        abi: routerAbi,
        functionName: "swap",
        args: [best.order, best.amount, best.td],
        account: account.address,
      });
      best.simulated = true;
      best.reason = `${best.reason}; simulated ok`;
    } catch (err) {
      best.take = false;
      best.reason = `simulate failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  } else if (best && !account) {
    best.take = false;
    best.reason = "simulated skipped — set PRIVATE_KEY to take";
  }

  if (TAKE_FILLS && best?.take && best.simulated && account) {
    const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) });
    const bump = async (token: Address, spender: Address, needed: bigint) => {
      const current = await client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account.address, spender],
      });
      if (current >= needed) return;
      const approveHash = await wallet.writeContract({
        account,
        chain,
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, maxUint256],
      });
      await client.waitForTransactionReceipt({ hash: approveHash });
    };
    await bump(best.tokenIn, ROUTER, best.amountInN);
    const hash = await wallet.writeContract({
      account,
      chain,
      address: ROUTER,
      abi: routerAbi,
      functionName: "swap",
      args: [best.order, best.amount, best.td],
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    best.reason = `filled ${receipt.transactionHash}`;
    if (HEDGE && ONEINCH_API_KEY && CHAIN_ID === 8453) {
      try {
        const tx = await oneInchSwapTx(best.tokenOut, best.tokenIn, best.amountOutN, account.address);
        await bump(best.tokenOut, tx.to, best.amountOutN);
        const hedgeHash = await wallet.sendTransaction({
          account,
          chain,
          to: tx.to,
          data: tx.data,
          value: BigInt(tx.value ?? 0),
        });
        best.reason = `${best.reason}; hedged ${hedgeHash}`;
      } catch (err) {
        best.reason = `${best.reason}; hedge failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  } else if (best?.take && !TAKE_FILLS) {
    best.take = false;
    best.reason = `${best.reason}; TAKE_FILLS=0 so this poll only quotes`;
  }

  console.log(
    JSON.stringify(
      {
        t: new Date().toISOString(),
        maker: MAKER,
        live: attempts.filter((row) => row.amountOut !== "0").length,
        minMarginBps: MIN_MARGIN_BPS.toString(),
        takeFills: TAKE_FILLS,
        hedge: HEDGE,
        oneInch: Boolean(ONEINCH_API_KEY),
        router: ROUTER,
        attempts: attempts.map((row) => ({
          gridId: row.gridId,
          rung: row.rung,
          side: row.side,
          amountIn: row.amountIn,
          amountOut: row.amountOut,
          oneInchOut: row.oneInchOut,
          take: row.take,
          simulated: row.simulated,
          reason: row.reason,
        })),
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
