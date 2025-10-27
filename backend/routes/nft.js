import express from 'express';
import algorandService from '../services/algorandService.js';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/nft/mint-catch
 * Mint NFT when player catches a Pokemon
 */
router.post('/mint-catch', async (req, res) => {
  try {
    const { pokemonData, playerAddress, userId } = req.body;

    if (!pokemonData || !playerAddress) {
      return res.status(400).json({
        error: 'Missing required fields: pokemonData, playerAddress'
      });
    }

    // Validate Algorand address
    if (!playerAddress.match(/^[A-Z2-7]{58}$/)) {
      return res.status(400).json({
        error: 'Invalid Algorand address format'
      });
    }

    console.log(`🎯 Minting NFT for ${pokemonData.name} caught by ${playerAddress}`);

    // Mint NFT on Algorand
    const result = await algorandService.mintYokaiNFT(pokemonData, playerAddress);

    // Save to database
    if (userId) {
      try {
        const playerProgress = await prisma.playerProgress.upsert({
          where: { userId },
          update: { walletAddress: playerAddress },
          create: {
            userId,
            walletAddress: playerAddress,
            ownedYokai: []
          }
        });

        await prisma.caughtNFT.create({
          data: {
            progressId: playerProgress.id,
            assetId: BigInt(result.assetId),
            pokemonName: pokemonData.name,
            pokeId: pokemonData.pokeId || pokemonData.id || 0,
            rarity: pokemonData.rarity || 'Common',
            level: pokemonData.level || 1,
            isLegendary: pokemonData.isLegendary || false,
            txHash: result.txId,
            metadata: pokemonData
          }
        });
      } catch (dbError) {
        console.warn('Failed to save to DB, but NFT minted:', dbError);
      }
    }

    res.json({
      success: true,
      message: `Successfully minted ${pokemonData.name} as NFT!`,
      nft: {
        assetId: result.assetId,
        txId: result.txId,
        name: pokemonData.name,
        rarity: pokemonData.rarity,
        isLegendary: pokemonData.isLegendary,
        explorerUrl: `https://testnet.algoexplorer.io/tx/${result.txId}`
      }
    });

  } catch (error) {
    console.error('❌ Minting error:', error);
    res.status(500).json({
      error: 'Failed to mint NFT',
      message: error.message
    });
  }
});

/**
 * POST /api/nft/mint-starter
 * Mint starter Pokemon NFT for new players
 */
router.post('/mint-starter', async (req, res) => {
  try {
    const { starterName, playerAddress, userId } = req.body;

    if (!starterName || !playerAddress) {
      return res.status(400).json({
        error: 'Missing required fields: starterName, playerAddress'
      });
    }

    // Check if player already has starter
    if (userId) {
      const progress = await prisma.playerProgress.findUnique({
        where: { userId }
      });

      if (progress?.starterChosen) {
        return res.status(400).json({
          error: 'Starter Pokemon already claimed',
          starterPokemon: progress.starterPokemon
        });
      }
    }

    // Get starter data from PokeAPI
    const starterMap = {
      'charmander': 4,
      'squirtle': 7,
      'bulbasaur': 1
    };

    const pokeId = starterMap[starterName.toLowerCase()];
    if (!pokeId) {
      return res.status(400).json({
        error: 'Invalid starter Pokemon. Choose: Charmander, Squirtle, or Bulbasaur'
      });
    }

    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokeId}`);
    const pokemonData = await response.json();

    // Prepare starter NFT data
    const starterData = {
      name: starterName,
      pokeId,
      rarity: 'Starter',
      type: pokemonData.types?.[0]?.type?.name || 'Normal',
      attack: pokemonData.stats?.find(s => s.stat.name === 'attack')?.base_stat || 50,
      defense: pokemonData.stats?.find(s => s.stat.name === 'defense')?.base_stat || 50,
      speed: pokemonData.stats?.find(s => s.stat.name === 'speed')?.base_stat || 50,
      hp: pokemonData.stats?.find(s => s.stat.name === 'hp')?.base_stat || 50,
      yieldStat: 0,
      level: 5,
      evolutionStage: 0,
      imageUrl: pokemonData.sprites?.front_default || '',
      description: `Your starter ${starterName}! The beginning of your journey.`,
      isLegendary: false
    };

    console.log(`🌟 Minting starter ${starterName} for new player ${playerAddress}`);

    // Mint NFT
    const result = await algorandService.mintYokaiNFT(starterData, playerAddress);

    // Update database
    if (userId) {
      const playerProgress = await prisma.playerProgress.upsert({
        where: { userId },
        update: {
          walletAddress: playerAddress,
          starterChosen: true,
          starterPokemon: starterName
        },
        create: {
          userId,
          walletAddress: playerAddress,
          starterChosen: true,
          starterPokemon: starterName,
          ownedYokai: []
        }
      });

      await prisma.caughtNFT.create({
        data: {
          progressId: playerProgress.id,
          assetId: BigInt(result.assetId),
          pokemonName: starterName,
          pokeId,
          rarity: 'Starter',
          level: 5,
          isLegendary: false,
          txHash: result.txId,
          metadata: starterData
        }
      });
    }

    res.json({
      success: true,
      message: `Welcome! Your starter ${starterName} has been minted as NFT!`,
      nft: {
        assetId: result.assetId,
        txId: result.txId,
        name: starterName,
        rarity: 'Starter',
        explorerUrl: `https://testnet.algoexplorer.io/tx/${result.txId}`
      }
    });

  } catch (error) {
    console.error('❌ Starter minting error:', error);
    res.status(500).json({
      error: 'Failed to mint starter NFT',
      message: error.message
    });
  }
});

/**
 * GET /api/nft/inventory/:address
 * Get all NFTs owned by player
 */
router.get('/inventory/:address', async (req, res) => {
  try {
    const { address } = req.params;

    if (!address.match(/^[A-Z2-7]{58}$/)) {
      return res.status(400).json({
        error: 'Invalid Algorand address'
      });
    }

    const nfts = await algorandService.getPlayerNFTs(address);

    // Also get from database
    let dbNFTs = [];
    try {
      const progress = await prisma.playerProgress.findUnique({
        where: { walletAddress: address },
        include: { caughtNFTs: true }
      });
      dbNFTs = progress?.caughtNFTs || [];
    } catch (dbError) {
      console.warn('Failed to fetch from DB:', dbError);
    }

    res.json({
      success: true,
      address,
      count: nfts.length,
      nfts,
      dbRecords: dbNFTs
    });

  } catch (error) {
    console.error('Failed to fetch NFTs:', error);
    res.status(500).json({
      error: 'Failed to fetch NFTs',
      message: error.message
    });
  }
});

/**
 * GET /api/nft/metadata/:assetId
 * Get metadata for specific NFT
 */
router.get('/metadata/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const metadata = await algorandService.getYokaiMetadata(parseInt(assetId));

    res.json({
      success: true,
      assetId: parseInt(assetId),
      metadata
    });

  } catch (error) {
    console.error('Failed to fetch metadata:', error);
    res.status(500).json({
      error: 'Failed to fetch metadata',
      message: error.message
    });
  }
});

/**
 * GET /api/nft/check-starter/:userId
 * Check if player has chosen starter
 */
router.get('/check-starter/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const progress = await prisma.playerProgress.findUnique({
      where: { userId }
    });

    res.json({
      hasStarter: progress?.starterChosen || false,
      starterPokemon: progress?.starterPokemon || null,
      walletAddress: progress?.walletAddress || null
    });

  } catch (error) {
    console.error('Failed to check starter:', error);
    res.status(500).json({
      error: 'Failed to check starter status',
      message: error.message
    });
  }
});

export default router;
