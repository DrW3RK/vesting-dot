import { ChainProvider, useAccounts, useLazyLoadQuery, useMutation } from "@reactive-dot/react";
import { idle, MutationError, pending } from "@reactive-dot/core";
import { getWalletMetadata } from "dot-connect";
import { useState, useEffect } from "react";
import { VestingGraph } from "./VestingGraph";
import { ContactFooter } from "./ContactFooter";

interface VestingSchedule {
  locked: bigint | number;
  per_block: bigint | number;
  starting_block: bigint | number;
}

// Component to fetch relay chain block number
function RelayChainBlockFetcher({ onBlockFetched }: { onBlockFetched: (block: bigint) => void }) {
  const currentBlock = useLazyLoadQuery((builder) => 
    builder.storage("System", "Number")
  );
  
  useEffect(() => {
    if (currentBlock) {
      onBlockFetched(BigInt(currentBlock));
    }
  }, [currentBlock, onBlockFetched]);
  
  return null; // This component doesn't render anything
}

// Component to calculate locked vesting with relay chain block
function LockedVestingAmount({ 
  vestingInfo,
  relayChainBlock 
}: { 
  vestingInfo: VestingSchedule[];
  relayChainBlock: bigint;
}) {
  // Calculate total locked and unlocked across all vesting schedules
  let totalLocked = 0n;
  let totalUnlocked = 0n;

  vestingInfo.forEach((schedule) => {
    const locked = BigInt(schedule.locked);
    const perBlock = BigInt(schedule.per_block);
    const startingBlock = BigInt(schedule.starting_block);
    
    totalLocked += locked;
    
    const blocksElapsed = relayChainBlock > startingBlock ? relayChainBlock - startingBlock : 0n;
    const unlocked = blocksElapsed * perBlock;
    
    // Cap unlocked at locked amount
    if (unlocked >= locked) {
      totalUnlocked += locked;
    } else {
      totalUnlocked += unlocked;
    }
  });

  // Locked vesting = Total locked - Unlocked
  const lockedVesting = totalLocked - totalUnlocked;

  return (
    <div className="rounded-lg border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-white p-5 shadow-md dark:border-pink-700 dark:from-pink-900/20 dark:to-gray-800/50">
      <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Total Locked Vesting DOT</div>
      <div className="font-mono text-3xl font-bold text-pink-600 dark:text-pink-400">
        {(Number(lockedVesting) / 1e10).toFixed(4)} DOT
      </div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Across {vestingInfo.length} vesting schedule{vestingInfo.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// Helper to parse error messages for better UX
function parseErrorMessage(error: MutationError): string {
  const message = error.message.toLowerCase();
  
  // Ledger-specific errors
  if (message.includes('rejected') || message.includes('denied') || message.includes('cancelled') || message.includes('canceled')) {
    return "Transaction was rejected. Please try again.";
  }
  if (message.includes('locked') || message.includes('device')) {
    return "Please unlock your Ledger device and try again.";
  }
  if (message.includes('timeout')) {
    return "Device connection timed out. Please try again.";
  }
  if (message.includes('unknown_error') || message.includes('unknown error')) {
    return "Transaction was cancelled or rejected by the wallet.";
  }
  if (message.includes('user rejected') || message.includes('user declined')) {
    return "Transaction was declined. Please try again when ready.";
  }
  
  // Return original if no match, but clean it up
  return error.message || "Transaction failed. Please try again.";
}

function AccountVesting({ 
  address, 
  name, 
  wallet,
  account,
  relayChainBlock
}: { 
  address: string; 
  name?: string; 
  wallet: string;
  account: any;
  relayChainBlock: bigint;
}) {
  const [vestSuccessful, setVestSuccessful] = useState(false);

  const vestingInfo = useLazyLoadQuery((builder) =>
    builder.storage("Vesting", "Vesting", [address])
  );

  const accountInfo = useLazyLoadQuery((builder) =>
    builder.storage("System", "Account", [address])
  );

  // Use mutation with signer from account
  const [vestState, submitVest] = useMutation(
    (tx) => tx.Vesting.vest(),
    { signer: account?.polkadotSigner }
  );

  // State to track if we should hide the error after timeout
  const [showError, setShowError] = useState(true);

  // Balance calculations from on-chain data
  const free = (accountInfo as any)?.data?.free ?? 0n;
  const reserved = (accountInfo as any)?.data?.reserved ?? 0n;
  const frozen = (accountInfo as any)?.data?.frozen ?? 0n;
  const fullBalance = Number(free + reserved) / 1e10;
  const freeBalance = Number(free + reserved - (frozen < free ? frozen : free)) / 1e10;

  // Compute on-chain locked and available to unlock from vesting schedules
  let onChainLocked = 0n;
  if (vestingInfo && Array.isArray(vestingInfo)) {
    let totalLocked = 0n;
    let totalUnlocked = 0n;
    (vestingInfo as VestingSchedule[]).forEach((schedule) => {
      const locked = BigInt(schedule.locked);
      const perBlock = BigInt(schedule.per_block);
      const startingBlock = BigInt(schedule.starting_block);
      totalLocked += locked;
      const blocksElapsed = relayChainBlock > startingBlock ? relayChainBlock - startingBlock : 0n;
      const unlocked = blocksElapsed * perBlock;
      totalUnlocked += unlocked >= locked ? locked : unlocked;
    });
    onChainLocked = totalLocked - totalUnlocked;
  }
  // Available to unlock = difference between current frozen and what schedule says should be locked
  const availableToUnlock = frozen > onChainLocked ? frozen - onChainLocked : 0n;

  // Track successful vest
  useEffect(() => {
    if (vestState !== idle && vestState !== pending && !(vestState instanceof MutationError)) {
      if (vestState.type === "finalized" && vestState.ok) {
        setVestSuccessful(true);
      }
    }
  }, [vestState]);

  // Auto-reset error state after 3 seconds
  useEffect(() => {
    if (vestState instanceof MutationError || 
        (vestState !== idle && vestState !== pending && vestState.type === "finalized" && !vestState.ok)) {
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      setShowError(true);
    }
  }, [vestState]);

  const handleUnlockVested = () => {
    // Prevent re-submission if already successful or processing
    if (vestState !== idle && vestState !== pending && !(vestState instanceof MutationError)) {
      if (vestState.type === "finalized" && vestState.ok) {
        return; // Don't re-submit on success
      }
    }
    submitVest();
  };

  // Check if vestingInfo is undefined or null
  const hasVesting = vestingInfo && Array.isArray(vestingInfo) && vestingInfo.length > 0;

  // Check if using Ledger wallet
  const isLedgerWallet = wallet.toLowerCase().includes('ledger');

  // Determine button state based on mutation state
  const getButtonState = () => {
    // If error occurred but timeout passed, show idle state
    if (!showError && (vestState instanceof MutationError || 
        (vestState !== idle && vestState !== pending && vestState.type === "finalized" && !vestState.ok))) {
      return { 
        text: "Unlock Vested DOT", 
        disabled: false,
        isSuccess: false,
        isPending: false,
        isError: false
      };
    }
    
    if (vestState === idle) {
      return { 
        text: "Unlock Vested DOT", 
        disabled: false,
        isSuccess: false,
        isPending: false,
        isError: false
      };
    }
    if (vestState === pending) {
      return { 
        text: isLedgerWallet ? "Check your Ledger device..." : "Waiting for approval...", 
        disabled: true,
        isSuccess: false,
        isPending: true,
        isError: false
      };
    }
    if (vestState instanceof MutationError) {
      return { 
        text: "✗ Transaction Failed", 
        disabled: true,
        isSuccess: false,
        isPending: false,
        isError: true
      };
    }
    // Transaction event states
    if (vestState.type === "finalized") {
      if (vestState.ok) {
        return { 
          text: "✓ Unlocked Successfully!", 
          disabled: true,
          isSuccess: true,
          isPending: false,
          isError: false
        };
      } else {
        return { 
          text: "✗ Transaction Failed", 
          disabled: true,
          isSuccess: false,
          isPending: false,
          isError: true
        };
      }
    }
    // Other states like "broadcasted", "txBestBlocksState"
    return { 
      text: "Processing...", 
      disabled: true,
      isSuccess: false,
      isPending: false,
      isError: false
    };
  };

  const buttonState = getButtonState();
  const errorMessage = (vestState instanceof MutationError && showError) ? parseErrorMessage(vestState) : null;

  if (!hasVesting) {
    return (
      <div className="my-4 rounded-lg border border-gray-300 bg-white/80 p-6 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{name || "Account"}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{wallet}</div>
          </div>
        </div>
        <div className="font-mono text-xs text-gray-600 dark:text-gray-500">{address}</div>
        
        {/* Show balances even if no vesting */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-900/50">
            <div className="text-xs text-gray-600 dark:text-gray-400">Full Balance</div>
            <div className="font-mono text-lg font-semibold text-gray-900 dark:text-white">
              {fullBalance.toFixed(4)} DOT
            </div>
          </div>
          <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-900/50">
            <div className="text-xs text-gray-600 dark:text-gray-400">Free Balance</div>
            <div className="font-mono text-lg font-semibold text-gray-900 dark:text-white">
              {freeBalance.toFixed(4)} DOT
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-center text-gray-600 dark:text-gray-400">No vesting schedule found</div>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-lg border border-gray-300 bg-white/80 p-6 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-4">
        <div className="text-lg font-bold text-gray-900 dark:text-white">{name || "Account"}</div>
        <div className="text-xs text-gray-600 dark:text-gray-400">{wallet}</div>
        <div className="font-mono text-xs text-gray-600 dark:text-gray-500">{address}</div>
      </div>

      {/* Balance Information */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-900/50">
          <div className="text-xs text-gray-600 dark:text-gray-400">Full Balance</div>
          <div className="font-mono text-lg font-semibold text-gray-900 dark:text-white">
            {fullBalance.toFixed(4)} DOT
          </div>
        </div>
        <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-900/50">
          <div className="text-xs text-gray-600 dark:text-gray-400">Free Balance</div>
          <div className="font-mono text-lg font-semibold text-gray-900 dark:text-white">
            {freeBalance.toFixed(4)} DOT
          </div>
        </div>
      </div>

      {/* Unlock Vested Button */}
      <div className="mb-6">
        <button
          onClick={handleUnlockVested}
          disabled={buttonState.disabled}
          style={{
            backgroundColor: buttonState.isSuccess ? '#16a34a' : 
                           buttonState.isError ? '#dc2626' : 
                           buttonState.disabled ? '#6b7280' : '#db2777',
            color: '#ffffff',
            cursor: buttonState.disabled ? (buttonState.isSuccess ? 'default' : 'not-allowed') : 'pointer',
            opacity: buttonState.isPending ? 0.8 : 1
          }}
          className="w-full rounded-lg border-2 px-4 py-3 font-semibold shadow-lg transition-all duration-200"
        >
          {buttonState.text}
        </button>
        
        {/* Ledger-specific prompt when pending */}
        {buttonState.isPending && isLedgerWallet && (
          <div className="mt-2 rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-900/20">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              📱 Please review and approve the transaction on your Ledger device
            </p>
          </div>
        )}
        
        {/* Generic pending message for non-Ledger wallets */}
        {buttonState.isPending && !isLedgerWallet && (
          <div className="mt-2 rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-900/20">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Please confirm the transaction in your wallet
            </p>
          </div>
        )}
        
        {errorMessage && (
          <div className="mt-2 text-center text-sm text-red-600 dark:text-red-400">{errorMessage}</div>
        )}
        {vestState !== idle && vestState !== pending && !(vestState instanceof MutationError) && (
          <div className="mt-2 text-center text-xs text-gray-600 dark:text-gray-400">
            Tx: {vestState.txHash.slice(0, 10)}...{vestState.txHash.slice(-8)} • {vestState.type}
          </div>
        )}
      </div>

      {/* Aggregate Locked Vesting Amount with Available to Unlock */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <LockedVestingAmount 
          vestingInfo={vestingInfo as VestingSchedule[]} 
          relayChainBlock={relayChainBlock}
        />
        
        {/* Vested DOT Available for Unlock */}
        {availableToUnlock > 0n && (
          <div className="rounded-lg border-2 border-green-300 bg-gradient-to-br from-green-50 to-white p-5 shadow-md dark:border-green-700 dark:from-green-900/20 dark:to-gray-800/50">
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              Vested DOT Available for Unlock
            </div>
            <div className="font-mono text-3xl font-bold text-green-600 dark:text-green-400">
              {vestSuccessful ? "0.0000 DOT" : `${(Number(availableToUnlock) / 1e10).toFixed(4)} DOT`}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {vestSuccessful ? "Successfully unlocked!" : "Ready to be unlocked"}
            </div>
          </div>
        )}
      </div>

      {/* Individual Vesting Schedules */}
      {vestingInfo.length > 1 && (
        <div className="mb-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Individual Vesting Schedules
          </h3>
          <div className="space-y-6">
            {(vestingInfo as VestingSchedule[]).map((schedule, index) => (
              <VestingGraph
                key={index}
                vestingInfo={[schedule]}
                currentRelayBlock={relayChainBlock}
                title={`Schedule #${index + 1} Unlock Timeline`}
                scheduleIndex={index}
              />
            ))}
          </div>
        </div>
      )}

      {/* Aggregate Vesting Timeline Graph (only show for multiple schedules) */}
      {vestingInfo.length > 1 && (
        <div className="mb-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Combined Vesting Timeline
          </h3>
          <VestingGraph 
            vestingInfo={vestingInfo as VestingSchedule[]}
            currentRelayBlock={relayChainBlock}
            title="All Schedules Combined"
          />
        </div>
      )}

      {/* Single Vesting Schedule Timeline */}
      {vestingInfo.length === 1 && (
        <VestingGraph 
          vestingInfo={vestingInfo as VestingSchedule[]}
          currentRelayBlock={relayChainBlock}
        />
      )}
    </div>
  );
}

export function VestingSchedule() {
  const accounts = useAccounts();
  const [relayChainBlock, setRelayChainBlock] = useState<bigint | null>(null);

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Vesting Schedule</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">Connect your wallet to view your vesting schedule</p>
        <div className="rounded-lg border border-gray-300 bg-white/80 p-12 text-center dark:border-gray-700 dark:bg-gray-800/50">
          <p className="text-gray-600 dark:text-gray-400">No accounts connected</p>
          <p className="mt-2 text-sm text-gray-500">Click "Connect Wallet" in the top right to get started</p>
        </div>

        <ContactFooter />
      </div>
    );
  }

  // Step 1: Fetch relay chain block number
  if (relayChainBlock === null) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Vesting Schedule</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">Loading relay chain data...</p>
        <ChainProvider chainId="polkadot">
          <RelayChainBlockFetcher onBlockFetched={setRelayChainBlock} />
        </ChainProvider>

        <ContactFooter />
      </div>
    );
  }

  // Step 2: Once we have relay block, switch to Asset Hub for vesting data
  return (
    <ChainProvider chainId="polkadot_asset_hub">
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Vesting Schedule</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">View your token vesting details</p>
        
        <div>
          {accounts.map((account, index) => {
            const walletMeta = getWalletMetadata(account.wallet);
            const walletName = walletMeta?.name ?? account.wallet.name;

            return (
              <AccountVesting
                key={index}
                address={account.address}
                name={account.name}
                wallet={walletName}
                account={account}
                relayChainBlock={relayChainBlock}
              />
            );
          })}
        </div>

        <ContactFooter />
      </div>
    </ChainProvider>
  );
}
