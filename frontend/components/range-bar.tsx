import { cn } from "@/lib/utils";

function logPct(value: number, lo: number, hi: number) {
  const v = Math.log(Math.max(value, 1e-9));
  return ((v - lo) / (hi - lo)) * 100;
}

export function RangeBar({
  min,
  max,
  spot,
  unit = "token1 / token0",
  formatLabel,
  className,
}: {
  min: number;
  max: number;
  spot?: number;
  unit?: string;
  formatLabel?: (value: number) => string;
  className?: string;
}) {
  if (!(min > 0) || !(max > min)) {
    return <div className={cn("h-1.5 rounded-full bg-muted", className)} aria-hidden />;
  }

  const lo = Math.log(min) - 0.35;
  const hi = Math.log(max) + 0.35;
  const left = Math.max(0, Math.min(100, logPct(min, lo, hi)));
  const right = Math.max(left + 2, Math.min(100, logPct(max, lo, hi)));
  const spotPct = spot && spot > 0 ? Math.max(0, Math.min(100, logPct(spot, lo, hi))) : null;
  const inRange = spotPct !== null && spotPct >= left && spotPct <= right;

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="relative h-1.5 rounded-full bg-muted">
        <div
          className="absolute inset-y-0 rounded-full bg-primary/55"
          style={{ left: `${left}%`, width: `${right - left}%` }}
        />
        {spotPct !== null ? (
          <span
            className={cn(
              "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background transition-colors",
              inRange ? "bg-foreground" : "bg-destructive",
            )}
            style={{ left: `${spotPct}%` }}
            title={spot ? `Spot ≈ ${spot.toPrecision(3)}` : undefined}
          />
        ) : null}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span className="num">{formatLabel ? formatLabel(min) : min}</span>
        <span className={inRange ? "text-muted-foreground" : "text-destructive"}>
          {spot ? (
            <>
              spot <span className="num">{formatLabel ? formatLabel(spot) : Number(spot.toPrecision(3))}</span>
              {inRange ? "" : " · outside range"}
            </>
          ) : (
            unit
          )}
        </span>
        <span className="num">{formatLabel ? formatLabel(max) : max}</span>
      </div>
    </div>
  );
}
