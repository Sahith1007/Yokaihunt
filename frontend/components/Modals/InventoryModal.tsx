"use client";

interface ModalProps {
  open: boolean;
  onClose: () => void;
}

export default function InventoryModal({ open, onClose }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full sm:max-w-md rounded-lg bg-[#111318] border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">🎒 Inventory</div>
          <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">✕</button>
        </div>
        <div className="text-sm text-gray-300">Your items will appear here.</div>
      </div>
    </div>
  );
}
