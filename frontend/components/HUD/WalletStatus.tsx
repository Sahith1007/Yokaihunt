"use client";

import { useWallet } from "../../hooks/useWallet";

export default function WalletStatus() {
  const { address, connected, connect, disconnect, formatAddress } = useWallet();
  const handleClick = async () => {
    if (connected) return disconnect();
    // default to Pera; you can expose a selector later if needed
    await connect("pera");
  };
  return (
    <button
      onClick={handleClick}
      className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 border border-white/10 text-xs"
    >
      {connected ? `ADDR: ${formatAddress(address!)}` : "Connect Wallet"}
    </button>
  );
}
