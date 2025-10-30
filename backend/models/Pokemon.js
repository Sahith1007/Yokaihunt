import mongoose from "mongoose";

const pokemonSchema = new mongoose.Schema({
  name: String,
  level: Number,
  baseStats: {
    hp: Number,
    attack: Number,
    defense: Number,
    speed: Number,
    yield: Number, // Only for evolved ones
  },
  isLegendary: Boolean,
  isMythical: Boolean,
  rarityTier: { type: String, enum: ["common", "rare", "epic", "legendary", "mythic"], default: "common" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
  minted: { type: Boolean, default: false },
});

export default mongoose.model("Pokemon", pokemonSchema);