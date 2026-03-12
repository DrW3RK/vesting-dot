import { useLazyLoadQuery } from "@reactive-dot/react";
import { useEffect } from "react";

interface Props {
  onBlockFetched: (block: bigint) => void;
}

/**
 * Headless component that fetches the current relay chain block number and
 * reports it via callback. Renders nothing itself.
 */
export function RelayChainBlockFetcher({ onBlockFetched }: Props) {
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
