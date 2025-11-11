import express from 'express';
import { nanoid } from 'nanoid';
import NFTItem from '../models/NFTItem.js';
import { pinJSON } from '../services/pinataService.js';
import { mintFrozenAsset, transferToOwner, updateAssetMetadata, waitForPayment } from '../services/algorandWeb3Service.js';

const router = express.Router();

function w(req){ return (req.headers['x-wallet-address']||req.body?.ownerWallet||req.query?.ownerWallet||'').toString(); }
const BACKEND_HOT_ADDRESS = process.env.BACKEND_HOT_ADDRESS || '';
const SERVICE_FEE_ALGO = parseFloat(process.env.SERVICE_FEE_ALGO || '0.3');

function algoToMicro(a){ return Math.round(a*1_000_000); }

// 1) mint-options
router.post('/nft/mint-options', async (req,res)=>{
  try{
    const owner = w(req); const { uid } = req.body||{};
    const doc = await NFTItem.findOne({ uid });
    if(!doc || (owner && doc.ownerWallet.toLowerCase()!==owner.toLowerCase())) return res.status(404).json({ ok:false, error:'not found' });
    const status = doc.minted ? 'on-chain' : 'in-game';
    res.json({ ok:true, status, minted:doc.minted, assetId:doc.assetId, options:[ 'frozen','live' ], message: doc.minted? 'Already minted':'Eligible to mint' });
  }catch(e){ res.status(500).json({ ok:false, error:'failed' }); }
});

// helper to build metadata from DB
async function buildMetadata(doc){
  return {
    name: `${doc.species || 'Yokai'} #${doc.uid}`,
    description: `Level ${doc.level||1} ${doc.species} owned by ${doc.ownerWallet}`,
    image: doc.imageUrl || '',
    attributes: [
      { trait_type:'Level', value: doc.level||1 },
      { trait_type:'XP', value: doc.xp||0 },
      { trait_type:'Moves', value: (doc.moves||[]).join(', ') }
    ]
  };
}

// 2) mint frozen
router.post('/nft/mint/frozen', async (req,res)=>{
  try{
    const owner = w(req); const { uid } = req.body||{};
    const doc = await NFTItem.findOne({ uid });
    if(!doc || doc.ownerWallet.toLowerCase()!==owner.toLowerCase()) return res.status(404).json({ ok:false, error:'not found' });
    if(doc.minted) return res.json({ ok:true, assetId:doc.assetId, minted:true });
    const meta = await buildMetadata(doc);
    const cid = await pinJSON(meta);
    const { txId: mintTxId, assetId } = await mintFrozenAsset({ name: meta.name, url:`ipfs://${cid}` });
    const { txId: transferTxId } = await transferToOwner({ assetId, to: owner });
    doc.minted = true; doc.assetId = assetId; doc.metadataCid = cid; doc.liveUpdating=false; await doc.save();
    res.json({ ok:true, assetId, mintTxId, transferTxId, metadataCid:cid });
  }catch(e){ res.status(500).json({ ok:false, error:e.message||'mint failed' }); }
});

// 3) mint live-init
router.post('/nft/mint/live-init', async (req,res)=>{
  try{
    const owner = w(req); const { uid } = req.body||{};
    const doc = await NFTItem.findOne({ uid });
    if(!doc || doc.ownerWallet.toLowerCase()!==owner.toLowerCase()) return res.status(404).json({ ok:false, error:'not found' });
    const meta = await buildMetadata(doc);
    const cid = await pinJSON(meta);
    const { txId: mintTxId, assetId } = await mintFrozenAsset({ name: meta.name, url:`ipfs://${cid}` });
    const { txId: transferTxId } = await transferToOwner({ assetId, to: owner });
    doc.minted = true; doc.assetId = assetId; doc.metadataCid = cid; doc.liveUpdating=true; await doc.save();
    res.json({ ok:true, assetId, mintTxId, transferTxId, metadataCid:cid });
  }catch(e){ res.status(500).json({ ok:false, error:e.message||'mint failed' }); }
});

// 4) calc-update-fee
router.get('/nft/calc-update-fee', async (req,res)=>{
  const est = algoToMicro(SERVICE_FEE_ALGO);
  res.json({ ok:true, estimateMicroAlgos: est, human:`${SERVICE_FEE_ALGO} ALGO`});
});

// 5) prepare-update
router.post('/nft/prepare-update', async (req,res)=>{
  try{
    const owner=w(req); const { uid } = req.body||{}; const doc = await NFTItem.findOne({ uid });
    if(!doc || doc.ownerWallet.toLowerCase()!==owner.toLowerCase()) return res.status(404).json({ ok:false, error:'not found' });
    if(!doc.minted || !doc.liveUpdating) return res.status(400).json({ ok:false, error:'not live-updating' });
    const orderId = nanoid(12);
    const amountMicroAlgos = algoToMicro(SERVICE_FEE_ALGO);
    const memo = `nft-update:${uid}`;
    doc.pendingOrder = { orderId, amountMicroAlgos, backendWallet: BACKEND_HOT_ADDRESS, memo, status:'PENDING' };
    await doc.save();
    res.json({ ok:true, backendWalletAddress: BACKEND_HOT_ADDRESS, amountMicroAlgos, memo, orderId });
  }catch(e){ res.status(500).json({ ok:false, error:'failed' }); }
});

// 6) verify-payment
router.post('/nft/verify-payment', async (req,res)=>{
  try{
    const { orderId, paymentTxId, uid } = req.body||{}; const doc = await NFTItem.findOne({ uid });
    if(!doc || !doc.pendingOrder || doc.pendingOrder.orderId!==orderId) return res.status(404).json({ ok:false, error:'order not found' });
    const tx = await waitForPayment(paymentTxId);
    const to = tx['payment-transaction']?.receiver || tx['tx-type']==='pay' && tx['payment-transaction']?.receiver;
    const amt = tx['payment-transaction']?.amount || 0;
    if(String(to)!==String(doc.pendingOrder.backendWallet) || amt < doc.pendingOrder.amountMicroAlgos) return res.status(400).json({ ok:false, error:'payment mismatch' });
    // Pin new metadata and update ASA URL
    const meta = await buildMetadata(doc);
    const cid = await pinJSON(meta);
    const { txId: configTxId } = await updateAssetMetadata({ assetId: doc.assetId, url:`ipfs://${cid}` });
    doc.metadataCid = cid; doc.lastOnChainSync = new Date(); doc.pendingOrder.status='PAID'; doc.pendingOrder.paymentTxId = paymentTxId; await doc.save();
    res.json({ ok:true, configTxId, metadataCid: cid });
  }catch(e){ res.status(500).json({ ok:false, error:e.message||'verify failed' }); }
});

// 7) admin update
router.post('/nft/update-metadata', async (req,res)=>{
  try{
    const { uid } = req.body||{}; const doc = await NFTItem.findOne({ uid }); if(!doc) return res.status(404).json({ ok:false, error:'not found' });
    const cid = await pinJSON(await buildMetadata(doc));
    const { txId } = await updateAssetMetadata({ assetId: doc.assetId, url:`ipfs://${cid}` });
    doc.metadataCid = cid; doc.lastOnChainSync = new Date(); await doc.save();
    res.json({ ok:true, configTxId: txId, metadataCid: cid });
  }catch(e){ res.status(500).json({ ok:false, error:'failed' }); }
});

// 8) recover
router.post('/nft/recover', async (req,res)=>{
  try{
    const { ownerWallet, assetId } = req.body||{}; if(!ownerWallet||!assetId) return res.status(400).json({ ok:false, error:'missing fields' });
    let doc = await NFTItem.findOne({ assetId:Number(assetId) });
    if(!doc){ doc = await NFTItem.create({ uid: nanoid(10), ownerWallet, species:'Recovered', minted:true, assetId:Number(assetId) }); }
    res.json({ ok:true, item: doc });
  }catch(e){ res.status(500).json({ ok:false, error:'failed' }); }
});

export default router;
