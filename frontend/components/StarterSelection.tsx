"use client";

import { useEffect, useState } from "react";
import {
  getStarterPokemon,
  saveStarterPokemon,
  getTypeEmoji,
  getTypeColor,
  type StarterPokemon,
} from "../lib/pokeapi";

interface StarterSelectionProps {
  onSelectStarter: (pokemon: StarterPokemon) => void;
}

export default function StarterSelection({ onSelectStarter }: StarterSelectionProps) {
  const [starters, setStarters] = useState<StarterPokemon[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPokemon, setSelectedPokemon] = useState<StarterPokemon | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadStarters();
  }, []);

  async function loadStarters() {
    setLoading(true);
    const pokemon = await getStarterPokemon();
    setStarters(pokemon);
    setLoading(false);
  }

  function handleChoose(pokemon: StarterPokemon) {
    setSelectedPokemon(pokemon);
    setConfirming(true);

    // Animate selection
    setTimeout(() => {
      saveStarterPokemon(pokemon);
      onSelectStarter(pokemon);
    }, 2000);
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center">
        <div className="text-white text-2xl font-bold animate-pulse">
          Loading Pokémon...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center p-4 animate-fade-in">
      <div className="max-w-5xl w-full">
        {!confirming ? (
          <>
            {/* Header */}
            <div className="text-center mb-8 animate-slide-down">
              <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
                Welcome to YokaiHunt!
              </h1>
              <p className="text-2xl text-white/90 font-medium">
                Choose your first Pokémon
              </p>
              <p className="text-lg text-white/70 mt-2 italic">
                "Professor Willow: It's dangerous to go alone — choose your partner wisely!"
              </p>
            </div>

            {/* Pokemon Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {starters.map((pokemon, index) => (
                <div
                  key={pokemon.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border-2 border-white/20 hover:border-white/40 hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-white/20">
                    {/* Type Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-3xl">{getTypeEmoji(pokemon.type)}</span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${getTypeColor(
                          pokemon.type
                        )}`}
                      >
                        {pokemon.type.toUpperCase()}
                      </span>
                    </div>

                    {/* Pokemon Sprite */}
                    <div className="bg-white/20 rounded-xl p-4 mb-4 flex items-center justify-center h-48">
                      {pokemon.sprite ? (
                        <img
                          src={pokemon.sprite}
                          alt={pokemon.displayName}
                          className="w-32 h-32 object-contain drop-shadow-lg hover:scale-110 transition-transform"
                        />
                      ) : (
                        <div className="text-white/50">No sprite</div>
                      )}
                    </div>

                    {/* Pokemon Name */}
                    <h3 className="text-2xl font-bold text-white text-center mb-4">
                      {pokemon.displayName}
                    </h3>

                    {/* Choose Button */}
                    <button
                      onClick={() => handleChoose(pokemon)}
                      className={`w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r ${getTypeColor(
                        pokemon.type
                      )} hover:brightness-110 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1`}
                    >
                      Choose {pokemon.displayName}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Confirmation Screen */
          <div className="text-center animate-fade-in">
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border-2 border-white/30 max-w-md mx-auto">
              {/* Pokeball Animation */}
              <div className="mb-6 flex justify-center">
                <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
                  <div className="text-6xl">⚪</div>
                </div>
              </div>

              {/* Selected Pokemon */}
              {selectedPokemon && (
                <>
                  <img
                    src={selectedPokemon.sprite}
                    alt={selectedPokemon.displayName}
                    className="w-40 h-40 object-contain mx-auto mb-4 drop-shadow-2xl animate-pulse"
                  />
                  <h2 className="text-4xl font-bold text-white mb-2">
                    You chose {selectedPokemon.displayName}!
                  </h2>
                  <p className="text-xl text-white/80">
                    {getTypeEmoji(selectedPokemon.type)} {selectedPokemon.type.toUpperCase()} Type
                  </p>
                  <p className="text-lg text-white/70 mt-4">
                    Starting your adventure...
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
