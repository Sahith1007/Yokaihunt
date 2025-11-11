import React, { useState } from "react";
import { mintFrozen, mintLiveInit, calcUpdateFee, prepareUpdate, payAndVerify } from "../lib/nftFlow";

export default function InventoryItem({ item }: { item: any }) {
  const [busy, setBusy] = useState(false);
  const backend = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');
  const wallet = typeof window !== 'undefined' ? (localStorage.getItem('algorand_wallet_address') || '') : '';

  const doMintFrozen = async () => { setBusy(true); try { await mintFrozen({ backend, uid: item.uid, wallet }); } finally { setBusy(false); } };
  const doMintLive = async () => { setBusy(true); try { await mintLiveInit({ backend, uid: item.uid, wallet }); } finally { setBusy(false); } };
  const doSync = async () => {
    setBusy(true);
    try {
      const ord = await prepareUpdate({ backend, uid: item.uid, wallet });
      const res = await payAndVerify({ backend, order: ord, wallet, uid: item.uid });
      console.log('sync result', res);
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded p-2 flex items-center gap-2">
      <div className="flex-1">
        <div className="font-semibold">{item.species} — Lv.{item.level}</div>
        <div className="text-xs opacity-70">{item.uid}</div>
        <div className="text-xs mt-1">{item.minted ? (item.liveUpdating? 'OnChain (Live)':'OnChain (Frozen)') : 'In-Game'}</div>
      </div>
      {!item.minted ? (
        <div className="flex gap-2">
          <button disabled={busy} onClick={doMintFrozen} className="px-2 py-1 text-xs bg-green-600 rounded">Mint Frozen</button>
          <button disabled={busy} onClick={doMintLive} className="px-2 py-1 text-xs bg-blue-600 rounded">Mint Live</button>
        </div>
      ) : item.liveUpdating ? (
        <button disabled={busy} onClick={doSync} className="px-2 py-1 text-xs bg-yellow-600 rounded">Sync to Chain</button>
      ) : null}
    </div>
  );
}
