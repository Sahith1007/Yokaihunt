"use client";

import { useState } from "react";
import { useWallet, type ProviderId } from "../lib/wallet";

export default function WalletButton() {
  const { address, connected, connectWith, disconnect, formatAddr } = useWallet();
  const [open, setOpen] = useState(false);

  const short = address ? formatAddr(address) : "";

  return (
    <>
      <button
        className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg hover:bg-emerald-700 transition z-[3000]"
        onClick={() => (connected ? setOpen(true) : setOpen(true))}
      >
        {connected ? `Wallet: ${short}` : "Connect Wallet"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[3500] bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm bg-[#0f1116] text-white rounded-xl border border-white/10 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Wallet</div>
              <button className="text-sm opacity-70 hover:opacity-100" onClick={() => setOpen(false)}>✕</button>
            </div>

            {!connected ? (
              <div className="grid gap-2">
                {(["pera","myalgo","defly"] as ProviderId[]).map((pid) => (
                  <button
                    key={pid}
                    onClick={async () => { await connectWith(pid); setOpen(false); }}
                    className="w-full bg-white/10 hover:bg-white/20 border border-white/10 rounded px-3 py-2 text-left capitalize"
                  >
                    {pid}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm">Connected: <span className="font-mono">{address}</span></div>
                <button onClick={async () => { await disconnect(); setOpen(false); }} className="text-red-300 text-sm underline">Disconnect</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
