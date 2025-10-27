import { motion } from "framer-motion";

interface Props {
  onInventory?: () => void;
  onTeam?: () => void;
  onMarket?: () => void;
  onWallet?: () => void;
}

export default function Taskbar({ onInventory, onTeam, onMarket, onWallet }: Props) {
  const Item = ({ icon, label, onClick, disabled }: { icon: string; label: string; onClick?: () => void; disabled?: boolean }) => (
    <motion.button
      whileHover={{ y: -2, scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center w-24 h-16 rounded-lg bg-black/40 backdrop-blur border border-white/10 mx-2 ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-[0_0_12px_#6ee7ff]'}`}
    >
      <div className="text-xl">{icon}</div>
      <div className="text-xs mt-1 opacity-90">{label}</div>
    </motion.button>
  );

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[2000] flex items-center rounded-xl bg-white/5 p-2 border border-white/10">
      <Item icon="🎒" label="Inventory" onClick={onInventory} />
      <Item icon="🧠" label="Team" onClick={onTeam} />
      <Item icon="🏪" label="Market" onClick={onMarket} disabled />
      <Item icon="💰" label="Wallet" onClick={onWallet} />
    </div>
  );
}
