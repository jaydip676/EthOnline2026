import { cn } from "@/lib/utils";

const tones = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  gold: "bg-gold",
  idle: "bg-muted-foreground/50",
} as const;

export function LiveDot({
  on = true,
  tone = "gold",
  className,
}: {
  on?: boolean;
  tone?: keyof typeof tones;
  className?: string;
}) {
  const color = on ? tones[tone] : tones.idle;
  return (
    <span className={cn("relative inline-flex size-1.5", className)} aria-hidden>
      {on ? <span className={cn("live-pulse absolute -inset-1 rounded-full opacity-40", color)} /> : null}
      <span className={cn("relative size-1.5 rounded-full", color)} />
    </span>
  );
}
