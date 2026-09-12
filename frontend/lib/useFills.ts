"use client";

import { useCallback, useEffect, useState } from "react";
import { parseAbiItem, zeroAddress, type PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { ROUTER, START_BLOCK } from "./addresses";

const swapped = parseAbiItem(
  "event Swapped(bytes32 orderHash, address maker, address taker, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)",
);

/** Base public RPC (`mainnet.base.org`) rejects eth_getLogs wider than 2,000 blocks. */
const LOG_SPAN = 1_999n;

export type FillRow = {
  tx: `0x${string}`;
  block: bigint;
  maker: `0x${string}`;
  taker: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  amountOut: bigint;
};

async function getSwappedLogs(client: PublicClient) {
  const latest = await client.getBlockNumber();
  const start = START_BLOCK > 0n && START_BLOCK <= latest ? START_BLOCK : latest > LOG_SPAN ? latest - LOG_SPAN : 0n;
  const logs: Awaited<ReturnType<PublicClient["getLogs"]>> = [];
  for (let from = start; from <= latest; from += LOG_SPAN + 1n) {
    const to = from + LOG_SPAN > latest ? latest : from + LOG_SPAN;
    const batch = await client.getLogs({
      address: ROUTER,
      event: swapped,
      fromBlock: from,
      toBlock: to,
    });
    logs.push(...batch);
  }
  return logs;
}

export function useFills(maker?: `0x${string}`) {
  const publicClient = usePublicClient();
  const [fills, setFills] = useState<FillRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    if (!publicClient || ROUTER === zeroAddress) return;
    setLoading(true);
    setError("");
    try {
      const logs = await getSwappedLogs(publicClient);
      const rows = [...logs].reverse().map((log) => ({
        tx: log.transactionHash,
        block: log.blockNumber ?? 0n,
        maker: log.args.maker as `0x${string}`,
        taker: log.args.taker as `0x${string}`,
        tokenIn: log.args.tokenIn as `0x${string}`,
        tokenOut: log.args.tokenOut as `0x${string}`,
        amountIn: log.args.amountIn as bigint,
        amountOut: log.args.amountOut as bigint,
      }));
      setFills(maker ? rows.filter((row) => row.maker.toLowerCase() === maker.toLowerCase()) : rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [publicClient, maker]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { fills, loading, error, refetch };
}
