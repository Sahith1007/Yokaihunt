import algosdk from 'algosdk';
import { walletManager } from '../../lib/wallet';

export async function buildPaymentTx({ to, amountMicroAlgos, note }: { to: string; amountMicroAlgos: number; note?: string }) {
  const base = process.env.NEXT_PUBLIC_ALGOD_URL || 'https://testnet-api.algonode.cloud';
  const params = await fetch(`${base}/v2/transactions/params`).then(r=>r.json()).catch(()=>null);
  const sp = {
    fee: params?.fee || 1000,
    flatFee: true,
    firstRound: params?.['last-round']||0,
    lastRound: (params?.['last-round']||0)+1000,
    genesisID: params?.['genesis-id']||'testnet-v1.0',
    genesisHash: params?.['genesis-hash']||'SGO1GKSfTKA2U2QEIh3vYvP4Q7E3EYKf5u5uVb5hG6k=',
    minFee: params?.['min-fee'] || 1000,
    firstValid: params?.['last-round']||0,
    lastValid: (params?.['last-round']||0)+1000,
  };
  const sender = walletManager.getAddress();
  if (!sender) throw new Error('No wallet connected');
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender, receiver: to, amount: amountMicroAlgos, note: note? new Uint8Array(Buffer.from(note)) : undefined, suggestedParams: sp });
  return txn;
}

export async function signAndSend(txn: algosdk.Transaction) {
  const manager = walletManager.getInstance();
  if (!manager?.activeWallet) throw new Error('No active wallet');
  
  const encodedTxn = algosdk.encodeUnsignedTransaction(txn);
  const signedTxns = await manager.activeWallet.signTransactions([encodedTxn]);
  const signedTxn = signedTxns[0];
  if (!signedTxn) throw new Error('Failed to sign transaction');
  
  const base = process.env.NEXT_PUBLIC_ALGOD_URL || 'https://testnet-api.algonode.cloud';
  const res = await fetch(`${base}/v2/transactions`, { method:'POST', headers:{'content-type':'application/x-binary'}, body: new Uint8Array(signedTxn) });
  const js = await res.json().catch(()=>({}));
  return js?.txId || js?.txid;
}
