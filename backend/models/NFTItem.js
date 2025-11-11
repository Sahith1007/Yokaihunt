import mongoose from "mongoose";

const PendingOrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, index: true },
    amountMicroAlgos: Number,
    backendWallet: String,
    memo: String,
    status: { type: String, enum: ["PENDING", "PAID", "CANCELLED"], default: "PENDING" },
    paymentTxId: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const NFTItemSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true },
    ownerWallet: { type: String, required: true, index: true },
    species: String,
    level: Number,
    xp: Number,
    moves: [String],
    iv: { attack: Number, defense: Number, stamina: Number },
    minted: { type: Boolean, default: false },
    assetId: { type: Number, default: null },
    metadataCid: { type: String, default: null },
    liveUpdating: { type: Boolean, default: false },
    lastOnChainSync: { type: Date, default: null },
    pendingOrder: PendingOrderSchema,
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.models.NFTItem || mongoose.model("NFTItem", NFTItemSchema);
