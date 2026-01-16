interface RpcEndpointSelectorProps {
  selectedEndpoint: string;
  onEndpointChange: (endpoint: string) => void;
}

const RPC_ENDPOINTS = [
  { url: "wss://sys.ibp.network/asset-hub-polkadot", label: "IBP Network" },
  { url: "wss://asset-hub-polkadot.dotters.network", label: "Dotters Network" },
  { url: "wss://polkadot-asset-hub-rpc.polkadot.io", label: "Polkadot.io" },
  { url: "wss://dot-rpc.stakeworld.io/assethub", label: "StakeWorld" },
  { url: "wss://statemint.public.curie.radiumblock.co/ws", label: "RadiumBlock" },
  { url: "wss://rpc-asset-hub-polkadot.luckyfriday.io", label: "LuckyFriday" },
];

export function RpcEndpointSelector({ selectedEndpoint, onEndpointChange }: RpcEndpointSelectorProps) {
  return (
    <div className="inline-block">
      <select
        value={selectedEndpoint}
        onChange={(e) => onEndpointChange(e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {RPC_ENDPOINTS.map((endpoint) => (
          <option key={endpoint.url} value={endpoint.url}>
            {endpoint.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export const DEFAULT_RPC_ENDPOINT = "wss://sys.ibp.network/asset-hub-polkadot";
export { RPC_ENDPOINTS };
