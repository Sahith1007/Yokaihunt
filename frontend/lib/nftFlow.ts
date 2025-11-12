import { buildPaymentTx, signAndSend } from './algorand/peraClient';

export async function mintFrozen({ backend, uid, wallet }: { backend: string; uid: string; wallet: string }) {
  const res = await fetch(`${backend}/api/nft/mint/frozen`, { method:'POST', headers:{ 'content-type':'application/json', 'x-wallet-address': wallet }, body: JSON.stringify({ uid, ownerWallet: wallet }) });
  return res.json();
}

export async function mintLiveInit({ backend, uid, wallet }: { backend: string; uid: string; wallet: string }) {
  const res = await fetch(`${backend}/api/nft/mint/live-init`, { method:'POST', headers:{ 'content-type':'application/json', 'x-wallet-address': wallet }, body: JSON.stringify({ uid, ownerWallet: wallet }) });
  return res.json();
}

export async function calcUpdateFee({ backend, uid }: { backend: string; uid: string }) {
  const r = await fetch(`${backend}/api/nft/calc-update-fee?uid=${encodeURIComponent(uid)}`);
  return r.json();
}

export async function prepareUpdate({ backend, uid, wallet }: { backend: string; uid: string; wallet: string }) {
  const r = await fetch(`${backend}/api/nft/prepare-update`, { method:'POST', headers:{ 'content-type':'application/json', 'x-wallet-address': wallet }, body: JSON.stringify({ uid, ownerWallet: wallet }) });
  return r.json();
}

export async function payAndVerify({ backend, order, wallet, uid }: { backend: string; order: any; wallet: string; uid: string }) {
  const txn = await buildPaymentTx({ to: order.backendWalletAddress, amountMicroAlgos: order.amountMicroAlgos, note: order.memo });
  const txId = await signAndSend(txn);
  const r = await fetch(`${backend}/api/nft/verify-payment`, { method:'POST', headers:{ 'content-type':'application/json', 'x-wallet-address': wallet }, body: JSON.stringify({ orderId: order.orderId, paymentTxId: txId, uid }) });
  return r.json();
}
