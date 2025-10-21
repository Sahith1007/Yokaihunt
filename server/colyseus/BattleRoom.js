const colyseus = require("colyseus");
const schema = require("@colyseus/schema");
const { Schema, MapSchema, ArraySchema } = schema;

class PlayerState extends Schema {
  constructor(id = "") {
    super();
    this.id = id;
    this.hp = 100;
    this.ready = false;
    this.lastMove = -1;
  }
}

class BattleState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema(); // sessionId -> PlayerState
    this.turn = ""; // sessionId of current turn
    this.log = new ArraySchema();
    this.over = false;
    this.winner = "";
  }
}

schema.defineTypes(PlayerState, {
  id: "string",
  hp: "number",
  ready: "boolean",
  lastMove: "number",
});

schema.defineTypes(BattleState, {
  players: { map: PlayerState },
  turn: "string",
  log: ["string"],
  over: "boolean",
  winner: "string",
});

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const MOVE_TABLE = [
  { name: "Slash", min: 6, max: 12 },
  { name: "Pierce", min: 4, max: 16 },
  { name: "Smash", min: 8, max: 10 },
];

class BattleRoom extends colyseus.Room {
  onCreate() {
    this.maxClients = 2;
    this.setPrivate(true);
    this.setState(new BattleState());

    this.onMessage("ready", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || this.state.over) return;
      p.ready = true;
      this.state.log.push(`${p.id} is ready.`);
      if (this.clients.length === 2) this.tryStart();
    });

    this.onMessage("choose", (client, { move }) => {
      if (this.state.over) return;
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (this.state.turn !== client.sessionId) return; // not your turn
      const idx = Number(move);
      if (Number.isNaN(idx) || idx < 0 || idx >= MOVE_TABLE.length) return;
      this.applyMove(client.sessionId, idx);
    });
  }

  tryStart() {
    // Both players ready? if not, wait
    const ids = Array.from(this.state.players.keys());
    if (ids.length < 2) return;
    const [aId, bId] = ids;
    const a = this.state.players.get(aId);
    const b = this.state.players.get(bId);
    if (!a.ready || !b.ready) return;

    // Randomize first turn
    this.state.turn = Math.random() < 0.5 ? aId : bId;
    this.state.log.push(`Battle started! ${this.state.turn} goes first.`);
  }

  applyMove(attackerId, moveIndex) {
    const ids = Array.from(this.state.players.keys());
    const defenderId = ids.find((id) => id !== attackerId);
    if (!defenderId) return;

    const attacker = this.state.players.get(attackerId);
    const defender = this.state.players.get(defenderId);
    const move = MOVE_TABLE[moveIndex];
    const dmg = randInt(move.min, move.max);

    attacker.lastMove = moveIndex;
    this.state.log.push(`${attacker.id} used ${move.name} for ${dmg} dmg!`);

    defender.hp = Math.max(0, defender.hp - dmg);

    if (defender.hp <= 0) {
      this.state.over = true;
      this.state.winner = attacker.id;
      this.state.log.push(`${attacker.id} wins!`);
      this.lock();
      return;
    }

    // Switch turn
    this.state.turn = defenderId;
  }

  onJoin(client, options) {
    const id = options?.id || client.sessionId;
    const p = new PlayerState(id);
    this.state.players.set(client.sessionId, p);
    this.state.log.push(`${p.id} joined.`);

    if (this.clients.length === 2) this.tryStart();
  }

  onLeave(client) {
    const p = this.state.players.get(client.sessionId);
    if (p) this.state.log.push(`${p.id} left.`);
    this.state.players.delete(client.sessionId);
    if (!this.state.over) {
      // If someone left early, declare the other as winner
      const remaining = Array.from(this.state.players.values())[0];
      if (remaining) {
        this.state.over = true;
        this.state.winner = remaining.id;
        this.state.log.push(`${remaining.id} wins by forfeit.`);
      }
    }
  }
}

module.exports = { BattleRoom };
