import React from 'react';

export function ChatPanel({ open, onClose }: { open: boolean; onClose: ()=>void }) {
  if (!open) return null;
  return (
    <div className="fixed bottom-16 left-2 z-[2200] w-80 bg-[#0f1116] border border-white/10 rounded p-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm opacity-80">Chat (placeholder)</div>
        <button onClick={onClose} className="text-xs opacity-60">Close</button>
      </div>
      <div className="h-40 overflow-auto text-xs opacity-70">Coming soon...</div>
      <input className="mt-2 w-full text-sm bg-white/5 border border-white/10 rounded px-2 py-1" placeholder="Type message..." />
    </div>
  );
}
