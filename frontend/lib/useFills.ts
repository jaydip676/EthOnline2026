"use client";

import { useCallback, useEffect, useState } from "react";
import { parseAbiItem, zeroAddress } from "viem";
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
      const latest = await publicClient.getBlockNumber();
      const start =
        START_BLOCK > 0n && START_BLOCK <= latest ? START_BLOCK : latest > LOG_SPAN ? latest - LOG_SPAN : 0n;
      const rows: FillRow[] = [];
      for (let from = start; from <= latest; from += LOG_SPAN + 1n) {
        const to = from + LOG_SPAN > latest ? latest : from + LOG_SPAN;
        const batch = await publicClient.getLogs({
          address: ROUTER,
          event: swapped,
          fromBlock: from,
          toBlock: to,
        });
        for (const log of batch) {
          const { maker: logMaker, taker, tokenIn, tokenOut, amountIn, amountOut } = log.args;
          if (!logMaker || !taker || !tokenIn || !tokenOut || amountIn === undefined || amountOut === undefined) {
            continue;
          }
          rows.push({
            tx: log.transactionHash,
            block: log.blockNumber ?? 0n,
            maker: logMaker,
            taker,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
          });
        }
      }
      rows.reverse();
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
