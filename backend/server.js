import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import "./db.js";
import pokemonRoutes from "./routes/pokemon.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "YokaiHunt Backend is running!", uptime: process.uptime() });
});

// Routes
app.use("/api", pokemonRoutes);
import trainerRoutes from "./routes/trainer.js";
app.use("/api", trainerRoutes);
import nftRoutes from "./routes/nft2.js";
app.use("/api", nftRoutes);
import battleRoutes from "./routes/battle.js";
app.use("/api", battleRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🎮 API endpoints: http://localhost:${PORT}/api`);
});
