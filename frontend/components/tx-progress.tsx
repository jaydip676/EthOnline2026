import { CheckIcon } from "lucide-react";
import { Spinner } from "@/components/spinner";
import { cn } from "@/lib/utils";

export type ProgressStep = {
  id: string;
  label: string;
  hint?: string;
};

export function TxProgress({
  steps,
  currentId,
  doneIds,
  batched,
}: {
  steps: ProgressStep[];
  currentId?: string;
  doneIds: string[];
  /** Wallet is confirming the remaining steps in one `wallet_sendCalls` prompt. */
  batched?: boolean;
}) {
  const waiting = Boolean(currentId);
  const progress =
    steps.length === 0 ? 0 : ((doneIds.length + (waiting ? 0.4 : 0)) / steps.length) * 100;

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-muted/50 p-3">
      <div className="flex items-center gap-3">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <span className="num text-[11px] text-muted-foreground">
          {doneIds.length}/{steps.length}
        </span>
      </div>
      <ol className="grid gap-1.5">
        {steps.map((step) => {
          const done = doneIds.includes(step.id);
          const current = batched ? waiting && !done : currentId === step.id;
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-start gap-2.5 text-[13px] transition-opacity",
                !done && !current && "opacity-45",
              )}
            >
              <span className="mt-[3px] grid size-3.5 shrink-0 place-items-center">
                {done ? (
                  <CheckIcon className="size-3.5 text-gold-foreground" />
                ) : current ? (
                  <Spinner className="size-3.5 text-primary" label={step.label} />
                ) : (
                  <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                )}
              </span>
              <span className="min-w-0">
                <span className={cn("block", current ? "font-medium text-foreground" : "text-foreground/80")}>
                  {step.label}
                </span>
                {current ? (
                  <span className="block text-xs text-primary">
                    {batched
                      ? "One wallet confirmation for these steps, then wait for the chain"
                      : "Confirm in your wallet, then wait for the chain"}
                  </span>
                ) : step.hint && !done ? (
                  <span className="block text-xs text-muted-foreground">{step.hint}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
