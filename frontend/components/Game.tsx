"use client";

import * as Phaser from "phaser";
import { useEffect, useRef } from "react";
import { GameScene } from "../lib/phaser/GameScene";
import { BattleScene } from "../lib/phaser/BattleScene";

interface GameProps {
  className?: string;
  tileSize?: number;
  mapWidth?: number;
  mapHeight?: number;
  playerSpeed?: number;
  initialX?: number;
  initialY?: number;
  onPokemonSpotted?: (pokemon: { name: string; spriteUrl: string; pokeId: number }) => void;
  onPokemonCleared?: () => void;
  onSpawnsUpdate?: (spawns: any[]) => void;
  playerPokemon?: any;
}

export default function Game({
  className = "",
  tileSize = 32,
  mapWidth = 50,
  mapHeight = 38,
  playerSpeed = 200,
  initialX,
  initialY,
  onPokemonSpotted,
  onPokemonCleared,
  onSpawnsUpdate,
  playerPokemon,
}: GameProps) {
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameRef.current) return;

    const getSize = () => ({ w: gameRef.current!.clientWidth, h: gameRef.current!.clientHeight });
    const { w, h } = getSize();

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: Math.max(320, w),
      height: Math.max(240, h),
      parent: gameRef.current,
      backgroundColor: "#0b0e14",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [GameScene, BattleScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    phaserGameRef.current = new Phaser.Game(config);

    const startOrRestart = () => {
      const game = phaserGameRef.current as Phaser.Game;
      const data = {
        tileSize,
        mapWidth,
        mapHeight,
        playerSpeed,
        initialX,
        initialY,
        onPokemonSpotted,
        onPokemonCleared,
        onSpawnsUpdate,
        playerPokemon,
      };
      const mgr = game.scene;
      if (mgr.isActive("GameScene")) {
        mgr.stop("GameScene");
        mgr.start("GameScene", data);
      } else {
        mgr.start("GameScene", data);
      }
    };

    if (phaserGameRef.current.isBooted) startOrRestart();
    else phaserGameRef.current.events.once(Phaser.Core.Events.READY, startOrRestart);

    const ro = new ResizeObserver(() => {
      if (!phaserGameRef.current || !gameRef.current) return;
      const { w: nw, h: nh } = getSize();
      phaserGameRef.current.scale.resize(Math.max(320, nw), Math.max(240, nh));
    });
    ro.observe(gameRef.current);

    return () => {
      ro.disconnect();
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, [tileSize, mapWidth, mapHeight, playerSpeed, initialX, initialY, onPokemonSpotted, onPokemonCleared, onSpawnsUpdate, playerPokemon]);

  return (
    <div
      ref={gameRef}
      className={`game-container ${className}`}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
