import type { Address } from "viem";
import { USDC_TOKEN, WETH_TOKEN } from "./addresses";

export type TokenMeta = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  icon: "/tokens/weth.svg" | "/tokens/usdc-icon.svg";
};

export const WETH: TokenMeta = {
  symbol: "WETH",
  name: "Wrapped Ether",
  address: WETH_TOKEN,
  decimals: 18,
  icon: "/tokens/weth.svg",
};

export const USDC: TokenMeta = {
  symbol: "USDC",
  name: "USD Coin",
  address: USDC_TOKEN,
  decimals: 6,
  icon: "/tokens/usdc-icon.svg",
};

export const TOKENS = [WETH, USDC] as const;

export function tokenByAddress(address?: string | null): TokenMeta | undefined {
  if (!address) return undefined;
  const needle = address.toLowerCase();
  return TOKENS.find((token) => token.address.toLowerCase() === needle);
}

export function tokenBySymbol(symbol: string): TokenMeta | undefined {
  const needle = symbol.toUpperCase();
  if (needle === "ETH") return WETH;
  return TOKENS.find((token) => token.symbol === needle);
}
