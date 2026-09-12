import { cn } from "@/lib/utils";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label ?? "Loading"} className={cn("inline-flex", className)}>
      <svg className="size-full animate-spin" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" className="stroke-current/20" strokeWidth="2.5" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          className="stroke-current"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label ?? "Loading"}</span>
    </span>
  );
}
