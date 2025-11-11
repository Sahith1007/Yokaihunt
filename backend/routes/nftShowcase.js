import express from 'express';
import { nanoid } from 'nanoid';
import NFTItem from '../models/NFTItem.js';
import Trainer from '../models/Trainer.js';
import { pinJSON } from '../services/pinataService.js';
import { mintASA, transferAsset, updateAssetMetadata } from '../services/algorandService.js';
import { createOrder, verifyPaymentByTxId, completeOrder } from '../services/paymentService.js';

const router = express.Router();
const BACKEND_HOT_ADDRESS = process.env.BACKEND_HOT_ADDRESS || '';
const SERVICE_FEE_ALGO = parseFloat(process.env.SERVICE_FEE_ALGO || '0.3');
const toMicro = (x)=> Math.round(x*1_000_000);

function w(req){ return (req.headers['x-wallet-address']||req.body?.wallet||req.query?.wallet||'').toString(); }

// A) options
router.get('/showcase/options', async (req,res)=>{
  try{
    const owner = w(req); const uid = (req.query.uid||'').toString();
    const doc = await NFTItem.findOne({ uid, ownerWallet: owner });
    if(!doc) return res.status(404).json({ ok:false, error:'not found' });
    res.json({ ok:true, uid, minted:doc.minted, assetId:doc.assetId, liveUpdating:doc.liveUpdating, options:['mint_frozen','mint_live'], estimatedMintFeeAlgo: 0.002 });
  }catch(e){ res.status(500).json({ ok:false, error:'failed' }); }
});

async function buildMetadata(doc){
  return {
    name: `${doc.species||'Yokai'} #${doc.uid}`,
    description: `Level ${doc.level||1} ${doc.species} owned by ${doc.ownerWallet}`,
    image: doc.imageUrl || '',
    attributes: [ { trait_type:'Level', value: doc.level||1 }, { trait_type:'XP', value: doc.xp||0 }, { trait_type:'Moves', value:(doc.moves||[]).join(', ') } ]
  };
}

// B) mint
router.post('/showcase/mint', async (req,res)=>{
  try{
    const owner = w(req); const { uid, mode } = req.body||{};
    const doc = await NFTItem.findOne({ uid, ownerWallet: owner });
    if(!doc) return res.status(404).json({ ok:false, error:'not found' });
    if(doc.minted) return res.status(400).json({ ok:false, error:'already minted' });
    const meta = await buildMetadata(doc);
    const cid = await pinJSON(meta);
    const { txId: mintTxId, assetId } = await mintASA({ metadataUrl: `ipfs://${cid}`, assetName: meta.name });
    const { txId: transferTxId } = await transferAsset({ assetId, fromSk: null, fromAddr: process.env.CREATOR_ADDRESS, toAddr: owner });
    doc.minted = true; doc.assetId = assetId; doc.metadataCid = cid; doc.liveUpdating = (mode==='live'); doc.showcase = true;
    await doc.save();
    // Set showcaseUid on trainer and unset previous
    const tr = await Trainer.findOneAndUpdate({ walletAddress: owner }, { $set: { showcaseUid: uid } }, { new:true, upsert:true });
    res.json({ ok:true, assetId, mintTxId, transferTxId, metadataCid: cid });
  }catch(e){ res.status(500).json({ ok:false, error:e.message||'mint failed' }); }
});

// C) prepareUpdate
router.post('/showcase/prepareUpdate', async (req,res)=>{
  try{
    const owner = w(req); const { uid } = req.body||{}; const doc = await NFTItem.findOne({ uid, ownerWallet: owner });
    if(!doc || !doc.minted || !doc.liveUpdating) return res.status(400).json({ ok:false, error:'not live-updating or not minted' });
    const order = await createOrder({ uid, ownerWallet: owner, amountMicroAlgos: toMicro(SERVICE_FEE_ALGO), backendWallet: BACKEND_HOT_ADDRESS });
    res.json({ ok:true, orderId: order.orderId, backendWallet: BACKEND_HOT_ADDRESS, amountMicroAlgos: order.amountMicroAlgos });
  }catch(e){ res.status(500).json({ ok:false, error:'failed' }); }
});

// D) verifyPayment
router.post('/showcase/verifyPayment', async (req,res)=>{
  try{
    const { orderId, paymentTxId } = req.body||{}; const order = await verifyPaymentByTxId({ orderId, paymentTxId });
    const doc = await NFTItem.findOne({ uid: order.uid });
    const meta = await buildMetadata(doc); const cid = await pinJSON(meta);
    const { txId: configTxId } = await updateAssetMetadata({ assetId: doc.assetId, newMetadataUrl:`ipfs://${cid}` });
    doc.metadataCid = cid; doc.lastOnChainSync = new Date(); await doc.save();
    await completeOrder({ orderId, paymentTxId, configTxId, metadataCid: cid });
    res.json({ ok:true, configTxId, metadataCid: cid });
  }catch(e){ res.status(500).json({ ok:false, error:e.message||'verify failed' }); }
});

// E) unsetShowcase
router.post('/showcase/unsetShowcase', async (req,res)=>{
  try{
    const owner = w(req); const { uid } = req.body||{}; const tr = await Trainer.findOne({ walletAddress: owner });
    if(!tr) return res.status(404).json({ ok:false, error:'trainer not found' });
    if(tr.showcaseUid === uid) { tr.showcaseUid = null; await tr.save(); }
    await NFTItem.updateOne({ uid, ownerWallet: owner }, { $set: { showcase:false } });
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ ok:false, error:'failed' }); }
});

// F) recover
router.post('/showcase/recover', async (req,res)=>{
  try{
    const owner = w(req); const { assetId } = req.body||{}; if(!owner||!assetId) return res.status(400).json({ ok:false });
    // Minimal recovery: create record if missing
    let item = await NFTItem.findOne({ assetId:Number(assetId), ownerWallet: owner });
    if(!item) item = await NFTItem.create({ uid: nanoid(10), ownerWallet: owner, species:'Recovered', minted:true, assetId:Number(assetId), showcase:false });
    res.json({ ok:true, item });
  }catch(e){ res.status(500).json({ ok:false, error:'failed' }); }
});

export default router;
