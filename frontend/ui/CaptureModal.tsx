// frontend/ui/CaptureModal.tsx
// Updated with opt-in handling

import React, { useState, useEffect } from 'react';
import { signOptIn, waitForConfirmation } from '../src/services/algo';

export function CaptureModal({ open, outcome, txId, txIdMint, txIdSend, assetId, ipfs, pokemon, xpGained, optInRequired, onClose, onCapture }: { 
  open: boolean; 
  outcome?: 'success'|'fail'|'optInRequired'; 
  txId?: string;
  txIdMint?: string;
  txIdSend?: string;
  assetId?: string;
  ipfs?: string;
  pokemon?: any;
  xpGained?: number;
  optInRequired?: boolean;
  onClose: ()=>void;
  onCapture?: (spawn: any)=>void;
}) {
  const [attempting, setAttempting] = useState(false);
  const [minting, setMinting] = useState(false);
  const [optInPending, setOptInPending] = useState(false);
  const [transferring, setTransferring] = useState(false);
  
  // Auto-close after 3-4 seconds on success/fail (not for opt-in)
  useEffect(() => {
    if (open && outcome && outcome !== 'optInRequired' && !attempting) {
      const timer = setTimeout(() => {
        onClose();
      }, outcome === 'success' ? 4000 : 3000);
      return () => clearTimeout(timer);
    }
  }, [open, outcome, attempting, onClose]);
  
  if (!open) return null;
  
  const handleCapture = async () => {
    if (!pokemon || attempting) return;
    setAttempting(true);
    try {
      if (typeof window !== 'undefined' && onCapture) {
        await onCapture(pokemon);
      } else {
        window.dispatchEvent(new CustomEvent('yokai-capture-attempt', { detail: { spawn: pokemon } }));
      }
    } catch (e) {
      console.error('Capture failed:', e);
    } finally {
      setAttempting(false);
    }
  };

  const handleOptIn = async () => {
    if (!assetId || optInPending) return;
    
    setOptInPending(true);
    try {
      // Show toast
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('yokai-toast', { 
          detail: { message: 'Please approve the opt-in transaction in your wallet...' } 
        }));
      }

      // Sign opt-in transaction
      const optInTxId = await signOptIn(assetId);
      
      // Wait for confirmation
      await waitForConfirmation(optInTxId);
      
      // Show transferring state
      setTransferring(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('yokai-toast', { 
          detail: { message: 'Transferring NFT...' } 
        }));
      }

      // Poll backend to complete transfer (backend will detect opt-in and send NFT)
      const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
      if (wallet && assetId) {
        // Poll for transfer completion
        let attempts = 0;
        const maxAttempts = 15;
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check if NFT was transferred by verifying ownership
          const { verifyOwnership } = await import('../src/services/algo');
          const owns = await verifyOwnership(assetId, wallet);
          
          if (owns) {
            // Success! NFT transferred
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('yokai-capture-result', {
                detail: {
                  outcome: 'success',
                  txId: txIdSend || optInTxId,
                  txIdMint,
                  txIdSend: txIdSend || optInTxId,
                  assetId,
                  ipfs,
                  pokemon,
                  xpGained
                }
              }));
            }
            setOptInPending(false);
            setTransferring(false);
            return;
          }
          attempts++;
        }
        
        // Timeout - show error
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('yokai-toast', { 
            detail: { message: 'Transfer timeout. Please check your wallet.' } 
          }));
        }
      }
    } catch (error) {
      console.error('Opt-in error:', error);
      if (typeof window !== 'undefined') {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        window.dispatchEvent(new CustomEvent('yokai-toast', { 
          detail: { message: `Opt-in failed: ${errorMessage}` } 
        }));
      }
    } finally {
      setOptInPending(false);
      setTransferring(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 z-[2200] flex items-center justify-center">
      <div className="bg-[#0f1116] border border-white/10 rounded p-6 w-[380px] text-center">
        {outcome === 'optInRequired' || optInRequired ? (
          <>
            <div className="text-2xl mb-2 text-yellow-400">NFT Minted!</div>
            {pokemon && (
              <>
                <div className="text-lg mb-1">{pokemon.name || `Pokémon #${pokemon.pokeId}`}</div>
                {pokemon.pokeId && (
                  <img 
                    src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.pokeId}.png`}
                    alt={pokemon.name}
                    className="mx-auto mb-3 w-24 h-24"
                  />
                )}
              </>
            )}
            {xpGained && (
              <div className="text-sm text-yellow-400 mb-2">+{xpGained} XP</div>
            )}
            <div className="text-sm text-gray-400 mb-4">
              {optInPending ? 'Waiting for opt-in confirmation...' : 
               transferring ? 'Transferring NFT to your wallet...' :
               'Please opt-in to receive your NFT'}
            </div>
            {txIdMint && (
              <a 
                className="text-blue-400 text-sm block mb-2 hover:underline" 
                target="_blank" 
                rel="noreferrer" 
                href={`https://testnet.algoexplorer.io/tx/${txIdMint}`}
              >
                View Mint Transaction
              </a>
            )}
            {!optInPending && !transferring && (
              <button 
                onClick={handleOptIn}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded border border-blue-500 mb-2"
              >
                Opt-In to Receive NFT
              </button>
            )}
            <div className="mt-2">
              <button onClick={onClose} className="px-4 py-2 bg-white/10 rounded border border-white/10 hover:bg-white/20">
                Close
              </button>
            </div>
          </>
        ) : outcome === 'success' ? (
          <>
            <div className="text-2xl mb-2 text-green-400">Gotcha!</div>
            {pokemon && (
              <>
                <div className="text-lg mb-1">{pokemon.name || `Pokémon #${pokemon.pokeId}`}</div>
                {pokemon.pokeId && (
                  <img 
                    src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.pokeId}.png`}
                    alt={pokemon.name}
                    className="mx-auto mb-3 w-24 h-24"
                  />
                )}
              </>
            )}
            {xpGained && (
              <div className="text-sm text-yellow-400 mb-2">+{xpGained} XP</div>
            )}
            {txId && (
              <a 
                className="text-blue-400 text-sm block mb-2 hover:underline" 
                target="_blank" 
                rel="noreferrer" 
                href={`https://testnet.algoexplorer.io/tx/${txId}`}
              >
                View Transaction on AlgoExplorer
              </a>
            )}
            {ipfs && (
              <a 
                className="text-purple-400 text-sm block mb-2 hover:underline" 
                target="_blank" 
                rel="noreferrer" 
                href={`https://ipfs.io/ipfs/${ipfs}`}
              >
                View on IPFS
              </a>
            )}
            <div className="mt-4">
              <button onClick={onClose} className="px-4 py-2 bg-white/10 rounded border border-white/10 hover:bg-white/20">
                Close
              </button>
            </div>
          </>
        ) : outcome === 'fail' ? (
          <>
            <div className="text-2xl mb-2 text-red-400">It fled!</div>
            {xpGained && (
              <div className="text-sm text-yellow-400 mb-2">+{xpGained} XP (attempt)</div>
            )}
            <div className="mt-4">
              <button onClick={onClose} className="px-4 py-2 bg-white/10 rounded border border-white/10 hover:bg-white/20">
                Close
              </button>
            </div>
          </>
        ) : pokemon ? (
          <>
            <div className="text-xl mb-2">Wild Pokémon spotted!</div>
            <div className="text-lg mb-1">{pokemon.name || `Pokémon #${pokemon.pokeId}`}</div>
            <div className="text-sm opacity-70 mb-4">Level {pokemon.level} · {pokemon.rarity || 'common'}</div>
            {pokemon.pokeId && (
              <img 
                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.pokeId}.png`}
                alt={pokemon.name}
                className="mx-auto mb-4 w-24 h-24"
              />
            )}
            <div className="flex gap-3 justify-center">
              <button 
                onClick={handleCapture} 
                disabled={attempting || minting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded border border-green-500 disabled:opacity-50"
              >
                {attempting || minting ? 'Catching...' : 'Try to Catch'}
              </button>
              <button 
                onClick={onClose} 
                className="px-4 py-2 bg-white/10 rounded border border-white/10 hover:bg-white/20"
              >
                Run
              </button>
            </div>
          </>
        ) : (
          <div className="text-lg mb-4">No Pokémon nearby</div>
        )}
      </div>
    </div>
  );
}
