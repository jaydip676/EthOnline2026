import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function WizardSteps({
  steps,
  current,
  onSelect,
  canGo,
}: {
  steps: { title: string; hint: string }[];
  current: number;
  onSelect?: (index: number) => void;
  canGo?: (index: number) => boolean;
}) {
  return (
    <ol>
      {steps.map((step, index) => {
        const active = index === current;
        const done = index < current;
        const allowed = canGo ? canGo(index) : Boolean(onSelect);
        const clickable = Boolean(onSelect) && !active && allowed;
        const last = index === steps.length - 1;

        return (
          <li key={step.title}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onSelect?.(index)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex w-full items-stretch gap-3 overflow-visible rounded-lg px-2.5 py-2.5 text-left transition-colors duration-150",
                clickable && "cursor-pointer hover:bg-muted",
                !clickable && "cursor-default",
              )}
            >
              <span className="relative flex w-[1.375rem] shrink-0 flex-col items-center">
                <span
                  className={cn(
                    "num relative z-10 grid size-[1.375rem] shrink-0 place-items-center rounded-full text-[10px] font-semibold transition-colors",
                    active && "bg-primary text-primary-foreground",
                    done && "bg-gold text-ink",
                    !active && !done && "bg-muted text-muted-foreground ring-1 ring-border ring-inset",
                  )}
                >
                  {done ? <CheckIcon className="size-3" /> : index + 1}
                </span>
                {!last ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-0 top-[1.625rem] -bottom-4 mx-auto w-px",
                      done ? "bg-gold" : "bg-border",
                    )}
                  />
                ) : null}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-[13px] font-medium",
                    active ? "text-foreground" : done ? "text-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {step.hint}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
