import mongoose from "mongoose";

const PokemonSubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    level: { type: Number, default: 1 },
    hp: { type: Number, default: 10 },
    attack: { type: Number, default: 5 },
    defense: { type: Number, default: 5 },
    moves: { type: [String], default: [] },
    rarity: { type: String, default: "Common" },
    caughtAt: { type: Date, default: Date.now },
    // On-chain linkage (optional)
    assetId: { type: Number },
    txId: { type: String },
    image_url: { type: String },
    metadata_cid: { type: String },
  },
  { _id: false }
);

const TrainerSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, index: true, unique: true, sparse: true },
    username: { type: String },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 }, // total XP (back-compat)
    currentXP: { type: Number, default: 0 }, // XP within current level
    nextLevelXP: { type: Number, default: 100 },
    team: { type: [PokemonSubSchema], default: [] },
    storage: { type: [PokemonSubSchema], default: [] },
    inventory: {
      pokeballs: { type: Number, default: 10 },
      potions: { type: Number, default: 0 },
      berries: { type: Number, default: 0 },
    },
    location: {
      x: { type: Number, default: 64 },
      y: { type: Number, default: 64 },
      biome: { type: String, default: "grassland" },
    },
    ipfsBackupHash: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Trainer", TrainerSchema);