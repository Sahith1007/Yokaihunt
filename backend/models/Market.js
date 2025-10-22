import mongoose from "mongoose";

const marketSchema = new mongoose.Schema({
  pokemon: { type: mongoose.Schema.Types.ObjectId, ref: "Pokemon" },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
  price: Number,
  isSold: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Market", marketSchema);