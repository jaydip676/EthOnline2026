# Ladder

CEX-style grid trading as *maker* liquidity on 1inch Aqua. Tokens never leave the wallet. No keeper. The grid goes dark in a crash.

## Stack

- **Aqua** (official registry) + **SwapVM** redeployed as `LadderRouter` with four custom opcodes
- **Chainlink** ETH/USD envelope
- **1inch Swap API** for the resolver hedge
- Next.js frontend (viem / wagmi / RainbowKit)

No Uniswap. Pair in v1: WETH / USDC on Base.

## Repo

```
contracts/    Foundry — LadderRouter, opcodes, GridManager, LadderLens
frontend/     Next.js — Grid setup + Position monitor
resolver/     TypeScript taker — quotes rungs, hedges on 1inch
```

## Contracts

`LadderRouter` is SwapVM + the stock Aqua opcode set plus:

| Opcode | Slot | What it does |
|---|---|---|
| `OracleEnvelope` | `0x27` | Reverts outside `[floor, ceiling)` or when the feed is stale |
| `WalletGuard` | `0x28` | Caps each quote to `min(aquaVirtual, wallet * maxShareBps / 10_000, Aqua allowance)` |
| `RungQuote` | `0x52` | Fixed-price two-sided quote at `L ± s` |
| `ProtocolFee` | `0x72` | Taker-paid `bps` of `tokenIn` to the treasury |

A rung program is `OracleEnvelope → WalletGuard(WETH) → WalletGuard(USDC) → ProtocolFee → RungQuote → Salt`.

## Quick start

```bash
# Contracts (needs a Base or Sepolia RPC with official Aqua)
cd contracts
cp .env.example .env
forge install foundry-rs/forge-std
forge install 1inch/aqua
forge install OpenZeppelin/openzeppelin-contracts
forge install 1inch/solidity-utils
forge install 1inch/swap-vm
forge test -vvv

# Frontend
pnpm install
pnpm dev                      # http://localhost:3000

# Resolver
cp resolver/.env.example resolver/.env
pnpm --filter ladder-resolver start
```

Default commit is 20% of the wallet — a live share, not a frozen number. Docking is N `Aqua.dock` calls from the wallet. Revoking the Aqua allowance turns off every Aqua position that wallet holds.

The Ladder resolver is the v1 counterparty so fills exist before external takers arrive. That belongs in the UI footer, not a footnote.

`frontend/lib/deployments.json` is zeros until:

```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url $BASE_RPC_URL --broadcast
```
