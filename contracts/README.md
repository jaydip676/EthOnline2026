# Contracts

Foundry project pointed at official Aqua (`0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a`). SwapVM will be redeployed.

`lib/` is gitignored. Pull the remappings once:

```bash
cd contracts
forge install foundry-rs/forge-std
forge install 1inch/aqua
forge install OpenZeppelin/openzeppelin-contracts
forge install 1inch/solidity-utils
forge install 1inch/swap-vm
```

Or copy `lib/` from an existing Foundry tree that already has those five remotes. `.gitmodules` lists the same URLs.
