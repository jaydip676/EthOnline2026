import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { TokenPair } from "@/components/token-avatar";
import { AQUA, GRID_MANAGER, LENS, ROUTER } from "@/lib/addresses";
import { explorerAddress, shortenAddress } from "@/lib/format";

const contracts = [
  { label: "Router", address: ROUTER },
  { label: "GridManager", address: GRID_MANAGER },
  { label: "Lens", address: LENS },
  { label: "Aqua", address: AQUA },
];

const pages = [
  { href: "/grid", label: "Grid" },
  { href: "/position", label: "Position" },
  { href: "/coverage", label: "Coverage" },
];

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-20 bg-ink text-[#F4FBFD]">
      <div className="app-shell grid gap-10 py-12 md:grid-cols-[minmax(0,1.4fr)_auto_auto] md:gap-16">
        <div className="max-w-sm">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-7 place-items-center overflow-hidden rounded-[8px] bg-[#F4FBFD]">
              <LogoMark className="size-7" />
            </span>
            Ladder
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-mist/90">
            CEX-style grid on official Aqua. Rungs re-arm themselves. Coverage stops underfunded
            quotes on-chain. Tokens never leave the wallet.
          </p>
        </div>
        <div>
          <p className="mb-3 text-[11px] font-medium tracking-[0.18em] text-mist uppercase">App</p>
          <nav aria-label="Footer" className="grid gap-2 text-[13px]">
            {pages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="text-[#F4FBFD]/70 transition-colors hover:text-[#F4FBFD]"
              >
                {page.label}
              </Link>
            ))}
          </nav>
        </div>
        <div>
          <p className="mb-3 text-[11px] font-medium tracking-[0.18em] text-mist uppercase">Contracts</p>
          <ul className="grid gap-2 text-[13px]">
            {contracts.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-8">
                <span className="text-mist/80">{row.label}</span>
                <a
                  className="num text-xs text-[#F4FBFD]/80 transition-colors hover:text-[#F4FBFD]"
                  href={explorerAddress(row.address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortenAddress(row.address)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="app-shell flex flex-col gap-2 border-t border-mist/20 py-5 text-xs text-mist/80 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2">
          <TokenPair size="xs" ringClassName="ring-ink" />
          WETH / USDC on Base · 1inch Aqua + SwapVM + Chainlink
        </p>
        <p>v1: the Ladder resolver is the counterparty so fills exist from day one.</p>
      </div>
    </footer>
  );
}
