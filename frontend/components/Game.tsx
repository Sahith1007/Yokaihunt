"use client";

import * as Phaser from "phaser";
import { useEffect, useRef } from "react";
import { GameScene } from "../lib/phaser/GameScene";
import { BattleScene } from "../lib/phaser/BattleScene";

interface GameProps {
  width?: number;
  height?: number;
  className?: string;
  tileSize?: number;
  mapWidth?: number;
  mapHeight?: number;
  playerSpeed?: number;
  initialX?: number;
  initialY?: number;
  onPokemonSpotted?: (pokemon: { name: string; spriteUrl: string; pokeId: number }) => void;
  onPokemonCleared?: () => void;
  playerPokemon?: any;
}

export default function Game({
  width = 800,
  height = 600,
  className = "",
  tileSize = 32,
  mapWidth = 50,
  mapHeight = 38,
  playerSpeed = 200,
  initialX,
  initialY,
  onPokemonSpotted,
  onPokemonCleared,
  playerPokemon,
}: GameProps) {
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width,
      height,
      parent: gameRef.current,
      backgroundColor: "#2c3e50",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [GameScene, BattleScene],
      scale: {
        mode: Phaser.Scale.FIT,
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

    return () => {
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, [width, height, tileSize, mapWidth, mapHeight, playerSpeed, initialX, initialY, onPokemonSpotted, onPokemonCleared, playerPokemon]);

  return (
    <div
      ref={gameRef}
      className={`game-container ${className}`}
      style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}
    />
  );
}