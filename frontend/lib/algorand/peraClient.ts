import algosdk from 'algosdk';
import { walletManager } from '../../lib/wallet';

export async function buildPaymentTx({ to, amountMicroAlgos, note }) {
  const base = process.env.NEXT_PUBLIC_ALGOD_URL || 'https://testnet-api.algonode.cloud';
  const params = await fetch(`${base}/v2/transactions/params`).then(r=>r.json()).catch(()=>null);
  const sp = {
    fee: params?.fee || 1000,
    flatFee: true,
    firstRound: params?.['last-round']||0,
    lastRound: (params?.['last-round']||0)+1000,
    genesisID: params?.['genesis-id']||'testnet-v1.0',
    genesisHash: params?.['genesis-hash']||'SGO1GKSfTKA2U2QEIh3vYvP4Q7E3EYKf5u5uVb5hG6k=',
  };
  const from = walletManager.getAddress();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ from, to, amount: amountMicroAlgos, note: note? new Uint8Array(Buffer.from(note)) : undefined, suggestedParams: sp });
  return txn;
}

export async function signAndSend(txn) {
  const blob = txn.toByte();
  const signed = await walletManager.signTxn(blob);
  const base = process.env.NEXT_PUBLIC_ALGOD_URL || 'https://testnet-api.algonode.cloud';
  const res = await fetch(`${base}/v2/transactions`, { method:'POST', headers:{'content-type':'application/x-binary'}, body: signed });
  const js = await res.json().catch(()=>({}));
  return js?.txId || js?.txid;
}
