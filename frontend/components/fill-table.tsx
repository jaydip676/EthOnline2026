"use client";

import Link from "next/link";
import { ArrowUpRightIcon, RefreshCwIcon, Rows3Icon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { USDC, WETH } from "@/lib/tokens";
import { explorerTx, formatToken, shortenAddress } from "@/lib/format";
import { WETH_TOKEN } from "@/lib/addresses";
import type { FillRow } from "@/lib/useFills";

export function FillTable({
  fills,
  loading,
  error,
  onRefresh,
}: {
  fills: FillRow[];
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
}) {
  const showEmpty = !loading && fills.length === 0 && !error;

  return (
    <div className="grid gap-2">
      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      {showEmpty ? (
        <EmptyState
          icon={<Rows3Icon className="size-4" />}
          title="No fills yet"
          description="When a taker hits a rung, the LadderRouter Swapped log lands here."
          action={
            <Button size="sm" variant="outline" asChild>
              <Link href="/grid">Open Grid</Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Block</TableHead>
              <TableHead>Taker</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
              <TableHead className="text-right">Tx</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && fills.length === 0
              ? Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index} className="hover:bg-transparent">
                    <TableCell colSpan={5}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : null}
            {fills.map((row) => {
              const inDec = row.tokenIn.toLowerCase() === WETH_TOKEN.toLowerCase() ? WETH.decimals : USDC.decimals;
              const outDec = row.tokenOut.toLowerCase() === WETH_TOKEN.toLowerCase() ? WETH.decimals : USDC.decimals;
              return (
                <TableRow key={`${row.tx}-${row.block}`}>
                  <TableCell className="num text-xs text-muted-foreground">{row.block.toString()}</TableCell>
                  <TableCell className="num text-xs">{shortenAddress(row.taker)}</TableCell>
                  <TableCell className="num text-right text-[13px]">{formatToken(row.amountIn, inDec)}</TableCell>
                  <TableCell className="num text-right text-[13px] text-primary">
                    {formatToken(row.amountOut, outDec)}
                  </TableCell>
                  <TableCell className="text-right">
                    <a
                      className="num inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
                      href={explorerTx(row.tx)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortenAddress(row.tx, 3)}
                      <ArrowUpRightIcon className="size-3" />
                    </a>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {onRefresh ? (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCwIcon className={loading ? "animate-spin" : undefined} />
            {loading ? "Loading" : "Refresh"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
