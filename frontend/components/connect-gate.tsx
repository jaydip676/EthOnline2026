"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TokenPair } from "@/components/token-avatar";

export function ConnectGate({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-center justify-items-center text-center">
        <TokenPair size="lg" className="mb-1" />
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          WETH / USDC · Base
        </p>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="max-w-sm text-pretty">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center pb-3">
        <ConnectButton chainStatus="icon" showBalance={false} />
      </CardContent>
    </Card>
  );
}
