"use client";

import { useWallet } from "../../lib/wallet";

export default function WalletStatus() {
  const { address, connected, connectWith, disconnect, formatAddr } = useWallet();
  return (
    <button
      onClick={() => (connected ? disconnect() : connectWith('pera'))}
      className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 border border-white/10 text-xs"
    >
      {connected ? `ADDR: ${formatAddr(address!)}` : "Connect Wallet"}
    </button>
  );
}
