import type { Abi } from "viem";

const gridParams = [
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
  { name: "minCoverageBps", type: "uint16" },
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

const order = {
  type: "tuple",
  components: [
    { name: "maker", type: "address" },
    { name: "traits", type: "uint256" },
    { name: "data", type: "bytes" },
  ],
} as const;

export const lensAbi = [
  {
    type: "function",
    name: "rungs",
    stateMutability: "view",
    inputs: [
      { name: "maker", type: "address" },
      { name: "gridId", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "index", type: "uint256" },
          { name: "level", type: "uint256" },
          { name: "bidPrice", type: "uint256" },
          { name: "askPrice", type: "uint256" },
          { name: "bidLive", type: "bool" },
          { name: "askLive", type: "bool" },
          { name: "pausedReason", type: "uint8" },
          { name: "virtualWeth", type: "uint256" },
          { name: "virtualUsdc", type: "uint256" },
          { name: "realAvailableWeth", type: "uint256" },
          { name: "realAvailableUsdc", type: "uint256" },
          { name: "coverageWeth", type: "uint256" },
          { name: "coverageUsdc", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "gridView",
    stateMutability: "view",
    inputs: [
      { name: "maker", type: "address" },
      { name: "gridId", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "envelopeState", type: "uint8" },
          { name: "oraclePrice", type: "uint256" },
          { name: "updatedAt", type: "uint256" },
          { name: "floor", type: "uint256" },
          { name: "ceiling", type: "uint256" },
          { name: "spendableWeth", type: "uint256" },
          { name: "spendableUsdc", type: "uint256" },
          { name: "reserveBacked", type: "bool" },
          { name: "tier", type: "uint8" },
          { name: "active", type: "bool" },
          { name: "rungCount", type: "uint8" },
          { name: "slac", type: "uint256" },
        ],
      },
    ],
  },
] as const satisfies Abi;

export const managerAbi = [
  {
    type: "function",
    name: "gridCount",
    stateMutability: "view",
    inputs: [{ name: "maker", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getGrid",
    stateMutability: "view",
    inputs: [
      { name: "maker", type: "address" },
      { name: "gridId", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "tokenA", type: "address" },
          { name: "tokenB", type: "address" },
          { name: "hashes", type: "bytes32[]" },
          { name: "params", type: "tuple", components: gridParams },
          { name: "registeredAt", type: "uint64" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "buildRungOrder",
    stateMutability: "pure",
    inputs: [
      { name: "p", type: "tuple", components: gridParams },
      { name: "rungIndex", type: "uint256" },
    ],
    outputs: [{ name: "order", ...order }],
  },
  {
    type: "function",
    name: "buildTakerData",
    stateMutability: "pure",
    inputs: [
      { name: "taker", type: "address" },
      { name: "isExactIn", type: "bool" },
      { name: "isAToB", type: "bool" },
      { name: "allowPartialFill", type: "bool" },
    ],
    outputs: [{ type: "bytes" }],
  },
] as const satisfies Abi;

export const routerAbi = [
  {
    type: "function",
    name: "quote",
    stateMutability: "view",
    inputs: [
      { name: "order", ...order },
      { name: "amount", type: "uint256" },
      { name: "takerTraitsAndData", type: "bytes" },
    ],
    outputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOut", type: "uint256" },
      { name: "orderHash", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "swap",
    stateMutability: "payable",
    inputs: [
      { name: "order", ...order },
      { name: "amount", type: "uint256" },
      { name: "takerTraitsAndData", type: "bytes" },
    ],
    outputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOut", type: "uint256" },
      { name: "orderHash", type: "bytes32" },
    ],
  },
] as const satisfies Abi;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const satisfies Abi;
