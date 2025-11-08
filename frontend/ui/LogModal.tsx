import React, { useEffect, useState } from 'react';

export function LogModal({ open, onClose, wallet }: { open: boolean; onClose: ()=>void; wallet: string|null }) {
  const [logs, setLogs] = useState<any[]>([]);
  
  const fetchLogs = async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/tx/log?walletAddress=${encodeURIComponent(wallet)}`, { headers: { 'x-wallet-address': wallet } });
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {}
  };

  useEffect(() => {
    if (!open || !wallet) return;
    fetchLogs();
    
    // Listen for new transaction events
    const handler = () => {
      fetchLogs();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('yokai-transaction-logged', handler);
      return () => window.removeEventListener('yokai-transaction-logged', handler);
    }
  }, [open, wallet]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 z-[2200] flex items-center justify-center">
      <div className="bg-[#0f1116] border border-white/10 rounded p-4 w-[480px] max-h-[70vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold">Recent Activity</div>
          <button onClick={onClose} className="text-sm opacity-75">Close</button>
        </div>
        <div className="space-y-2">
          {logs.length === 0 ? (
            <div className="text-sm opacity-60">No activity yet.</div>
          ) : logs.map((l, i) => (
            <div key={i} className="p-2 bg-white/5 rounded text-sm flex justify-between">
              <div>
                <div className="font-mono text-xs opacity-80">{l.type} · {l.asset}</div>
                <div className="font-mono text-xs">{l.txId}</div>
                {l.timestamp && (
                  <div className="text-xs opacity-60 mt-1">{new Date(l.timestamp).toLocaleString()}</div>
                )}
              </div>
              {l.txId && (
                <a className="text-blue-400 text-xs" target="_blank" rel="noreferrer" href={`https://testnet.algoexplorer.io/tx/${l.txId}`}>Open</a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
