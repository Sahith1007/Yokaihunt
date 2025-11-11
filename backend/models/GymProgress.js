import mongoose from "mongoose";

const GymProgressSchema = new mongoose.Schema(
  {
    wallet: { type: String, required: true, unique: true, index: true },
    gyms: { type: Map, of: Boolean, default: {} },
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export default mongoose.models.GymProgress || mongoose.model("GymProgress", GymProgressSchema);
