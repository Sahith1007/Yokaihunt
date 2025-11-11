import React, { useEffect, useState } from "react";

export default function MintShowcaseModal({ uid, onClose, onMintFrozen, onMintLive }: { uid:string; onClose:()=>void; onMintFrozen:()=>void; onMintLive:()=>void }) {
  const [opts, setOpts] = useState<any>(null);
  const backend = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');
  const wallet = typeof window !== 'undefined' ? (localStorage.getItem('algorand_wallet_address') || '') : '';

  useEffect(()=>{
    fetch(`${backend}/api/showcase/options?uid=${encodeURIComponent(uid)}&wallet=${encodeURIComponent(wallet)}`, { headers: { 'x-wallet-address': wallet } })
      .then(r=>r.json()).then(setOpts).catch(()=>{});
  }, [uid]);

  return (
    <div className="fixed inset-0 bg-black/70 z-[2700] flex items-center justify-center">
      <div className="bg-[#0f1116] text-white border border-white/10 rounded p-4 w-[460px]">
        <div className="font-semibold mb-2">Showcase Pokémon</div>
        <div className="text-xs opacity-70 mb-2">UID: {uid}</div>
        <div className="space-y-2">
          <button onClick={onMintFrozen} className="w-full text-left p-3 rounded bg-white/5 border border-white/10 hover:bg-white/10">
            <div className="font-semibold">Mint Frozen</div>
            <div className="text-xs opacity-70">One-time mint. No future on-chain updates.</div>
          </button>
          <button onClick={onMintLive} className="w-full text-left p-3 rounded bg-white/5 border border-white/10 hover:bg-white/10">
            <div className="font-semibold">Mint Live-Updating</div>
            <div className="text-xs opacity-70">Allows paid sync to chain later.</div>
          </button>
        </div>
        <div className="mt-3 text-right">
          <button onClick={onClose} className="px-3 py-1 text-xs bg-white/10 border border-white/10 rounded">Close</button>
        </div>
      </div>
    </div>
  );
}
