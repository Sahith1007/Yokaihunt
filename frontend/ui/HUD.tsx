import React from 'react';

export function HUD({ onInventory }: { onInventory: ()=>void }) {
  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-[2100] flex gap-3">
      <button onClick={onInventory} className="px-3 py-2 rounded bg-black/60 text-white border border-white/10">🎒 Inventory</button>
    </div>
  );
}
