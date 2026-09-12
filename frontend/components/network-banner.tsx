"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useAccount, useSwitchChain } from "wagmi";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CHAIN_ID } from "@/lib/addresses";
import { chain } from "@/lib/wagmi";

export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  if (!isConnected || chainId === CHAIN_ID) return null;

  return (
    <Alert variant="warning" className="mb-6 animate-enter">
      <AlertTriangleIcon />
      <AlertTitle>Wrong network</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>Ladder is deployed on {chain.name}.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => switchChain({ chainId: CHAIN_ID })}
          disabled={isPending}
          loading={isPending}
        >
          {isPending ? "Switching" : `Switch to ${chain.name}`}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
