#!/usr/bin/env node
/**
 * runTestBots.js
 * Automated multi-wallet TestNet simulation for YokaiHunt showcase flows.
 *
 * Usage:
 *   node runTestBots.js
 *
 * Required env:
 *   BACKEND_BASE=http://localhost:4000
 *   MINT_PATH=/api/showcase/mint                (default)
 *   PREPARE_PATH=/api/showcase/prepareUpdate    (default)
 *   VERIFY_PATH=/api/showcase/verifyPayment     (default)
 *   ALGOD_URL=https://testnet-api.algonode.cloud
 *   ALGOD_TOKEN=                                 (optional)
 *   ALGOD_INDEXER_URL=https://testnet-idx.algonode.cloud
 *
 * Notes:
 * - This script generates 3 test wallets (or uses BOT*_MNEMONIC if provided).
 * - Each bot mints a live-updating NFT, then performs 2-3 update cycles with
 *   real TestNet payment -> backend verification -> ASA config update.
 */

import algosdk from 'algosdk';
import fetch from 'node-fetch';

const BACKEND = process.env.BACKEND_BASE || 'http://localhost:4000';
const MINT_PATH = process.env.MINT_PATH || '/api/showcase/mint';
const PREPARE_PATH = process.env.PREPARE_PATH || '/api/showcase/prepareUpdate';
const VERIFY_PATH = process.env.VERIFY_PATH || '/api/showcase/verifyPayment';

const ALGOD_URL = process.env.ALGOD_URL || 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';
const INDEXER_URL = process.env.ALGOD_INDEXER_URL || process.env.ALGOD_INDEXER || 'https://testnet-idx.algonode.cloud';

const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, '');
const indexer = new algosdk.Indexer('', INDEXER_URL, '');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForConfirmation(txId, timeout = 20) {
  const status = await algod.status().do();
  let lastRound = status['last-round'];
  for (let i = 0; i < timeout; i++) {
    const p = await algod.pendingTransactionInformation(txId).do();
    if (p && p['confirmed-round'] && p['confirmed-round'] > 0) return p;
    lastRound++; await algod.statusAfterBlock(lastRound).do();
  }
  throw new Error('tx not confirmed: ' + txId);
}

function mkAccountFromEnvOrGenerate(name) {
  const envKey = (process.env[`${name.toUpperCase()}_MNEMONIC`] || '').trim();
  if (envKey) {
    const acct = algosdk.mnemonicToSecretKey(envKey);
    return { name, addr: acct.addr, sk: acct.sk, mnemonic: envKey };
  }
  const acct = algosdk.generateAccount();
  const mnemonic = algosdk.secretKeyToMnemonic(acct.sk);
  return { name, addr: acct.addr, sk: acct.sk, mnemonic };
}

async function signAndSendPayment({ from, sk, to, amountMicroAlgos, note }) {
  const params = await algod.getTransactionParams().do();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from, to, amount: Number(amountMicroAlgos), note: note ? new Uint8Array(Buffer.from(note)) : undefined, suggestedParams: params
  });
  const signed = txn.signTxn(sk);
  const { txId } = await algod.sendRawTransaction(signed).do();
  await waitForConfirmation(txId);
  return txId;
}

async function ownsAsset(address, assetId) {
  const info = await indexer.lookupAccountByID(address).do();
  const assets = info?.account?.assets || [];
  return assets.some(a => a['asset-id'] === Number(assetId) && (a.amount || 0) > 0);
}

async function postJSON(url, body, headers = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    if (res.ok) return res.json();
    const t = await res.text().catch(()=> '');
    if (attempt === 3) throw new Error(`POST ${url} failed ${res.status} ${t}`);
    await sleep(500 * attempt);
  }
}

async function mintShowcase({ uid, wallet }) {
  const url = `${BACKEND}${MINT_PATH}`;
  const js = await postJSON(url, { uid, wallet, mode: 'live' }, { 'x-wallet-address': wallet });
  return js;
}

async function prepareUpdate({ uid, wallet }) {
  const url = `${BACKEND}${PREPARE_PATH}`;
  const js = await postJSON(url, { uid, wallet }, { 'x-wallet-address': wallet });
  return js; // { ok, orderId, backendWallet, amountMicroAlgos }
}

async function verifyPayment({ orderId, paymentTxId, wallet }) {
  const url = `${BACKEND}${VERIFY_PATH}`;
  const js = await postJSON(url, { orderId, paymentTxId }, { 'x-wallet-address': wallet });
  return js; // { ok, configTxId, metadataCid }
}

async function runBot(name) {
  const acct = mkAccountFromEnvOrGenerate(name);
  console.log(`\n=== ${name} ===`);
  console.log(`addr: ${acct.addr}`);
  console.log(`mnemonic (test only): ${acct.mnemonic}`);

  const uid = `${name}-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
  console.log(`uid: ${uid}`);

  // 1) Mint live-updating showcase
  const mint = await mintShowcase({ uid, wallet: acct.addr });
  if (!mint?.assetId) throw new Error(`${name}: mint failed ${JSON.stringify(mint)}`);
  console.log(`[mint] assetId=${mint.assetId} txMint=${mint.mintTxId} txSend=${mint.transferTxId} cid=${mint.metadataCid}`);

  // 2) Verify ownership
  for (let i=0;i<10;i++) {
    const ok = await ownsAsset(acct.addr, mint.assetId).catch(()=>false);
    if (ok) break; await sleep(1000);
    if (i===9) throw new Error(`${name}: asset not found in wallet after 10s`);
  }
  console.log(`[indexer] ownership confirmed for asset ${mint.assetId}`);

  // 3) Perform 2–3 update cycles
  const cycles = 2 + Math.floor(Math.random()*2);
  for (let i = 0; i < cycles; i++) {
    console.log(`-- cycle ${i+1} --`);
    // (c) Random new metadata update – simulated server-side; client only requests prepare
    const prep = await prepareUpdate({ uid, wallet: acct.addr });
    if (!prep?.backendWallet || !prep?.amountMicroAlgos) throw new Error(`${name}: prepareUpdate failed ${JSON.stringify(prep)}`);
    console.log(`[prepare] pay -> ${prep.backendWallet} amount=${prep.amountMicroAlgos}`);

    // (e) Pay fee
    const payTxId = await signAndSendPayment({ from: acct.addr, sk: acct.sk, to: prep.backendWallet, amountMicroAlgos: prep.amountMicroAlgos, note: `nft-update:${uid}` });
    console.log(`[payment] txId=${payTxId}`);

    // (f) Verify
    const ver = await verifyPayment({ orderId: prep.orderId, paymentTxId: payTxId, wallet: acct.addr });
    if (!ver?.ok) throw new Error(`${name}: verifyPayment failed ${JSON.stringify(ver)}`);
    console.log(`[verify] configTxId=${ver.configTxId} metadataCid=${ver.metadataCid}`);
  }

  console.log(`=== ${name} complete ===\n`);
  return { wallet: acct.addr, uid };
}

(async () => {
  try {
    console.log('Starting 3-bot TestNet showcase simulation...');
    console.log(`backend=${BACKEND}`);
    const bots = ['bot1','bot2','bot3'];
    for (const b of bots) {
      await runBot(b);
    }
    console.log('All bots completed successfully.');
  } catch (e) {
    console.error('Simulation failed:', e?.message || e);
    process.exit(1);
  }
})();
