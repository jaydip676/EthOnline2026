"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LiveDot } from "@/components/live-dot";
import { LogoMark } from "@/components/logo-mark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CHAIN_ID } from "@/lib/addresses";
import { cn } from "@/lib/utils";

const links = [
  { href: "/grid", label: "Grid" },
  { href: "/position", label: "Position" },
  { href: "/coverage", label: "Coverage" },
];

const network = CHAIN_ID === 11155111 ? "Sepolia" : "Base";

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="app-shell flex h-16 items-center gap-6">
        <Link href="/" className="group flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-80">
          <LogoMark className="size-7" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Ladder</span>
          <span className="hidden rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-ink uppercase sm:inline">
            Aqua
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = path === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary/8 text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <span
            title={`Live contracts on ${network}`}
            className="hidden items-center gap-2 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex"
          >
            <LiveDot on />
            {network}
          </span>
          <div className="hidden sm:block">
            <ConnectButton chainStatus="none" showBalance={false} accountStatus="address" />
          </div>
          <div className="sm:hidden">
            <ConnectButton chainStatus="none" showBalance={false} accountStatus="avatar" />
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Ladder</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 grid gap-2">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm hover:bg-muted"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
