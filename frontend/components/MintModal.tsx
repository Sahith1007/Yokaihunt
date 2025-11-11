import React from "react";

export default function MintModal({ open, onClose, onFrozen, onLive }: { open:boolean; onClose:()=>void; onFrozen:()=>void; onLive:()=>void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 z-[2600] flex items-center justify-center">
      <div className="bg-[#0f1116] text-white border border-white/10 rounded p-4 w-[440px]">
        <div className="font-semibold mb-2">Mint Pokémon to Wallet</div>
        <div className="text-sm opacity-80 mb-3">Choose how you want to mint your Pokémon:</div>
        <div className="space-y-2">
          <button onClick={onFrozen} className="w-full text-left p-3 rounded bg-white/5 hover:bg-white/10 border border-white/10">
            <div className="font-semibold">Frozen</div>
            <div className="text-xs opacity-70">One-time mint. No future on-chain updates. Cheapest.</div>
          </button>
          <button onClick={onLive} className="w-full text-left p-3 rounded bg-white/5 hover:bg-white/10 border border-white/10">
            <div className="font-semibold">Live-Updating</div>
            <div className="text-xs opacity-70">On-chain metadata can be refreshed later. Each refresh costs a small fee.</div>
          </button>
        </div>
        <div className="mt-3 text-right">
          <button onClick={onClose} className="px-3 py-1 text-xs bg-white/10 border border-white/10 rounded">Close</button>
        </div>
      </div>
    </div>
  );
}
