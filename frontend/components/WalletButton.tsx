"use client";

import { useState } from "react";
import { useWallet } from "../hooks/useWallet";

type ProviderId = "pera" | "myalgo" | "defly";

export default function WalletButton() {
  const { address, connected, connect, disconnect, formatAddress } = useWallet();
  const [open, setOpen] = useState(false);

  const shortAddress = address ? formatAddress(address) : "";

  const handleConnect = async (providerId: ProviderId) => {
    await connect(providerId);
    setOpen(false);
  };

  const handleDisconnect = async () => {
    await disconnect();
    setOpen(false);
  };

  return (
    <>
      <button
        className="fixed bottom-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg hover:bg-indigo-700 transition z-[3000]"
        onClick={() => setOpen(true)}
      >
        {connected ? `Wallet: ${shortAddress}` : "Connect Wallet"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[3500] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[#0f1116] text-white rounded-xl border border-white/10 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Wallet</div>
              <button
                className="text-sm opacity-70 hover:opacity-100"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            {!connected ? (
              <div className="grid gap-2">
                {(["pera", "myalgo", "defly"] as ProviderId[]).map((pid) => (
                  <button
                    key={pid}
                    onClick={() => handleConnect(pid)}
                    className="w-full bg-white/10 hover:bg-white/20 border border-white/10 rounded px-3 py-2 text-left capitalize transition"
                  >
                    {pid === "myalgo" ? "MyAlgo" : pid === "pera" ? "Pera" : "Defly"}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm">
                  Connected: <span className="font-mono">{address}</span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="text-red-300 text-sm underline hover:text-red-200 transition"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
