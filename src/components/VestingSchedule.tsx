import { ChainProvider, useAccounts, useLazyLoadQuery, useMutation } from "@reactive-dot/react";
import { idle, MutationError, pending } from "@reactive-dot/core";
import { getWalletMetadata } from "dot-connect";
import { useState, useEffect } from "react";

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
    <div className="rounded border border-gray-600 bg-gray-900/50 p-4">
      <div className="text-sm text-gray-400">Locked Vesting DOT</div>
      <div className="font-mono text-2xl font-bold text-pink-400">
        {(Number(lockedVesting) / 1e10).toFixed(4)} DOT
      </div>
      <div className="mt-1 text-xs text-gray-500">
        Relay block: {relayChainBlock.toString()}
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
    if (vestState === idle) {
      return { text: "Unlock Vested DOT", className: "bg-pink-600 text-white hover:bg-pink-700", disabled: false };
    }
    if (vestState === pending) {
      return { text: "Unlocking Vested DOT...", className: "cursor-not-allowed bg-gray-600 text-gray-400", disabled: true };
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
    return { text: "Processing...", className: "cursor-not-allowed bg-gray-600 text-gray-400", disabled: true };
  };

  const buttonState = getButtonState();
  const errorMessage = vestState instanceof MutationError ? vestState.message : null;

  if (!hasVesting) {
    return (
      <div className="my-4 rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">{name || "Account"}</div>
            <div className="text-xs text-gray-400">{wallet}</div>
          </div>
        </div>
        <div className="font-mono text-xs text-gray-500">{address}</div>
        
        {/* Show balances even if no vesting */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded border border-gray-600 bg-gray-900/50 p-3">
            <div className="text-xs text-gray-400">Full Balance</div>
            <div className="font-mono text-lg font-semibold">
              {(Number(fullBalance) / 1e10).toFixed(4)} DOT
            </div>
          </div>
          <div className="rounded border border-gray-600 bg-gray-900/50 p-3">
            <div className="text-xs text-gray-400">Free Balance</div>
            <div className="font-mono text-lg font-semibold">
              {(Number(freeBalance) / 1e10).toFixed(4)} DOT
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-center text-gray-400">No vesting schedule found</div>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-lg border border-gray-700 bg-gray-800/50 p-6">
      <div className="mb-4">
        <div className="text-lg font-bold">{name || "Account"}</div>
        <div className="text-xs text-gray-400">{wallet}</div>
        <div className="font-mono text-xs text-gray-500">{address}</div>
      </div>

      {/* Balance Information */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded border border-gray-600 bg-gray-900/50 p-3">
          <div className="text-xs text-gray-400">Full Balance</div>
          <div className="font-mono text-lg font-semibold">
            {(Number(fullBalance) / 1e10).toFixed(4)} DOT
          </div>
        </div>
        <div className="rounded border border-gray-600 bg-gray-900/50 p-3">
          <div className="text-xs text-gray-400">Free Balance</div>
          <div className="font-mono text-lg font-semibold">
            {(Number(freeBalance) / 1e10).toFixed(4)} DOT
          </div>
        </div>
      </div>

      {/* Unlock Vested Button */}
      <div className="mb-4">
        <button
          onClick={handleUnlockVested}
          disabled={buttonState.disabled}
          className={`w-full rounded-lg px-4 py-3 font-semibold transition-colors ${buttonState.className}`}
        >
          {buttonState.text}
        </button>
        {errorMessage && (
          <div className="mt-2 text-center text-sm text-red-400">{errorMessage}</div>
        )}
        {vestState !== idle && vestState !== pending && !(vestState instanceof MutationError) && (
          <div className="mt-2 text-center text-xs text-gray-400">
            Tx: {vestState.txHash.slice(0, 10)}...{vestState.txHash.slice(-8)} • {vestState.type}
          </div>
        )}
      </div>

      {/* Locked Vesting Amount */}
      <div className="mt-4">
        <LockedVestingAmount 
          vestingInfo={vestingInfo as VestingSchedule[]} 
          relayChainBlock={relayChainBlock}
        />
      </div>
    </div>
  );
}

export function VestingSchedule() {
  const accounts = useAccounts();
  const [relayChainBlock, setRelayChainBlock] = useState<bigint | null>(null);

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="mb-2 text-4xl font-bold">Vesting Schedule</h1>
        <p className="mb-8 text-gray-400">Connect your wallet to view your vesting schedule</p>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-12 text-center">
          <p className="text-gray-400">No accounts connected</p>
          <p className="mt-2 text-sm text-gray-500">Click "Connect Wallet" in the top right to get started</p>
        </div>
      </div>
    );
  }

  // Step 1: Fetch relay chain block number
  if (relayChainBlock === null) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="mb-2 text-4xl font-bold">Vesting Schedule</h1>
        <p className="mb-8 text-gray-400">Loading relay chain data...</p>
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
        <h1 className="mb-2 text-4xl font-bold">Vesting Schedule</h1>
        <p className="mb-8 text-gray-400">View your token vesting details</p>
        
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