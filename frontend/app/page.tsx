import Link from "next/link";
import { ArrowRightIcon, Rows3Icon, ShieldOffIcon, WalletIcon } from "lucide-react";
import { HeroWell } from "@/components/hero-well";
import { LiveDot } from "@/components/live-dot";
import { TokenAvatar } from "@/components/token-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { USDC, WETH } from "@/lib/tokens";

const facts = [
  { label: "Custody", value: "Your wallet" },
  { label: "Keeper", value: "None" },
  { label: "Crash", value: "Grid goes dark" },
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
    title: "An envelope, not a range",
    body: "Outside Chainlink ±10% every rung stops. On recovery it comes back live. That is why this is not an LP product.",
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
              1inch Aqua · SwapVM · Chainlink
            </span>
            <h1 className="mt-6 text-[2.5rem] leading-[1.06] font-semibold tracking-[-0.03em] text-pretty sm:text-[3.25rem]">
              A grid bot that never takes your coins.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-pretty text-mist/90">
              CEX-style maker quotes on Aqua. One wallet balance backs every rung. No keeper, no
              delegated key, and the whole grid goes dark in a crash.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" className="bg-[#F4FBFD] text-ink hover:bg-[#F4FBFD]/92" asChild>
                <Link href="/grid">
                  Start a grid
                  <ArrowRightIcon />
                </Link>
              </Button>
              <Button size="lg" variant="cta" asChild>
                <Link href="/position">Watch position</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center gap-2 text-[13px] text-mist/90">
              <TokenAvatar symbol={WETH.symbol} accent={WETH.accent} size="sm" />
              <TokenAvatar symbol={USDC.symbol} accent={USDC.accent} size="sm" />
              Base · WETH / USDC
            </div>
            <dl className="grid grid-cols-2 gap-3">
              {facts.map((fact) => (
                <div key={fact.label} className="rounded-xl border border-mist/20 bg-mist/10 px-4 py-3">
                  <dt className="text-[11px] tracking-[0.14em] text-mist/80 uppercase">{fact.label}</dt>
                  <dd className="mt-1 text-sm font-medium">{fact.value}</dd>
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
