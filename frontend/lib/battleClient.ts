/**
 * Battle Client
 * TypeScript wrapper for battle API endpoints
 */

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export interface BattleAction {
  actorUid: string;
  moveId: string;
  targetUid?: string;
}

export interface BattleSession {
  sessionId: string;
  type: 'pvp' | 'gym' | 'wild';
  status: 'created' | 'active' | 'finished' | 'abandoned';
  winner?: string;
  players: Array<{
    walletAddress: string;
    team: Array<{
      uid: string;
      pokeId: number;
      name: string;
      level: number;
      currentHP: number;
      maxHP: number;
      attack: number;
      defense: number;
      speed: number;
      moves: string[];
      status: string;
    }>;
    active: number;
  }>;
  seed: string;
  actionLog: Array<{
    turn: number;
    actorUid: string;
    moveId: string;
    targetUid: string;
    damage: number;
    accuracy: boolean;
  }>;
  currentTurn: number;
  rewards?: {
    winner?: {
      playerXP: number;
      pokemonXP: number;
    };
    loser?: {
      playerXP: number;
      pokemonXP: number;
    };
  };
}

/**
 * Create a new battle session
 */
export async function createBattle(params: {
  walletAddress: string;
  type: 'pvp' | 'gym';
  opponent?: string;
  seed?: string;
}): Promise<{ success: boolean; sessionId: string; seed: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/battle/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': params.walletAddress,
      },
      body: JSON.stringify({
        type: params.type,
        opponent: params.opponent,
        seed: params.seed,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Create battle error:', error);
    return { success: false, sessionId: '', seed: '', error: String(error) };
  }
}

/**
 * Submit an action to a battle
 */
export async function submitBattleAction(params: {
  walletAddress: string;
  sessionId: string;
  action: BattleAction;
  signature?: string;
}): Promise<{ success: boolean; battleOver: boolean; winner?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/battle/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': params.walletAddress,
      },
      body: JSON.stringify({
        sessionId: params.sessionId,
        action: params.action,
        signature: params.signature,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Submit action error:', error);
    return { success: false, battleOver: false, error: String(error) };
  }
}

/**
 * Get battle session state
 */
export async function getBattleSession(sessionId: string): Promise<{
  success: boolean;
  session?: BattleSession;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/battle/session/${sessionId}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Get session error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Finish battle and get rewards
 */
export async function finishBattle(params: {
  walletAddress: string;
  sessionId: string;
}): Promise<{
  success: boolean;
  winner?: string;
  rewards?: any;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/battle/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': params.walletAddress,
      },
      body: JSON.stringify({
        sessionId: params.sessionId,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Finish battle error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Auto-resolve a gym battle
 */
export async function autoResolveBattle(params: {
  walletAddress: string;
  sessionId: string;
}): Promise<{
  success: boolean;
  winner?: string;
  turns?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/battle/auto-resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': params.walletAddress,
      },
      body: JSON.stringify({
        sessionId: params.sessionId,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Auto-resolve error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Replay a battle (for verification)
 */
export async function replayBattle(sessionId: string): Promise<{
  success: boolean;
  allMatch?: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/battle/replay/${sessionId}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Replay error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get player XP info
 */
export async function getPlayerXP(walletAddress: string): Promise<{
  success: boolean;
  level?: number;
  xp?: number;
  currentXP?: number;
  nextLevelXP?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/battle/xp/player/${walletAddress}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Get player XP error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Test award XP (admin/testing only)
 */
export async function testAwardXP(params: {
  walletAddress: string;
  xp: number;
}): Promise<{
  success: boolean;
  leveled?: boolean;
  newLevel?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/battle/xp/test-award`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Test award XP error:', error);
    return { success: false, error: String(error) };
  }
}

export default {
  createBattle,
  submitBattleAction,
  getBattleSession,
  finishBattle,
  autoResolveBattle,
  replayBattle,
  getPlayerXP,
  testAwardXP,
};
