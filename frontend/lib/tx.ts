import type { Hash, PublicClient, TransactionReceipt } from "viem";
import { toast } from "sonner";
import { shortError } from "./errors";
import { explorerTx, shortenAddress } from "./format";

export const TX_TOAST = "ladder-tx";

export async function waitMined(publicClient: PublicClient, hash: Hash) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted (${hash})`);
  }
  return receipt;
}

export async function runTx(
  publicClient: PublicClient,
  label: string,
  send: () => Promise<Hash>,
): Promise<{ hash: Hash; receipt: TransactionReceipt }> {
  toast.loading(label, { id: TX_TOAST, description: "Confirm in your wallet" });
  const hash = await send();
  toast.loading(label, {
    id: TX_TOAST,
    description: `Waiting for confirmation · ${shortenAddress(hash, 4)}`,
    action: {
      label: "Explorer",
      onClick: () => {
        window.open(explorerTx(hash), "_blank", "noopener,noreferrer");
      },
    },
  });
  const receipt = await waitMined(publicClient, hash);
  return { hash, receipt };
}

export function toastTxOk(title: string, description?: string, hash?: Hash) {
  toast.success(title, {
    id: TX_TOAST,
    description,
    action: hash
      ? {
          label: "View",
          onClick: () => {
            window.open(explorerTx(hash), "_blank", "noopener,noreferrer");
          },
        }
      : undefined,
  });
}

export function toastTxErr(error: unknown) {
  toast.error(shortError(error), { id: TX_TOAST });
}
