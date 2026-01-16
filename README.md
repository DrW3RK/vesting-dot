# Unlock Vested DOT

A simple dashboard built with [ReactiveDOT](https://reactivedot.dev/) to view and unlock vested DOT tokens on Polkadot Asset Hub.

## Features

- **Read-Only Mode**: View vesting schedules for any Polkadot address without connecting a wallet
- **Wallet Mode**: Connect your wallet to unlock your own vested DOT tokens
- **Vest Other**: Unlock vested tokens on behalf of another account (you pay the transaction fees)
- **Visual Timeline**: Interactive graphs showing vesting unlock schedules
- **Multiple Wallet Support**: Works with browser extension wallets and Ledger hardware wallets

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [Yarn](https://yarnpkg.com/) package manager

## Local Development

### 1. Clone the repository

```bash
git clone <repository-url>
cd vesting-dot
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Generate Polkadot API descriptors

```bash
yarn papi
```

### 4. Set up environment variables (optional)

Create a `.env.local` file in the project root for the Subscan API key:

```bash
VITE_SUBSCAN_API_KEY=your_subscan_api_key_here
```

> **Note**: The app will work without a Subscan API key, but balance information from Subscan may be rate-limited.

### 5. Start the development server

```bash
yarn dev
```

The app will be available at `http://localhost:5173` (or another port if 5173 is in use).