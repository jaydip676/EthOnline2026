import Link from "next/link";
import { ArrowRightIcon, ArrowUpRightIcon, Rows3Icon, ShieldOffIcon, WalletIcon } from "lucide-react";
import { HeroWell } from "@/components/hero-well";
import { LiveDot } from "@/components/live-dot";
import { TokenAvatar, TokenPair } from "@/components/token-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_ASK, DEMO_BID } from "@/lib/addresses";
import { explorerTx, shortenAddress } from "@/lib/format";
import { USDC, WETH } from "@/lib/tokens";

const facts = [
  { label: "Custody", value: "Your wallet" },
  { label: "Fills", value: "Base" },
  { label: "Coverage", value: "Quote-time floor" },
  { label: "Pair", value: "WETH / USDC" },
];

const features = [
  {
    icon: WalletIcon,
    title: "The coins stay yours",
    body: "One ERC-20 allowance to Aqua. No session key. Spend ETH tomorrow and the asks go dark on their own.",
  },
  {
    icon: Rows3Icon,
    title: "A rung re-arms itself",
    body: "Bid fills, virtual balance flips to ETH, the ask lights up. Round-trip profit is 2s. The taker paid the gas.",
  },
  {
    icon: ShieldOffIcon,
    title: "Quote-time floor, on-chain",
    body: "Below your coverage floor the rung stops quoting. That is Aqua §3 as SwapVM bytecode, not a keeper.",
  },
];

export default function HomePage() {
  return (
    <div className="grid gap-20 sm:gap-24">
      <section className="relative isolate overflow-hidden rounded-2xl bg-ink px-6 py-14 text-[#F4FBFD] sm:px-10 sm:py-16 lg:px-14">
        <HeroWell className="-top-1/3 -right-1/4 w-[34rem] opacity-70" />
        <div className="relative grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-16">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-mist/35 bg-mist/10 px-3 py-1 text-[11px] font-medium text-mist">
              <LiveDot on tone="gold" />
              1inch Aqua · SwapVM · Base
            </span>
            <h1 className="mt-6 text-[2.5rem] leading-[1.06] font-semibold tracking-[-0.03em] text-pretty sm:text-[3.25rem]">
              CEX-style grid on official Aqua. Rungs re-arm themselves.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-pretty text-mist/90">
              WETH / USDC. Tokens stay in the wallet. A bid fill lights the ask with no maker
              transaction. WalletGuard and CoverageGuard sit in the program, so underfunded rungs
              stop quoting on-chain.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" className="bg-[#F4FBFD] text-ink hover:bg-[#F4FBFD]/92" asChild>
                <Link href="/grid">
                  Start a grid
                  <ArrowRightIcon />
                </Link>
              </Button>
              <Button size="lg" variant="cta" asChild>
                <Link href="/coverage">Watch coverage</Link>
              </Button>
            </div>
            <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-mist/80">
              <span>Live fills</span>
              <a
                className="inline-flex items-center gap-1 text-mist transition-colors hover:text-[#F4FBFD]"
                href={explorerTx(DEMO_BID)}
                target="_blank"
                rel="noreferrer"
              >
                Bid {shortenAddress(DEMO_BID, 3)}
                <ArrowUpRightIcon className="size-3" />
              </a>
              <a
                className="inline-flex items-center gap-1 text-mist transition-colors hover:text-[#F4FBFD]"
                href={explorerTx(DEMO_ASK)}
                target="_blank"
                rel="noreferrer"
              >
                Ask re-arm {shortenAddress(DEMO_ASK, 3)}
                <ArrowUpRightIcon className="size-3" />
              </a>
            </p>
          </div>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3 text-[13px] text-mist/90">
              <TokenPair size="md" ringClassName="ring-ink" />
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <TokenAvatar token={WETH} size="xs" />
                  WETH
                </span>
                <span className="text-mist/50">/</span>
                <span className="inline-flex items-center gap-1.5">
                  <TokenAvatar token={USDC} size="xs" />
                  USDC
                </span>
                <span className="text-mist/70">· Base</span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              {facts.map((fact) => (
                <div key={fact.label} className="rounded-xl border border-mist/20 bg-mist/10 px-4 py-3">
                  <dt className="text-[11px] tracking-[0.14em] text-mist/80 uppercase">{fact.label}</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {fact.label === "Pair" ? (
                      <span className="inline-flex items-center gap-2">
                        <TokenPair size="xs" ringClassName="ring-ink" />
                        WETH / USDC
                      </span>
                    ) : (
                      fact.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <div className="mb-2 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="size-5" />
              </div>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription className="text-pretty">{feature.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
