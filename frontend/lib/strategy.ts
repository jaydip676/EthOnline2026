import {
  type Address,
  type Hex,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
} from "viem";

export type SwapVMOrder = {
  maker: Address;
  traits: bigint;
  data: Hex;
};

const ORDER_ABI = parseAbiParameters("(address maker, uint256 traits, bytes data)");

export function encodeOrder(order: SwapVMOrder): Hex {
  return encodeAbiParameters(ORDER_ABI, [
    {
      maker: order.maker,
      traits: order.traits,
      data: order.data,
    },
  ]);
}

export function aquaOrderHash(order: SwapVMOrder): Hex {
  return keccak256(encodeOrder(order));
}

export function nextSalt(): bigint {
  return BigInt(Date.now() % 2 ** 32);
}

export const GRID_PARAMS = [
  { name: "maker", type: "address" },
  { name: "weth", type: "address" },
  { name: "usdc", type: "address" },
  { name: "oracle", type: "address" },
  { name: "treasury", type: "address" },
  { name: "aqua", type: "address" },
  { name: "spot", type: "uint256" },
  { name: "rangeBps", type: "uint16" },
  { name: "envelopeBps", type: "uint16" },
  { name: "rungCount", type: "uint8" },
  { name: "maxShareBps", type: "uint16" },
  { name: "protocolFeeBps", type: "uint24" },
  { name: "maxStaleness", type: "uint32" },
  { name: "wethDecimals", type: "uint8" },
  { name: "usdcDecimals", type: "uint8" },
  { name: "mode", type: "uint8" },
  { name: "tier", type: "uint8" },
  { name: "saltNonce", type: "uint64" },
  { name: "ethCap", type: "uint256" },
  { name: "usdcCap", type: "uint256" },
] as const;
