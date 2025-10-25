# Algorand Wallet Integration

✅ **Successfully integrated Algorand wallet support using @txnlab/use-wallet**

## 📁 File Structure

```
frontend/
├── lib/
│   └── wallet.ts           # Wallet manager with connector initialization
├── hooks/
│   └── useWallet.ts        # React hook for wallet state management
└── components/
    └── WalletButton.tsx    # Floating wallet connect button
```

## 🔧 Implementation Details

### 1. **wallet.ts** (`frontend/lib/wallet.ts`)
- Initializes `WalletManager` from `@txnlab/use-wallet`
- Configures three wallet providers:
  - **Pera Wallet** (`@perawallet/connect`)
  - **MyAlgo** (`@randlabs/myalgo-connect`)
  - **Defly Wallet** (`@blockshake/defly-connect`)
- Provides methods:
  - `initialize()` - Sets up wallet manager
  - `connect(providerId)` - Connects to a specific wallet
  - `disconnect()` - Disconnects active wallet
  - `isConnected()` - Checks connection status
  - `getAddress()` - Returns connected wallet address
  - `getActiveProvider()` - Returns active wallet provider ID

### 2. **useWallet.ts** (`frontend/hooks/useWallet.ts`)
- React hook wrapping the wallet manager
- Auto-initializes on mount
- Auto-restores wallet session from localStorage
- Polls for wallet state changes every 1s
- Returns:
  - `address` - Connected wallet address
  - `connected` - Boolean connection status
  - `connector` - Active wallet provider ID
  - `connect(providerId)` - Function to connect
  - `disconnect()` - Function to disconnect
  - `formatAddress(addr)` - Formats address to `ABCD…EFGH`

### 3. **WalletButton.tsx** (`frontend/components/WalletButton.tsx`)
- Floating button positioned at bottom-right
- Shows "Connect Wallet" when disconnected
- Shows shortened address when connected (e.g., "Wallet: ABCD…EFGH")
- Opens modal on click:
  - **Disconnected state**: Shows wallet provider selection (Pera, MyAlgo, Defly)
  - **Connected state**: Shows full address + Disconnect button
- Styled with Tailwind CSS
- Z-index: 3000 (button), 3500 (modal)

## 🚀 Usage

The `WalletButton` component is already integrated into the main game page:
- **File**: `frontend/src/pages/index.jsx` (line 7 & 84)
- The button is rendered globally and persists across Phaser scene reloads

## 📦 Dependencies

Installed packages:
- `@txnlab/use-wallet` - Wallet management framework
- `@perawallet/connect` - Pera Wallet connector
- `@randlabs/myalgo-connect` - MyAlgo connector
- `@blockshake/defly-connect` - Defly Wallet connector

## ✅ Expected Behavior

1. User opens the game → sees "Connect Wallet" button (bottom-right)
2. Clicking opens modal with wallet options
3. User selects Pera, MyAlgo, or Defly
4. Wallet extension opens → user approves connection
5. Button updates to show wallet address
6. On page reload, wallet session is auto-restored
7. User can disconnect anytime via the modal

## 🔄 Session Persistence

- Wallet connection state is managed by `@txnlab/use-wallet`
- State persists in browser's localStorage
- Auto-reconnects on page load if previously connected
- Connected address is logged to console for verification

## 🎨 Styling

Button uses indigo theme:
```tsx
className="fixed bottom-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg hover:bg-indigo-700 transition"
```

Modal uses dark theme matching game UI:
```tsx
className="bg-[#0f1116] text-white rounded-xl border border-white/10"
```

## 🔧 Configuration

Network configuration in `wallet.ts`:
```ts
network: "testnet", // Change to "mainnet" for production
algod: {
  baseServer: "https://testnet-api.algonode.cloud",
  port: "",
  token: "",
}
```

## 🐛 Troubleshooting

- Check browser console for connection logs
- Ensure wallet extensions are installed
- Verify network is set correctly (testnet vs mainnet)
- Clear localStorage if session seems stuck
