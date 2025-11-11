import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import Taskbar from "../../components/HUD/Taskbar";
import Sidebar from "../../components/HUD/Sidebar";
import InventoryModal from "../../components/Modals/InventoryModal";
import TeamModal from "../../components/Modals/TeamModal";
import StarterSelection from "../../components/StarterSelection";
import { hasStarterPokemon, loadStarterPokemon } from "../../lib/pokeapi";
import { CaptureModal } from "../../ui/CaptureModal";

const Game = dynamic(() => import("../../components/Game"), { ssr: false });

export default function Home() {
  const [player, setPlayer] = useState(null);
  const [balls, setBalls] = useState({ pokeball: 0, greatball: 0, ultraball: 0, masterball: 0 });
  const [spottedPokemon, setSpottedPokemon] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [playerPokemon, setPlayerPokemon] = useState([]);
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [showInventory, setShowInventory] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showStarterSelection, setShowStarterSelection] = useState(false);
  const [starterPokemon, setStarterPokemon] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [captureState, setCaptureState] = useState({ 
    open: false, 
    outcome: null, 
    txId: null, 
    txIdMint: null,
    txIdSend: null,
    assetId: null,
    ipfs: null, 
    spawn: null, 
    xpGained: null,
    optInRequired: false
  });

  // Check for starter on mount (only once)
  useEffect(() => {
    if (typeof window !== "undefined" && !isInitialized) {
      if (!hasStarterPokemon()) {
        setShowStarterSelection(true);
      } else {
        const starter = loadStarterPokemon();
        setStarterPokemon(starter);
      }
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Listen for spawn proximity and capture results from GameScene
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const proximityHandler = (e) => {
      const d = e.detail || {};
      if (d.spawn) {
        setCaptureState({ open: true, outcome: null, txId: null, spawn: d.spawn });
      }
    };
    const resultHandler = async (e) => {
      const d = e.detail || {};
      setCaptureState(prev => ({ 
        ...prev, 
        outcome: d.outcome || null, 
        txId: d.txId || null,
        txIdMint: d.txIdMint || null,
        txIdSend: d.txIdSend || null,
        assetId: d.assetId || null,
        ipfs: d.ipfs || null,
        xpGained: d.xpGained || null,
        optInRequired: d.optInRequired || false,
        pokemon: d.pokemon || prev.spawn
      }));
      
      // If capture was successful and trainer was updated, refresh player team
      if (d.outcome === 'success' && d.trainer) {
        // Update local state with new trainer.team
        if (d.trainer.team && d.trainer.team.length > 0) {
          setPlayerPokemon(d.trainer.team);
          if (!selectedPokemon) setSelectedPokemon(d.trainer.team[0]);
        }
      }
    };
    window.addEventListener('yokai-spawn-proximity', proximityHandler);
    window.addEventListener('yokai-capture-result', resultHandler);
    return () => {
      window.removeEventListener('yokai-spawn-proximity', proximityHandler);
      window.removeEventListener('yokai-capture-result', resultHandler);
    };
  }, [selectedPokemon]);

  // Load player data (only once)
  useEffect(() => {
    if (!isInitialized) return;

    // player position
    fetch("http://localhost:4000/api/player")
      .then(async (r) => {
        const data = await r.json();
        if (r.ok) setPlayer({ posX: data?.progress?.posX ?? 64, posY: data?.progress?.posY ?? 64 });
      })
      .catch(() => {});

    // player pokemon + bag
    import("../../lib/api/pokemonApi").then(async (mod) => {
      try {
        const mons = await mod.fetchPlayerPokemon();
        setPlayerPokemon(mons || []);
        if ((mons || []).length && !selectedPokemon) setSelectedPokemon(mons[0]);
      } catch {}
      try {
        const bag = await mod.getPlayerInventory();
        setBalls(bag || { pokeball: 0, greatball: 0, ultraball: 0, masterball: 0 });
      } catch {}
    });
  }, [isInitialized]);

  const handleStarterSelected = useCallback((pokemon) => {
    setStarterPokemon(pokemon);
    setShowStarterSelection(false);
  }, []);

  // Memoize Phaser callbacks to prevent Game re-initialization
  const handlePokemonSpotted = useCallback((pokemon) => {
    setSpottedPokemon(pokemon);
  }, []);

  const handlePokemonCleared = useCallback(() => {
    setSpottedPokemon(null);
  }, []);

  const handleSpawnsUpdate = useCallback((spawns) => {
    setNearby(spawns);
  }, []);

  // Show starter selection if player hasn't chosen one
  if (showStarterSelection) {
    return <StarterSelection onSelectStarter={handleStarterSelected} />;
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0f1116] text-white">
      <div className="grid grid-cols-[80vw_20vw] grid-rows-[1fr] w-screen h-screen">
        <section className="relative w-full h-full bg-black/20">
          <div className="absolute inset-0">
            <Game
              tileSize={32}
              mapWidth={60}
              mapHeight={40}
              playerSpeed={220}
              initialX={player?.posX}
              initialY={player?.posY}
              onPokemonSpotted={handlePokemonSpotted}
              onPokemonCleared={handlePokemonCleared}
              onSpawnsUpdate={handleSpawnsUpdate}
              playerPokemon={starterPokemon || selectedPokemon}
            />
          </div>
          <Taskbar
            onInventory={() => setShowInventory(true)}
            onTeam={() => setShowTeam(true)}
            onMarket={() => {}}
            starterPokemon={starterPokemon}
          />
        </section>

        <aside className="relative w-full h-full border-l border-white/5 bg-[#151821]">
          <Sidebar
            spotted={spottedPokemon}
            nearby={nearby}
            balls={balls}
            playerPokemon={starterPokemon ? [starterPokemon, ...playerPokemon] : playerPokemon}
            selectedPokemon={starterPokemon || selectedPokemon}
            onSelectPokemon={setSelectedPokemon}
          />
        </aside>
      </div>

      <InventoryModal open={showInventory} onClose={() => setShowInventory(false)} />
      <TeamModal 
        open={showTeam} 
        team={starterPokemon ? [starterPokemon, ...playerPokemon].slice(0, 6) : playerPokemon.slice(0, 6)} 
        onClose={() => setShowTeam(false)} 
      />
      <CaptureModal 
        open={captureState.open} 
        outcome={captureState.outcome} 
        txId={captureState.txId}
        txIdMint={captureState.txIdMint}
        txIdSend={captureState.txIdSend}
        assetId={captureState.assetId}
        ipfs={captureState.ipfs}
        pokemon={captureState.spawn}
        xpGained={captureState.xpGained}
        optInRequired={captureState.optInRequired}
        onClose={() => setCaptureState({ 
          open: false, 
          outcome: null, 
          txId: null, 
          txIdMint: null,
          txIdSend: null,
          assetId: null,
          ipfs: null, 
          spawn: null, 
          xpGained: null,
          optInRequired: false
        })}
        onCapture={async (spawn) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('yokai-capture-attempt', { detail: { spawn } }));
          }
        }}
      />
    </div>
  );
}
