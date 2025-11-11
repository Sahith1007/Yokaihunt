import React, { useEffect, useState } from "react";
import MintShowcaseModal from "./MintShowcaseModal";

export default function TeamList({ team, onSelectShowcase }: { team: any[]; onSelectShowcase: (uid: string)=>void }) {
  const [open, setOpen] = useState<{ uid: string }|null>(null);

  return (
    <div className="space-y-2">
      {team.map((p) => (
        <div key={p.uid || p.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded p-2">
          <div className="flex-1">
            <div className="font-semibold">{p.species || p.name} — Lv.{p.level || 1}</div>
            <div className="text-xs opacity-70">UID: {p.uid || '-'}</div>
          </div>
          <button onClick={() => setOpen({ uid: p.uid })} className="px-2 py-1 text-xs bg-blue-600 rounded">Select for Showcase</button>
        </div>
      ))}

      {open && (
        <MintShowcaseModal
          uid={open.uid}
          onClose={() => setOpen(null)}
          onMintFrozen={() => onSelectShowcase(open.uid)}
          onMintLive={() => onSelectShowcase(open.uid)}
        />
      )}
    </div>
  );
}
