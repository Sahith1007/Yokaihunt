"use client";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  team: any[];
}

export default function TeamModal({ open, onClose, team }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full sm:max-w-md rounded-lg bg-[#111318] border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">👥 Active Team</div>
          <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">✕</button>
        </div>
        {team.length === 0 ? (
          <div className="text-sm text-gray-300">No active Pokémon.</div>
        ) : (
          <ul className="space-y-2">
            {team.map((p) => (
              <li key={p.id} className="flex items-center gap-3 bg-white/5 rounded p-2">
                {p.spriteUrl && <img src={p.spriteUrl} alt={p.name} className="w-6 h-6 pixelated" />}
                <div className="flex-1">
                  <div className="text-sm font-semibold capitalize">{p.name}</div>
                  <div className="text-xs opacity-70">Lv.{p.level} HP {p.currentHp}/{p.maxHp}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
