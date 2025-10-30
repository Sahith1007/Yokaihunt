import express from 'express';
import algosdk from 'algosdk';
import { uploadJsonToIPFS } from '../services/ipfs.js';
import { verifyWalletSignature, mintASAWithIPFS, listWalletNFTs, transferASA, burnASA } from '../services/algorand.js';
import Trainer from '../models/Trainer.js';
import { isMongoConnected } from '../db.js';

const router = express.Router();

function requireDatabase(_req, res, next) {
  if (!isMongoConnected()) return res.status(503).json({ error: 'Database not available' });
  next();
}

function walletHeader(req) {
  const wallet = (req.headers['x-wallet-address'] || req.body?.walletAddress || '').toString();
  return wallet;
}

router.post('/mint/pokemon', requireDatabase, async (req, res) => {
  try {
    const wallet = walletHeader(req);
    const { signature, message, pokemon } = req.body || {};
    if (!wallet || !pokemon) return res.status(400).json({ error: 'wallet and pokemon required' });

    if (signature && message) {
      const ok = await verifyWalletSignature({ address: wallet, message, signature });
      if (!ok) return res.status(401).json({ error: 'Invalid signature' });
    }

    const meta = {
      name: `${pokemon.name} #${pokemon.pokeId}`,
      description: `Level ${pokemon.level} ${pokemon.name} owned by ${wallet}`,
      image: pokemon.imageUrl || pokemon.spriteUrl || '',
      attributes: [
        { trait_type: 'Type', value: (pokemon.types?.[0] || pokemon.type || 'Unknown') },
        { trait_type: 'Level', value: Number(pokemon.level || 1) },
        { trait_type: 'Rarity', value: pokemon.rarity || 'Common' },
      ],
    };

    const { cid } = await uploadJsonToIPFS(meta);

    const fromMnemonic = process.env.ALGORAND_CREATOR_MNEMONIC;
    if (!fromMnemonic) return res.status(500).json({ error: 'Server not configured to mint' });
    const acct = algosdk.mnemonicToSecretKey(fromMnemonic);

    const { txId, assetId } = await mintASAWithIPFS({
      fromSk: acct.sk,
      fromAddr: acct.addr,
      unitName: (pokemon.name || 'YOKAI').slice(0, 8).toUpperCase(),
      assetName: `${pokemon.name} #${pokemon.pokeId}`,
      total: 1,
      decimals: 0,
      cid,
    });

    await Trainer.findOneAndUpdate(
      { walletAddress: wallet },
      {
        $setOnInsert: { walletAddress: wallet },
        $push: {
          storage: {
            name: pokemon.name,
            level: pokemon.level || 1,
            hp: pokemon.hp || 10,
            attack: pokemon.attack || 5,
            defense: pokemon.defense || 5,
            moves: pokemon.moves || [],
            rarity: pokemon.rarity || 'Common',
            caughtAt: new Date(),
            assetId,
            txId,
            image_url: meta.image,
            metadata_cid: cid,
          },
        },
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true, nft: { assetId, txId, cid } });
  } catch (e) {
    const msg = e?.message || 'Mint failed';
    return res.status(500).json({ error: msg });
  }
});

router.get('/inventory/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const nfts = await listWalletNFTs({ wallet });
    return res.json({ wallet, nfts });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

router.post('/trade', async (req, res) => {
  try {
    const { fromMnemonic, fromAddr, toAddr, assetId } = req.body || {};
    if (!fromMnemonic || !fromAddr || !toAddr || !assetId) return res.status(400).json({ error: 'missing fields' });
    const acct = algosdk.mnemonicToSecretKey(fromMnemonic);
    if (acct.addr !== fromAddr) return res.status(401).json({ error: 'mnemonic mismatch' });

    const { txId } = await transferASA({ assetId: Number(assetId), fromSk: acct.sk, fromAddr, toAddr, amount: 1 });
    return res.json({ success: true, txId });
  } catch (e) {
    return res.status(500).json({ error: 'Trade failed' });
  }
});

router.post('/release/:id', async (req, res) => {
  try {
    const { id } = req.params; // asset id
    const { managerMnemonic, managerAddr } = req.body || {};
    if (!id || !managerMnemonic || !managerAddr) return res.status(400).json({ error: 'missing fields' });
    const acct = algosdk.mnemonicToSecretKey(managerMnemonic);
    if (acct.addr !== managerAddr) return res.status(401).json({ error: 'mnemonic mismatch' });

    const { txId } = await burnASA({ assetId: Number(id), managerSk: acct.sk, managerAddr });
    return res.json({ success: true, txId });
  } catch (e) {
    return res.status(500).json({ error: 'Release failed' });
  }
});

export default router;