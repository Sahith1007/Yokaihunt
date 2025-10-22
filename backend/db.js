import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

// Check if MongoDB URI is properly configured
if (!MONGO_URI || MONGO_URI === 'REPLACE_WITH_YOUR_MONGODB_ATLAS_URI' || MONGO_URI.includes('localhost:27017')) {
  console.log("⚠️  MongoDB Atlas not configured - running in development mode");
  console.log("📋 To set up MongoDB Atlas:");
  console.log("   1. Go to https://www.mongodb.com/cloud/atlas");
  console.log("   2. Create a free account and cluster");
  console.log("   3. Get your connection string");
  console.log("   4. Update MONGO_URI in .env file");
  console.log("   5. Example: MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/yokaihunt");
  console.log("\n🚀 Server will continue running. Some endpoints will work without database.");
} else {
  // Only try to connect if we have a valid MongoDB URI
  mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Atlas Connected"))
    .catch((err) => {
      console.error("❌ MongoDB Connection Failed:", err.message);
      console.log("💡 Check your MONGO_URI in .env file");
      console.log("🚀 Server will continue running with limited functionality.");
    });
}

// Export connection status for route handlers
export const isMongoConnected = () => mongoose.connection.readyState === 1;
