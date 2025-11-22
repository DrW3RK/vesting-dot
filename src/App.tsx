import { type ChainId } from "@reactive-dot/core";
import { ChainProvider, ReactiveDotProvider } from "@reactive-dot/react";
import { ConnectionButton } from "dot-connect/react.js";
import { Suspense, useState } from "react";

import "./App.css";
import polkadotLogo from "./assets/polkadot-logo.svg";
import { ChainSwitch } from "./components/ChainSwitch";
import Loading from "./components/Loading";
import { VestingSchedule } from "./components/VestingSchedule";
import { ReadOnlyPage } from "./components/ReadOnlyPage";
import { config } from "./reactive-dot";

type PageMode = "wallet" | "readonly";

function App() {
  const [chainId, setChainId] = useState<ChainId>("polkadot_asset_hub");
  const [pageMode, setPageMode] = useState<PageMode>("wallet");

  return (
    <ReactiveDotProvider config={config}>
      <ChainProvider chainId={chainId}>
        {/* Navigation tabs */}
        <div className="fixed left-10 top-10 z-50">
          <div className="flex gap-2 rounded-lg bg-white/90 p-1 shadow-lg dark:bg-gray-800/90">
            <button
              onClick={() => setPageMode("wallet")}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                pageMode === "wallet"
                  ? "bg-pink-600 text-white"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              🔗 Wallet Mode
            </button>
            <button
              onClick={() => setPageMode("readonly")}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                pageMode === "readonly"
                  ? "bg-pink-600 text-white"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              📖 Read-Only Mode
            </button>
          </div>
        </div>

        {/* Wallet and chain controls (only show in wallet mode) */}
        {pageMode === "wallet" && (
          <div className="fixed right-10 top-10 z-50">
            <div className="ml-5 inline-block">
              <ConnectionButton />
            </div>
            <div className="ml-5 inline-block">
              <ChainSwitch chainId={chainId} setChainId={setChainId} />
            </div>
          </div>
        )}

        <Suspense fallback={<Loading />}>
          <img src={polkadotLogo} className="logo mx-auto h-32 p-4" alt="Polkadot logo" />
          
          {pageMode === "wallet" ? (
            <VestingSchedule />
          ) : (
            <ReadOnlyPage />
          )}
        </Suspense>
      </ChainProvider>
    </ReactiveDotProvider>
  );
}

export default App;