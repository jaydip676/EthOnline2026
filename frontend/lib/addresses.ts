import { zeroAddress, type Address } from "viem";
import deployments from "./deployments.json";

export type Deployments = {
  chainId: number;
  aqua: Address;
  router: Address;
  gridManager: Address;
  lens: Address;
  weth: Address;
  usdc: Address;
  chainlinkAdapter: Address;
  treasury: Address;
  startBlock: number;
  demoBid: `0x${string}`;
  demoAsk: `0x${string}`;
};

export const ADDRESSES = deployments as Deployments;

export const AQUA = (process.env.NEXT_PUBLIC_AQUA as Address | undefined) ?? ADDRESSES.aqua;
export const ROUTER = (process.env.NEXT_PUBLIC_ROUTER as Address | undefined) ?? ADDRESSES.router;
export const GRID_MANAGER =
  (process.env.NEXT_PUBLIC_GRID_MANAGER as Address | undefined) ?? ADDRESSES.gridManager;
export const LENS = (process.env.NEXT_PUBLIC_LENS as Address | undefined) ?? ADDRESSES.lens;
export const WETH_TOKEN = (process.env.NEXT_PUBLIC_WETH as Address | undefined) ?? ADDRESSES.weth;
export const USDC_TOKEN = (process.env.NEXT_PUBLIC_USDC as Address | undefined) ?? ADDRESSES.usdc;
export const ORACLE =
  (process.env.NEXT_PUBLIC_ORACLE as Address | undefined) ?? ADDRESSES.chainlinkAdapter;
export const TREASURY = (process.env.NEXT_PUBLIC_TREASURY as Address | undefined) ?? ADDRESSES.treasury;
export const START_BLOCK = BigInt(process.env.NEXT_PUBLIC_START_BLOCK ?? String(ADDRESSES.startBlock ?? 0));
export const CHAIN_ID = 8453;
export const DEMO_BID = ADDRESSES.demoBid;
export const DEMO_ASK = ADDRESSES.demoAsk;

export function isDeployed(): boolean {
  return ROUTER !== zeroAddress && GRID_MANAGER !== zeroAddress && LENS !== zeroAddress;
}
