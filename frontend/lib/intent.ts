import { sendCalls, waitForCallsStatus } from "viem/actions";
import type { Address, Hash, Hex, PublicClient, WalletClient } from "viem";
import { toast } from "sonner";
import { TX_TOAST, waitMined } from "./tx";
import { explorerTx, shortenAddress } from "./format";
import { chain } from "./wagmi";

export type IntentCall = {
  id: string;
  label: string;
  to: Address;
  data: Hex;
};

export type IntentLog = {
  address: Address;
  data: Hex;
  topics: Hex[];
};

export type IntentReceipt = {
  logs: readonly IntentLog[];
  status: "success" | "reverted";
  transactionHash: Hash;
};

export type IntentResult = {
  batched: boolean;
  hashes: Hash[];
  receipts: IntentReceipt[];
};

function isUserRejected(error: unknown): boolean {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/user rejected|denied transaction|rejected the request|UserRejectedRequestError/i.test(raw)) {
    return true;
  }
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code: unknown }).code
      : undefined;
  return code === 4001 || code === "ACTION_REJECTED";
}

function isBatchUnsupported(error: unknown): boolean {
  if (isUserRejected(error)) return false;
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /wallet_sendCalls|Method not found|does not exist\/is not available|UnsupportedProviderMethod|ConnectorMethodNotFoundError|sendCalls is not available|AtomicityNotSupported|atomicRequired|EIP-5792|eip-5792/i.test(
    raw,
  );
}

export async function runIntent(
  publicClient: PublicClient,
  walletClient: WalletClient,
  calls: IntentCall[],
  onStep?: (id: string) => void,
): Promise<IntentResult> {
  const account = walletClient.account;
  if (!account) throw new Error("Connect a wallet first.");

  try {
    toast.loading("Confirm in your wallet", {
      id: TX_TOAST,
      description: `${calls.length} steps in one batch`,
    });
    const { id } = await sendCalls(walletClient, {
      account,
      chain,
      calls: calls.map((call) => ({ to: call.to, data: call.data })),
    });
    const status = await waitForCallsStatus(walletClient, { id });
    const receipts = (status.receipts ?? []).map((row) => ({
      logs: row.logs ?? [],
      status: row.status === "success" ? ("success" as const) : ("reverted" as const),
      transactionHash: row.transactionHash,
    }));
    if (receipts.some((row) => row.status === "reverted")) {
      throw new Error("A batched call reverted.");
    }
    return {
      batched: true,
      hashes: receipts.map((row) => row.transactionHash),
      receipts,
    };
  } catch (error) {
    if (isUserRejected(error)) throw error;
    if (!isBatchUnsupported(error)) throw error;
  }

  const hashes: Hash[] = [];
  const receipts: IntentReceipt[] = [];
  for (const call of calls) {
    onStep?.(call.id);
    toast.loading(call.label, { id: TX_TOAST, description: "Confirm in your wallet" });
    const hash = await walletClient.sendTransaction({
      account,
      chain,
      to: call.to,
      data: call.data,
    });
    hashes.push(hash);
    toast.loading(call.label, {
      id: TX_TOAST,
      description: `Waiting · ${shortenAddress(hash, 4)}`,
      action: {
        label: "Explorer",
        onClick: () => {
          window.open(explorerTx(hash), "_blank", "noopener,noreferrer");
        },
      },
    });
    const mined = await waitMined(publicClient, hash);
    receipts.push({
      logs: mined.logs.map((log) => ({
        address: log.address,
        data: log.data,
        topics: log.topics,
      })),
      status: mined.status === "success" ? "success" : "reverted",
      transactionHash: mined.transactionHash,
    });
  }
  return { batched: false, hashes, receipts };
}
