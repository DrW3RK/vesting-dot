import { type ChainId } from "@reactive-dot/core";
import { ChainProvider, ReactiveDotProvider } from "@reactive-dot/react";
import { ConnectionButton } from "dot-connect/react.js";
import { Suspense, useState } from "react";

import "./App.css";
import { ChainPage } from "./ChainPage";
import polkadotLogo from "./assets/polkadot-logo.svg";
import { AccountList } from "./components/AccountList";
import { ChainSwitch } from "./components/ChainSwitch";
import Loading from "./components/Loading";
import { config } from "./reactive-dot";

function App() {
  const [chainId, setChainId] = useState<ChainId>("paseo");

  return (
    <ReactiveDotProvider config={config}>
      <ChainProvider chainId={chainId}>
        <div className="fixed right-10 top-10">
          <div className="ml-5 inline-block">
            <ConnectionButton />
          </div>
          <div className="ml-5 inline-block">
            <ChainSwitch chainId={chainId} setChainId={setChainId} />
          </div>
        </div>

        <Suspense fallback={<Loading />}>
          <img src={polkadotLogo} className="logo mx-auto h-52 p-4" alt="Polkadot logo" />
          <div className="container mx-auto p-2 leading-6">
            <ChainPage />
          </div>

          <div>
            <AccountList />
          </div>
        </Suspense>
      </ChainProvider>
    </ReactiveDotProvider>
  );
}

export default App;
