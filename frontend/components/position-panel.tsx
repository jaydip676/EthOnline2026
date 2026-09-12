"use client";

import { useState } from "react";
import { encodeFunctionData } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ConnectGate } from "@/components/connect-gate";
import { DataRow } from "@/components/data-row";
import { FillTable } from "@/components/fill-table";
import { PageHeader } from "@/components/page-header";
import { RangeBar } from "@/components/range-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { aquaAbi, erc20Abi, gridManagerAbi } from "@/lib/abi";
import { AQUA, GRID_MANAGER, ROUTER, USDC_TOKEN, WETH_TOKEN, isDeployed } from "@/lib/addresses";
import { formatToken, formatUsd } from "@/lib/format";
import { runIntent } from "@/lib/intent";
import { useFills } from "@/lib/useFills";
import { PAUSED, useGridCount, useGridView, useReliability, useRungs } from "@/lib/useGrid";
import { toastTxErr, toastTxOk } from "@/lib/tx";

export function PositionPanel() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [busy, setBusy] = useState<"pause" | "off" | null>(null);

  const { data: count } = useGridCount(address);
  const gridId = 0n;
  const { data: view } = useGridView(address, gridId);
  const { data: rungs } = useRungs(address, gridId);
  const { data: score } = useReliability(address);
  const fills = useFills(address);

  const hasGrid = Boolean(count && count > 0n && view);

  async function dockAll() {
    if (!address || !publicClient || !walletClient || !rungs) return;
    setBusy("pause");
    try {
      const grid = await publicClient.readContract({
        address: GRID_MANAGER,
        abi: [
          {
            type: "function",
            name: "getGrid",
            stateMutability: "view",
            inputs: [
              { name: "maker", type: "address" },
              { name: "gridId", type: "uint256" },
            ],
            outputs: [
              {
                type: "tuple",
                components: [
                  { name: "tokenA", type: "address" },
                  { name: "tokenB", type: "address" },
                  { name: "hashes", type: "bytes32[]" },
                  {
                    name: "params",
                    type: "tuple",
                    components: [
                      { name: "maker", type: "address" },
                      { name: "weth", type: "address" },
                      { name: "usdc", type: "address" },
                      { name: "oracle", type: "address" },
                      { name: "treasury", type: "address" },
                      { name: "aqua", type: "address" },
                      { name: "spot", type: "uint256" },
                      { name: "rangeBps", type: "uint16" },
                      { name: "envelopeBps", type: "uint16" },
                      { name: "rungCount", type: "uint8" },
                      { name: "maxShareBps", type: "uint16" },
                      { name: "protocolFeeBps", type: "uint24" },
                      { name: "maxStaleness", type: "uint32" },
                      { name: "wethDecimals", type: "uint8" },
                      { name: "usdcDecimals", type: "uint8" },
                      { name: "mode", type: "uint8" },
                      { name: "tier", type: "uint8" },
                      { name: "saltNonce", type: "uint64" },
                      { name: "ethCap", type: "uint256" },
                      { name: "usdcCap", type: "uint256" },
                    ],
                  },
                  { name: "registeredAt", type: "uint64" },
                  { name: "active", type: "bool" },
                ],
              },
            ],
          },
        ] as const,
        functionName: "getGrid",
        args: [address, gridId],
      });
      const hashes = [...grid.hashes];
      const calls = hashes.map((hash, i) => ({
        id: `dock-${i}`,
        label: `Dock rung ${i + 1}`,
        to: AQUA,
        data: encodeFunctionData({
          abi: aquaAbi,
          functionName: "dock",
          args: [ROUTER, hash, [WETH_TOKEN, USDC_TOKEN]],
        }),
      }));
      calls.push({
        id: "inactive",
        label: "Mark inactive",
        to: GRID_MANAGER,
        data: encodeFunctionData({
          abi: gridManagerAbi,
          functionName: "markInactive",
          args: [gridId],
        }),
      });
      const result = await runIntent(publicClient, walletClient, calls);
      toastTxOk("Grid paused", "Docked. Zero transfers. Nothing quotes.", result.hashes.at(-1));
    } catch (error) {
      toastTxErr(error);
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    if (!address || !publicClient || !walletClient) return;
    setBusy("off");
    try {
      const result = await runIntent(publicClient, walletClient, [
        {
          id: "revoke-weth",
          label: "Revoke WETH",
          to: WETH_TOKEN,
          data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [AQUA, 0n] }),
        },
        {
          id: "revoke-usdc",
          label: "Revoke USDC",
          to: USDC_TOKEN,
          data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [AQUA, 0n] }),
        },
      ]);
      toastTxOk("Allowance revoked", "This turns off every Aqua position this wallet holds.", result.hashes.at(-1));
    } catch (error) {
      toastTxErr(error);
    } finally {
      setBusy(null);
    }
  }

  if (!isConnected) {
    return (
      <ConnectGate
        title="Connect to see the position"
        description="The lens is the only thing the UI reads. Live means it can fill."
      />
    );
  }

  if (!isDeployed() || !hasGrid || !view) {
    return (
      <div>
        <PageHeader eyebrow="Monitor" title="Position" description="Ship a grid first. Then this screen is the source of truth." />
        <Card>
          <CardHeader>
            <CardTitle>No grid registered</CardTitle>
            <CardDescription>Start on the Grid screen. The lens will pick it up under this wallet.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const state = PAUSED[view.envelopeState] ?? "Live";
  const live = view.envelopeState === 0 && view.active;

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Monitor"
        title="Position"
        description="Paused is not Off. Only docking or revoking is genuinely off — and a deposit will wake paused rungs."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void dockAll()} loading={busy === "pause"} disabled={Boolean(busy)}>
              Pause
            </Button>
            <Button variant="destructive" onClick={() => void revoke()} loading={busy === "off"} disabled={Boolean(busy)}>
              Off
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Status
              <Badge variant={live ? "success" : view.active ? "warning" : "secondary"}>{live ? "Live" : state}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-rule">
            <DataRow label="Oracle" value={<span className="num">{formatUsd(view.oraclePrice)}</span>} />
            <DataRow label="Envelope" value={<span className="num">{formatUsd(view.floor)} – {formatUsd(view.ceiling)}</span>} />
            <DataRow
              label="Spendable now"
              value={
                <span className="num">
                  {formatToken(view.spendableWeth, 18, 4)} ETH · {formatToken(view.spendableUsdc, 6, 2)} USDC
                </span>
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reliability</CardTitle>
            <CardDescription>fills succeeded / attempted, rolling.</CardDescription>
          </CardHeader>
          <CardContent className="divide-rule">
            <DataRow label="Score" value={<span className="num">{score === undefined ? "—" : `${(Number(score) / 100).toFixed(2)}%`}</span>} />
            <DataRow label="Tier" value={view.tier === 1 ? "Committed" : "Flexible"} />
            <DataRow label="Reserve-backed" value={view.reserveBacked ? "Yes" : "No"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Envelope</CardTitle>
          </CardHeader>
          <CardContent>
            <RangeBar
              min={Number(view.floor) / 1e18}
              max={Number(view.ceiling) / 1e18}
              spot={Number(view.oraclePrice) / 1e18}
              unit="ETH/USD"
            />
          </CardContent>
        </Card>
      </div>

      <Alert variant="warning">
        <AlertTitle>Off is revoke</AlertTitle>
        <AlertDescription>
          The Aqua allowance is global. Revoking turns off every Aqua position this wallet holds — not only this grid.
          Pause (dock) if you only want these rungs dark.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Rungs</CardTitle>
          <CardDescription>A rung must never show Live when it cannot fill.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>#</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Bid</TableHead>
                <TableHead>Ask</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rungs ?? []).map((rung) => (
                <TableRow key={rung.index.toString()}>
                  <TableCell className="num">{rung.index.toString()}</TableCell>
                  <TableCell className="num">{formatUsd(rung.level)}</TableCell>
                  <TableCell className="num">{rung.bidLive ? formatUsd(rung.bidPrice) : "—"}</TableCell>
                  <TableCell className="num">{rung.askLive ? formatUsd(rung.askPrice) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={rung.bidLive || rung.askLive ? "success" : "secondary"}>
                      {rung.bidLive || rung.askLive ? "Live" : (PAUSED[rung.pausedReason] ?? "Paused")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fills</CardTitle>
          <CardDescription>LadderRouter Swapped. The v1 resolver is often the taker — that is disclosed, not a footnote.</CardDescription>
        </CardHeader>
        <CardContent>
          <FillTable fills={fills.fills} loading={fills.loading} error={fills.error} onRefresh={() => void fills.refetch()} />
        </CardContent>
      </Card>
    </div>
  );
}
