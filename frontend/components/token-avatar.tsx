import { cn } from "@/lib/utils";

export function TokenAvatar({
  symbol,
  accent,
  size = "md",
}: {
  symbol: string;
  accent: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-linear-to-b font-semibold text-primary-foreground ring-1 ring-white/25 ring-inset",
        accent,
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-8 text-[11px]",
        size === "lg" && "size-10 text-xs",
      )}
      aria-hidden
    >
      {symbol.slice(0, 2)}
    </span>
  );
}
