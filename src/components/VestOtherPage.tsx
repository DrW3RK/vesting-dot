import { ChainProvider, useAccounts, useLazyLoadQuery, useMutation } from "@reactive-dot/react";
import { idle, MutationError, pending } from "@reactive-dot/core";
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
  
  return null;
}

// Component to calculate locked vesting with relay chain block
function LockedVestingAmount({ 
  vestingInfo,
  relayChainBlock 
}: { 
  vestingInfo: VestingSchedule[];
  relayChainBlock: bigint;
}) {
  let totalLocked = 0n;
  let totalUnlocked = 0n;

  vestingInfo.forEach((schedule) => {
    const locked = BigInt(schedule.locked);
    const perBlock = BigInt(schedule.per_block);
    const startingBlock = BigInt(schedule.starting_block);
    
    totalLocked += locked;
    
    const blocksElapsed = relayChainBlock > startingBlock ? relayChainBlock - startingBlock : 0n;
    const unlocked = blocksElapsed * perBlock;
    
    if (unlocked >= locked) {
      totalUnlocked += locked;
    } else {
      totalUnlocked += unlocked;
    }
  });

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

function VestOtherAccountVesting({ 
  targetAddress,
  relayChainBlock,
  connectedAccount
}: { 
  targetAddress: string;
  relayChainBlock: bigint;
  connectedAccount: any;
}) {
  const vestingInfo = useLazyLoadQuery((builder) => 
    builder.storage("Vesting", "Vesting", [targetAddress])
  );

  // Use mutation with signer from connected account - calling vest_other with target address
  const [vestState, submitVest] = useMutation(
    (tx) => tx.Vesting.vest_other({ target: { type: "Id", value: targetAddress } }),
    { signer: connectedAccount?.polkadotSigner }
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

  const handleUnlockVested = () => {
    submitVest();
  };

  const hasVesting = vestingInfo && Array.isArray(vestingInfo) && vestingInfo.length > 0;

  // Determine button state based on mutation state
  const getButtonState = () => {
    if (!showError && (vestState instanceof MutationError || 
        (vestState !== idle && vestState !== pending && vestState.type === "finalized" && !vestState.ok))) {
      return { 
        text: "Unlock Vested DOT for Other", 
        className: "border-2 border-pink-700 bg-gradient-to-r from-pink-600 to-pink-700 text-white shadow-lg hover:from-pink-700 hover:to-pink-800 hover:shadow-xl dark:border-pink-600 dark:from-pink-600 dark:to-pink-700 dark:hover:from-pink-500 dark:hover:to-pink-600", 
        disabled: false 
      };
    }
    
    if (vestState === idle) {
      return { 
        text: "Unlock Vested DOT for Other", 
        className: "border-2 border-pink-700 bg-gradient-to-r from-pink-600 to-pink-700 text-white shadow-lg hover:from-pink-700 hover:to-pink-800 hover:shadow-xl dark:border-pink-600 dark:from-pink-600 dark:to-pink-700 dark:hover:from-pink-500 dark:hover:to-pink-600", 
        disabled: false 
      };
    }
    if (vestState === pending) {
      return { 
        text: "Unlocking Vested DOT...", 
        className: "cursor-not-allowed border-2 border-gray-500 bg-gray-500 text-white opacity-70 shadow-md dark:border-gray-600 dark:bg-gray-600", 
        disabled: true 
      };
    }
    if (vestState instanceof MutationError) {
      return { 
        text: "✗ Transaction Failed", 
        className: "border-2 border-red-700 bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg dark:border-red-600 dark:from-red-600 dark:to-red-700", 
        disabled: false 
      };
    }
    if (vestState.type === "finalized") {
      if (vestState.ok) {
        return { 
          text: "✓ Unlocked Successfully!", 
          className: "border-2 border-green-700 bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg dark:border-green-600 dark:from-green-600 dark:to-green-700", 
          disabled: false 
        };
      } else {
        return { 
          text: "✗ Transaction Failed", 
          className: "border-2 border-red-700 bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg dark:border-red-600 dark:from-red-600 dark:to-red-700", 
          disabled: false 
        };
      }
    }
    return { 
      text: "Processing...", 
      className: "cursor-not-allowed border-2 border-gray-500 bg-gray-500 text-white opacity-70 shadow-md dark:border-gray-600 dark:bg-gray-600", 
      disabled: true 
    };
  };

  const buttonState = getButtonState();
  const errorMessage = (vestState instanceof MutationError && showError) ? vestState.message : null;

  if (!hasVesting) {
    return (
      <div className="my-4 rounded-lg border border-gray-300 bg-white/80 p-6 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="mb-2">
          <div className="text-lg font-bold text-gray-900 dark:text-white">Target Account Details</div>
        </div>
        <div className="font-mono text-xs text-gray-600 dark:text-gray-500">{targetAddress}</div>
        
        <div className="mt-4 text-center text-gray-600 dark:text-gray-400">No vesting schedule found</div>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-lg border border-gray-300 bg-white/80 p-6 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-4">
        <div className="text-lg font-bold text-gray-900 dark:text-white">Target Account Details</div>
        <div className="font-mono text-xs text-gray-600 dark:text-gray-500">{targetAddress}</div>
      </div>

      {/* Unlock Vested Button */}
      <div className="mb-6">
        <button
          onClick={handleUnlockVested}
          disabled={buttonState.disabled}
          className={`w-full rounded-lg px-4 py-3 font-semibold !text-white transition-all duration-200 ${buttonState.className}`}
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

      {/* Info notice */}
      <div className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <p className="text-sm text-blue-800 dark:text-blue-400">
          🎁 <strong>Vest Other:</strong> You are unlocking vested tokens for another account. Transaction fees will be paid from your connected wallet.
        </p>
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

export function VestOtherPage() {
  const accounts = useAccounts();
  const [address, setAddress] = useState("");
  const [submittedAddress, setSubmittedAddress] = useState<string | null>(null);
  const [relayChainBlock, setRelayChainBlock] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Basic validation for Polkadot address
    if (!address.trim()) {
      setError("Please enter an address");
      return;
    }
    
    if (!address.startsWith("1")) {
      setError("Invalid Polkadot address (should start with '1')");
      return;
    }
    
    if (address.length < 47 || address.length > 48) {
      setError("Invalid Polkadot address length");
      return;
    }

    // Check if address is same as any connected account
    const isSameAsConnected = accounts.some(account => account.address === address.trim());
    if (isSameAsConnected) {
      setError("Cannot use vest_other with your own connected address. Use Wallet Mode instead.");
      return;
    }

    setSubmittedAddress(address.trim());
    setRelayChainBlock(null);
  };

  const handleReset = () => {
    setSubmittedAddress(null);
    setRelayChainBlock(null);
    setAddress("");
    setError(null);
  };

  // Check if wallet is connected
  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Vest Other</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">
          Unlock vested tokens
        </p>
        <div className="rounded-lg border border-gray-300 bg-white/80 p-12 text-center dark:border-gray-700 dark:bg-gray-800/50">
          <p className="text-gray-600 dark:text-gray-400">No wallet connected</p>
          <p className="mt-2 text-sm text-gray-500">Click "Connect Wallet" in the top right to get started</p>
        </div>

        <ContactFooter />
      </div>
    );
  }

  // If no address submitted, show the input form
  if (!submittedAddress) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Vest Other</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">
          Unlock vested tokens for another account on their behalf
        </p>
        
        <div className="rounded-lg border border-gray-300 bg-white/80 p-8 dark:border-gray-700 dark:bg-gray-800/50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="address" className="mb-2 block text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                Target Polkadot Address
              </label>
              <input
                type="text"
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="1..."
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-pink-400 dark:focus:ring-pink-400"
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>
            
            <button
              type="submit"
              className="w-full rounded-lg bg-pink-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-pink-700"
            >
              Unlock Vested DOT for Other
            </button>
          </form>

          <div className="mt-6 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
            <p className="text-sm text-yellow-800 dark:text-yellow-400">
             This will unlock vested tokens for the address you specify. 
              You will pay the transaction fees on behalf of that account.
              The target address must not be the same as your connected wallet address.
            </p>
          </div>
        </div>

        <ContactFooter />
      </div>
    );
  }

  // Step 1: Fetch relay chain block number
  if (relayChainBlock === null) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <button
          onClick={handleReset}
          className="mb-4 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          ← Back to Address Input
        </button>
        
        <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Vest Other</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">Loading relay chain data...</p>
        <ChainProvider chainId="polkadot">
          <RelayChainBlockFetcher onBlockFetched={setRelayChainBlock} />
        </ChainProvider>

        <ContactFooter />
      </div>
    );
  }

  // Step 2: Show vesting data and unlock button
  return (
    <ChainProvider chainId="polkadot_asset_hub">
      <div className="mx-auto max-w-4xl p-8">
        <button
          onClick={handleReset}
          className="mb-4 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          ← Vest for Different Address
        </button>
        
        <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Vest Other</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">Unlocking vested tokens for another account</p>
        
        <VestOtherAccountVesting
          targetAddress={submittedAddress}
          relayChainBlock={relayChainBlock}
          connectedAccount={accounts[0]} // Use first connected account as signer
        />

        <ContactFooter />
      </div>
    </ChainProvider>
  );
}