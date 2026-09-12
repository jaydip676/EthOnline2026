import { cn } from "@/lib/utils";

export function LogoMark({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="9"
        className={inverse ? "fill-primary-foreground/12 stroke-primary-foreground/30" : "fill-primary/12 stroke-primary/30"}
        strokeWidth="1"
      />
      <path
        d="M9 10h14M9 16h14M9 22h14"
        className={inverse ? "stroke-primary-foreground" : "stroke-primary"}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M11 8v16M21 8v16"
        className="stroke-gold"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
