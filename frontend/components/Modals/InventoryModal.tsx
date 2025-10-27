"use client";
import { useEffect, useState } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
}

interface Inventory {
  pokeball: number;
  greatball: number;
  ultraball: number;
  masterball: number;
}

export default function InventoryModal({ open, onClose }: ModalProps) {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      import('../../lib/api/pokemonApi')
        .then(mod => mod.getPlayerInventory())
        .then(data => {
          setInventory(data);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [open]);

  if (!open) return null;

  const ballIcons: Record<string, string> = {
    pokeball: '⚾',
    greatball: '🥎',
    ultraball: '🏀',
    masterball: '🎱'
  };

  const ballNames: Record<string, string> = {
    pokeball: 'Poké Ball',
    greatball: 'Great Ball',
    ultraball: 'Ultra Ball',
    masterball: 'Master Ball'
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full sm:max-w-md rounded-lg bg-[#111318] border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">🎒 Inventory</div>
          <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">✕</button>
        </div>
        
        {loading ? (
          <div className="text-sm text-gray-300 py-4 text-center">Loading...</div>
        ) : inventory ? (
          <div className="space-y-2">
            {Object.entries(inventory).map(([key, count]) => (
              <div key={key} className="flex items-center justify-between bg-white/5 p-3 rounded-lg hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{ballIcons[key]}</span>
                  <span className="text-sm font-medium">{ballNames[key]}</span>
                </div>
                <span className="text-sm font-bold text-blue-400">× {count}</span>
              </div>
            ))}
            {Object.values(inventory).every(v => v === 0) && (
              <div className="text-sm text-gray-400 py-4 text-center">Your inventory is empty.</div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-400 py-4 text-center">Failed to load inventory.</div>
        )}
      </div>
    </div>
  );
}
