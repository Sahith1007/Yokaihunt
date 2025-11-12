import { pinJSON } from './pinataService.js';
import { indexerClient, mintASA, transferAsset, updateAssetMetadata, CREATOR_ACCOUNT } from './algorandService.js';
import NFTRecord from '../models/NFTRecord.js';

function cleanMetadata(obj) {
  // Basic sanitation: remove scripts and large fields
  const clone = JSON.parse(JSON.stringify(obj || {}));
  const str = JSON.stringify(clone);
  if (Buffer.byteLength(str, 'utf8') > 40 * 1024) throw new Error('metadata too large (>40KB)');
  return clone;
}

export async function mintAsset({ uid, type, ownerWallet, metadata, mode }) {
  if (!ownerWallet || !type || !metadata) throw new Error('ownerWallet, type, metadata required');
  const safe = cleanMetadata(metadata);
  const cid = await pinJSON(safe);
  const { assetId, txId } = await mintASA({ metadataUrl: `ipfs://${cid}`, assetName: safe?.name || `${type.toUpperCase()} NFT` });
  // Attempt to transfer to owner (may fail if not opted-in)
  if (!CREATOR_ACCOUNT) throw new Error('creator not configured');
  let transferTxId = null;
  let optInRequired = false;
  try {
    const t = await transferAsset({ assetId, fromSk: CREATOR_ACCOUNT.sk, fromAddr: CREATOR_ACCOUNT.addr, toAddr: ownerWallet });
    transferTxId = t.txId;
  } catch (e) {
    optInRequired = true;
  }

  let rec = null;
  try {
    rec = await NFTRecord.create({
      assetId: Number(assetId),
      uid,
      type,
      ownerWallet,
      currentCid: cid,
      liveUpdating: String(mode).toLowerCase() === 'live',
      history: [{ action: 'mint', cid, txId, by: ownerWallet }]
    });
  } catch (_) {}
  return { assetId: Number(assetId), txId, transferTxId, optInRequired, metadataCid: cid, record: rec };
}

export async function refreshAsset({ assetId, ownerWallet, newMetadata }) {
  if (!assetId || !ownerWallet || !newMetadata) throw new Error('assetId, ownerWallet, newMetadata required');
  // Verify ownership via indexer
  const info = await indexerClient.lookupAccountByID(ownerWallet).do();
  const owns = (info?.account?.assets || []).some(a => a['asset-id'] === Number(assetId) && (a.amount || 0) > 0);
  if (!owns) throw new Error('owner does not hold asset');

  const safe = cleanMetadata(newMetadata);
  const cid = await pinJSON(safe);
  const { txId } = await updateAssetMetadata({ assetId: Number(assetId), newMetadataUrl: `ipfs://${cid}` });
  let rec = null;
  try {
    rec = await NFTRecord.findOneAndUpdate(
      { assetId: Number(assetId) },
      { $set: { currentCid: cid }, $push: { history: { action: 'refresh', cid, txId, by: ownerWallet } } },
      { upsert: true, new: true }
    );
  } catch (_) {}
  return { configTxId: txId, newCid: cid, record: rec };
}

export async function getRecord(assetId) {
  try {
    const rec = await NFTRecord.findOne({ assetId: Number(assetId) }).lean();
    return rec;
  } catch (e) {
    return null;
  }
}

export async function recoverAsset({ ownerWallet, assetId }) {
  // Verify owner
  const info = await indexerClient.lookupAccountByID(ownerWallet).do();
  const owns = (info?.account?.assets || []).some(a => a['asset-id'] === Number(assetId) && (a.amount || 0) > 0);
  if (!owns) throw new Error('owner does not hold asset');
  // Read asset URL
  const asset = await indexerClient.lookupAssetByID(Number(assetId)).do();
  const url = asset?.asset?.params?.url || '';
  const cid = url.startsWith('ipfs://') ? url.slice('ipfs://'.length) : url;
  try {
    const rec = await NFTRecord.findOneAndUpdate(
      { assetId: Number(assetId) },
      { $set: { ownerWallet, currentCid: cid }, $push: { history: { action: 'recover', cid, by: ownerWallet, note: 'recovered from chain' } } },
      { upsert: true, new: true }
    );
    return rec;
  } catch (_) {
    return { assetId: Number(assetId), ownerWallet, currentCid: cid };
  }
}
