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

// Start server
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🎮 API endpoints: http://localhost:${PORT}/api`);
});
