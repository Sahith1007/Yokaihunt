"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

interface SidebarProps {
  spotted: { name: string; spriteUrl: string; pokeId: number } | null;
  nearby: { key: string; name: string; pokeId: number; spriteUrl: string; distance: number }[];
  balls: { pokeball: number; greatball: number; ultraball: number; masterball: number };
  playerPokemon: any[];
  selectedPokemon: any | null;
  onSelectPokemon: (p: any) => void;
}

export default function Sidebar({ spotted, nearby, balls, playerPokemon, selectedPokemon, onSelectPokemon }: SidebarProps) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"report" | "nearby" | "player">("report");

  return (
    <div className={`absolute top-0 right-0 h-full transition-all ${open ? "w-full" : "w-6"}`}>
      <button
        aria-label="Toggle sidebar"
        onClick={() => setOpen(!open)}
        className="absolute top-1/2 -left-3 z-10 w-6 h-10 -translate-y-1/2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-l flex items-center justify-center text-xs"
      >
        {open ? "▶" : "◀"}
      </button>
      {open && (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
            <button className={`px-2 py-1 text-xs rounded ${tab === 'report' ? 'bg-white/20' : 'bg-transparent'}`} onClick={() => setTab("report")}>Field Report</button>
            <button className={`px-2 py-1 text-xs rounded ${tab === 'nearby' ? 'bg-white/20' : 'bg-transparent'}`} onClick={() => setTab("nearby")}>Nearby Pokémon</button>
            <button className={`px-2 py-1 text-xs rounded ${tab === 'player' ? 'bg-white/20' : 'bg-transparent'}`} onClick={() => setTab("player")}>Player Info</button>
          </div>
          <div className="flex-1 overflow-auto p-3 text-sm">
            {tab === "report" && (
              <div>
                <div className="font-semibold mb-2">Field Report</div>
                {spotted ? (
                  <div className="text-center">
                    <img src={spotted.spriteUrl} alt={spotted.name} className="w-20 h-20 mx-auto mb-2 pixelated" />
                    <div className="font-semibold capitalize">A wild {spotted.name} appeared!</div>
                    <div className="text-xs text-gray-400 mt-1">Press ENTER when close to battle/catch.</div>
                  </div>
                ) : (
                  <div className="text-gray-400">Exploring... Watch for activity.</div>
                )}
              </div>
            )}
            {tab === "nearby" && (
              <div>
                <div className="font-semibold mb-2">Nearby Pokémon</div>
                {nearby.length === 0 ? (
                  <div className="text-gray-400">No spawns in sight.</div>
                ) : (
                  <ul className="space-y-2">
                    {nearby.map((n) => (
                      <li key={n.key} className="flex items-center gap-2 bg-white/5 rounded p-2">
                        <img src={n.spriteUrl} alt={n.name} className="w-6 h-6 pixelated" />
                        <div className="capitalize">{n.name}</div>
                        <div className="ml-auto text-xs opacity-70">{Math.round(n.distance)} px</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {tab === "player" && (
              <div className="space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wider opacity-70 mb-1">Bag</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white/5 rounded p-2">Pokéball: {balls.pokeball}</div>
                    <div className="bg-white/5 rounded p-2">Greatball: {balls.greatball}</div>
                    <div className="bg-white/5 rounded p-2">Ultraball: {balls.ultraball}</div>
                    <div className="bg-white/5 rounded p-2">Masterball: {balls.masterball}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider opacity-70 mb-1">Your Pokémon</div>
                  {playerPokemon.length === 0 ? (
                    <div className="text-gray-400">No Pokémon yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {playerPokemon.slice(0, 6).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => onSelectPokemon(p)}
                          className={`w-full flex items-center gap-3 p-2 rounded text-left ${selectedPokemon?.id === p.id ? 'bg-white/15 border border-white/20' : 'bg-white/5 hover:bg-white/10'}`}
                        >
                          {p.spriteUrl && <img src={p.spriteUrl} alt={p.name} className="w-6 h-6 pixelated" />}
                          <div className="flex-1">
                            <div className="text-sm font-semibold capitalize">{p.name}</div>
                            <div className="text-xs opacity-70">Lv.{p.level} HP {p.currentHp}/{p.maxHp}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Link href="/market" className="inline-block text-center bg-white text-black font-semibold px-3 py-2 rounded">Open Marketplace</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
