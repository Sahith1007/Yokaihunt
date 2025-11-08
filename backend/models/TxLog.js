import mongoose from 'mongoose';

const TxLogSchema = new mongoose.Schema({
  walletAddress: { type: String, index: true },
  txId: { type: String, index: true },
  type: { type: String, default: 'CAPTURE' },
  asset: { type: String, default: 'Yokai' },
  meta: { type: Object },
  timestamp: { type: Date, default: Date.now, index: true }
}, { versionKey: false });

export default mongoose.models.TxLog || mongoose.model('TxLog', TxLogSchema);
