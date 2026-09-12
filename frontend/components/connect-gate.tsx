"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
        <div className="mb-1 grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <WalletIcon className="size-5" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="max-w-sm text-pretty">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center pb-3">
        <ConnectButton chainStatus="icon" showBalance={false} />
      </CardContent>
    </Card>
  );
}
