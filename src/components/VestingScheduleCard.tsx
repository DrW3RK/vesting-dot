interface VestingSchedule {
  locked: bigint | number;
  per_block: bigint | number;
  starting_block: bigint | number;
}

interface VestingScheduleCardProps {
  schedule: VestingSchedule;
  scheduleIndex: number;
  currentRelayBlock: bigint;
}

export function VestingScheduleCard({ schedule, scheduleIndex, currentRelayBlock }: VestingScheduleCardProps) {
  const locked = BigInt(schedule.locked);
  const perBlock = BigInt(schedule.per_block);
  const startingBlock = BigInt(schedule.starting_block);

  // Calculate unlocked amount for this schedule
  const blocksElapsed = currentRelayBlock > startingBlock ? currentRelayBlock - startingBlock : 0n;
  const unlocked = blocksElapsed * perBlock;
  const actualUnlocked = unlocked >= locked ? locked : unlocked;
  
  // Calculate locked amount for this schedule
  const lockedAmount = locked - actualUnlocked;
  
  // Calculate when this schedule will be fully unlocked
  const blocksToUnlock = locked / perBlock;
  const endBlock = startingBlock + blocksToUnlock;
  const isFullyUnlocked = currentRelayBlock >= endBlock;
  
  // Calculate percentage unlocked
  const percentageUnlocked = Number((actualUnlocked * 100n) / locked);
  
  // Calculate days remaining (6 second block time)
  const BLOCK_TIME_SECONDS = 6;
  const BLOCKS_PER_DAY = (24 * 60 * 60) / BLOCK_TIME_SECONDS;
  const blocksRemaining = endBlock > currentRelayBlock ? endBlock - currentRelayBlock : 0n;
  const daysRemaining = Math.ceil(Number(blocksRemaining) / BLOCKS_PER_DAY);
  
  // Calculate end date
  const secondsUntilEnd = Number(blocksRemaining) * BLOCK_TIME_SECONDS;
  const endDate = new Date(Date.now() + secondsUntilEnd * 1000);

  return (
    <div className="rounded-lg border border-gray-300 bg-gradient-to-br from-gray-50 to-white p-4 shadow-sm dark:border-gray-600 dark:from-gray-900/50 dark:to-gray-800/30">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Schedule #{scheduleIndex + 1}
        </h4>
        {isFullyUnlocked && (
          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-400">
            ✓ Fully Unlocked
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Initial Locked Amount */}
        <div className="rounded bg-white p-2 shadow-sm dark:bg-gray-900/50">
          <div className="text-xs text-gray-500 dark:text-gray-400">Initial Locked</div>
          <div className="font-mono text-sm font-bold text-gray-900 dark:text-white">
            {(Number(locked) / 1e10).toFixed(4)} DOT
          </div>
        </div>

        {/* Currently Locked */}
        <div className="rounded bg-white p-2 shadow-sm dark:bg-gray-900/50">
          <div className="text-xs text-gray-500 dark:text-gray-400">Currently Locked</div>
          <div className="font-mono text-sm font-bold text-pink-600 dark:text-pink-400">
            {(Number(lockedAmount) / 1e10).toFixed(4)} DOT
          </div>
        </div>

        {/* Unlocked Amount */}
        <div className="rounded bg-white p-2 shadow-sm dark:bg-gray-900/50">
          <div className="text-xs text-gray-500 dark:text-gray-400">Unlocked</div>
          <div className="font-mono text-sm font-bold text-green-600 dark:text-green-400">
            {(Number(actualUnlocked) / 1e10).toFixed(4)} DOT
          </div>
        </div>

        {/* Per Block Vesting */}
        <div className="rounded bg-white p-2 shadow-sm dark:bg-gray-900/50">
          <div className="text-xs text-gray-500 dark:text-gray-400">Per Block</div>
          <div className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
            {(Number(perBlock) / 1e10).toFixed(6)} DOT
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Progress</span>
          <span className="font-semibold">{percentageUnlocked.toFixed(1)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-pink-500 to-pink-600 transition-all duration-300"
            style={{ width: `${percentageUnlocked}%` }}
          />
        </div>
      </div>

      {/* Timeline Info */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-gray-500 dark:text-gray-400">Starting Block</div>
          <div className="font-mono font-semibold text-gray-900 dark:text-white">
            {startingBlock.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-gray-400">End Block</div>
          <div className="font-mono font-semibold text-gray-900 dark:text-white">
            {endBlock.toLocaleString()}
          </div>
        </div>
      </div>

      {!isFullyUnlocked && (
        <div className="mt-3 rounded bg-blue-50 p-2 dark:bg-blue-900/20">
          <div className="text-xs text-blue-800 dark:text-blue-400">
            <span className="font-semibold">{daysRemaining.toLocaleString()} days</span> remaining
            {' '}({Math.ceil(daysRemaining / 30)} months)
          </div>
          <div className="mt-1 text-xs text-blue-600 dark:text-blue-300">
            Fully unlocked: {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      )}
    </div>
  );
}