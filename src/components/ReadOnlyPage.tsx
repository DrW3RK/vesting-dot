import { ChainProvider, useLazyLoadQuery } from "@reactive-dot/react";
import { useState } from "react";
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
  
  if (currentBlock) {
    onBlockFetched(BigInt(currentBlock));
  }
  
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

function ReadOnlyAccountVesting({ 
  address,
  relayChainBlock
}: { 
  address: string;
  relayChainBlock: bigint;
}) {
  const vestingInfo = useLazyLoadQuery((builder) => 
    builder.storage("Vesting", "Vesting", [address])
  );

  const accountInfo = useLazyLoadQuery((builder) =>
    builder.storage("System", "Account", [address])
  );

  const freeBalance = accountInfo?.data?.free || 0n;
  const reservedBalance = accountInfo?.data?.reserved || 0n;
  const fullBalance = BigInt(freeBalance) + BigInt(reservedBalance);

  const hasVesting = vestingInfo && Array.isArray(vestingInfo) && vestingInfo.length > 0;

  // Calculate locked vesting for transferable balance calculation
  let currentLockedVesting = 0n;
  if (hasVesting) {
    let totalLocked = 0n;
    let totalUnlocked = 0n;

    (vestingInfo as VestingSchedule[]).forEach((schedule) => {
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

    currentLockedVesting = totalLocked - totalUnlocked;
  }

  // Transferable balance = free balance - locked vesting
  const transferableBalance = BigInt(freeBalance) - currentLockedVesting;
  const actualTransferable = transferableBalance < 0n ? 0n : transferableBalance;

  if (!hasVesting) {
    return (
      <div className="my-4 rounded-lg border border-gray-300 bg-white/80 p-6 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="mb-2">
          <div className="text-lg font-bold text-gray-900 dark:text-white">Account Details</div>
        </div>
        <div className="font-mono text-xs text-gray-600 dark:text-gray-500">{address}</div>
        
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-900/50">
            <div className="text-xs text-gray-600 dark:text-gray-400">Full Balance</div>
            <div className="font-mono text-lg font-semibold text-gray-900 dark:text-white">
              {(Number(fullBalance) / 1e10).toFixed(4)} DOT
            </div>
          </div>
          <div className="rounded border border-gray-300 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-900/50">
            <div className="text-xs text-gray-600 dark:text-gray-400">Transferable Balance</div>
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
        <div className="text-lg font-bold text-gray-900 dark:text-white">Account Details</div>
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
          <div className="text-xs text-gray-600 dark:text-gray-400">Transferable Balance</div>
          <div className="font-mono text-lg font-semibold text-gray-900 dark:text-white">
            {(Number(actualTransferable) / 1e10).toFixed(4)} DOT
          </div>
        </div>
      </div>

      {/* Read-only notice */}
      <div className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <p className="text-sm text-blue-800 dark:text-blue-400">
          📖 <strong>Read-Only Mode:</strong> Connect your wallet to unlock vested tokens
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

export function ReadOnlyPage() {
  const [address, setAddress] = useState("");
  const [submittedAddress, setSubmittedAddress] = useState<string | null>(null);
  const [relayChainBlock, setRelayChainBlock] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Basic validation for Polkadot address (should start with 1 and be 47-48 characters)
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

    setSubmittedAddress(address.trim());
    setRelayChainBlock(null); // Reset relay chain block for new address
  };

  const handleReset = () => {
    setSubmittedAddress(null);
    setRelayChainBlock(null);
    setAddress("");
    setError(null);
  };

  // If no address submitted, show the input form
  if (!submittedAddress) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Vesting Schedule Viewer</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">
          Enter a Polkadot address to view its vesting schedule
        </p>
        
        <div className="rounded-lg border border-gray-300 bg-white/80 p-8 dark:border-gray-700 dark:bg-gray-800/50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="address" className="mb-2 block text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                Polkadot Address
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
              View Vesting Schedule
            </button>
          </form>

          <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              💡 <strong>Tip:</strong> Polkadot addresses start with "1"
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
        
        <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Read-Only Vesting Viewer</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">Loading relay chain data...</p>
        <ChainProvider chainId="polkadot">
          <RelayChainBlockFetcher onBlockFetched={setRelayChainBlock} />
        </ChainProvider>

        <ContactFooter />
      </div>
    );
  }

  // Step 2: Show vesting data
  return (
    <ChainProvider chainId="polkadot_asset_hub">
      <div className="mx-auto max-w-4xl p-8">
        <button
          onClick={handleReset}
          className="mb-4 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          ← View Different Address
        </button>
        
        <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Read-Only Vesting Viewer</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">Viewing vesting details</p>
        
        <ReadOnlyAccountVesting
          address={submittedAddress}
          relayChainBlock={relayChainBlock}
        />

        <ContactFooter />
      </div>
    </ChainProvider>
  );
}