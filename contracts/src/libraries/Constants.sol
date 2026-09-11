// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @dev Official Aqua is CREATE2-deployed at this address on every supported chain.
address constant AQUA = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;

/// @dev Canonical WETH on Base.
address constant WETH_BASE = 0x4200000000000000000000000000000000000006;

/// @dev Native USDC on Base.
address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

/// @dev Chainlink ETH/USD on Base (8 decimals).
address constant CHAINLINK_ETH_USD_BASE = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;

/// @dev Canonical WETH9 on Ethereum Sepolia (tests / fallback deploy).
address constant WETH_SEPOLIA = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;

/// @dev Chainlink ETH/USD on Ethereum Sepolia.
address constant CHAINLINK_ETH_USD_SEPOLIA = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
