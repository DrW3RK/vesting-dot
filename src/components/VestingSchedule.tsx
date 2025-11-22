import { ChainProvider, useAccounts, useLazyLoadQuery, useMutation } from "@reactive-dot/react";
import { idle, MutationError, pending } from "@reactive-dot/core";
import { getWalletMetadata } from "dot-connect";
import { useState, useEffect } from "react";
import { VestingGraph } from "./VestingGraph";

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

  // Extract balance information
  const freeBalance = accountInfo?.data?.free || 0n;
  const reservedBalance = accountInfo?.data?.reserved || 0n;
  const fullBalance = BigInt(freeBalance) + BigInt(reservedBalance);

  const handleUnlockVested = () => {
    submitVest();
  };

  // Check if vestingInfo is undefined or null
  const hasVesting = vestingInfo && Array.isArray(vestingInfo) && vestingInfo.length > 0;

  // Determine button state based on mutation state
  const getButtonState = () => {
    // If error occurred but timeout passed, show idle state
    if (!showError && (vestState instanceof MutationError || 
        (vestState !== idle && vestState !== pending && vestState.type === "finalized" && !vestState.ok))) {
      return { text: "Unlock Vested DOT", className: "bg-pink-600 text-white hover:bg-pink-700", disabled: false };
    }
    
    if (vestState === idle) {
      return { text: "Unlock Vested DOT", className: "bg-pink-600 text-white hover:bg-pink-700", disabled: false };
    }
    if (vestState === pending) {
      return { text: "Unlocking Vested DOT...", className: "cursor-not-allowed bg-gray-400 text-gray-700 dark:bg-gray-600 dark:text-gray-400", disabled: true };
    }
    if (vestState instanceof MutationError) {
      return { text: "✗ Transaction Failed", className: "bg-red-600 text-white", disabled: false };
    }
    // Transaction event states
    if (vestState.type === "finalized") {
      if (vestState.ok) {
        return { text: "✓ Unlocked Successfully!", className: "bg-green-600 text-white", disabled: false };
      } else {
        return { text: "✗ Transaction Failed", className: "bg-red-600 text-white", disabled: false };
      }
    }
    // Other states like "broadcasted", "txBestBlocksState"
    return { text: "Processing...", className: "cursor-not-allowed bg-gray-400 text-gray-700 dark:bg-gray-600 dark:text-gray-400", disabled: true };
  };

  const buttonState = getButtonState();
  const errorMessage = (vestState instanceof MutationError && showError) ? vestState.message : null;

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
              {(Number(fullBalance) / 1e10).toFixed(4)} DOT
            </div>
          </div>
          <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-900/50">
            <div className="text-xs text-gray-600 dark:text-gray-400">Free Balance</div>
            <div className="font-mono text-lg font-semibold text-gray-900 dark:text-white">
              {(Number(freeBalance) / 1e10).toFixed(4)} DOT
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
            {(Number(fullBalance) / 1e10).toFixed(4)} DOT
          </div>
        </div>
        <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-900/50">
          <div className="text-xs text-gray-600 dark:text-gray-400">Free Balance</div>
          <div className="font-mono text-lg font-semibold text-gray-900 dark:text-white">
            {(Number(freeBalance) / 1e10).toFixed(4)} DOT
          </div>
        </div>
      </div>

      {/* Unlock Vested Button */}
      <div className="mb-6">
        <button
          onClick={handleUnlockVested}
          disabled={buttonState.disabled}
          className={`w-full rounded-lg px-4 py-3 font-semibold transition-colors ${buttonState.className}`}
        >
          {buttonState.text}
        </button>
        {errorMessage && (
          <div className="mt-2 text-center text-sm text-red-600 dark:text-red-400">{errorMessage}</div>
        )}
        {vestState !== idle && vestState !== pending && !(vestState instanceof MutationError) && (
          <div className="mt-2 text-center text-xs text-gray-600 dark:text-gray-400">
            Tx: {vestState.txHash.slice(0, 10)}...{vestState.txHash.slice(-8)} • {vestState.type}
          </div>
        )}
      </div>

      {/* Aggregate Locked Vesting Amount */}
      <div className="mb-6">
        <LockedVestingAmount 
          vestingInfo={vestingInfo as VestingSchedule[]} 
          relayChainBlock={relayChainBlock}
        />
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
      </div>
    </ChainProvider>
  );
}