import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DataRow({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2 text-[13px]", className)}>
      <span className="shrink-0 text-muted-foreground" title={hint}>
        {label}
      </span>
      <span className="min-w-0 flex-1 text-right font-medium break-words">{value}</span>
    </div>
  );
}
