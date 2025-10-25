import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Taskbar from "../../components/HUD/Taskbar";
import Sidebar from "../../components/HUD/Sidebar";
import InventoryModal from "../../components/Modals/InventoryModal";
import TeamModal from "../../components/Modals/TeamModal";
import WalletButton from "../../components/WalletButton";
import StarterSelection from "../../components/StarterSelection";
import { hasStarterPokemon, loadStarterPokemon } from "../../lib/pokeapi";

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

  useEffect(() => {
    // Check if player has selected a starter
    if (typeof window !== "undefined") {
      if (!hasStarterPokemon()) {
        setShowStarterSelection(true);
        return;
      } else {
        const starter = loadStarterPokemon();
        setStarterPokemon(starter);
      }
    }

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
  }, []);

  const handleStarterSelected = (pokemon) => {
    setStarterPokemon(pokemon);
    setShowStarterSelection(false);
  };

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
              onPokemonSpotted={setSpottedPokemon}
              onPokemonCleared={() => setSpottedPokemon(null)}
              onSpawnsUpdate={setNearby}
              playerPokemon={selectedPokemon}
            />
          </div>
          <Taskbar
            onInventory={() => setShowInventory(true)}
            onTeam={() => setShowTeam(true)}
            onMarket={() => {}}
            onWallet={() => {}}
            starterPokemon={starterPokemon}
          />
        </section>

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

      <InventoryModal open={showInventory} onClose={() => setShowInventory(false)} />
      <TeamModal open={showTeam} team={playerPokemon.slice(0, 6)} onClose={() => setShowTeam(false)} />
      <WalletButton />
    </div>
  );
}
