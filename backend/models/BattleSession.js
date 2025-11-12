import mongoose from 'mongoose';

/**
 * BattleSession model
 * Stores complete battle state for PVP and Gym battles
 * Enables deterministic replay and validation
 */

const ActionSchema = new mongoose.Schema({
  turn: { type: Number, required: true },
  actorUid: { type: String, required: true }, // which pokemon acted
  moveId: { type: String, required: true }, // move used
  targetUid: { type: String }, // target pokemon (if applicable)
  damage: { type: Number, default: 0 },
  accuracy: { type: Boolean, default: true },
  timestamp: { type: Date, default: Date.now },
  signature: { type: String }, // wallet signature for verification (PVP only)
}, { _id: false });

const ParticipantSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  team: [{
    uid: { type: String, required: true }, // unique pokemon identifier
    pokeId: { type: Number, required: true },
    name: { type: String, required: true },
    level: { type: Number, required: true },
    currentHP: { type: Number, required: true },
    maxHP: { type: Number, required: true },
    attack: { type: Number, required: true },
    defense: { type: Number, required: true },
    speed: { type: Number, default: 50 },
    moves: [{ type: String }],
    status: { type: String, default: 'active' }, // active, fainted
  }],
  active: { type: Number, default: 0 }, // index of active pokemon
}, { _id: false });

const BattleSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['wild', 'pvp', 'gym'], required: true },
  
  // Participants
  players: [ParticipantSchema],
  
  // Battle state
  status: { 
    type: String, 
    enum: ['created', 'active', 'finished', 'abandoned'], 
    default: 'created' 
  },
  winner: { type: String }, // walletAddress of winner
  
  // Deterministic replay support
  seed: { type: String, required: true }, // random seed for deterministic outcomes
  actionLog: [ActionSchema],
  currentTurn: { type: Number, default: 0 },
  
  // Rewards (calculated on finish)
  rewards: {
    winner: {
      playerXP: { type: Number, default: 0 },
      pokemonXP: { type: Number, default: 0 },
      items: [{ type: String }],
    },
    loser: {
      playerXP: { type: Number, default: 0 },
      pokemonXP: { type: Number, default: 0 },
    }
  },
  
  // Metadata
  startedAt: { type: Date, default: Date.now },
  finishedAt: { type: Date },
  
  // Anti-cheat
  flagged: { type: Boolean, default: false },
  flagReason: { type: String },
}, { timestamps: true });

// Indexes for efficient queries
BattleSessionSchema.index({ 'players.walletAddress': 1 });
BattleSessionSchema.index({ status: 1, createdAt: -1 });

// Methods
BattleSessionSchema.methods.isParticipant = function(walletAddress) {
  return this.players.some(p => p.walletAddress === walletAddress);
};

BattleSessionSchema.methods.getParticipant = function(walletAddress) {
  return this.players.find(p => p.walletAddress === walletAddress);
};

BattleSessionSchema.methods.getOpponent = function(walletAddress) {
  return this.players.find(p => p.walletAddress !== walletAddress);
};

export default mongoose.model('BattleSession', BattleSessionSchema);
