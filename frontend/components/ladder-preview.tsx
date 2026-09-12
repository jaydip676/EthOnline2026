import { LiveDot } from "@/components/live-dot";
import { TokenLabel } from "@/components/token-avatar";
import { Badge } from "@/components/ui/badge";
import { formatUsd } from "@/lib/format";
import type { GridPreview } from "@/lib/grid";
import { USDC, WETH } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export type LadderRow = {
  id: string;
  level: bigint;
  bid: bigint;
  ask: bigint;
  bidLive?: boolean;
  askLive?: boolean;
  stateLabel?: string;
  stateLive?: boolean;
};

function nearestRung(levels: bigint[], spot: bigint): number {
  let best = 0;
  let dist = levels[0]! > spot ? levels[0]! - spot : spot - levels[0]!;
  for (let i = 1; i < levels.length; i++) {
    const d = levels[i]! > spot ? levels[i]! - spot : spot - levels[i]!;
    if (d < dist) {
      dist = d;
      best = i;
    }
  }
  return best;
}

function Usd({ price, className }: { price: bigint; className?: string }) {
  return (
    <span className={cn("num tabular-nums", className)}>
      ${formatUsd(price)}
    </span>
  );
}

export function RungLadder({
  rows,
  spot,
  showState = false,
}: {
  rows: LadderRow[];
  spot?: bigint;
  showState?: boolean;
}) {
  const near =
    spot !== undefined && rows.length > 0 ? nearestRung(rows.map((row) => row.level), spot) : -1;
  const cols = showState
    ? "grid-cols-[3.25rem_1fr_1fr_1fr_5.5rem]"
    : "grid-cols-[3.25rem_1fr_1fr_1fr]";

  return (
    <div className="grid gap-3">
      <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        <TokenLabel token={WETH} />
        <span>/</span>
        <TokenLabel token={USDC} />
        <span>Each number is USDC for 1 WETH. Icons in the header are the side, not an amount.</span>
      </p>

      <div className="overflow-x-auto">
        <div className={cn("grid min-w-[32rem] gap-px", cols)}>
          <div />
          <div className="rounded-t-lg bg-primary/10 px-3 py-2.5 text-center">
            <TokenLabel token={WETH} className="justify-center font-medium text-foreground" size="sm">
              Buy WETH
            </TokenLabel>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Bid · you pay USDC</p>
          </div>
          <div className="rounded-t-lg bg-muted/70 px-3 py-2.5 text-center">
            <p className="text-[13px] font-medium">Level</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Mid of the rung</p>
          </div>
          <div className="rounded-t-lg bg-gold/20 px-3 py-2.5 text-center">
            <TokenLabel token={WETH} className="justify-center font-medium text-foreground" size="sm">
              Sell WETH
            </TokenLabel>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Ask · you receive USDC</p>
          </div>
          {showState ? (
            <div className="rounded-t-lg px-3 py-2.5 text-center">
              <p className="text-[13px] font-medium">State</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Can it fill?</p>
            </div>
          ) : null}

          {rows.map((row, i) => {
            const active = i === near;
            const bidOn = row.bidLive !== false;
            const askOn = row.askLive !== false;
            return (
              <div key={row.id} className="contents">
                <div
                  className={cn(
                    "flex items-center justify-end gap-1.5 py-2.5 pr-2 text-[12px] text-muted-foreground",
                    active && "font-medium text-foreground",
                  )}
                >
                  {active ? <LiveDot on tone="gold" /> : null}
                  <span className="num">{i + 1}</span>
                </div>
                <div
                  className={cn(
                    "flex items-center justify-end bg-primary/[0.06] px-3 py-2.5",
                    active && "bg-primary/12",
                  )}
                >
                  {bidOn ? (
                    <Usd price={row.bid} className="text-[13px] text-primary" />
                  ) : (
                    <span className="text-[13px] text-muted-foreground">—</span>
                  )}
                </div>
                <div
                  className={cn(
                    "flex items-center justify-center bg-muted/40 px-3 py-2.5",
                    active && "bg-muted/80",
                  )}
                >
                  <Usd price={row.level} className="text-[13px] font-medium" />
                </div>
                <div
                  className={cn(
                    "flex items-center justify-end bg-gold/[0.12] px-3 py-2.5",
                    active && "bg-gold/25",
                  )}
                >
                  {askOn ? (
                    <Usd price={row.ask} className="text-[13px]" />
                  ) : (
                    <span className="text-[13px] text-muted-foreground">—</span>
                  )}
                </div>
                {showState ? (
                  <div className="flex items-center justify-center px-2 py-2.5">
                    <Badge variant={row.stateLive ? "success" : "secondary"}>
                      {row.stateLabel ?? (row.stateLive ? "Live" : "Paused")}
                    </Badge>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LadderPreview({
  preview,
  spot,
}: {
  preview: GridPreview;
  spot: bigint;
}) {
  return (
    <RungLadder
      spot={spot}
      rows={preview.levels.map((level, i) => ({
        id: `preview-${i}`,
        level,
        bid: preview.bids[i]!,
        ask: preview.asks[i]!,
      }))}
    />
  );
}
