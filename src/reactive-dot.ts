import { polkadot, polkadot_asset_hub} from "@polkadot-api/descriptors";
import { getWsProvider } from "@polkadot-api/ws-provider/web";
import { defineConfig } from "@reactive-dot/core";
import { InjectedWalletProvider } from "@reactive-dot/core/wallets.js";
import { LedgerWallet } from "@reactive-dot/wallet-ledger";
// import { WalletConnect } from "@reactive-dot/wallet-walletconnect";
import { registerDotConnect } from "dot-connect";

/**
 * Creates a WebSocket provider that tries multiple RPC endpoints sequentially
 * until a successful connection is established.
 *
 * @param endpoints - Array of RPC endpoint URLs to try in order
 * @returns A provider function that attempts each endpoint until one succeeds
 */
const createFallbackWsProvider = (endpoints: string[]) => {
  let currentEndpointIndex = 0;

  return async () => {
    let lastError: Error | undefined;

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[(currentEndpointIndex + i) % endpoints.length];
      try {
        const provider = getWsProvider(endpoint);
        const connection = await provider();
        console.log(`Successfully connected to ${endpoint}`);
        currentEndpointIndex = (currentEndpointIndex + i) % endpoints.length;
        return connection;
      } catch (error) {
        console.warn(`Failed to connect to ${endpoint}:`, error);
        lastError = error as Error;
      }
    }

    throw new Error(
      `Failed to connect to any RPC endpoint. Last error: ${lastError?.message}`
    );
  };
};

export const config = defineConfig({
  chains: {
    polkadot: {
      descriptor: polkadot,
      provider: getWsProvider("wss://rpc.polkadot.io"),
    },
    polkadot_asset_hub: {
      descriptor: polkadot_asset_hub,
      provider: createFallbackWsProvider([
        "wss://sys.ibp.network/asset-hub-polkadot",
        "wss://asset-hub-polkadot.dotters.network",
        "wss://polkadot-asset-hub-rpc.polkadot.io",
      ]),
    },
  },
  wallets: [
    new InjectedWalletProvider(),
    new LedgerWallet(),
    // Uncomment to configure WalletConnect.
    //new WalletConnect({
    //  projectId: "WALLET_CONNECT_PROJECT_ID",
    //  providerOptions: {
    //    metadata: {
    //      name: "APP_NAME",
    //      description: "APP_DESCRIPTION",
    //      url: "APP_URL",
    //      icons: ["APP_ICON"]
    //    }
    //  },
    //  // https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-13.md
    //  chainIds: [
    //    "polkadot:91b171bb158e2d3848fa23a9f1c25182" // Polkadot
    //  ],
    //  optionalChainIds: [
    //    "polkadot:91b171bb158e2d3848fa23a9f1c25182", // Polkadot
    //    "polkadot:b0a8d493285c2df73290dfb7e61f870f", // Kusama
    //    "polkadot:77afd6190f1554ad45fd0d31aee62aac", // Paseo
    //    "polkadot:e143f23803ac50e8f6f8e62695d1ce9e" // Westend
    //  ]
    //})
  ],
});

declare module "@reactive-dot/core" {
  export interface Register {
    config: typeof config;
  }
}

registerDotConnect(config);