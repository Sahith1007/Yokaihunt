// backend/routes/capture.js
// Full NFT minting flow with opt-in handling

import express from 'express';
import { uploadImageFromURL, uploadJSON } from '../services/pinata.js';
import { mintNFT, sendNFT, waitForOptIn } from '../services/algorand.js';
import TxLog from '../models/TxLog.js';
import Trainer from '../models/Trainer.js';

const router = express.Router();

function successChance(level) {
  return Math.min(0.95, 0.6 + (Number(level || 1) * 0.02));
}

router.post('/capture', async (req, res) => {
  try {
    const { pokemonId, pokemonName, pokemonSprite, type, walletAddress } = req.body;
    
    if (!walletAddress || !pokemonId || !pokemonName) {
      return res.status(400).json({ error: 'walletAddress, pokemonId, and pokemonName required' });
    }

    // Get trainer level for success chance
    const trainer = await Trainer.findOne({ walletAddress }).lean();
    const trainerLevel = trainer?.level || 1;
    const chance = successChance(trainerLevel);
    const success = Math.random() < chance;

    // Award XP
    const baseXP = (trainer?.xp || 0) + 5 + (success ? 25 : 0);
    let newLevel = 1;
    let remaining = baseXP;
    while (remaining >= (100 * Math.pow(newLevel, 2))) {
      remaining -= 100 * Math.pow(newLevel, 2);
      newLevel++;
    }
    const currentXP = remaining;
    const nextLevelXP = 100 * Math.pow(newLevel, 2);

    await Trainer.findOneAndUpdate(
      { walletAddress },
      {
        $set: {
          xp: baseXP,
          level: newLevel,
          currentXP,
          nextLevelXP,
          timestamp: new Date()
        }
      },
      { upsert: true, new: true }
    );

    if (!success) {
      // Log failed capture
      await TxLog.create({
        walletAddress,
        txId: `FAIL-${Date.now()}`,
        type: 'CAPTURE_ATTEMPT',
        asset: 'Yokai',
        meta: { pokemonId, pokemonName, success: false }
      });

      return res.json({
        success: false,
        xp: baseXP,
        level: newLevel,
        currentXP,
        nextLevelXP
      });
    }

    // Success - mint NFT
    let assetId = null;
    let metadataCID = null;
    let txIdMint = null;
    let txIdSend = null;

    try {
      // Step 1: Upload sprite to IPFS
      const imageCID = await uploadImageFromURL(pokemonSprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`);
      const imageUrl = `ipfs://${imageCID}`;

      // Step 2: Create metadata
      const metadata = {
        name: pokemonName,
        type: type || 'Normal',
        level: trainerLevel,
        image: imageUrl,
        attributes: [
          { trait_type: 'hp', value: 45 + Math.floor(Math.random() * 20) },
          { trait_type: 'attack', value: 55 + Math.floor(Math.random() * 20) },
          { trait_type: 'defense', value: 50 + Math.floor(Math.random() * 20) },
          { trait_type: 'speed', value: 50 + Math.floor(Math.random() * 20) },
          { trait_type: 'pokemonId', value: pokemonId },
          { trait_type: 'capturedAt', value: new Date().toISOString() }
        ]
      };

      // Step 3: Upload metadata to IPFS
      metadataCID = await uploadJSON(metadata);
      const metadataUrl = `ipfs://${metadataCID}`;

      // Step 4: Mint NFT
      const mintResult = await mintNFT({
        name: pokemonName,
        description: `Level ${trainerLevel} ${pokemonName} captured in YokaiHunt`,
        imageUrl: metadataUrl,
        ownerAddress: walletAddress
      });

      assetId = mintResult.assetId;
      txIdMint = mintResult.txId;

      // Step 5: Wait for opt-in (poll indexer)
      const optedIn = await waitForOptIn(assetId, walletAddress, 30, 2000);

      if (!optedIn) {
        // Log that opt-in is pending
        await TxLog.create({
          walletAddress,
          txId: txIdMint,
          type: 'MINT',
          asset: 'Yokai',
          meta: { assetId, metadataCID, pokemonId, pokemonName, optInPending: true }
        });

        return res.json({
          success: true,
          assetId,
          metadataCID,
          txIdMint,
          txIdSend: null,
          optInRequired: true,
          xp: baseXP,
          level: newLevel,
          currentXP,
          nextLevelXP
        });
      }

      // Step 6: Transfer NFT to player
      const sendResult = await sendNFT({
        assetId,
        to: walletAddress
      });

      txIdSend = sendResult.txId;

      // Log successful capture
      await TxLog.create({
        walletAddress,
        txId: txIdSend,
        type: 'CAPTURE',
        asset: 'Yokai',
        meta: {
          assetId,
          metadataCID,
          pokemonId,
          pokemonName,
          txIdMint
        }
      });

      // Build Pokémon object and add to trainer.inventory
      const pokemonObj = {
        name: pokemonName,
        pokeId: pokemonId,
        sprite: pokemonSprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`,
        level: 1,
        xp: 0,
        assetId: Number(assetId),
        txId: txIdSend,
        metadata_cid: metadataCID,
        caughtAt: new Date()
      };

      // Push to inventory; if team < 6, also push to team
      const updateObj = { $push: { inventory: pokemonObj } };
      if (!trainer || !trainer.team || trainer.team.length < 6) {
        updateObj.$push.team = pokemonObj;
      }

      const updated = await Trainer.findOneAndUpdate(
        { walletAddress },
        updateObj,
        { new: true }
      );

      return res.json({
        success: true,
        assetId,
        metadataCID,
        txIdMint,
        txIdSend,
        optInRequired: false,
        xp: baseXP,
        level: newLevel,
        currentXP,
        nextLevelXP,
        pokemon: pokemonObj,
        trainer: updated
      });

    } catch (error) {
      console.error('NFT minting error:', error);
      
      // Log error
      await TxLog.create({
        walletAddress,
        txId: `ERROR-${Date.now()}`,
        type: 'CAPTURE_ERROR',
        asset: 'Yokai',
        meta: {
          pokemonId,
          pokemonName,
          error: error.message
        }
      });

      // Still return success for capture, but indicate NFT minting failed
      return res.status(500).json({
        success: true,
        captureSuccess: true,
        nftMintingFailed: true,
        error: error.message,
        xp: baseXP,
        level: newLevel,
        currentXP,
        nextLevelXP
      });
    }
  } catch (e) {
    console.error('Capture route error:', e);
    return res.status(500).json({ error: 'Capture failed', details: e.message });
  }
});

export default router;
