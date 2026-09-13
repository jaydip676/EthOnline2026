# Ladder

**A CEX-style grid on official 1inch Aqua. Rungs re-arm themselves. Quote-time solvency is bytecode.**

WETH / USDC on Base. Tokens stay in the wallet. No keeper. No AI in the quote path.

A bid fill `push()`es inventory into the rung; the ask lights up with no maker transaction. `WalletGuard` and `CoverageGuard` sit in the SwapVM program, so an underfunded rung stops quoting on-chain — not via a bot. Both already filled on canonical Aqua `0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a`.

Lisbon work priced this with a fee or docked it from a keeper. The cap and the floor here are in the program bytes.

## Demo for judges

1. Connect `0x637AcD6C56f9D4685B1b9f949a4903049c22C7aA`. Open **Position** and **Coverage**. Eight rungs. Live means `LadderLens` says `quote()` would succeed.
2. Proof of fill (same wallet as maker and taker, so balances net out; the txs are the point):
   - Bid: [`0x3231e3…f4b6`](https://basescan.org/tx/0x3231e3e482b06b3280c0ad48eac65ed32b91fe9ba4f931e6cb408d9f7ce8f4b6)
   - Ask re-arm: [`0x1283d2…c4f1`](https://basescan.org/tx/0x1283d264b30f8f287540a044355919213b71f4a35d735159a8d98d5ac6a3c4f1)
3. `forge test --match-test test_spec10_underfundedAdverseMoveNoStaleFill -vvv` — underfunded, adverse move, refund: no fill at the stale adverse price. That is Aqua §3, prevented.
4. `forge test --match-test test_coverageGuardStopsQuotesWalletGuardAloneWouldHonor -vvv` — same drain: WalletGuard alone still quotes the residual share; CoverageGuard refuses.
5. Do not click Start again on the demo wallet (it would ship a second grid). Optional: send ~70% of the WETH and watch asks go dark.

The collision heuristic on Coverage is a method demonstration, not a validated predictor. It never prices a swap and never holds a key.

## What the whitepaper actually says

| Whitepaper statement | Where | What it licenses |
|---|---|---|
| Apps quote on virtual balances only, without checking real balances or allowances, to preserve price continuity | §3 | The gap `WalletGuard` fills — by design, not oversight |
| Illiquid strategies can lock in adverse price movements on the first trade after liquidity returns | §3, §6.2 | The harm being prevented |
| Aqua does not auto-pause illiquid positions; makers should manually dock chronically underfunded strategies | §3 | The manual process the program automates |
| Operational best practice: *monitor virtual versus real balance ratios* | §6.3 | The Coverage screen |
| SLAC = provisioned liquidity ÷ wallet equity, ≥ 1; 9× example | §4.1 | The quantity we report, not a uniqueness claim |
| Utilization stays low so shared capital services occasional trades | §4.1 | The assumption `test_spec17` records against |
| `push()` returns assets and immediately expands the strategy's usable balance | §3, §5 | Why rungs re-arm with no user transaction |
| Shipped parameters should not be modified; change means dock and re-ship | §3 | Why no adaptive agent loop exists here |
| `pull()` checks real balances and reverts if insufficient — atomic, no partial fills | §6.1 | Failure is clean; the problem is the *quote*, not settlement |
| Aqua liquidity is off-chain discoverable, on-chain accessible | §4.2 | Why a Lens is protocol-shaped, not bolted on |

Use **SLAC**, not a synonym. SLAC is defined but unbounded.

## What this ships (and what it does not claim)

**Not claiming novelty for:** Aqua market making, oracle-gated positions, ladder/price-bin liquidity, reliability scoring, NL or visual SwapVM composers, inventory-skew fees, or off-chain dock keepers. Those appeared at prior Aqua events (Doca, Solvent, Superpose, Aquapilot, QilinSwap, RiverSwap, Aqua Outcome Market, among others).

**What is in this repo:**

1. **Self-arming discrete rungs on one balance** — a fill via `push()` re-quotes the other side with zero user transactions. That is the product.
2. **`WalletGuard` (`maxShareBps`)** — each quote is capped to a live share of the real wallet, evaluated at quote time.
3. **`CoverageGuard`** — if `realAvailable / quotedSize` is below the maker's floor, the quote reverts `CoverageBreach` instead of advertising a size `pull()` cannot settle.
4. **Live Base fills** on official Aqua, with Coverage as whitepaper §6.3.
5. **`test_spec17`** — collision rate vs SLAC 1×–9×. Present as a method demonstration, not a bound.

`WalletGuard` / `CoverageGuard` are what we shipped in the program, not a claim that nobody else thought about solvency.

## Stack

- **Aqua** (official registry at `0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a`) + **SwapVM** redeployed as `LadderRouter`
- **Chainlink** ETH/USD for the envelope
- **1inch Swap API** for the resolver hedge
- Next.js (viem / wagmi / RainbowKit)

No Uniswap in the product. Pair: WETH / USDC on Base.

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

The matrix lives in `contracts/test/LadderGrid.t.sol`. Lead with these:

- **`test_spec10_underfundedAdverseMoveNoStaleFill`** — the §3 harm, prevented.
- **`test_coverageGuardStopsQuotesWalletGuardAloneWouldHonor`** — with vs without the floor, same drain.
- **`test_spec17_fuzzSlacCollisions`** — experiment, not pass/fail. Logs collision rate vs SLAC 1×–9×.

Also: coverage breach then restore (`test_spec09`); two takers, one balance (`test_spec11`); price path never worse than the rung (`test_spec18`); self-custody, self-rearm, share cap, envelope, fee, dock.

## App

- **Grid** — sliders for commit, range, rungs, envelope, coverage floor. Deterministic risk explainer before Start. Start = approve + N ships + register.
- **Position** — live flags, spendable now, SLAC, Pause (dock) / Off (revoke; Aqua allowance is global).
- **Coverage** — quoted vs real per rung, current SLAC, predicted fill / max safe SLAC (method demo), fill history. Whitepaper §6.3.

The Ladder resolver is the v1 counterparty so fills exist before external takers arrive. Quote-only until `TAKE_FILLS=1`. That belongs in the UI footer, not a footnote.

## Quick start

```bash
# Contracts (needs a Base RPC with official Aqua)
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

`frontend/lib/deployments.json` is the live Base deployment. To redeploy:

```bash
cd contracts
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url $BASE_RPC_URL --broadcast
```
