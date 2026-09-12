# Ladder

**Bounding SLAC — the missing safety layer for 1inch Aqua, and the grid that measures it.**

> The Aqua whitepaper defines **SLAC** — the Shared Liquidity Amplification Coefficient, total liquidity provisioned across all strategies divided by the wallet equity backing it — and demonstrates 9×, from 3× leverage multiplied by 3× strategy sharing.
>
> It never says what SLAC is *safe*. The entire safety argument is one sentence: *each strategy sees its full provisioned amount for price discovery, while actual utilization remains low, allowing the same capital to service multiple strategies' occasional trades.* Stated, never derived, never bounded.
>
> The whitepaper is also explicit about the cost of getting it wrong. An Aqua app *"continues quoting prices based solely on virtual balances without checking real balances or allowances, preserving price continuity."* When balances fall short, strategies go illiquid, and *"if prices move unfavorably during the illiquid period, the first executable trade when liquidity returns may lock in those adverse price movements."* The protocol does not pause them — §3 says makers *"are strongly recommended to manually dock strategies that become chronically underfunded."*
>
> Ladder automates that recommendation on-chain, measures where SLAC actually breaks, and proves both with a self-arming grid on Base.

WETH / USDC. Official Aqua. Tokens stay in the wallet. No keeper.

## What the whitepaper actually says

| Whitepaper statement | Where | What it licenses |
|---|---|---|
| Apps quote on virtual balances only, without checking real balances or allowances, to preserve price continuity | §3 | The gap `WalletGuard` fills — by design, not oversight |
| Illiquid strategies can lock in adverse price movements on the first trade after liquidity returns | §3, §6.2 | The harm being prevented |
| Aqua does not auto-pause illiquid positions; makers should manually dock chronically underfunded strategies | §3 | **The manual process Ladder automates** |
| Operational best practice: *monitor virtual versus real balance ratios* | §6.3 | The Coverage screen |
| SLAC = provisioned liquidity ÷ wallet equity, ≥ 1; 9× example | §4.1 | The quantity we bound |
| Utilization stays low so shared capital services occasional trades | §4.1 | The unproven assumption we test |
| `push()` returns assets and immediately expands the strategy's usable balance | §3, §5 | Why rungs re-arm with no user transaction |
| Shipped parameters should not be modified; change means dock and re-ship | §3 | Why no adaptive agent loop exists here |
| `pull()` checks real balances and reverts if insufficient — atomic, no partial fills | §6.1 | Failure is clean; the problem is the *quote*, not settlement |
| Aqua liquidity is off-chain discoverable, on-chain accessible | §4.2 | Why a Lens is protocol-shaped, not bolted on |

Use **SLAC**, not a synonym. SLAC is defined but unbounded.

## What is new (and what is not)

**Not claiming novelty for:** Aqua market making, oracle-gated positions, ladder/price-bin liquidity, reliability scoring in the abstract. Those have appeared at prior Aqua events.

**Genuinely new:**

1. **`WalletGuard` with `maxShareBps`** — commitment as a live share of the wallet, evaluated at quote time.
2. **`CoverageGuard`** — auto-docking as on-chain policy. §3 tells makers to do this by hand.
3. **SLAC bounding** — the collision-rate experiment (`test_spec17`) that turns an unbounded coefficient into a measured range for a given wallet.
4. **Self-arming discrete rungs on one balance** — a fill via `push()` re-quotes the other side with zero user transactions.

Put **test 10** in the README first: underfunded, adverse price move, refund — no fill at the stale adverse price. That is the §3 harm, prevented.

## Stack

- **Aqua** (official registry at `0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a`) + **SwapVM** redeployed as `LadderRouter`
- **Chainlink** ETH/USD for the envelope
- **1inch Swap API** for the resolver hedge
- Next.js (viem / wagmi / RainbowKit)

No Uniswap. Pair: WETH / USDC on Base.

## Repo

```
contracts/    Foundry — LadderRouter, opcodes, GridManager, LadderLens
frontend/     Next.js — Grid, Position, Coverage
resolver/     TypeScript taker — quotes rungs, hedges on 1inch
```

## Contracts

`LadderRouter` is SwapVM + the stock Aqua opcode set plus:

| Opcode | Slot | What it does |
|---|---|---|
| `OracleEnvelope` | `0x27` | Reverts outside `[floor, ceiling)` or when the feed is stale |
| `WalletGuard` | `0x28` | Caps each quote to `min(aquaVirtual, wallet * maxShareBps / 10_000, Aqua allowance)` |
| `CoverageGuard` | `0x29` | Reverts `CoverageBreach` when `realAvailable / quotedSize` is below the maker's floor |
| `RungQuote` | `0x52` | Fixed-price two-sided quote at `L ± s` |
| `ProtocolFee` | `0x72` | Taker-paid `bps` of `tokenIn` to the treasury |

Program bytes (fee before quote because SwapVM `runLoop`):

`OracleEnvelope → WalletGuard(WETH) → WalletGuard(USDC) → CoverageGuard → ProtocolFee → RungQuote → Salt`

Defaults: commit 20% of wallet, range ±6%, 8 rungs, envelope ±10%, coverage floor 40%, fee 5 bps.

`LadderLens` is the only UI/taker read path. Live means `quote()` would succeed. SLAC is `Σ provisioned / walletEquity` (1e18 = 1.0×). `makerView` is a transparent collision heuristic (quadratic in SLAC−1) — a method demonstration, not a validated predictor. It never prices a swap and never holds a key.

## Tests (Foundry, Aqua fork)

The matrix lives in `contracts/test/LadderGrid.t.sol`. The two that carry the thesis:

- **`test_spec10_underfundedAdverseMoveNoStaleFill`** — the §3 harm, prevented.
- **`test_spec17_fuzzSlacCollisions`** — experiment, not pass/fail. Logs collision rate vs SLAC 1×–9×. Present as a method demonstration, not a validated predictor.

Also: coverage breach then restore (`test_spec09`); two takers, one balance (`test_spec11`); price path never worse than the rung (`test_spec18`); self-custody, self-rearm, share cap, envelope, fee, dock.

## App

- **Grid** — sliders for commit, range, rungs, envelope, coverage floor. Deterministic risk explainer before Start. Start = approve + N ships + register.
- **Position** — live flags, spendable now, SLAC, Pause (dock) / Off (revoke; Aqua allowance is global).
- **Coverage** — quoted vs real per rung, current SLAC, predicted fill / max safe SLAC (method demo), fill history. Judge screen. Whitepaper §6.3.

The Ladder resolver is the v1 counterparty so fills exist before external takers arrive. Quote-only until `TAKE_FILLS=1`. That belongs in the UI footer, not a footnote.

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

`frontend/lib/deployments.json` is zeros until:

```bash
cd contracts
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url $BASE_RPC_URL --broadcast
```
