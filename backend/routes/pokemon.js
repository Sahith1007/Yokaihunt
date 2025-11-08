// backend/routes/pokemon.js
// Pokémon routes - NFT minting with separate opt-in/transfer flow

import express from 'express';
import algosdk from 'algosdk';
import { uploadImageFromBase64, uploadJSON } from '../services/pinata.js';
import { getClient, getIndexer, getCreatorAccount, confirmTx } from '../services/algorand.js';
import Pokemon from '../models/Pokemon.js';
import TxLog from '../models/TxLog.js';

const router = express.Router();

/**
 * POST /api/pokemon/caught
 * Mint NFT for caught Pokémon
 */
router.post('/pokemon/caught', async (req, res) => {
  try {
    const { wallet, name, imageBase64, rarity } = req.body;
    const walletAddress = wallet || req.headers['x-wallet-address'];

    if (!walletAddress || !name || !imageBase64 || !rarity) {
      return res.status(400).json({ 
        error: 'wallet, name, imageBase64, and rarity are required' 
      });
    }

    // Step 1: Upload image to Pinata
    const imageCid = await uploadImageFromBase64(imageBase64, `${name}-${Date.now()}.png`);

    // Step 2: Create metadata (static, no XP/level)
    const metadata = {
      name: name,
      description: 'A Yokai creature',
      image: `ipfs://${imageCid}`,
      attributes: [
        { trait_type: 'rarity', value: rarity }
      ]
    };

    // Step 3: Upload metadata to Pinata
    const metadataCid = await uploadJSON(metadata);

    // Step 4: Mint NFT ASA
    const algod = getClient();
    const creator = getCreatorAccount();
    const suggestedParams = await algod.getTransactionParams().do();

    const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
      from: creator.addr,
      total: 1,
      decimals: 0,
      defaultFrozen: false,
      unitName: 'YOKAI',
      assetName: name,
      assetURL: `ipfs://${metadataCid}`,
      note: new TextEncoder().encode(JSON.stringify({ 
        standard: 'arc3',
        metadataCid 
      })),
      suggestedParams,
    });

    const signed = txn.signTxn(creator.sk);
    const { txId } = await algod.sendRawTransaction(signed).do();
    
    // Wait for confirmation
    const confirmed = await confirmTx(txId);
    const assetId = confirmed['asset-index'] || confirmed['created-asset-index'];
    
    if (!assetId) {
      throw new Error('Failed to extract asset ID from transaction');
    }

    // Step 5: Save Pokémon in DB (level: 1, xp: 0)
    const pokemon = await Pokemon.create({
      ownerWallet: walletAddress,
      name,
      imageCid,
      metadataCid,
      assetId,
      rarity,
      level: 1,
      xp: 0
    });

    // Log transaction
    await TxLog.create({
      walletAddress,
      txId,
      type: 'MINT',
      asset: 'Yokai',
      meta: { assetId, name, rarity }
    });

    return res.json({
      success: true,
      assetId,
      txId,
      metadataCid,
      pokemonId: pokemon._id
    });

  } catch (error) {
    console.error('Pokémon caught error:', error);
    return res.status(500).json({ 
      error: 'Failed to mint Pokémon NFT', 
      details: error.message 
    });
  }
});

/**
 * POST /api/pokemon/optin
 * Return unsigned opt-in transaction
 */
router.post('/pokemon/optin', async (req, res) => {
  try {
    const { assetId } = req.body;
    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet;

    if (!assetId || !walletAddress) {
      return res.status(400).json({ 
        error: 'assetId and wallet are required' 
      });
    }

    const algod = getClient();
    const suggestedParams = await algod.getTransactionParams().do();

    // Create unsigned opt-in transaction (transfer 0 to self)
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: walletAddress,
      to: walletAddress,
      amount: 0,
      assetIndex: Number(assetId),
      suggestedParams,
    });

    // Encode transaction for signing
    const txnBytes = algosdk.encodeUnsignedTransaction(txn);
    const txnBase64 = Buffer.from(txnBytes).toString('base64');

    return res.json({
      unsignedTxn: txnBase64,
      assetId: Number(assetId)
    });

  } catch (error) {
    console.error('Opt-in transaction creation error:', error);
    return res.status(500).json({ 
      error: 'Failed to create opt-in transaction', 
      details: error.message 
    });
  }
});

/**
 * POST /api/pokemon/optin/submit
 * Submit signed opt-in transaction
 */
router.post('/pokemon/optin/submit', async (req, res) => {
  try {
    const { signedTxn } = req.body;
    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet;

    if (!signedTxn || !walletAddress) {
      return res.status(400).json({ 
        error: 'signedTxn and wallet are required' 
      });
    }

    const algod = getClient();
    
    // Decode signed transaction
    const txnBytes = Buffer.from(signedTxn, 'base64');
    const decodedTxn = algosdk.decodeSignedTransaction(txnBytes);

    // Verify it's an opt-in (amount 0, from === to)
    if (decodedTxn.txn.amount !== 0 || 
        algosdk.encodeAddress(decodedTxn.txn.from.publicKey) !== 
        algosdk.encodeAddress(decodedTxn.txn.to.publicKey)) {
      return res.status(400).json({ 
        error: 'Invalid opt-in transaction' 
      });
    }

    // Submit transaction
    const { txId } = await algod.sendRawTransaction(txnBytes).do();
    
    // Wait for confirmation
    await confirmTx(txId);

    // Log transaction
    await TxLog.create({
      walletAddress,
      txId,
      type: 'OPT_IN',
      asset: 'Yokai',
      meta: { assetId: decodedTxn.txn.assetIndex }
    });

    return res.json({
      success: true,
      txId
    });

  } catch (error) {
    console.error('Opt-in submission error:', error);
    return res.status(500).json({ 
      error: 'Failed to submit opt-in transaction', 
      details: error.message 
    });
  }
});

/**
 * POST /api/pokemon/transfer
 * Transfer NFT from creator to player (after opt-in)
 */
router.post('/pokemon/transfer', async (req, res) => {
  try {
    const { assetId } = req.body;
    const walletAddress = req.headers['x-wallet-address'] || req.body.wallet;

    if (!assetId || !walletAddress) {
      return res.status(400).json({ 
        error: 'assetId and wallet are required' 
      });
    }

    // Verify player has opted in
    const indexer = getIndexer();
    try {
      const accountInfo = await indexer.lookupAccountByID(walletAddress).do();
      const hasAsset = accountInfo.account?.assets?.some(
        (asset) => asset['asset-id'] === Number(assetId)
      );
      
      if (!hasAsset) {
        return res.status(400).json({ 
          error: 'Player must opt-in before transfer' 
        });
      }
    } catch (e) {
      return res.status(400).json({ 
        error: 'Failed to verify opt-in status' 
      });
    }

    // Transfer NFT from creator to player
    const algod = getClient();
    const creator = getCreatorAccount();
    const suggestedParams = await algod.getTransactionParams().do();

    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: creator.addr,
      to: walletAddress,
      amount: 1,
      assetIndex: Number(assetId),
      suggestedParams,
    });

    const signed = txn.signTxn(creator.sk);
    const { txId } = await algod.sendRawTransaction(signed).do();
    
    // Wait for confirmation
    await confirmTx(txId);

    // Update Pokémon owner in DB
    await Pokemon.findOneAndUpdate(
      { assetId: Number(assetId) },
      { ownerWallet: walletAddress }
    );

    // Log transaction
    await TxLog.create({
      walletAddress,
      txId,
      type: 'TRANSFER',
      asset: 'Yokai',
      meta: { assetId: Number(assetId) }
    });

    return res.json({
      success: true,
      txId
    });

  } catch (error) {
    console.error('Transfer error:', error);
    return res.status(500).json({ 
      error: 'Failed to transfer NFT', 
      details: error.message 
    });
  }
});

/**
 * GET /api/pokemon/:id
 * Get Pokémon data including XP/Level (from DB, not NFT)
 */
router.get('/pokemon/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pokemon = await Pokemon.findById(id).lean();

    if (!pokemon) {
      return res.status(404).json({ error: 'Pokémon not found' });
    }

    return res.json({
      id: pokemon._id,
      name: pokemon.name,
      assetId: pokemon.assetId,
      rarity: pokemon.rarity,
      level: pokemon.level,
      xp: pokemon.xp,
      imageCid: pokemon.imageCid,
      metadataCid: pokemon.metadataCid,
      ownerWallet: pokemon.ownerWallet,
      createdAt: pokemon.createdAt
    });

  } catch (error) {
    console.error('Get Pokémon error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch Pokémon', 
      details: error.message 
    });
  }
});

/**
 * GET /api/pokemon/owner/:wallet
 * Get all Pokémon owned by wallet
 */
router.get('/pokemon/owner/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const pokemon = await Pokemon.find({ ownerWallet: wallet })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      pokemon: pokemon.map(p => ({
        id: p._id,
        name: p.name,
        assetId: p.assetId,
        rarity: p.rarity,
        level: p.level,
        xp: p.xp,
        imageCid: p.imageCid,
        createdAt: p.createdAt
      }))
    });

  } catch (error) {
    console.error('Get owner Pokémon error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch Pokémon', 
      details: error.message 
    });
  }
});

export default router;
