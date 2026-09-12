"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useAccount, useSwitchChain } from "wagmi";
import { TokenPair } from "@/components/token-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { chain } from "@/lib/wagmi";

export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  if (!isConnected || chainId === chain.id) return null;

  return (
    <Alert variant="warning" className="mb-6 animate-enter">
      <AlertTriangleIcon />
      <AlertTitle>Wrong network</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2">
          <TokenPair size="xs" />
          Ladder quotes WETH / USDC on {chain.name}.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => switchChain({ chainId: chain.id })}
          disabled={isPending}
          loading={isPending}
        >
          {isPending ? "Switching" : `Switch to ${chain.name}`}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
