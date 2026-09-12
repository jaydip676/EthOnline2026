import { formatUnits, parseUnits } from "viem";
import { CHAIN_ID } from "./addresses";

export function formatToken(amount: bigint | undefined, decimals = 18, maxFrac = 5): string {
  if (amount === undefined) return "—";
  const raw = formatUnits(amount, decimals);
  const [whole, frac = ""] = raw.split(".");
  if (!frac) return whole;
  const trimmed = frac.slice(0, maxFrac).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function parseAmount(value: string, decimals = 18): bigint | null {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) return null;
  try {
    return parseUnits(trimmed, decimals);
  } catch {
    return null;
  }
}

export function shortenAddress(address: string, size = 4): string {
  if (address.length < size * 2 + 4) return address;
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`;
}

export function formatUsd(price1e18: bigint, maxFrac = 2): string {
  const n = Number(formatUnits(price1e18, 18));
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac, minimumFractionDigits: maxFrac });
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

export const EXPLORER = CHAIN_ID === 11155111 ? "https://sepolia.etherscan.io" : "https://basescan.org";

export function explorerTx(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function explorerAddress(address: string): string {
  return `${EXPLORER}/address/${address}`;
}
