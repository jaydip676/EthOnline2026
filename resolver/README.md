# Ladder resolver

Open-source TypeScript service anyone can run. Ladder runs one from day one so fills exist before external takers arrive.

Each poll:

1. Enumerate live rungs from `LadderLens`
2. Quote each live side via `LadderRouter.quote()`
3. Fetch the 1inch Swap API price for the same size on Base
4. If the rung beats 1inch by `minMargin`, simulate against the next block
5. When `TAKE_FILLS=1`, take **at most one** fill per poll, never more than `spendableNow`
6. When `HEDGE=1`, flatten inventory through the 1inch Swap API

Never route across several rungs of the same maker for more than that wallet's real balance — virtual caps sum higher than reality by design.

Default is quote-only. A key is required only to take. This process is a taker, not a model; it never prices a swap with an LLM.

**Disclosure:** in v1 the Ladder resolver is the counterparty to Ladder's own users.

```bash
cp .env.example .env
# after Foundry deploy, set MAKER to the grid wallet
pnpm --filter ladder-resolver start
```

A first Base fill without a 1inch key: `TAKE_FILLS=1 ALLOW_UNREFERENCED=1` and a funded `PRIVATE_KEY`. With a key, omit `ALLOW_UNREFERENCED` so the rung has to beat 1inch.
