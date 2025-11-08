export class TransactionManager {
  private static listeners: Set<(tx: any) => void> = new Set();

  static async logCapture({ wallet, txId, meta }: { wallet: string; txId: string; meta?: any }) {
    try {
      const payload = { walletAddress: wallet, txId, type: 'CAPTURE', asset: 'Yokai', meta };
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/tx/log`, {
        method: 'POST', 
        headers: { 'content-type': 'application/json', 'x-wallet-address': wallet },
        body: JSON.stringify(payload)
      });
      // Notify listeners
      this.notifyListeners(payload);
    } catch {}
  }

  static async logTransaction({ wallet, txId, type, asset, meta }: { wallet: string; txId: string; type: string; asset: string; meta?: any }) {
    try {
      const payload = { walletAddress: wallet, txId, type, asset, meta };
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/tx/log`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-wallet-address': wallet },
        body: JSON.stringify(payload)
      });
      // Notify listeners
      this.notifyListeners(payload);
    } catch {}
  }

  static async fetchLogs(wallet: string) {
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/tx/log?walletAddress=${encodeURIComponent(wallet)}`;
    const res = await fetch(url, { headers: { 'x-wallet-address': wallet } });
    return await res.json().catch(() => ({ logs: [] }));
  }

  static onTransaction(callback: (tx: any) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private static notifyListeners(tx: any) {
    this.listeners.forEach(cb => {
      try {
        cb(tx);
      } catch {}
    });
    // Also dispatch global event for React components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('yokai-transaction-logged', { detail: tx }));
    }
  }
}
