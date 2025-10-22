import express from "express";
import { isMongoConnected } from "../db.js";
import Pokemon from "../models/Pokemon.js";
import Player from "../models/Player.js";
import Market from "../models/Market.js";

// Middleware to check database connection
const requireDatabase = (req, res, next) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ 
      error: "Database not available", 
      message: "Please configure MongoDB Atlas. See SETUP.md for instructions." 
    });
  }
  next();
};

const router = express.Router();

// 👤 Get current player (by token)
router.get("/player", async (req, res) => {
  try {
    // For now, return dummy player data since auth isn't implemented
    const mockPlayer = {
      username: "TestPlayer",
      progress: {
        posX: 64,
        posY: 64
      }
    };
    
    res.json(mockPlayer);
  } catch (error) {
    res.status(500).json({ error: "Failed to get player" });
  }
});

// 👤 Create new player
router.post("/player", requireDatabase, async (req, res) => {
  try {
    const { username, walletAddress } = req.body;
    
    // Check if player already exists
    const existingPlayer = await Player.findOne({ 
      $or: [{ username }, { walletAddress }] 
    });
    
    if (existingPlayer) {
      return res.status(400).json({ error: "Player already exists" });
    }

    const newPlayer = new Player({ username, walletAddress });
    await newPlayer.save();
    
    res.json({ success: true, player: newPlayer });
  } catch (error) {
    res.status(500).json({ error: "Failed to create player" });
  }
});

// 👤 Get player by ID
router.get("/player/:playerId", requireDatabase, async (req, res) => {
  try {
    const { playerId } = req.params;
    const player = await Player.findById(playerId).populate('pokedex');
    
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    
    res.json({ player });
  } catch (error) {
    res.status(500).json({ error: "Failed to get player" });
  }
});

// 🐾 Spawn random Pokémon (No database required)
router.get("/spawn", async (req, res) => {
  try {
    const id = Math.floor(Math.random() * 898) + 1;
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await response.json();

    res.json({
      name: data.name,
      stats: data.stats.map(s => ({ name: s.stat.name, value: s.base_stat })),
      sprite: data.sprites.front_default,
      types: data.types.map(t => t.type.name),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to spawn Pokémon" });
  }
});

// 🎯 Catch Pokémon
router.post("/catch", requireDatabase, async (req, res) => {
  try {
    const { playerId, name, stats, types } = req.body;
    const catchChance = Math.random();
    
    if (catchChance < 0.6) {
      return res.status(400).json({ success: false, message: "Pokémon escaped!" });
    }

    // Convert stats array to object
    const baseStats = {};
    stats.forEach(stat => {
      baseStats[stat.name.replace('-', '')] = stat.value;
    });

    const newPokemon = new Pokemon({ 
      name, 
      baseStats, 
      level: 1, 
      owner: playerId,
      isLegendary: false,
      isMythical: false
    });
    await newPokemon.save();

    await Player.findByIdAndUpdate(playerId, { $push: { pokedex: newPokemon._id } });

    res.json({ success: true, message: `${name} caught!`, pokemon: newPokemon });
  } catch (error) {
    res.status(500).json({ error: "Failed to catch Pokémon" });
  }
});

// 🐾 Get player Pokemon (by token)
router.get("/pokemon", requireDatabase, async (req, res) => {
  try {
    // For now, return dummy starter Pokemon since auth isn't implemented
    const mockPokemon = [
      {
        id: "starter1",
        name: "pikachu",
        pokeId: 25,
        level: 5,
        currentHp: 35,
        maxHp: 35,
        stats: [
          { name: "hp", value: 35 },
          { name: "attack", value: 55 },
          { name: "defense", value: 40 },
          { name: "speed", value: 90 }
        ],
        types: ["electric"]
      }
    ];
    
    res.json({ pokemon: mockPokemon });
  } catch (error) {
    res.status(500).json({ error: "Failed to get pokemon" });
  }
});

// 📦 Get player inventory (by token)
router.get("/inventory", requireDatabase, async (req, res) => {
  try {
    // For now, return dummy data since auth isn't implemented
    const mockInventory = {
      balls: {
        pokeball: 10,
        greatball: 5,
        ultraball: 3,
        masterball: 1
      }
    };
    
    res.json(mockInventory);
  } catch (error) {
    res.status(500).json({ error: "Failed to get inventory" });
  }
});

// 📦 Get player inventory by ID
router.get("/inventory/:playerId", requireDatabase, async (req, res) => {
  try {
    const { playerId } = req.params;
    const player = await Player.findById(playerId).populate('pokedex');
    
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    res.json({ inventory: player.pokedex });
  } catch (error) {
    res.status(500).json({ error: "Failed to get inventory" });
  }
});

// ⚡ Evolve Pokémon
router.post("/evolve", requireDatabase, async (req, res) => {
  try {
    const { playerId, pokemonIds } = req.body;
    
    if (!pokemonIds || pokemonIds.length < 2) {
      return res.status(400).json({ error: "Need at least 2 Pokémon to evolve" });
    }

    // Get the Pokémon to evolve
    const pokemon = await Pokemon.find({ _id: { $in: pokemonIds }, owner: playerId });
    
    if (pokemon.length !== pokemonIds.length) {
      return res.status(400).json({ error: "Invalid Pokémon or not owned by player" });
    }

    // Simple evolution logic - combine stats and increase level
    const evolvedStats = {
      hp: Math.floor(pokemon.reduce((sum, p) => sum + p.baseStats.hp, 0) / pokemon.length * 1.2),
      attack: Math.floor(pokemon.reduce((sum, p) => sum + p.baseStats.attack, 0) / pokemon.length * 1.2),
      defense: Math.floor(pokemon.reduce((sum, p) => sum + p.baseStats.defense, 0) / pokemon.length * 1.2),
      speed: Math.floor(pokemon.reduce((sum, p) => sum + p.baseStats.speed, 0) / pokemon.length * 1.2),
      yield: 100 // Evolved Pokémon have yield
    };

    const evolvedPokemon = new Pokemon({
      name: `Evolved ${pokemon[0].name}`,
      level: Math.max(...pokemon.map(p => p.level)) + 1,
      baseStats: evolvedStats,
      owner: playerId,
      isLegendary: false,
      isMythical: false
    });

    await evolvedPokemon.save();

    // Remove the original Pokémon
    await Pokemon.deleteMany({ _id: { $in: pokemonIds } });
    await Player.findByIdAndUpdate(playerId, { 
      $pull: { pokedex: { $in: pokemonIds } },
      $push: { pokedex: evolvedPokemon._id }
    });

    res.json({ success: true, pokemon: evolvedPokemon });
  } catch (error) {
    res.status(500).json({ error: "Failed to evolve Pokémon" });
  }
});

// 🛍️ List Pokémon for sale
router.post("/sell", requireDatabase, async (req, res) => {
  try {
    const { playerId, pokemonId, price } = req.body;
    
    const pokemon = await Pokemon.findOne({ _id: pokemonId, owner: playerId });
    if (!pokemon) {
      return res.status(404).json({ error: "Pokémon not found or not owned" });
    }

    const listing = new Market({
      pokemon: pokemonId,
      seller: playerId,
      price
    });

    await listing.save();
    res.json({ success: true, listing });
  } catch (error) {
    res.status(500).json({ error: "Failed to list Pokémon" });
  }
});

// 🏦 Get marketplace listings
router.get("/marketplace", requireDatabase, async (req, res) => {
  try {
    const listings = await Market.find({ isSold: false })
      .populate('pokemon')
      .populate('seller', 'username');
    
    res.json({ listings });
  } catch (error) {
    res.status(500).json({ error: "Failed to get marketplace" });
  }
});

// 💰 Buy Pokémon from marketplace
router.post("/buy", requireDatabase, async (req, res) => {
  try {
    const { buyerId, listingId } = req.body;
    
    const listing = await Market.findOne({ _id: listingId, isSold: false })
      .populate('pokemon');
    
    if (!listing) {
      return res.status(404).json({ error: "Listing not found or already sold" });
    }

    // Update ownership
    await Pokemon.findByIdAndUpdate(listing.pokemon._id, { owner: buyerId });
    
    // Update player inventories
    await Player.findByIdAndUpdate(listing.seller, { 
      $pull: { pokedex: listing.pokemon._id }
    });
    await Player.findByIdAndUpdate(buyerId, { 
      $push: { pokedex: listing.pokemon._id }
    });

    // Mark as sold
    listing.isSold = true;
    await listing.save();

    res.json({ success: true, pokemon: listing.pokemon });
  } catch (error) {
    res.status(500).json({ error: "Failed to buy Pokémon" });
  }
});

export default router;