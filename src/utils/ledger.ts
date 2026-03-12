import { MutationError } from "@reactive-dot/core";

/**
 * Detects whether the given wallet name corresponds to a Ledger hardware wallet.
 */
export function isLedgerWallet(walletName: string): boolean {
  return walletName.toLowerCase().includes("ledger");
}

/**
 * Parses a MutationError into a user-friendly message, with special handling
 * for common Ledger hardware wallet errors.
 */
export function parseErrorMessage(error: MutationError): string {
  const message = error.message.toLowerCase();

  // Ledger metadata proof errors — CheckMetadataHash signed extension failure
  if (message.includes("bad proof") || message.includes("badproof")) {
    return "Transaction rejected: metadata proof verification failed. Please update your Ledger firmware and Polkadot app to the latest version, then try again.";
  }
  if (
    message.includes("rejected") ||
    message.includes("denied") ||
    message.includes("cancelled") ||
    message.includes("canceled")
  ) {
    return "Transaction was rejected. Please try again.";
  }
  if (message.includes("locked") || message.includes("device")) {
    return "Please unlock your Ledger device and try again.";
  }
  if (message.includes("timeout")) {
    return "Device connection timed out. Please try again.";
  }
  if (message.includes("unknown_error") || message.includes("unknown error")) {
    return "Transaction was cancelled or rejected by the wallet.";
  }
  if (message.includes("user rejected") || message.includes("user declined")) {
    return "Transaction was declined. Please try again when ready.";
  }

  return error.message || "Transaction failed. Please try again.";
}

/**
 * Returns a user-friendly error message for on-chain finalized failures,
 * with extra Ledger-specific guidance when applicable.
 */
export function getFinalizedErrorMessage(ledgerWallet: boolean): string {
  if (ledgerWallet) {
    return "Transaction failed on-chain. If you see a 'bad proof' error, please ensure your Ledger firmware and Polkadot app are up to date, then try again.";
  }
  return "Transaction failed on-chain. Please try again.";
}
