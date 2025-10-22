"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchPlayerPokemon, getPlayerInventory, type PlayerPokemon } from "./lib/api/pokemonApi";

const Game = dynamic(() => import("./components/Game"), { ssr: false });

type PlayerPos = { posX: number; posY: number } | null;

type Balls = { pokeball: number; greatball: number; ultraball: number; masterball: number };

type SpottedPokemon = { name: string; spriteUrl: string; pokeId: number } | null;

export default function Home() {
  const [player, setPlayer] = useState<PlayerPos>(null);
  const [balls, setBalls] = useState<Balls>({ pokeball: 0, greatball: 0, ultraball: 0, masterball: 0 });
  const [spottedPokemon, setSpottedPokemon] = useState<SpottedPokemon>(null);
  const [playerPokemon, setPlayerPokemon] = useState<PlayerPokemon[]>([]);
  const [selectedPokemon, setSelectedPokemon] = useState<PlayerPokemon | null>(null);

  useEffect(() => {
    // Fetch player position (no auth for now)
    fetch("http://localhost:4000/api/player")
      .then(async (r) => {
        const data = await r.json();
        if (r.ok)
          setPlayer({ posX: data?.progress?.posX ?? 64, posY: data?.progress?.posY ?? 64 });
      })
      .catch(() => {});
      
    // Fetch player Pokémon and inventory
    fetchPlayerPokemon().then((pokemon) => {
      setPlayerPokemon(pokemon);
      if (pokemon.length > 0 && !selectedPokemon) {
        setSelectedPokemon(pokemon[0]); // Auto-select first Pokémon
      }
    });
    
    getPlayerInventory().then(setBalls);
  }, []);

  return (
    <div className="min-h-screen bg-[#1f2024] text-white">
      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <header className="flex items-center justify-between py-2 mb-4 border-b border-[#2a2a2f]">
          <nav className="flex gap-2 text-sm">
            <button className="px-3 py-1 rounded bg-[#23242a] border border-[#2f3036]">Maps</button>
            <a href="/login" className="px-3 py-1 rounded bg-[#23242a] border border-[#2f3036]">Profile</a>
            <button className="px-3 py-1 rounded bg-[#23242a] border border-[#2f3036]">Pokemon</button>
            <button className="px-3 py-1 rounded bg-[#23242a] border border-[#2f3036]">Battle</button>
            <button className="px-3 py-1 rounded bg-[#23242a] border border-[#2f3036]">Trade</button>
            <button className="px-3 py-1 rounded bg-[#23242a] border border-[#2f3036]">Misc</button>
          </nav>
          <div className="text-sm opacity-80">kai1001</div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          {/* Map area + taskbar */}
          <section className="flex flex-col gap-3">
            <div className="w-full max-w-[900px] h-[600px] border border-[#3a3c48] rounded-md overflow-hidden bg-black/20">
              <Game
                width={900}
                height={600}
                tileSize={32}
                mapWidth={60}
                mapHeight={40}
                playerSpeed={220}
                initialX={player?.posX}
                initialY={player?.posY}
                onPokemonSpotted={setSpottedPokemon}
                onPokemonCleared={() => setSpottedPokemon(null)}
                playerPokemon={selectedPokemon}
              />
            </div>

            {/* bottom taskbar */}
            <div className="taskbar">
              <div className="pad">
                <button className="arrow up" />
                <div className="middle">
                  <button className="arrow left" />
                  <div className="trainer" />
                  <button className="arrow right" />
                </div>
                <button className="arrow down" />
              </div>
              <label className="kbd"><input type="checkbox" defaultChecked /> Enable Keyboard Navigation?</label>
            </div>
          </section>

          {/* Right sidebar */}
          <aside className="flex flex-col gap-3">
            <div className="rounded-lg overflow-hidden bg-[#2a2b31]">
              <div className="px-3 py-2 font-semibold text-black bg-[#cfcbd5]">📖 Mystery Villa #1</div>
              <div className="p-4 min-h-[220px] text-sm opacity-90">
                {spottedPokemon ? (
                  <div className="text-center">
                    <img 
                      src={spottedPokemon.spriteUrl} 
                      alt={spottedPokemon.name}
                      className="w-24 h-24 mx-auto mb-2 pixelated"
                    />
                    <div className="text-white font-semibold capitalize">
                      A wild {spottedPokemon.name} appeared!
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Press ENTER when close to catch it!
                    </div>
                  </div>
                ) : (
                  <>Couldn't find anything.<br/>Try moving to another spot.</>
                )}
              </div>
            </div>

            <div className="rounded-lg p-4 bg-[#2a2b31]">
              <div className="text-[#cfcbd5] mb-2">Pokéballs in Bag:</div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between bg-[#26262d] border border-[#3a3c48] rounded px-3 py-2">Pokéball <span>x {balls.pokeball}</span></li>
                <li className="flex items-center justify-between bg-[#26262d] border border-[#3a3c48] rounded px-3 py-2">Greatball <span>x {balls.greatball}</span></li>
                <li className="flex items-center justify-between bg-[#26262d] border border-[#3a3c48] rounded px-3 py-2">Ultraball <span>x {balls.ultraball}</span></li>
                <li className="flex items-center justify-between bg-[#26262d] border border-[#3a3c48] rounded px-3 py-2">Masterball <span>x {balls.masterball}</span></li>
              </ul>
              <button className="mt-3 w-full bg-[#d9d6db] text-black font-semibold py-2 rounded">Visit Pokemart</button>
            </div>
            
            {/* Player Pokémon Selection */}
            <div className="rounded-lg p-4 bg-[#2a2b31]">
              <div className="text-[#cfcbd5] mb-2">Your Pokémon:</div>
              {playerPokemon.length === 0 ? (
                <div className="text-gray-400 text-sm">No Pokémon caught yet. Catch some first!</div>
              ) : (
                <div className="space-y-2">
                  {playerPokemon.slice(0, 3).map((pokemon) => (
                    <div 
                      key={pokemon.id} 
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                        selectedPokemon?.id === pokemon.id 
                          ? 'bg-[#3a3c48] border border-[#5865f2]' 
                          : 'bg-[#26262d] border border-[#3a3c48] hover:bg-[#2f2f35]'
                      }`}
                      onClick={() => setSelectedPokemon(pokemon)}
                    >
                      {pokemon.spriteUrl && (
                        <img src={pokemon.spriteUrl} alt={pokemon.name} className="w-8 h-8 pixelated" />
                      )}
                      <div className="flex-1">
                        <div className="text-sm font-semibold capitalize">{pokemon.name}</div>
                        <div className="text-xs text-gray-400">Lv.{pokemon.level} HP: {pokemon.currentHp}/{pokemon.maxHp}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
