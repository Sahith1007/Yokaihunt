// backend/models/Pokemon.js
// Pokémon model - stores XP/Level in DB, not in NFT metadata

import mongoose from 'mongoose';

const PokemonSchema = new mongoose.Schema({
  ownerWallet: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  imageCid: {
    type: String,
    required: true
  },
  metadataCid: {
    type: String,
    required: true
  },
  assetId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  rarity: {
    type: String,
    required: true,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary']
  },
  level: {
    type: Number,
    default: 1,
    min: 1
  },
  xp: {
    type: Number,
    default: 0,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  versionKey: false,
  timestamps: true
});

// Index for querying by owner
PokemonSchema.index({ ownerWallet: 1, createdAt: -1 });

export default mongoose.models.Pokemon || mongoose.model('Pokemon', PokemonSchema);
