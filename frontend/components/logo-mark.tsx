import { ICONS } from "@/lib/site";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string; inverse?: boolean }) {
  return (
    <img
      src={ICONS.mark}
      alt=""
      width={120}
      height={120}
      className={cn("size-7", className)}
    />
  );
}

export function LogoLockup({ className }: { className?: string }) {
  return (
    <img
      src={ICONS.lockup}
      alt="Ladder"
      width={180}
      height={72}
      className={cn("h-10 w-auto", className)}
    />
  );
}
