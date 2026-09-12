# Ladder resolver

Open-source TypeScript service anyone can run. Ladder runs one from day one so fills exist before external takers arrive.

Each poll:

1. Enumerate live rungs from `LadderLens`
2. Quote each live side via `LadderRouter.quote()`
3. Fetch the 1inch Swap API price for the same size on Base
4. If the rung beats 1inch by more than `gas + minMargin`, simulate against the target block, then `swap` through a private relay when configured
5. Hedge inventory on the 1inch Swap API

Never route across several rungs of the same maker for more than that wallet's real balance — virtual caps sum higher than reality by design.

**Disclosure:** in v1 the Ladder resolver is the counterparty to Ladder's own users.

```bash
cp .env.example .env
pnpm --filter ladder-resolver start
```
