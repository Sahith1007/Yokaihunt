import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  username: String,
  walletAddress: String,
  pokedex: [{ type: mongoose.Schema.Types.ObjectId, ref: "Pokemon" }],
  inventory: { type: Object, default: {} },
  battlesWon: { type: Number, default: 0 },
  battlesLost: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Player", playerSchema);