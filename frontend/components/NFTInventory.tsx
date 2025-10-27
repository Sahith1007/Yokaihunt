"use client";

import React, { useState, useEffect } from 'react';
import { walletManager } from '../lib/wallet';

interface NFT {
  assetId: number;
  name: string;
  rarity: string;
  level: number;
  imageUrl?: string;
  isLegendary: boolean;
}

interface NFTInventoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NFTInventory({ isOpen, onClose }: NFTInventoryProps) {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadNFTs();
    }
  }, [isOpen]);

  const loadNFTs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const walletAddress = walletManager.getAddress();
      if (!walletAddress) {
        throw new Error('No wallet connected');
      }

      const response = await fetch(`/api/nft/inventory/${walletAddress}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load NFTs');
      }

      // Merge blockchain data with DB records
      const nftList = result.dbRecords?.map((record: any) => ({
        assetId: Number(record.assetId),
        name: record.pokemonName,
        rarity: record.rarity,
        level: record.level,
        isLegendary: record.isLegendary,
        imageUrl: record.metadata?.imageUrl || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${record.pokeId}.png`
      })) || [];

      setNfts(nftList);

    } catch (err: any) {
      console.error('Error loading NFTs:', err);
      setError(err.message || 'Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const getRarityColor = (rarity: string): string => {
    const colors: Record<string, string> = {
      'Starter': '#FFD700',
      'Common': '#AAAAAA',
      'Uncommon': '#55FF55',
      'Rare': '#5555FF',
      'Legendary': '#FF00FF'
    };
    return colors[rarity] || '#FFFFFF';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border-4 border-blue-500 rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-blue-400">
            🎒 My NFT Collection
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl font-bold"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-400">Loading your NFTs from blockchain...</p>
          </div>
        ) : nfts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-xl mb-4">No Pokémon NFTs found</p>
            <p className="text-gray-500 text-sm">Catch some Pokémon to mint NFTs!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {nfts.map((nft) => (
                <div
                  key={nft.assetId}
                  onClick={() => setSelectedNFT(nft)}
                  className="bg-gray-800 border-2 border-gray-600 rounded-lg p-4 cursor-pointer hover:border-blue-400 hover:scale-105 transition-all"
                  style={{
                    borderColor: selectedNFT?.assetId === nft.assetId ? getRarityColor(nft.rarity) : undefined
                  }}
                >
                  {nft.imageUrl && (
                    <img
                      src={nft.imageUrl}
                      alt={nft.name}
                      className="w-24 h-24 mx-auto mb-2 pixelated"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  )}
                  <h3 className="text-white font-bold text-center capitalize">
                    {nft.name}
                  </h3>
                  <p className="text-center text-sm mb-1" style={{ color: getRarityColor(nft.rarity) }}>
                    {nft.rarity}
                  </p>
                  <p className="text-gray-400 text-xs text-center">
                    Lv. {nft.level}
                  </p>
                  {nft.isLegendary && (
                    <p className="text-yellow-400 text-xs text-center mt-1">
                      ⭐ Legendary
                    </p>
                  )}
                  <p className="text-gray-500 text-xs text-center mt-1">
                    #{nft.assetId}
                  </p>
                </div>
              ))}
            </div>

            {/* Selected NFT Details */}
            {selectedNFT && (
              <div className="bg-gray-800 border-4 rounded-lg p-6" style={{ borderColor: getRarityColor(selectedNFT.rarity) }}>
                <h3 className="text-2xl font-bold text-white mb-4 capitalize">
                  {selectedNFT.name}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    {selectedNFT.imageUrl && (
                      <img
                        src={selectedNFT.imageUrl}
                        alt={selectedNFT.name}
                        className="w-48 h-48 mx-auto pixelated"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    )}
                  </div>
                  <div className="text-gray-300">
                    <p className="mb-2">
                      <span className="font-bold">Asset ID:</span> {selectedNFT.assetId}
                    </p>
                    <p className="mb-2">
                      <span className="font-bold">Rarity:</span>{' '}
                      <span style={{ color: getRarityColor(selectedNFT.rarity) }}>
                        {selectedNFT.rarity}
                      </span>
                    </p>
                    <p className="mb-2">
                      <span className="font-bold">Level:</span> {selectedNFT.level}
                    </p>
                    {selectedNFT.isLegendary && (
                      <p className="mb-2 text-yellow-400">
                        <span className="font-bold">⭐ Legendary Pokémon</span>
                      </p>
                    )}
                    <div className="mt-4">
                      <a
                        href={`https://testnet.algoexplorer.io/asset/${selectedNFT.assetId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm"
                      >
                        View on AlgoExplorer →
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            Total NFTs: <span className="text-blue-400 font-bold">{nfts.length}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
