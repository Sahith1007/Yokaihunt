/**
 * NFT Controller
 * Handles API endpoints for Yokai NFT operations
 */

const algorandService = require('../services/algorandService');

/**
 * POST /api/nft/mint
 * Mint a Yokai NFT after catching a Pokemon
 * 
 * Body: {
 *   pokemonData: { name, pokeId, level, stats, ... },
 *   playerAddress: "ALGORAND_ADDRESS"
 * }
 */
exports.mintYokaiNFT = async (req, res) => {
  try {
    const { pokemonData, playerAddress } = req.body;

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

    // Determine rarity based on Pokemon ID or stats
    const rarity = determineRarity(pokemonData);
    const isLegendary = checkIfLegendary(pokemonData.pokeId);

    // If legendary, check if already minted
    if (isLegendary) {
      const alreadyMinted = await algorandService.isLegendaryMinted(pokemonData.name);
      if (alreadyMinted) {
        return res.status(409).json({
          error: `Legendary ${pokemonData.name} has already been minted! Only 1 can exist.`
        });
      }
    }

    // Prepare NFT data
    const yokaiData = {
      name: pokemonData.name,
      rarity,
      type: pokemonData.types?.[0]?.type?.name || 'Normal',
      attack: pokemonData.stats?.find(s => s.stat.name === 'attack')?.base_stat || 50,
      defense: pokemonData.stats?.find(s => s.stat.name === 'defense')?.base_stat || 50,
      speed: pokemonData.stats?.find(s => s.stat.name === 'speed')?.base_stat || 50,
      hp: pokemonData.stats?.find(s => s.stat.name === 'hp')?.base_stat || 50,
      yieldStat: 0, // Base form has no yield
      level: pokemonData.level || 1,
      evolutionStage: 0,
      imageUrl: pokemonData.sprites?.front_default || pokemonData.imageUrl || '',
      description: `A ${rarity} ${pokemonData.types?.[0]?.type?.name || ''} type Yokai captured in the wild.`,
      isLegendary
    };

    // Mint NFT on Algorand
    const result = await algorandService.mintYokaiNFT(yokaiData, playerAddress);

    res.json({
      success: true,
      message: `Successfully minted ${pokemonData.name} as NFT!`,
      nft: {
        assetId: result.assetId,
        txId: result.txId,
        name: yokaiData.name,
        rarity,
        isLegendary,
        explorerUrl: `https://testnet.algoexplorer.io/tx/${result.txId}`
      }
    });

  } catch (error) {
    console.error('Minting error:', error);
    res.status(500).json({
      error: 'Failed to mint NFT',
      message: error.message
    });
  }
};

/**
 * GET /api/nft/player/:address
 * Get all Yokai NFTs owned by a player
 */
exports.getPlayerNFTs = async (req, res) => {
  try {
    const { address } = req.params;

    if (!address.match(/^[A-Z2-7]{58}$/)) {
      return res.status(400).json({
        error: 'Invalid Algorand address'
      });
    }

    const nfts = await algorandService.getPlayerNFTs(address);

    res.json({
      success: true,
      address,
      count: nfts.length,
      nfts
    });

  } catch (error) {
    console.error('Failed to fetch NFTs:', error);
    res.status(500).json({
      error: 'Failed to fetch NFTs',
      message: error.message
    });
  }
};

/**
 * GET /api/nft/metadata/:assetId
 * Get metadata for a specific NFT
 */
exports.getNFTMetadata = async (req, res) => {
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
};

/**
 * POST /api/nft/evolve
 * Evolve a Yokai by burning multiple NFTs
 * 
 * Body: {
 *   playerAddress: string,
 *   burnAssets: [assetId1, assetId2],
 *   targetStage: 1 or 2
 * }
 */
exports.evolveYokai = async (req, res) => {
  try {
    const { playerAddress, burnAssets, targetStage } = req.body;

    if (!playerAddress || !burnAssets || !targetStage) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    // Verify player owns all assets to burn
    const playerNFTs = await algorandService.getPlayerNFTs(playerAddress);
    const playerAssetIds = playerNFTs.map(nft => nft.assetId);
    
    for (const assetId of burnAssets) {
      if (!playerAssetIds.includes(assetId)) {
        return res.status(403).json({
          error: `Player does not own asset ${assetId}`
        });
      }
    }

    // Verify correct number of burns
    const requiredBurns = targetStage === 1 ? 2 : 4;
    if (burnAssets.length !== requiredBurns) {
      return res.status(400).json({
        error: `Evolution to stage ${targetStage} requires ${requiredBurns} NFTs to burn`
      });
    }

    // Call evolution contract
    const evolutionData = {
      baseSpecies: 'Pikachu', // Get from first NFT metadata
      targetStage,
      burnAssets
    };

    const result = await algorandService.evolveYokai(evolutionData, playerAddress);

    res.json({
      success: true,
      message: 'Evolution successful!',
      evolvedAssetId: result.evolvedAssetId,
      txId: result.txId
    });

  } catch (error) {
    console.error('Evolution error:', error);
    res.status(500).json({
      error: 'Failed to evolve Yokai',
      message: error.message
    });
  }
};

/**
 * Helper: Determine rarity based on Pokemon stats
 */
function determineRarity(pokemonData) {
  const totalStats = pokemonData.stats
    ?.reduce((sum, stat) => sum + stat.base_stat, 0) || 0;

  if (totalStats > 600) return 'Legendary';
  if (totalStats > 500) return 'Rare';
  if (totalStats > 400) return 'Uncommon';
  return 'Common';
}

/**
 * Helper: Check if Pokemon is legendary
 */
function checkIfLegendary(pokeId) {
  // Legendary Pokemon IDs
  const legendaryIds = [
    150, // Mewtwo
    144, 145, 146, // Birds
    243, 244, 245, // Beasts
    249, 250, // Ho-Oh, Lugia
    382, 383, 384, // Hoenn legends
    480, 481, 482, // Lake Trio
    483, 484, 487, // Dialga, Palkia, Giratina
    // Add more as needed
  ];

  return legendaryIds.includes(pokeId);
}

module.exports = exports;
