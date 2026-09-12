import type { Address } from "viem";
import { USDC_TOKEN, WETH_TOKEN } from "./addresses";

export type TokenMeta = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  accent: string;
};

export const WETH: TokenMeta = {
  symbol: "WETH",
  name: "Wrapped Ether",
  address: WETH_TOKEN,
  decimals: 18,
  accent: "from-[#219EBC] to-[#023047]",
};

export const USDC: TokenMeta = {
  symbol: "USDC",
  name: "USD Coin",
  address: USDC_TOKEN,
  decimals: 6,
  accent: "from-[#FFB703] to-[#FB8500] text-ink",
};
