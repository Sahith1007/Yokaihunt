import React from 'react';

interface DebugOverlayProps {
  trainerLevel: number;
  experience: number;
  experienceToNext: number;
  battlesWon: number;
  spawns: Array<{
    name: string;
    level: number;
    rarity: string;
    distance: number;
  }>;
  lastDamageInfo?: {
    attacker: string;
    damage: number;
    effectiveness: string | null;
  } | null;
  isVisible: boolean;
  onToggle: () => void;
}

export default function DebugOverlay({
  trainerLevel,
  experience,
  experienceToNext,
  battlesWon,
  spawns,
  lastDamageInfo,
  isVisible,
  onToggle
}: DebugOverlayProps) {
  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="fixed bottom-4 left-4 bg-gray-800 text-white px-3 py-2 rounded-md text-sm font-mono hover:bg-gray-700 z-[2000]"
        title="Toggle Debug Overlay"
      >
        {isVisible ? '🐛 Hide Debug' : '🐛 Debug'}
      </button>

      {/* Debug overlay */}
      {isVisible && (
        <div className="fixed top-4 left-4 bg-black/80 text-white p-4 rounded-lg font-mono text-xs max-w-sm z-[1999] border border-green-500">
          <div className="space-y-3">
            {/* Trainer Info */}
            <div className="border-b border-green-500/50 pb-2">
              <h3 className="text-green-400 font-bold mb-2">🎮 Trainer Info</h3>
              <div className="space-y-1">
                <div>Level: <span className="text-yellow-300">{trainerLevel}</span></div>
                <div>XP: <span className="text-blue-300">{experience}</span> / {experienceToNext}</div>
                <div>Battles Won: <span className="text-green-300">{battlesWon}</span></div>
              </div>
            </div>

            {/* Spawned Pokemon */}
            <div className="border-b border-green-500/50 pb-2">
              <h3 className="text-green-400 font-bold mb-2">📍 Active Spawns ({spawns.length})</h3>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {spawns.map((spawn, index) => (
                  <div key={index} className="text-xs">
                    <span className={getRarityColor(spawn.rarity)}>{spawn.name}</span>
                    {' '}Lv.{spawn.level}
                    {' '}({Math.round(spawn.distance)}px)
                  </div>
                ))}
                {spawns.length === 0 && (
                  <div className="text-gray-400 italic">No active spawns</div>
                )}
              </div>
            </div>

            {/* Last Damage Info */}
            {lastDamageInfo && (
              <div>
                <h3 className="text-green-400 font-bold mb-2">⚔️ Last Damage</h3>
                <div className="space-y-1">
                  <div>Attacker: <span className="text-purple-300">{lastDamageInfo.attacker}</span></div>
                  <div>Damage: <span className="text-red-300">{lastDamageInfo.damage}</span></div>
                  {lastDamageInfo.effectiveness && (
                    <div>Effect: <span className="text-yellow-300">{lastDamageInfo.effectiveness}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    common: 'text-gray-300',
    uncommon: 'text-green-300',
    rare: 'text-blue-300',
    epic: 'text-purple-300',
    legendary: 'text-yellow-300',
  };
  return colors[rarity.toLowerCase()] || 'text-white';
}
