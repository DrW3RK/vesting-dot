import { idle, MutationError, pending } from "@reactive-dot/core";
import { useState, useEffect } from "react";
import { isLedgerWallet, parseErrorMessage, getFinalizedErrorMessage } from "../utils/ledger";

type VestState =
  | typeof idle
  | typeof pending
  | MutationError
  | { type: string; ok?: boolean; txHash: string };

interface ButtonStateResult {
  text: string;
  disabled: boolean;
  isSuccess: boolean;
  isPending: boolean;
  isError: boolean;
}

function deriveButtonState(
  vestState: VestState,
  showError: boolean,
  ledger: boolean,
  idleLabel: string
): ButtonStateResult {
  const isError =
    vestState instanceof MutationError ||
    (vestState !== idle &&
      vestState !== pending &&
      !(vestState instanceof MutationError) &&
      (vestState as any).type === "finalized" &&
      !(vestState as any).ok);

  if (!showError && isError) {
    return { text: idleLabel, disabled: false, isSuccess: false, isPending: false, isError: false };
  }
  if (vestState === idle) {
    return { text: idleLabel, disabled: false, isSuccess: false, isPending: false, isError: false };
  }
  if (vestState === pending) {
    return {
      text: ledger ? "Check your Ledger device..." : "Waiting for approval...",
      disabled: true,
      isSuccess: false,
      isPending: true,
      isError: false,
    };
  }
  if (vestState instanceof MutationError) {
    return { text: "✗ Transaction Failed", disabled: true, isSuccess: false, isPending: false, isError: true };
  }

  const state = vestState as any;
  if (state.type === "finalized") {
    if (state.ok) {
      return { text: "✓ Unlocked Successfully!", disabled: true, isSuccess: true, isPending: false, isError: false };
    }
    return { text: "✗ Transaction Failed", disabled: true, isSuccess: false, isPending: false, isError: true };
  }

  return { text: "Processing...", disabled: true, isSuccess: false, isPending: false, isError: false };
}

interface TransactionButtonProps {
  vestState: VestState;
  walletName: string;
  idleLabel: string;
  onSubmit: () => void;
  /** Milliseconds before an error display auto-resets to idle. Default: 3000 */
  errorResetMs?: number;
}

/**
 * Reusable transaction button with wallet-type-aware pending prompts and
 * automatic error display reset. Handles both Ledger and injected wallets.
 */
export function TransactionButton({
  vestState,
  walletName,
  idleLabel,
  onSubmit,
  errorResetMs = 3000,
}: TransactionButtonProps) {
  const ledger = isLedgerWallet(walletName);
  const [showError, setShowError] = useState(true);

  const isErrorState =
    vestState instanceof MutationError ||
    (vestState !== idle &&
      vestState !== pending &&
      !(vestState instanceof MutationError) &&
      (vestState as any).type === "finalized" &&
      !(vestState as any).ok);

  // Auto-reset error display after timeout
  useEffect(() => {
    if (isErrorState) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), errorResetMs);
      return () => clearTimeout(timer);
    } else {
      setShowError(true);
    }
  }, [vestState, isErrorState, errorResetMs]);

  const buttonState = deriveButtonState(vestState, showError, ledger, idleLabel);

  const errorMessage = showError
    ? vestState instanceof MutationError
      ? parseErrorMessage(vestState)
      : isErrorState
      ? getFinalizedErrorMessage(ledger)
      : null
    : null;

  const txInfo =
    vestState !== idle &&
    vestState !== pending &&
    !(vestState instanceof MutationError)
      ? (vestState as any)
      : null;

  return (
    <div>
      <button
        onClick={onSubmit}
        disabled={buttonState.disabled}
        style={{
          backgroundColor: buttonState.isSuccess
            ? "#16a34a"
            : buttonState.isError
            ? "#dc2626"
            : buttonState.disabled
            ? "#6b7280"
            : "#db2777",
          color: "#ffffff",
          cursor: buttonState.disabled
            ? buttonState.isSuccess
              ? "default"
              : "not-allowed"
            : "pointer",
          opacity: buttonState.isPending ? 0.8 : 1,
        }}
        className="w-full rounded-lg border-2 px-4 py-3 font-semibold shadow-lg transition-all duration-200"
      >
        {buttonState.text}
      </button>

      {buttonState.isPending && (
        <div className="mt-2 rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-900/20">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            {ledger
              ? "📱 Please review and approve the transaction on your Ledger device"
              : "Please confirm the transaction in your wallet"}
          </p>
        </div>
      )}

      {errorMessage && (
        <div className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      {txInfo && (
        <div className="mt-2 text-center text-xs text-gray-600 dark:text-gray-400">
          Tx: {txInfo.txHash.slice(0, 10)}...{txInfo.txHash.slice(-8)} •{" "}
          {txInfo.type}
        </div>
      )}
    </div>
  );
}
