import mongoose from 'mongoose';

const ActiveTrainerSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, index: true, unique: true },
  username: { type: String },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  biome: { type: String, default: 'grassland', index: true },
  lastActive: { type: Date, default: Date.now, index: true },
}, { timestamps: false, versionKey: false });

export default mongoose.models.ActiveTrainer || mongoose.model('ActiveTrainer', ActiveTrainerSchema);
