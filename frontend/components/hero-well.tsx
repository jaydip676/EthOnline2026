import { cn } from "@/lib/utils";

/** Ambient background flourish. Decorative only — never holds content. */
export function HeroWell({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute aspect-square", className)} aria-hidden>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,color-mix(in_srgb,#8ECAE6_28%,transparent),transparent_62%)] blur-2xl" />
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="well-ring absolute rounded-full border border-[#8ECAE6]/25"
          style={{
            animation: `ripple 6s ${i * 1.6}s ease-out infinite`,
            inset: `${16 + i * 10}%`,
          }}
        />
      ))}
      <div className="well-pulse absolute inset-[38%] rounded-full bg-[radial-gradient(circle_at_45%_38%,color-mix(in_srgb,#FFB703_38%,transparent),transparent_70%)] blur-md" />
    </div>
  );
}
