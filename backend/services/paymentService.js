const NFTItem = require('../models/NFTItem.js').default || require('../models/NFTItem.js');
const { nanoid } = require('nanoid');
const { indexerClient } = require('./algorandService');

async function createOrder({ uid, ownerWallet, amountMicroAlgos, backendWallet }) {
  const orderId = nanoid(12);
  const doc = await NFTItem.findOne({ uid, ownerWallet });
  if (!doc) throw new Error('item not found');
  doc.pendingOrder = { orderId, amountMicroAlgos, backendWallet, memo: `nft-update:${uid}`, status: 'PENDING' };
  await doc.save();
  return doc.pendingOrder;
}

async function verifyPaymentByTxId({ orderId, paymentTxId }) {
  const resp = await indexerClient.searchForTransactions().txid(paymentTxId).do();
  if (!resp?.transactions?.length) throw new Error('payment not found');
  const t = resp.transactions[0];
  if (!t['payment-transaction']) throw new Error('not a payment tx');
  const to = t['payment-transaction'].receiver;
  const amt = t['payment-transaction'].amount || 0;
  const doc = await NFTItem.findOne({ 'pendingOrder.orderId': orderId });
  if (!doc) throw new Error('order missing');
  if (String(to) !== String(doc.pendingOrder.backendWallet) || amt < doc.pendingOrder.amountMicroAlgos) throw new Error('payment mismatch');
  doc.pendingOrder.status = 'PAID';
  doc.pendingOrder.paymentTxId = paymentTxId;
  await doc.save();
  return doc.pendingOrder;
}

async function completeOrder({ orderId, paymentTxId, configTxId, metadataCid }) {
  const doc = await NFTItem.findOne({ 'pendingOrder.orderId': orderId });
  if (!doc) return null;
  doc.pendingOrder.status = 'PAID';
  doc.pendingOrder.paymentTxId = paymentTxId;
  doc.pendingOrder.updatedAt = new Date();
  await doc.save();
  return true;
}

module.exports = { createOrder, verifyPaymentByTxId, completeOrder };
