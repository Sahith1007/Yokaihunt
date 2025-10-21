import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";

const Game = dynamic(() => import("../../components/Game"), { ssr: false });

export default function Home() {
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      fetch("http://localhost:4000/api/player", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (r) => {
          const data = await r.json();
          if (r.ok)
            setPlayer({
              posX: data?.progress?.posX ?? 64,
              posY: data?.progress?.posY ?? 64,
            });
        })
        .catch(() => {});
    } catch {}
  }, []);

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image className="dark:invert" src="/next.svg" alt="Next.js" width={180} height={38} priority />
        <div className="flex gap-4">
          <a className="underline" href="/login">Login</a>
          <a className="underline" href="/register">Register</a>
        </div>
        <div className="w-full max-w-[900px] h-[600px] border border-black/[.08] dark:border-white/[.145] rounded-md overflow-hidden">
          <Game
            width={900}
            height={600}
            tileSize={32}
            mapWidth={60}
            mapHeight={40}
            playerSpeed={220}
            initialX={player?.posX}
            initialY={player?.posY}
          />
        </div>
      </main>
    </div>
  );
}
