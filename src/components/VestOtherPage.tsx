import { ChainProvider, useAccounts, useLazyLoadQuery, useMutation } from "@reactive-dot/react";
import { idle, MutationError, pending } from "@reactive-dot/core";
import { getWalletMetadata } from "dot-connect";
import { useState, useEffect } from "react";
import { VestingGraph } from "./VestingGraph";
import { ContactFooter } from "./ContactFooter";
import { TransactionButton } from "./TransactionButton";
import { RelayChainBlockFetcher } from "./RelayChainBlockFetcher";

interface VestingSchedule {
  locked: bigint | number;
  per_block: bigint | number;
  starting_block: bigint | number;
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
  connectedAccount,
  walletName
}: {
  targetAddress: string;
  relayChainBlock: bigint;
  connectedAccount: any;
  walletName: string;
}) {
  const [vestSuccessful, setVestSuccessful] = useState(false);

  const vestingInfo = useLazyLoadQuery((builder) =>
    builder.storage("Vesting", "Vesting", [targetAddress])
  );

  const accountInfo = useLazyLoadQuery((builder) =>
    builder.storage("System", "Account", [targetAddress])
  );

  // Use mutation with signer from connected account - calling vest_other with target address
  const [vestState, submitVest] = useMutation(
    (tx) => tx.Vesting.vest_other({ target: { type: "Id", value: targetAddress } }),
    { signer: connectedAccount?.polkadotSigner }
  );

  const frozen = (accountInfo as any)?.data?.frozen ?? 0n;

  // Compute on-chain locked and available to unlock from vesting schedules
  let onChainLocked = 0n;
  if (vestingInfo && Array.isArray(vestingInfo) && vestingInfo.length > 0) {
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
  const availableToUnlock = frozen > onChainLocked ? frozen - onChainLocked : 0n;

  // Track successful vest
  useEffect(() => {
    if (vestState !== idle && vestState !== pending && !(vestState instanceof MutationError)) {
      if (vestState.type === "finalized" && vestState.ok) {
        setVestSuccessful(true);
      }
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

  const hasVesting = vestingInfo && Array.isArray(vestingInfo) && vestingInfo.length > 0;

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
        <TransactionButton
          vestState={vestState}
          walletName={walletName}
          idleLabel="Unlock Vested DOT for Other"
          onSubmit={handleUnlockVested}
        />
      </div>

      {/* Info notice */}
      <div className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <p className="text-sm text-blue-800 dark:text-blue-400">
          🎁 <strong>Vest Other:</strong> You are unlocking vested tokens for another account. Transaction fees will be paid from your connected wallet.
        </p>
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

export function VestOtherPage() {
  const accounts = useAccounts();
  const [address, setAddress] = useState("");
  const [submittedAddress, setSubmittedAddress] = useState<string | null>(null);
  const [relayChainBlock, setRelayChainBlock] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get wallet name for the first account
  const getWalletName = () => {
    if (accounts.length > 0) {
      const walletMeta = getWalletMetadata(accounts[0].wallet);
      return walletMeta?.name ?? accounts[0].wallet.name;
    }
    return "";
  };

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
          walletName={getWalletName()}
        />

        <ContactFooter />
      </div>
    </ChainProvider>
  );
}
