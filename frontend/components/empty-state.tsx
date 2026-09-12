import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid place-items-center gap-3 px-6 py-12 text-center", className)}>
      {icon ? (
        <div className="grid size-10 place-items-center rounded-xl border border-border bg-muted/50 text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <div className="grid gap-1">
        <p className="text-[13px] font-medium">{title}</p>
        {description ? (
          <p className="max-w-xs text-[13px] leading-relaxed text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
