import React from "react";

export default function GymTeamModal({ gym, onClose }: { gym: any; onClose: ()=>void }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-[2400] flex items-center justify-center">
      <div className="bg-[#0f1116] text-white border border-white/10 rounded p-4 w-[520px] max-h-[70vh] overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">{gym.name} — Team</div>
          <button onClick={onClose} className="text-xs opacity-70">Close</button>
        </div>
        <ul className="space-y-2">
          {gym.team.map((p: any, i: number) => (
            <li key={i} className="flex items-center gap-3 bg-white/5 rounded p-2">
              {p.spriteUrl && <img src={p.spriteUrl} className="w-8 h-8" alt={p.species} />}
              <div className="flex-1">
                <div className="font-semibold">{p.species} — Lv.{p.level}</div>
                <div className="text-xs opacity-70">{(p.moves || []).join(', ')}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
