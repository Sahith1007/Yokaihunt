"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Taskbar from "./components/HUD/Taskbar";
import Sidebar from "./components/HUD/Sidebar";
import InventoryModal from "./components/Modals/InventoryModal";
import TeamModal from "./components/Modals/TeamModal";
import WalletButton from "./components/WalletButton";
import { fetchPlayerPokemon, getPlayerInventory, type PlayerPokemon } from "./lib/api/pokemonApi";

const Game = dynamic(() => import("./components/Game"), { ssr: false });

type PlayerPos = { posX: number; posY: number } | null;

type Balls = { pokeball: number; greatball: number; ultraball: number; masterball: number };

type SpottedPokemon = { name: string; spriteUrl: string; pokeId: number } | null;

type Nearby = { key: string; name: string; pokeId: number; spriteUrl: string; distance: number }[];

export default function Home() {
  const [player, setPlayer] = useState<PlayerPos>(null);
  const [balls, setBalls] = useState<Balls>({ pokeball: 0, greatball: 0, ultraball: 0, masterball: 0 });
  const [spottedPokemon, setSpottedPokemon] = useState<SpottedPokemon>(null);
  const [nearby, setNearby] = useState<Nearby>([]);
  const [playerPokemon, setPlayerPokemon] = useState<PlayerPokemon[]>([]);
  const [selectedPokemon, setSelectedPokemon] = useState<PlayerPokemon | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [showTeam, setShowTeam] = useState(false);

  useEffect(() => {
    fetch("http://localhost:4000/api/player")
      .then(async (r) => {
        const data = await r.json();
        if (r.ok)
          setPlayer({ posX: data?.progress?.posX ?? 64, posY: data?.progress?.posY ?? 64 });
      })
      .catch(() => {});

    fetchPlayerPokemon().then((pokemon) => {
      setPlayerPokemon(pokemon);
      if (pokemon.length > 0 && !selectedPokemon) {
        setSelectedPokemon(pokemon[0]);
      }
    });

    getPlayerInventory().then(setBalls);
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0f1116] text-white">
      <div className="grid grid-cols-[80vw_20vw] grid-rows-[1fr] w-screen h-screen">
        {/* Map Area */}
        <section className="relative w-full h-full bg-black/20">
          <div className="absolute inset-0">
            <Game
              tileSize={32}
              mapWidth={60}
              mapHeight={40}
              playerSpeed={220}
              initialX={player?.posX}
              initialY={player?.posY}
              onPokemonSpotted={setSpottedPokemon}
              onPokemonCleared={() => setSpottedPokemon(null)}
              onSpawnsUpdate={setNearby as any}
              playerPokemon={selectedPokemon}
            />
          </div>

          {/* Bottom HUD Taskbar */}
          <Taskbar
            onInventory={() => setShowInventory(true)}
            onTeam={() => setShowTeam(true)}
            onMarket={() => {}}
          />
        </section>

        {/* Right Sidebar */}
        <aside className="relative w-full h-full border-l border-white/5 bg-[#151821]">
          <Sidebar
            spotted={spottedPokemon}
            nearby={nearby}
            balls={balls}
            playerPokemon={playerPokemon}
            selectedPokemon={selectedPokemon}
            onSelectPokemon={setSelectedPokemon}
          />
        </aside>
      </div>

      {/* Modals */}
      <InventoryModal open={showInventory} onClose={() => setShowInventory(false)} />
      <TeamModal open={showTeam} team={playerPokemon.slice(0, 6)} onClose={() => setShowTeam(false)} />

      {/* Global Wallet Button (fixed bottom-right) */}
      <WalletButton />
    </div>
  );
}
