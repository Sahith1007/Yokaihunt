"use client";

import React, { useState } from 'react';
import { walletManager } from '../lib/wallet';

interface StarterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStarterChosen: (starter: string, nft: any) => void;
}

const STARTERS = [
  {
    name: 'Charmander',
    id: 4,
    type: 'Fire',
    description: 'A fire-type Pokémon with a flame on its tail',
    color: '#FF7F00',
    imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png'
  },
  {
    name: 'Squirtle',
    id: 7,
    type: 'Water',
    description: 'A water-type Pokémon with a hard shell',
    color: '#6890F0',
    imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png'
  },
  {
    name: 'Bulbasaur',
    id: 1,
    type: 'Grass',
    description: 'A grass-type Pokémon with a bulb on its back',
    color: '#78C850',
    imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png'
  }
];

export default function StarterModal({ isOpen, onClose, onStarterChosen }: StarterModalProps) {
  const [selectedStarter, setSelectedStarter] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintedNFT, setMintedNFT] = useState<any>(null);

  if (!isOpen) return null;

  const handleSelectStarter = async (starterName: string) => {
    setSelectedStarter(starterName);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!selectedStarter) {
      setError('Please select a starter Pokémon');
      return;
    }

    setIsMinting(true);
    setError(null);

    try {
      // Get wallet address
      const walletAddress = walletManager.getAddress();
      if (!walletAddress) {
        throw new Error('No wallet connected. Please connect your wallet first.');
      }

      // Get or create user ID
      const userId = localStorage.getItem('user_id') || `user_${Date.now()}`;
      localStorage.setItem('user_id', userId);

      console.log(`🌟 Minting starter ${selectedStarter} for ${walletAddress}`);

      // Call backend to mint starter NFT
      const response = await fetch('/api/nft/mint-starter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starterName: selectedStarter.toLowerCase(),
          playerAddress: walletAddress,
          userId
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to mint starter NFT');
      }

      if (result.success) {
        setMintedNFT(result.nft);
        
        // Show success message for 3 seconds before closing
        setTimeout(() => {
          onStarterChosen(selectedStarter, result.nft);
          onClose();
        }, 3000);
      } else {
        throw new Error(result.error || 'Minting failed');
      }

    } catch (err: any) {
      console.error('Error minting starter:', err);
      setError(err.message || 'Failed to mint starter NFT');
      setIsMinting(false);
    }
  };

  if (mintedNFT) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
        <div className="bg-gray-900 border-4 border-yellow-500 rounded-lg p-8 max-w-md w-full text-center">
          <h2 className="text-3xl font-bold text-yellow-500 mb-4">🎉 NFT Minted!</h2>
          <p className="text-white text-xl mb-4">
            Your starter <span className="font-bold">{selectedStarter}</span> has been minted as an NFT!
          </p>
          <div className="bg-gray-800 p-4 rounded mb-4">
            <p className="text-gray-300 text-sm mb-2">Asset ID: <span className="text-yellow-400">{mintedNFT.assetId}</span></p>
            <p className="text-gray-400 text-xs break-all">Tx: {mintedNFT.txId?.substring(0, 30)}...</p>
          </div>
          <a 
            href={mintedNFT.explorerUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 underline hover:text-blue-300 text-sm"
          >
            View on AlgoExplorer →
          </a>
          <p className="text-green-400 mt-4">Starting your adventure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border-4 border-yellow-500 rounded-lg p-8 max-w-4xl w-full">
        <h2 className="text-3xl font-bold text-yellow-500 text-center mb-6">
          Choose Your Starter Pokémon
        </h2>
        <p className="text-white text-center mb-8">
          Your starter will be minted as an NFT on Algorand TestNet!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {STARTERS.map((starter) => (
            <div
              key={starter.name}
              onClick={() => !isMinting && handleSelectStarter(starter.name)}
              className={`
                border-4 rounded-lg p-6 cursor-pointer transition-all duration-300
                ${selectedStarter === starter.name 
                  ? 'border-yellow-400 bg-gray-800 scale-105' 
                  : 'border-gray-600 bg-gray-800 hover:border-gray-400 hover:scale-102'
                }
                ${isMinting ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              style={{
                boxShadow: selectedStarter === starter.name 
                  ? `0 0 20px ${starter.color}` 
                  : 'none'
              }}
            >
              <img 
                src={starter.imageUrl} 
                alt={starter.name}
                className="w-32 h-32 mx-auto mb-4 pixelated"
                style={{ imageRendering: 'pixelated' }}
              />
              <h3 
                className="text-2xl font-bold text-center mb-2"
                style={{ color: starter.color }}
              >
                {starter.name}
              </h3>
              <p className="text-sm text-center text-gray-400 mb-2">
                {starter.type} Type
              </p>
              <p className="text-xs text-center text-gray-500">
                {starter.description}
              </p>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-900 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={onClose}
            disabled={isMinting}
            className={`
              px-6 py-3 rounded font-bold transition-colors
              ${isMinting 
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                : 'bg-gray-700 text-white hover:bg-gray-600'
              }
            `}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedStarter || isMinting}
            className={`
              px-8 py-3 rounded font-bold transition-colors
              ${!selectedStarter || isMinting
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-yellow-500 text-black hover:bg-yellow-400'
              }
            `}
          >
            {isMinting ? 'Minting NFT...' : 'Confirm & Mint'}
          </button>
        </div>

        {isMinting && (
          <div className="mt-4 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            <p className="text-yellow-400 mt-2">Minting your NFT on Algorand TestNet...</p>
            <p className="text-gray-400 text-sm">This may take a few seconds</p>
          </div>
        )}
      </div>
    </div>
  );
}
