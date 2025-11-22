import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useMemo } from 'react';

interface VestingSchedule {
  locked: bigint | number;
  per_block: bigint | number;
  starting_block: bigint | number;
}

interface VestingGraphProps {
  vestingInfo: VestingSchedule[];
  currentRelayBlock: bigint;
  title?: string;
  scheduleIndex?: number;
}

// Polkadot relay chain has ~6 second block time
const BLOCK_TIME_SECONDS = 6;
const BLOCKS_PER_DAY = (24 * 60 * 60) / BLOCK_TIME_SECONDS;

export function VestingGraph({ vestingInfo, currentRelayBlock, title, scheduleIndex }: VestingGraphProps) {
  const { chartData, currentLockedVesting, fullyUnlockedBlock, fullyUnlockedDate } = useMemo(() => {
    // Calculate total locked across all vesting schedules
    let totalLocked = 0n;
    let latestEndBlock = 0n;

    vestingInfo.forEach((schedule) => {
      const locked = BigInt(schedule.locked);
      const perBlock = BigInt(schedule.per_block);
      const startingBlock = BigInt(schedule.starting_block);
      
      totalLocked += locked;
      
      // Calculate when this schedule ends
      const blocksToUnlock = locked / perBlock;
      const endBlock = startingBlock + blocksToUnlock;
      
      if (endBlock > latestEndBlock) {
        latestEndBlock = endBlock;
      }
    });

    // Helper function to calculate locked vesting at a specific block
    // This matches the logic in LockedVestingAmount component
    const calculateLockedVestingAtBlock = (block: bigint): bigint => {
      let totalUnlocked = 0n;
      
      vestingInfo.forEach((schedule) => {
        const locked = BigInt(schedule.locked);
        const perBlock = BigInt(schedule.per_block);
        const startingBlock = BigInt(schedule.starting_block);
        
        const blocksElapsed = block > startingBlock ? block - startingBlock : 0n;
        const unlocked = blocksElapsed * perBlock;
        
        // Cap unlocked at locked amount
        if (unlocked >= locked) {
          totalUnlocked += locked;
        } else {
          totalUnlocked += unlocked;
        }
      });
      
      // Locked vesting = Total locked - Unlocked
      return totalLocked - totalUnlocked;
    };

    // Calculate current locked vesting
    const currentLockedVesting = calculateLockedVestingAtBlock(currentRelayBlock);

    // Generate data points from NOW to END
    const startBlock = currentRelayBlock;
    const endBlock = latestEndBlock;
    const totalBlocks = Number(endBlock - startBlock);
    
    // Create data points (sample every N blocks for performance)
    const numPoints = Math.min(100, Math.max(10, totalBlocks));
    const blockInterval = Math.max(1, Math.floor(totalBlocks / numPoints));
    
    const data = [];
    
    // Always include the current block as the first point
    for (let i = 0; i <= numPoints; i++) {
      const blockOffset = BigInt(i * blockInterval);
      const block = startBlock + blockOffset;
      
      // Make sure we don't go past the end block
      const actualBlock = block > endBlock ? endBlock : block;
      
      // Calculate locked vesting at this block using the same logic as LockedVestingAmount
      const lockedVesting = calculateLockedVestingAtBlock(actualBlock);
      
      // Convert block to approximate date
      const blocksFromNow = Number(actualBlock - currentRelayBlock);
      const secondsFromNow = blocksFromNow * BLOCK_TIME_SECONDS;
      const date = new Date(Date.now() + secondsFromNow * 1000);
      
      const lockedDOT = Number(lockedVesting) / 1e10;
      
      data.push({
        block: Number(actualBlock),
        date: date.toLocaleDateString(),
        fullDate: date,
        lockedDOT: lockedDOT,
        isCurrent: i === 0, // First point is current block
      });
      
      if (actualBlock >= endBlock) break;
    }
    
    // Calculate fully unlocked date
    const blocksUntilFullyUnlocked = Number(latestEndBlock - currentRelayBlock);
    const secondsUntilFullyUnlocked = blocksUntilFullyUnlocked * BLOCK_TIME_SECONDS;
    const fullyUnlockedDate = new Date(Date.now() + secondsUntilFullyUnlocked * 1000);
    
    return {
      chartData: data,
      currentLockedVesting,
      fullyUnlockedBlock: latestEndBlock,
      fullyUnlockedDate,
    };
  }, [vestingInfo, currentRelayBlock]);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isToday = data.isCurrent;
      const dateLabel = isToday ? 'Today' : data.fullDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      return (
        <div className="rounded-lg border border-gray-300 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {dateLabel}
          </p>
          <p className="mt-2 text-lg font-bold text-pink-600 dark:text-pink-400">
            {data.lockedDOT.toFixed(4)} DOT
          </p>
          {isToday && (
            <p className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400">← Current Position</p>
          )}
        </div>
      );
    }
    return null;
  };

  const daysUntilFullyUnlocked = Math.ceil(
    Number(fullyUnlockedBlock - currentRelayBlock) / BLOCKS_PER_DAY
  );

  // Determine the display title
  const displayTitle = title || "Vesting Unlock Timeline";
  const isIndividualSchedule = scheduleIndex !== undefined;

  return (
    <div className="mt-6 rounded-lg border border-gray-300 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          {displayTitle}
        </h3>
        {isIndividualSchedule && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Unlock timeline for schedule #{scheduleIndex + 1}
          </p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded border border-gray-300 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/50">
          <div className="text-xs text-gray-600 dark:text-gray-400">Currently Locked</div>
          <div className="font-mono text-lg font-bold text-pink-600 dark:text-pink-400">
            {(Number(currentLockedVesting) / 1e10).toFixed(4)} DOT
          </div>
        </div>

        <div className="rounded border border-gray-300 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/50">
          <div className="text-xs text-gray-600 dark:text-gray-400">Fully Unlocked By</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {fullyUnlockedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        <div className="rounded border border-gray-300 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/50">
          <div className="text-xs text-gray-600 dark:text-gray-400">Days Remaining</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {daysUntilFullyUnlocked.toLocaleString()} days
          </div>
          <div className="text-xs text-gray-500">
            ≈ {Math.ceil(daysUntilFullyUnlocked / 30)} months
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`colorLocked-${scheduleIndex ?? 'aggregate'}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
            <XAxis 
              dataKey="date" 
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ fill: 'currentColor' }}
              interval={Math.floor(chartData.length / 5)}
              tickFormatter={(value, index) => {
                // Show "Today" for the first tick
                if (index === 0 && chartData[0]?.isCurrent) {
                  return 'Today';
                }
                return value;
              }}
            />
            <YAxis 
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ fill: 'currentColor' }}
              label={{ 
                value: 'Locked (DOT)', 
                angle: -90, 
                position: 'insideLeft',
                className: 'text-gray-600 dark:text-gray-400 fill-current'
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="lockedDOT"
              stroke="#ec4899"
              strokeWidth={2}
              fill={`url(#colorLocked-${scheduleIndex ?? 'aggregate'})`}
              dot={(props) => {
                const typedProps = props as { payload?: { isCurrent?: boolean }; cx?: number; cy?: number };
                if (typedProps.payload?.isCurrent) {
                  return (
                    <circle
                      cx={typedProps.cx}
                      cy={typedProps.cy}
                      r={6}
                      fill="#3b82f6"
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  );
                }
                return null;
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 text-center text-xs text-gray-500">
        <span className="inline-flex items-center">
          <span className="mr-2 inline-block h-3 w-3 rounded-full bg-blue-500"></span>
          Today's position • Graph shows future unlock timeline
        </span>
      </div>
    </div>
  );
}