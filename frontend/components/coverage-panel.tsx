"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectGate } from "@/components/connect-gate";
import { DataRow } from "@/components/data-row";
import { FillTable } from "@/components/fill-table";
import { PageHeader } from "@/components/page-header";
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
import { formatBps, formatSlac, formatToken } from "@/lib/format";
import { useFills } from "@/lib/useFills";
import { PAUSED, useGridCount, useGridView, useRegisteredGrid, useReliability, useRungs } from "@/lib/useGrid";

function coverageBadge(bps: bigint, floorBps: number) {
  const n = Number(bps);
  if (n < floorBps) return { variant: "warning" as const, label: formatBps(n) };
  return { variant: "success" as const, label: formatBps(n) };
}

export function CoveragePanel() {
  const { address, isConnected } = useAccount();
  const gridId = 0n;
  const { data: count } = useGridCount(address);
  const { data: view } = useGridView(address, gridId);
  const { data: rungs } = useRungs(address, gridId);
  const { data: grid } = useRegisteredGrid(address, gridId);
  const { data: score } = useReliability(address);
  const fills = useFills(address);

  const hasGrid = Boolean(count && count > 0n && view);
  const floorBps = grid?.params.minCoverageBps ?? 4_000;
  const slac = view?.slac ?? 0n;

  if (!isConnected) {
    return (
      <ConnectGate
        title="Connect to read coverage"
        description="The lens is the only source of quoted vs real. SLAC is provisioned liquidity divided by wallet equity."
      />
    );
  }

  if (!hasGrid || !view) {
    return (
      <div>
        <PageHeader
          eyebrow="Judge screen"
          title="Coverage"
          description="Whitepaper §6.3: monitor virtual versus real balance ratios. Ship a grid first."
        />
        <Card>
          <CardHeader>
            <CardTitle>No grid registered</CardTitle>
            <CardDescription>
              Start on Grid. Coverage, SLAC and live flags all come from LadderLens after you register.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/grid">Start a grid</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Judge screen"
        title="Coverage"
        description="Quoted versus real available, per rung. SLAC is defined in Aqua §4.1 and unbounded there. Ladder measures it and stops quotes below the coverage floor."
        action={
          <Button variant="outline" asChild>
            <Link href="/position">Position</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              SLAC
              <Badge variant={slac > 10n ** 18n ? "warning" : "success"}>{formatSlac(slac)}</Badge>
            </CardTitle>
            <CardDescription>Σ provisioned ÷ wallet equity. 1.0× means fully backed.</CardDescription>
          </CardHeader>
          <CardContent className="divide-rule">
            <DataRow label="Current" value={<span className="num">{formatSlac(slac)}</span>} />
            <DataRow label="Coverage floor" value={<span className="num">{formatBps(floorBps)}</span>} />
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
            <CardTitle>History, not a predictor</CardTitle>
            <CardDescription>fills succeeded / attempted. Backward-looking.</CardDescription>
          </CardHeader>
          <CardContent className="divide-rule">
            <DataRow
              label="Reliability"
              value={<span className="num">{score === undefined ? "—" : formatBps(score)}</span>}
            />
            <DataRow label="Fills logged" value={<span className="num">{fills.fills.length}</span>} />
            <DataRow label="Predicted fill" value="—" />
            <DataRow label="Max safe SLAC" value="—" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What this is</CardTitle>
          </CardHeader>
          <CardContent className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
            Aqua §3 tells makers to dock chronically underfunded strategies by hand. CoverageGuard is
            that policy on-chain. Predicted fill probability and max safe SLAC are a method
            demonstration on a weekend of data — they are not shown as numbers here on purpose.
          </CardContent>
        </Card>
      </div>

      <Alert variant="info">
        <AlertTitle>SLAC is defined, not bounded</AlertTitle>
        <AlertDescription>
          The whitepaper demonstrates 9× and assumes utilization stays low so shared capital can
          service occasional trades. Test 17 records collision rate against that assumption. This
          screen is §6.3, productized.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Quoted vs real</CardTitle>
          <CardDescription>
            Virtual is Aqua provisioned size. Real available is{" "}
            <span className="num">min(virtual, wallet × commit, allowance)</span>. Coverage below the
            floor darkens the rung.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>#</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Virt WETH</TableHead>
                <TableHead className="text-right">Real WETH</TableHead>
                <TableHead className="text-right">WETH cov</TableHead>
                <TableHead className="text-right">Virt USDC</TableHead>
                <TableHead className="text-right">Real USDC</TableHead>
                <TableHead className="text-right">USDC cov</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rungs ?? []).map((rung) => {
                const weth = coverageBadge(rung.coverageWeth, floorBps);
                const usdc = coverageBadge(rung.coverageUsdc, floorBps);
                const live = rung.bidLive || rung.askLive;
                return (
                  <TableRow key={rung.index.toString()}>
                    <TableCell className="num">{rung.index.toString()}</TableCell>
                    <TableCell>
                      <Badge variant={live ? "success" : "secondary"}>
                        {live ? "Live" : (PAUSED[rung.pausedReason] ?? "Paused")}
                      </Badge>
                    </TableCell>
                    <TableCell className="num text-right">{formatToken(rung.virtualWeth, 18, 4)}</TableCell>
                    <TableCell className="num text-right">{formatToken(rung.realAvailableWeth, 18, 4)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={weth.variant}>{weth.label}</Badge>
                    </TableCell>
                    <TableCell className="num text-right">{formatToken(rung.virtualUsdc, 6, 2)}</TableCell>
                    <TableCell className="num text-right">{formatToken(rung.realAvailableUsdc, 6, 2)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={usdc.variant}>{usdc.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collision history</CardTitle>
          <CardDescription>
            On-chain fills against this maker. The 1×–9× collision graph is{" "}
            <span className="num">test_spec17_fuzzSlacCollisions</span>, not a fitted predictor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FillTable fills={fills.fills} loading={fills.loading} error={fills.error} onRefresh={() => void fills.refetch()} />
        </CardContent>
      </Card>
    </div>
  );
}
