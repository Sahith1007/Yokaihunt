import mongoose from "mongoose";

const HistorySchema = new mongoose.Schema(
  {
    ts: { type: Date, default: Date.now },
    action: { type: String, enum: ["mint", "refresh", "recover"], required: true },
    cid: { type: String },
    txId: { type: String },
    by: { type: String }, // wallet or 'system'
    note: { type: String }
  },
  { _id: false }
);

const NFTRecordSchema = new mongoose.Schema(
  {
    assetId: { type: Number, unique: true, index: true, required: true },
    uid: { type: String }, // optional game id
    type: { type: String, enum: ["pokemon", "badge", "item"], required: true },
    ownerWallet: { type: String, index: true, required: true },
    currentCid: { type: String, required: true },
    liveUpdating: { type: Boolean, default: false },
    history: { type: [HistorySchema], default: [] }
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.models.NFTRecord || mongoose.model("NFTRecord", NFTRecordSchema);
