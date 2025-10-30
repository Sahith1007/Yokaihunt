const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const API = `${BASE_URL}/api`;

function walletHeader(walletAddress?: string) {
  if (!walletAddress && typeof window !== 'undefined') {
    walletAddress = localStorage.getItem('algorand_wallet_address') || undefined;
  }
  return walletAddress ? { 'x-wallet-address': walletAddress } : {};
}

export async function loadTrainer(walletAddress: string) {
  const res = await fetch(`${API}/trainer/load/${encodeURIComponent(walletAddress)}`, {
    headers: { ...walletHeader(walletAddress) },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Load failed ${res.status}`);
  return res.json();
}

export async function saveTrainer(snapshot: any) {
  const res = await fetch(`${API}/trainer/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...walletHeader(snapshot?.walletAddress) },
    body: JSON.stringify(snapshot)
  });
  if (!res.ok) throw new Error(`Save failed ${res.status}`);
  return res.json();
}

export async function autosaveTrainer(payload: any) {
  const res = await fetch(`${API}/autosave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...walletHeader(payload?.walletAddress) },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Autosave failed ${res.status}`);
  return res.json();
}

export async function updateInventory(payload: any) {
  const res = await fetch(`${API}/trainer/updateInventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...walletHeader(payload?.walletAddress) },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Update inventory failed ${res.status}`);
  return res.json();
}

export async function xpSync(payload: { walletAddress: string; newXP: number }) {
  const res = await fetch(`${API}/trainer/xpSync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...walletHeader(payload.walletAddress) },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`XP sync failed ${res.status}`);
  return res.json();
}

export async function backupTrainer(walletAddress: string) {
  const res = await fetch(`${API}/trainer/backup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...walletHeader(walletAddress) },
    body: JSON.stringify({ walletAddress })
  });
  if (!res.ok) throw new Error(`Backup failed ${res.status}`);
  return res.json();
}