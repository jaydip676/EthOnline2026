export function shortError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/user rejected|denied transaction|rejected the request/i.test(raw)) {
    return "Transaction was rejected in the wallet.";
  }
  if (/insufficient funds/i.test(raw)) {
    return "Not enough ETH to pay gas.";
  }
  if (/EnvelopeClosed/i.test(raw)) {
    return "Price is outside the envelope. The grid is dark until it recovers.";
  }
  if (/OracleStale/i.test(raw)) {
    return "The Chainlink feed is stale. Rungs pause until it updates.";
  }
  if (/InsufficientWalletBalance/i.test(raw)) {
    return "This rung cannot fill — wallet balance or the 20% share cap is too small.";
  }
  if (/CoverageBreach/i.test(raw)) {
    return "Coverage is below the floor. This rung stops quoting until the wallet can back it.";
  }
  if (/UnknownOpcode/i.test(raw)) {
    return "This SwapVM does not support that program. Check the router address.";
  }
  const first = raw.split("\n").find((line) => line.trim().length > 0) ?? raw;
  return first.replace(/^(ContractFunctionExecutionError|TransactionExecutionError):\s*/i, "").slice(0, 280);
}
