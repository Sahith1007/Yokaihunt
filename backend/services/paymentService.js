import NFTItem from '../models/NFTItem.js';
import { nanoid } from 'nanoid';
import { indexer } from './algorandWeb3Service.js';

export async function createOrder({ uid, ownerWallet, amountMicroAlgos, backendWallet }) {
  const orderId = nanoid(12);
  const doc = await NFTItem.findOne({ uid, ownerWallet });
  if (!doc) throw new Error('item not found');
  doc.pendingOrder = { orderId, amountMicroAlgos, backendWallet, memo: `nft-update:${uid}`, status: 'PENDING' };
  await doc.save();
  return doc.pendingOrder;
}

export async function verifyPaymentByTxId({ orderId, paymentTxId }) {
  // naive lookup with retries
  const max = 20; let last = null;
  for (let i = 0; i < max; i++) {
    try { last = await indexer().lookupTransactionByID(paymentTxId).do(); if (last?.transaction) break; } catch {}
    await new Promise(r => setTimeout(r, 1500));
  }
  if (!last?.transaction) throw new Error('payment not found');
  // Find order
  const doc = await NFTItem.findOne({ 'pendingOrder.orderId': orderId });
  if (!doc) throw new Error('order missing');
  const to = last.transaction['payment-transaction']?.receiver;
  const amt = last.transaction['payment-transaction']?.amount || 0;
  if (String(to) !== String(doc.pendingOrder.backendWallet) || amt < doc.pendingOrder.amountMicroAlgos) throw new Error('payment mismatch');
  doc.pendingOrder.status = 'PAID';
  doc.pendingOrder.paymentTxId = paymentTxId;
  await doc.save();
  return doc.pendingOrder;
}

export async function completeOrder({ orderId, paymentTxId, configTxId, metadataCid }) {
  const doc = await NFTItem.findOne({ 'pendingOrder.orderId': orderId });
  if (!doc) return null;
  doc.pendingOrder.status = 'PAID';
  doc.pendingOrder.paymentTxId = paymentTxId;
  doc.pendingOrder.updatedAt = new Date();
  await doc.save();
  return true;
}
