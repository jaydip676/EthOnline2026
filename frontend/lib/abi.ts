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
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

export const aquaAbi = [
  {
    type: "function",
    name: "ship",
    stateMutability: "nonpayable",
    inputs: [
      { name: "app", type: "address" },
      { name: "strategy", type: "bytes" },
      { name: "tokens", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [{ name: "strategyHash", type: "bytes32" }],
  },
  {
    type: "function",
    name: "dock",
    stateMutability: "nonpayable",
    inputs: [
      { name: "app", type: "address" },
      { name: "strategyHash", type: "bytes32" },
      { name: "tokens", type: "address[]" },
    ],
    outputs: [],
  },
] as const;

export const gridManagerAbi = [
  {
    type: "function",
    name: "previewGrid",
    stateMutability: "view",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
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
        ],
      },
    ],
    outputs: [
      { name: "programs", type: "bytes[]" },
      { name: "hashes", type: "bytes32[]" },
      { name: "usdcCaps", type: "uint256[]" },
      { name: "ethCaps", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "buildRungOrder",
    stateMutability: "pure",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
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
        ],
      },
      { name: "rungIndex", type: "uint256" },
    ],
    outputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "maker", type: "address" },
          { name: "traits", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "registerGrid",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA_", type: "address" },
      { name: "tokenB_", type: "address" },
      { name: "hashes", type: "bytes32[]" },
      {
        name: "p",
        type: "tuple",
        components: [
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
        ],
      },
    ],
    outputs: [{ name: "gridId", type: "uint256" }],
  },
  {
    type: "function",
    name: "gridCount",
    stateMutability: "view",
    inputs: [{ name: "maker", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "markInactive",
    stateMutability: "nonpayable",
    inputs: [{ name: "gridId", type: "uint256" }],
    outputs: [],
  },
] as const;

export const lensAbi = [
  {
    type: "function",
    name: "oraclePrice",
    stateMutability: "view",
    inputs: [{ name: "feed", type: "address" }],
    outputs: [
      { name: "px", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "decimals_", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "spendableNow",
    stateMutability: "view",
    inputs: [
      { name: "maker", type: "address" },
      { name: "token", type: "address" },
      { name: "maxShareBps", type: "uint16" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "reliabilityBps",
    stateMutability: "view",
    inputs: [{ name: "maker", type: "address" }],
    outputs: [{ type: "uint16" }],
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
        ],
      },
    ],
  },
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
        ],
      },
    ],
  },
] as const;

export const routerAbi = [
  {
    type: "event",
    name: "Swapped",
    inputs: [
      { name: "orderHash", type: "bytes32", indexed: false },
      { name: "maker", type: "address", indexed: false },
      { name: "taker", type: "address", indexed: false },
      { name: "tokenIn", type: "address", indexed: false },
      { name: "tokenOut", type: "address", indexed: false },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "quote",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "maker", type: "address" },
          { name: "traits", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
      { name: "amount", type: "uint256" },
      { name: "takerTraitsAndData", type: "bytes" },
    ],
    outputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOut", type: "uint256" },
      { name: "orderHash", type: "bytes32" },
    ],
  },
] as const;

export const oracleAbi = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;
