import React, { useEffect, useMemo, useState } from "react";

export default function GymMenu() {
  const [gyms, setGyms] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [teamFor, setTeamFor] = useState<any | null>(null);

  const backend = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');
  const wallet = typeof window !== 'undefined' ? (localStorage.getItem('algorand_wallet_address') || '') : '';

  useEffect(() => {
    (async () => {
      try {
        const list = await fetch(`${backend}/api/gym/list`, { headers: { 'x-wallet-address': wallet } }).then(r => r.json());
        setGyms(list.gyms || []);
        const prog = await fetch(`${backend}/api/gym/progress?wallet=${encodeURIComponent(wallet)}`, { headers: { 'x-wallet-address': wallet } }).then(r => r.json());
        setProgress(prog.progress || {});
      } catch {}
    })();

    const onWin = async (e: any) => {
      try {
        const { gymId } = e.detail || {};
        if (!gymId) return;
        const r = await fetch(`${backend}/api/gym/win`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-wallet-address': wallet },
          body: JSON.stringify({ wallet, gymId })
        });
        if (r.ok) {
          const prog = await fetch(`${backend}/api/gym/progress?wallet=${encodeURIComponent(wallet)}`, { headers: { 'x-wallet-address': wallet } }).then(x => x.json());
          setProgress(prog.progress || {});
        }
      } catch {}
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('yokai-gym-battle-win', onWin);
      return () => window.removeEventListener('yokai-gym-battle-win', onWin);
    }
  }, []);

  const startBattle = async (gymId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${backend}/api/gym/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-wallet-address': wallet },
        body: JSON.stringify({ wallet, gymId })
      }).then(r => r.json());
      const battle = res.battle;
      if (battle && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('yokai-gym-battle-start', { detail: battle }));
      }
    } catch {}
    setLoading(false);
  };

  return (
    <div className="p-3 text-sm">
      <div className="text-lg font-bold mb-2">Gym Leaders</div>
      <div className="grid grid-cols-1 gap-2">
        {gyms.map((g) => (
          <div key={g.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded p-2">
            <div className="flex-1">
              <div className="font-semibold">{g.name} — {g.region}</div>
              <div className="text-xs opacity-70">{g.leaderNotes}</div>
            </div>
            <div className={`text-xs px-2 py-1 rounded ${progress[g.id] ? 'bg-green-700' : 'bg-red-700'}`}>
              {progress[g.id] ? 'Defeated' : 'Undefeated'}
            </div>
            <button onClick={() => setTeamFor(g)} className="px-2 py-1 text-xs border border-white/20 rounded bg-white/10 hover:bg-white/20">Team</button>
            <button disabled={loading} onClick={() => startBattle(g.id)} className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50">Battle</button>
          </div>
        ))}
      </div>

      {teamFor && (
        <GymTeamModal gym={teamFor} onClose={() => setTeamFor(null)} />
      )}
    </div>
  );
}

export function GymTeamModal({ gym, onClose }: { gym: any; onClose: ()=>void }) {
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
