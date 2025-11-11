import * as Phaser from "phaser";
import { calculateDamage, getMoveData, type PokemonType } from "../typeEffectiveness";

interface BattleData {
  wildPokemon: {
    name: string;
    pokeId: number;
    data: any;
    spriteUrl: string;
    level?: number;
  };
  playerPokemon: {
    name: string;
    pokeId: number;
    data: any;
    spriteUrl: string;
    level: number;
    currentHp: number;
    maxHp: number;
  };
  playerTeam?: any[]; // Full team for switching
  trainerLevel?: number;
  // Gym hooks
  gymId?: string;
  allowCatch?: boolean;
  allowRun?: boolean;
}

export class BattleScene extends Phaser.Scene {
  private wildPokemon!: BattleData["wildPokemon"];
  private playerPokemon!: BattleData["playerPokemon"];
  private wildSprite?: Phaser.GameObjects.Image;
  private playerSprite?: Phaser.GameObjects.Image;
  private wildHp: number = 0;
  private wildMaxHp: number = 0;
  private wildLevel: number = 5;
  private playerHp: number = 0;
  private playerMaxHp: number = 0;
  private playerTeam: any[] = [];
  private trainerLevel: number = 1;
  private battleTeamHp: Map<number, number> = new Map(); // Track HP during battle
  private gymId?: string;
  private allowCatch: boolean = true;
  private allowRun: boolean = true;
  
  // Battle state
  private isPlayerTurn: boolean = true;
  private battleInProgress: boolean = false;
  private lastDamageInfo: { damage: number; effectiveness: string | null } | null = null;
  
  // UI Elements
  private battleUI?: Phaser.GameObjects.Container;
  private wildHpBar?: Phaser.GameObjects.Rectangle;
  private playerHpBar?: Phaser.GameObjects.Rectangle;
  private wildHpText?: Phaser.GameObjects.Text;
  private playerHpText?: Phaser.GameObjects.Text;
  private battleText?: Phaser.GameObjects.Text;
  private actionButtons?: Phaser.GameObjects.Container;
  private floatingTexts: Phaser.GameObjects.Text[] = [];
  private statusToast?: Phaser.GameObjects.Text;

  constructor() {
    super("BattleScene");
  }

  init(data: BattleData) {
    this.wildPokemon = data.wildPokemon;
    this.playerPokemon = data.playerPokemon;
    this.playerTeam = data.playerTeam || [];
    this.trainerLevel = data.trainerLevel || 1;
    this.gymId = data.gymId;
    if (typeof data.allowCatch === 'boolean') this.allowCatch = data.allowCatch;
    if (typeof data.allowRun === 'boolean') this.allowRun = data.allowRun;
    
// Calculate wild Pokemon HP with level scaling (include IV ~31) and minimum floor
    this.wildLevel = this.wildPokemon.level || 5;
    const wildHpStat = this.wildPokemon.data?.stats?.find((s: any) => s.stat.name === 'hp')?.base_stat || 50;
    this.wildMaxHp = Math.floor((((2 * wildHpStat + 31) * this.wildLevel) / 100) + this.wildLevel + 10);
    this.wildMaxHp = Math.max(24, this.wildMaxHp);
    this.wildHp = this.wildMaxHp;
    
    // Ensure player HP has sane floor and IV-based calc if missing
    this.playerMaxHp = Math.max(
      this.playerPokemon.maxHp || 0,
      Math.floor((((2 * (this.playerPokemon.data?.stats?.find((s: any) => s.stat.name === 'hp')?.base_stat || 50) + 31) * this.playerPokemon.level) / 100) + this.playerPokemon.level + 10)
    );
    this.playerMaxHp = Math.max(28, this.playerMaxHp);
    this.playerHp = Math.min(this.playerMaxHp, this.playerPokemon.currentHp || this.playerMaxHp);
    
    // Initialize battle HP tracking - all Pokemon start at full HP at battle start
    this.battleTeamHp.clear();
    this.playerTeam.forEach(p => {
      this.battleTeamHp.set(p.id, p.maxHp);
    });
    // Set current Pokemon HP
    this.battleTeamHp.set(this.playerPokemon.pokeId, this.playerHp);
    
    this.isPlayerTurn = true;
    this.battleInProgress = false;
  }

  async preload() {
    // Load Pokémon sprites if not already loaded
    if (!this.textures.exists(`wild-${this.wildPokemon.pokeId}`)) {
      await new Promise<void>((resolve) => {
        this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        this.load.image(`wild-${this.wildPokemon.pokeId}`, this.wildPokemon.spriteUrl);
        this.load.start();
      });
    }
    
    if (!this.textures.exists(`player-${this.playerPokemon.pokeId}`)) {
      await new Promise<void>((resolve) => {
        this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        this.load.image(`player-${this.playerPokemon.pokeId}`, this.playerPokemon.spriteUrl);
        this.load.start();
      });
    }
  }

  create() {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x87CEEB).setOrigin(0.5);

    // Hide any lingering map UI by drawing an opaque footer (prevents DOM overlap perception)
    this.add.rectangle(width / 2, height - 18, width, 36, 0x000000, 0.2).setDepth(5);

    // Wild Pokémon (enemy, top right)
    this.wildSprite = this.add.image(width * 0.75, height * 0.3, `wild-${this.wildPokemon.pokeId}`)
      .setScale(2)
      .setFlipX(false);

    // Player Pokémon (bottom left, back sprite)
    this.playerSprite = this.add.image(width * 0.25, height * 0.65, `player-${this.playerPokemon.pokeId}`)
      .setScale(2)
      .setFlipX(true);

    this.createUI();
    this.showToast(`A wild ${this.capitalize(this.wildPokemon.name)} appeared!`, 1500);
  }

  private createUI() {
    const { width, height } = this.scale;

    // Battle UI Container
    this.battleUI = this.add.container(0, 0);

    // Wild Pokémon HP Bar (top left)
    const wildHpBg = this.add.rectangle(20, 20, 200, 20, 0x333333).setOrigin(0);
    this.wildHpBar = this.add.rectangle(22, 22, 196, 16, 0x00ff00).setOrigin(0);
    this.wildHpText = this.add.text(20, 45, `${this.capitalize(this.wildPokemon.name)} HP: ${this.wildHp}/${this.wildMaxHp}`, {
      fontSize: '14px',
      color: '#000'
    });

    // Player Pokémon HP Bar (bottom right)
    const playerHpBg = this.add.rectangle(width - 220, height - 80, 200, 20, 0x333333).setOrigin(0);
    this.playerHpBar = this.add.rectangle(width - 218, height - 78, 196, 16, 0x00ff00).setOrigin(0);
    this.playerHpText = this.add.text(width - 220, height - 55, `${this.capitalize(this.playerPokemon.name)} Lv.${this.playerPokemon.level} HP: ${this.playerHp}/${this.playerMaxHp}`, {
      fontSize: '14px',
      color: '#000'
    });

    // Minimal status toast (top-right), no big dialog box
    this.battleText = this.add.text(width - 360, 12, '', {
      fontSize: '14px', color: '#000', backgroundColor: '#ffffffe6', padding: { x: 10, y: 6 }, wordWrap: { width: 340 }
    }).setDepth(1002).setVisible(false);

    // Action buttons (placed at right-middle as vertical stack)
    this.createActionButtons();

    this.battleUI.add([wildHpBg, this.wildHpBar, this.wildHpText, playerHpBg, this.playerHpBar, this.playerHpText]);
  }

  private createActionButtons() {
    const { width, height } = this.scale;

    this.actionButtons = this.add.container(0, 0);

    const baseX = width - 120;
    const baseY = height / 2 - 100;
    const vGap = 34;
    const buttonData = [
      { text: 'FIGHT', x: baseX, y: baseY + vGap * 0, action: () => this.showMoveSelection() },
      { text: 'SWITCH', x: baseX, y: baseY + vGap * 1, action: () => this.showTeamSelection() },
      { text: 'BAG', x: baseX, y: baseY + vGap * 2, action: () => this.openBag() },
      ...(this.allowCatch ? [{ text: 'CATCH', x: baseX, y: baseY + vGap * 3, action: () => this.attemptCatch() }] : []),
      ...(this.allowRun ? [{ text: 'RUN', x: baseX, y: baseY + vGap * 4, action: () => this.runAway() }] : [])
    ];

    buttonData.forEach(btn => {
      const button = this.add.text(btn.x, btn.y, btn.text, {
        fontSize: '14px',
        color: '#fff',
        backgroundColor: '#333',
        padding: { x: 8, y: 4 }
      }).setInteractive({ useHandCursor: true })
        .on('pointerdown', btn.action);
      
      this.actionButtons?.add(button);
    });

    if (this.actionButtons) this.battleUI?.add(this.actionButtons);
  }

  private showMoveSelection() {
    if (!this.isPlayerTurn || this.battleInProgress) return;

    // Hide main action buttons
    if (this.actionButtons) this.actionButtons.setVisible(false);

    const { width, height } = this.scale;
    const moves = this.getPlayerMoves();

    // Create move selection container
    const moveContainer = this.add.container(0, 0);

    // Background for move selection (right-center panel)
    const panelW = 300; const panelH = 140;
    const moveBg = this.add.rectangle(width - panelW - 20, height / 2 - panelH / 2, panelW, panelH, 0x222222, 0.95).setOrigin(0);
    moveContainer.add(moveBg);

    // Display up to 4 moves in a 2x2 grid
    moves.slice(0, 4).forEach((move, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = width - panelW - 10 + col * 150;
      const y = height / 2 - panelH / 2 + 10 + row * 60;

      const moveButton = this.add.text(x, y, move.name.toUpperCase(), {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: this.getMoveTypeColor(move.type),
        padding: { x: 10, y: 6 }
      }).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          moveContainer.destroy();
          if (this.actionButtons) this.actionButtons.setVisible(true);
          this.useMove(move);
        });

      moveContainer.add(moveButton);
    });

    // Back button
    const backButton = this.add.text(width - panelW, height / 2 + panelH / 2 + 8, 'BACK', {
      fontSize: '12px',
      color: '#fff',
      backgroundColor: '#666',
      padding: { x: 8, y: 4 }
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        moveContainer.destroy();
        if (this.actionButtons) this.actionButtons.setVisible(true);
      });

    moveContainer.add(backButton);
    this.battleUI?.add(moveContainer);
  }
  
  private showTeamSelection() {
    if (!this.isPlayerTurn || this.battleInProgress) return;
    if (this.playerTeam.length === 0) {
      // Try lazy-load team from trainer storage
      this.loadTrainerTeam().then(() => this.internalShowTeamSelection());
      return;
    }
    this.internalShowTeamSelection();
  }

  private internalShowTeamSelection() {
    
    // Hide main action buttons
    if (this.actionButtons) this.actionButtons.setVisible(false);

    const { width, height } = this.scale;

    // Create team selection container
    const teamContainer = this.add.container(0, 0);

    // Background for team selection
    const teamBg = this.add.rectangle(width / 2 - 200, height / 2 - 150, 400, 300, 0x222222, 0.95).setOrigin(0);
    teamContainer.add(teamBg);
    
    const title = this.add.text(width / 2, height / 2 - 130, 'Choose Pokemon', {
      fontSize: '18px',
      color: '#fff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    teamContainer.add(title);

    // Display team members
    this.playerTeam.forEach((pokemon, index) => {
      const y = height / 2 - 90 + index * 50;
      const maxHp = pokemon.maxHp || 100;
      const currentHp = this.battleTeamHp.get(pokemon.id) || maxHp;
      const isFainted = currentHp <= 0;
      const isCurrent = pokemon.id === this.playerPokemon.pokeId;
      
      const pokemonButton = this.add.text(width / 2 - 180, y, 
        `${this.capitalize(pokemon.name)} Lv.${pokemon.level || 1}  HP: ${currentHp}/${maxHp}`, 
        {
          fontSize: '14px',
          color: isFainted ? '#666' : isCurrent ? '#ffd700' : '#fff',
          backgroundColor: isCurrent ? '#444' : '#333',
          padding: { x: 10, y: 6 }
        }
      ).setOrigin(0);
      
      if (!isFainted && !isCurrent) {
        pokemonButton.setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            teamContainer.destroy();
            if (this.actionButtons) this.actionButtons.setVisible(true);
            this.switchPokemon(pokemon);
          });
      }

      teamContainer.add(pokemonButton);
    });

    // Back button
    const backButton = this.add.text(width / 2, height / 2 + 130, 'BACK', {
      fontSize: '14px',
      color: '#fff',
      backgroundColor: '#666',
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        teamContainer.destroy();
        if (this.actionButtons) this.actionButtons.setVisible(true);
      });

    teamContainer.add(backButton);
    teamContainer.setDepth(1001);
    this.battleUI?.add(teamContainer);
  }

  private getPlayerMoves() {
    // Ensure 4 unique moves with at least one STAB (type-matching) move
    const pokemonMoves = this.playerPokemon.data?.moves || [];
    const types = (this.playerPokemon.data?.types || []).map((t: any) => t.type.name);
    const primaryType: string = types[0] || 'normal';
    const secondaryType: string | undefined = types[1];

    type MoveLite = { name: string; type: string };
    const chosen: MoveLite[] = [];
    const seen = new Set<string>();

    const addMove = (name: string) => {
      const data = getMoveData(name);
      const norm = name.toLowerCase().replace(/\s+/g, '-');
      if (data.power <= 0) return;
      if (seen.has(norm)) return;
      seen.add(norm);
      chosen.push({ name: data.name, type: data.type });
    };

    // 1) Prefer STAB from PokeAPI-provided moves if available
    const shuffled = [...pokemonMoves].sort(() => Math.random() - 0.5);
    for (const m of shuffled) {
      const moveName = m.move?.name as string | undefined;
      if (!moveName) continue;
      const data = getMoveData(moveName);
      if (data.power > 0 && types.includes(data.type)) {
        addMove(data.name);
        if (chosen.length >= 2) break; // grab up to two STAB options first
      }
    }

    // 2) Guarantee at least one STAB move for primary type
    if (!chosen.some((mv) => mv.type === primaryType)) {
      addMove(this.getTypedMove(primaryType));
    }

    // 3) If dual-typed, try to include a move of the secondary type
    if (secondaryType && !chosen.some((mv) => mv.type === secondaryType) && chosen.length < 4) {
      addMove(this.getSecondaryTypedMove(secondaryType));
    }

    // 4) Fill remaining slots with offensive, unique moves from PokeAPI list
    for (const m of shuffled) {
      if (chosen.length >= 4) break;
      const moveName = m.move?.name as string | undefined;
      if (!moveName) continue;
      const data = getMoveData(moveName);
      if (data.power > 0) addMove(data.name);
    }

    // 5) Final fallback coverage pool (avoid duplicates and avoid two Scratches)
    const fallbackPool = [
      'Quick Attack',
      'Tackle',
      'Bite',
      'Rock Throw',
      'Confusion',
      'Metal Claw',
    ];
    for (const f of fallbackPool) {
      if (chosen.length >= 4) break;
      addMove(f);
    }

    // Enforce STAB for known starters if still missing
    const enforceStab = (type: string, moveName: string) => {
      if (!chosen.some((mv) => mv.type === type)) {
        addMove(moveName);
      }
    };

    // Squirtle (id 7) must have Water Gun
    if (this.playerPokemon.pokeId === 7) {
      enforceStab('water', 'Water Gun');
    }

    // If chosen exceeds 4 after enforcement, drop lowest-priority generic moves
    const dropOrder = ['Scratch', 'Tackle', 'Quick Attack', 'Bite'];
    while (chosen.length > 4) {
      const idx = chosen.findIndex((mv) => dropOrder.includes(mv.name));
      if (idx >= 0) chosen.splice(idx, 1);
      else chosen.pop();
    }

    // Prefer to show STAB first
    const primaryIdx = chosen.findIndex((mv) => mv.type === primaryType);
    if (primaryIdx > 0) {
      const [mv] = chosen.splice(primaryIdx, 1);
      chosen.unshift(mv);
    }

    // Trim to 4 just in case
    return chosen.slice(0, 4);
  }
  
  private getTypedMove(type: string): string {
    const typeMoves: Record<string, string> = {
      fire: 'Ember',
      water: 'Water Gun',
      grass: 'Vine Whip',
      electric: 'Thunder Shock',
      ice: 'Powder Snow',
      fighting: 'Karate Chop',
      poison: 'Poison Sting',
      ground: 'Mud Slap',
      flying: 'Gust',
      psychic: 'Confusion',
      bug: 'Bug Bite',
      rock: 'Rock Throw',
      ghost: 'Lick',
      dragon: 'Dragon Breath',
      dark: 'Bite',
      steel: 'Metal Claw',
      fairy: 'Fairy Wind',
      normal: 'Scratch'
    };
    return typeMoves[type] || 'Scratch';
  }
  
  private getSecondaryTypedMove(type: string): string {
    const secondaryMoves: Record<string, string> = {
      fire: 'Flame Burst',
      water: 'Bubble',
      grass: 'Razor Leaf',
      electric: 'Spark',
      ice: 'Ice Shard',
      fighting: 'Low Kick',
      poison: 'Acid',
      ground: 'Bulldoze',
      flying: 'Wing Attack',
      psychic: 'Psybeam',
      bug: 'Fury Cutter',
      rock: 'Rock Blast',
      ghost: 'Shadow Sneak',
      dragon: 'Twister',
      dark: 'Feint Attack',
      steel: 'Iron Defense',
      fairy: 'Draining Kiss',
      normal: 'Body Slam'
    };
    return secondaryMoves[type] || 'Body Slam';
  }

  private getMoveTypeColor(type: string): string {
    const colors: Record<string, string> = {
      normal: '#A8A878',
      fire: '#F08030',
      water: '#6890F0',
      grass: '#78C850',
      electric: '#F8D030',
      ice: '#98D8D8',
      fighting: '#C03028',
      poison: '#A040A0',
      ground: '#E0C068',
      flying: '#A890F0',
      psychic: '#F85888',
      bug: '#A8B820',
      rock: '#B8A038',
      ghost: '#705898',
      dragon: '#7038F8',
      dark: '#705848',
      steel: '#B8B8D0',
      fairy: '#EE99AC'
    };
    return colors[type] || colors.normal;
  }

  private useMove(move: any) {
    if (this.battleInProgress) return;
    this.battleInProgress = true;
    this.isPlayerTurn = false;
    
    // Get move data
    const moveData = getMoveData(move.name);
const playerAttack = this.getStatValue(this.playerPokemon.data, moveData.category === 'physical' ? 'attack' : 'special-attack', this.playerPokemon.level);
    const wildDefense = this.getStatValue(this.wildPokemon.data, moveData.category === 'physical' ? 'defense' : 'special-defense', this.wildLevel);
    
    // Get Pokemon types
    const wildTypes = (this.wildPokemon.data?.types || []).map((t: any) => t.type.name) as PokemonType[];
    
// Calculate damage with type effectiveness + STAB
    const playerTypes = (this.playerPokemon.data?.types || []).map((t: any) => t.type.name) as PokemonType[];
    const damageResult = calculateDamage(
      this.playerPokemon.level,
      moveData.power,
      playerAttack,
      wildDefense,
      moveData.type as PokemonType,
      wildTypes,
      playerTypes
    );
    
    const damage = damageResult.damage;
    this.wildHp = Math.max(0, this.wildHp - damage);
    
    // Update battle text
    let battleMsg = `${this.capitalize(this.playerPokemon.name)} used ${moveData.name}!`;
    this.updateBattleText(battleMsg);
    
    // Show floating damage text on wild Pokemon
    this.time.delayedCall(500, () => {
      this.showFloatingText(`-${damage} HP`, this.wildSprite!.x, this.wildSprite!.y - 30, '#ff4444');
      
      if (damageResult.effectivenessText) {
        this.time.delayedCall(300, () => {
          this.showFloatingText(damageResult.effectivenessText!, this.wildSprite!.x, this.wildSprite!.y - 50, '#ffff00');
        });
      }
    });
    
    this.updateHpBars();
    
    if (this.wildHp <= 0) {
      this.time.delayedCall(2000, () => {
        this.battleInProgress = false;
        this.wildDefeated();
      });
    } else {
      this.time.delayedCall(2000, () => {
        this.battleInProgress = false;
        this.wildAttack();
      });
    }
  }
  
  private switchPokemon(newPokemon: any) {
    if (this.battleInProgress) return;
    this.battleInProgress = true;
    
    // Save current Pokemon's HP before switching
    this.battleTeamHp.set(this.playerPokemon.pokeId, this.playerHp);
    
    // Get new Pokemon's current HP from battle tracking
    const newCurrentHp = this.battleTeamHp.get(newPokemon.id) || newPokemon.maxHp;
    
    // Update player Pokemon
    this.playerPokemon = {
      name: newPokemon.name,
      pokeId: newPokemon.id,
      data: newPokemon.data,
      spriteUrl: newPokemon.sprite,
      level: newPokemon.level || 1,
      currentHp: newCurrentHp,
      maxHp: newPokemon.maxHp,
    };
    
    this.playerHp = newCurrentHp;
    this.playerMaxHp = this.playerPokemon.maxHp;
    
    // Update sprite
    if (this.playerSprite) {
      this.playerSprite.setTexture(`player-${newPokemon.id}`);
    }
    
    this.updateBattleText(`Go, ${this.capitalize(newPokemon.name)}!`);
    this.updateHpBars();
    
    // Wild Pokemon attacks after switch
    this.time.delayedCall(2000, () => {
      this.battleInProgress = false;
      this.wildAttack();
    });
  }

  private playerAttack() {
const playerAttack = this.getStatValue(this.playerPokemon.data, 'attack', this.playerPokemon.level);
    const wildDefense = this.getStatValue(this.wildPokemon.data, 'defense', this.wildLevel);
    
    const baseDamage = Math.max(1, playerAttack - wildDefense);
    const damage = Math.floor(baseDamage * (0.8 + Math.random() * 0.4)); // 0.8-1.2 multiplier
    
    this.wildHp = Math.max(0, this.wildHp - damage);
    this.updateBattleText(`${this.capitalize(this.playerPokemon.name)} attacks! Dealt ${damage} damage!`);
    
    this.updateHpBars();
    
    if (this.wildHp <= 0) {
      this.wildDefeated();
    } else {
      this.time.delayedCall(1500, () => this.wildAttack());
    }
  }

  private wildAttack() {
    if (this.battleInProgress) return;
    this.battleInProgress = true;
    
    // Pick a random move type based on wild Pokemon's types
    const wildTypes = (this.wildPokemon.data?.types || []).map((t: any) => t.type.name);
    const attackType = (wildTypes[0] || 'normal') as PokemonType;
const movePower = 35; // Base move power for wild Pokemon (toned down)
    
const wildAttack = this.getStatValue(this.wildPokemon.data, 'attack', this.wildLevel);
    const playerDefense = this.getStatValue(this.playerPokemon.data, 'defense', this.playerPokemon.level);
    
    // Get player Pokemon types
    const playerTypes = (this.playerPokemon.data?.types || []).map((t: any) => t.type.name) as PokemonType[];
    
// Squirtle defensive buff
    const effectivePlayerDefense = (this.playerPokemon.pokeId === 7)
      ? Math.floor(playerDefense * 1.25)
      : playerDefense;

    // Calculate damage with type effectiveness + STAB
    const wildTypesForStab = (this.wildPokemon.data?.types || []).map((t: any) => t.type.name) as PokemonType[];
    const damageResult = calculateDamage(
      this.wildLevel,
      movePower,
      wildAttack,
      effectivePlayerDefense,
      attackType,
      playerTypes,
      wildTypesForStab
    );
    
    const damage = damageResult.damage;
    this.playerHp = Math.max(0, this.playerHp - damage);
    
    this.updateBattleText(`Wild ${this.capitalize(this.wildPokemon.name)} attacks!`);
    
    // Show floating damage text on player Pokemon
    this.time.delayedCall(500, () => {
      this.showFloatingText(`-${damage} HP`, this.playerSprite!.x, this.playerSprite!.y - 30, '#ff4444');
      
      if (damageResult.effectivenessText) {
        this.time.delayedCall(300, () => {
          this.showFloatingText(damageResult.effectivenessText!, this.playerSprite!.x, this.playerSprite!.y - 50, '#ffff00');
        });
      }
    });
    
    this.updateHpBars();
    
    if (this.playerHp <= 0) {
      this.time.delayedCall(2000, () => {
        this.battleInProgress = false;
        this.playerDefeated();
      });
    } else {
      this.time.delayedCall(1500, () => {
        this.battleInProgress = false;
        this.isPlayerTurn = true;
      });
    }
  }
  
  private showFloatingText(text: string, x: number, y: number, color: string) {
    const floatingText = this.add.text(x, y, text, {
      fontSize: '20px',
      color: color,
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(2000);
    
    this.floatingTexts.push(floatingText);
    
    // Animate floating text
    this.tweens.add({
      targets: floatingText,
      y: y - 50,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        floatingText.destroy();
        const index = this.floatingTexts.indexOf(floatingText);
        if (index > -1) this.floatingTexts.splice(index, 1);
      }
    });
  }

  private attemptCatch() {
    // Only allow catching if wild Pokemon HP < 10%
    const hpPercent = this.wildHp / this.wildMaxHp;
    if (hpPercent >= 0.10) {
      this.showToast(`The wild ${this.capitalize(this.wildPokemon.name)} is too strong to catch! Weaken it first (HP < 10%)`, 3000);
      return;
    }
    
    // Show Pokeball selection UI
    this.showPokeballSelection();
  }
  
  private showPokeballSelection() {
    if (!this.isPlayerTurn || this.battleInProgress) return;
    
    // Hide main action buttons
    if (this.actionButtons) this.actionButtons.setVisible(false);
    
    const { width, height } = this.scale;
    
    // Create Pokeball selection container
    const pokeballContainer = this.add.container(0, 0);
    
    // Background
    const panelW = 300; const panelH = 200;
    const ballBg = this.add.rectangle(width / 2 - panelW / 2, height / 2 - panelH / 2, panelW, panelH, 0x222222, 0.95).setOrigin(0);
    pokeballContainer.add(ballBg);
    
    const title = this.add.text(width / 2, height / 2 - panelH / 2 + 20, 'Choose Pokeball', {
      fontSize: '18px',
      color: '#fff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    pokeballContainer.add(title);
    
    // Pokeball types with different catch rates
    const pokeballs = [
      { name: 'Poke Ball', catchBonus: 1.0, color: '#ff4444' },
      { name: 'Great Ball', catchBonus: 1.5, color: '#4444ff' },
      { name: 'Ultra Ball', catchBonus: 2.0, color: '#ffff00' },
    ];
    
    pokeballs.forEach((ball, index) => {
      const y = height / 2 - panelH / 2 + 60 + index * 40;
      
      const ballButton = this.add.text(width / 2 - 100, y, ball.name, {
        fontSize: '16px',
        color: '#fff',
        backgroundColor: ball.color,
        padding: { x: 15, y: 8 }
      }).setOrigin(0).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          pokeballContainer.destroy();
          if (this.actionButtons) this.actionButtons.setVisible(true);
          this.performCatch(ball.catchBonus);
        });
      
      pokeballContainer.add(ballButton);
    });
    
    // Back button
    const backButton = this.add.text(width / 2, height / 2 + panelH / 2 - 20, 'BACK', {
      fontSize: '14px',
      color: '#fff',
      backgroundColor: '#666',
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        pokeballContainer.destroy();
        if (this.actionButtons) this.actionButtons.setVisible(true);
      });
    
    pokeballContainer.add(backButton);
    pokeballContainer.setDepth(1001);
    this.battleUI?.add(pokeballContainer);
  }
  
  private async performCatch(catchBonus: number = 1.0) {
    const baseCatchRate = this.wildHp < (this.wildMaxHp * 0.2) ? 0.8 : 0.3; // Higher rate if HP < 20%
    const catchRate = Math.min(0.95, baseCatchRate * catchBonus); // Cap at 95%
    
    if (Math.random() < catchRate) {
      this.updateBattleText(`Gotcha! ${this.capitalize(this.wildPokemon.name)} was caught!`);
      
      // Mint NFT on blockchain
      await this.mintCaughtPokemonNFT();

      // Save caught pokemon via battleResult endpoint
      try {
        const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
        if (wallet) {
          const caught = {
            pokeId: this.wildPokemon.pokeId,
            name: this.wildPokemon.name,
            level: this.wildLevel,
            hp: this.wildMaxHp,
attack: this.getStatValue(this.wildPokemon.data, 'attack', this.wildLevel),
            defense: this.getStatValue(this.wildPokemon.data, 'defense', this.wildLevel),
            moves: (this.wildPokemon.data?.moves || []).slice(0, 4).map((m: any) => m.move?.name?.replace(/-/g, ' ')).filter(Boolean),
            rarity: this.determineRarity(this.wildPokemon.data),
            image_url: this.wildPokemon.spriteUrl,
            caughtAt: new Date(),
          };
          
          // Sync with backend
          await fetch('/api/trainer/battleResult', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-wallet-address': wallet },
            body: JSON.stringify({
              walletAddress: wallet,
              outcome: 'caught',
              xpGained: this.wildLevel * 5, // Also award XP for catching
              caughtPokemon: caught,
            })
          });
          
          // Add to local team cache
          this.playerTeam.push({
            id: this.wildPokemon.pokeId,
            name: this.wildPokemon.name,
            data: this.wildPokemon.data,
            sprite: this.wildPokemon.spriteUrl,
            level: this.wildLevel,
            maxHp: this.wildMaxHp,
          });
        }
      } catch (error) {
        console.error('Failed to save caught Pokemon:', error);
      }
      
      this.time.delayedCall(2000, () => this.endBattle(true));
    } else {
      this.updateBattleText(`${this.capitalize(this.wildPokemon.name)} broke free!`);
      this.time.delayedCall(1500, () => this.wildAttack());
    }
  }

  private async mintCaughtPokemonNFT() {
    try {
      // Get wallet address from localStorage or wallet manager
      const walletAddress = this.getWalletAddress();
      
      if (!walletAddress) {
        console.warn('No wallet connected. Pokemon caught but not minted as NFT.');
        return;
      }

      this.updateBattleText('Minting your NFT on blockchain...');

      // Determine rarity based on stats
      const rarity = this.determineRarity(this.wildPokemon.data);
      const isLegendary = this.checkIfLegendary(this.wildPokemon.pokeId);

      const pokemonData = {
        name: this.wildPokemon.name,
        pokeId: this.wildPokemon.pokeId,
        rarity,
        level: 1,
        isLegendary,
        stats: this.wildPokemon.data.stats,
        types: this.wildPokemon.data.types,
        imageUrl: this.wildPokemon.spriteUrl,
        ...this.wildPokemon.data
      };

      const response = await fetch('/api/mint/pokemon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({
          walletAddress,
          pokemon: pokemonData
        })
      });

      const result = await response.json();

      if (result.success) {
        this.updateBattleText(
          `✅ ${this.capitalize(this.wildPokemon.name)} minted as NFT #${result.nft.assetId}!\nTx: ${result.nft.txId.substring(0, 10)}...`
        );
        
        // Show popup with transaction details
        this.showNFTMintedPopup(result.nft);
      } else {
        console.error('Failed to mint NFT:', result.error);
        this.updateBattleText(`Caught ${this.capitalize(this.wildPokemon.name)}! (NFT minting failed)`);
      }

    } catch (error) {
      console.error('Error minting NFT:', error);
      this.updateBattleText(`Caught ${this.capitalize(this.wildPokemon.name)}!`);
    }
  }

  private showNFTMintedPopup(nft: any) {
    const { width, height } = this.scale;
    
    // Create popup container
    const popup = this.add.container(width / 2, height / 2);
    
    // Background
    const bg = this.add.rectangle(0, 0, 400, 250, 0x000000, 0.9);
    const border = this.add.rectangle(0, 0, 400, 250, 0xffd700).setStrokeStyle(4, 0xffd700);
    
    // Title
    const title = this.add.text(0, -90, '🎉 NFT Minted!', {
      fontSize: '24px',
      color: '#ffd700',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Pokemon name
    const pokemonName = this.add.text(0, -50, `${this.capitalize(nft.name)}`, {
      fontSize: '20px',
      color: '#fff'
    }).setOrigin(0.5);
    
    // Asset ID
    const assetIdText = this.add.text(0, -20, `Asset ID: ${nft.assetId}`, {
      fontSize: '14px',
      color: '#aaa'
    }).setOrigin(0.5);
    
    // Tx hash (shortened)
    const txHashText = this.add.text(0, 5, `Tx: ${nft.txId.substring(0, 20)}...`, {
      fontSize: '12px',
      color: '#888'
    }).setOrigin(0.5);
    
    // Explorer link hint
    const explorerText = this.add.text(0, 30, 'View on AlgoExplorer (TestNet)', {
      fontSize: '12px',
      color: '#4da6ff',
      fontStyle: 'italic'
    }).setOrigin(0.5);
    
    // Rarity badge
    const rarityBadge = this.add.text(0, 60, `⭐ ${nft.rarity || 'Common'}`, {
      fontSize: '14px',
      color: '#ffd700',
      backgroundColor: '#333',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);
    
    // OK button
    const okButton = this.add.text(0, 100, 'OK', {
      fontSize: '18px',
      color: '#fff',
      backgroundColor: '#4CAF50',
      padding: { x: 30, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        popup.destroy();
      });
    
    popup.add([bg, border, title, pokemonName, assetIdText, txHashText, explorerText, rarityBadge, okButton]);
    popup.setDepth(1000);
    
    // Auto-dismiss after 10 seconds
    this.time.delayedCall(10000, () => {
      if (popup.scene) popup.destroy();
    });
  }

  private determineRarity(pokemonData: any): string {
    const totalStats = pokemonData.stats?.reduce((sum: number, stat: any) => sum + stat.base_stat, 0) || 0;
    
    if (totalStats > 600) return 'Legendary';
    if (totalStats > 500) return 'Rare';
    if (totalStats > 400) return 'Uncommon';
    return 'Common';
  }

  private checkIfLegendary(pokeId: number): boolean {
    const legendaryIds = [
      150, // Mewtwo
      144, 145, 146, // Legendary Birds
      243, 244, 245, // Legendary Beasts
      249, 250, // Ho-Oh, Lugia
      382, 383, 384, // Hoenn legends
      480, 481, 482, // Lake Trio
      483, 484, 487, // Dialga, Palkia, Giratina
    ];
    return legendaryIds.includes(pokeId);
  }

  private getWalletAddress(): string | null {
    // Try to get from wallet manager
    if (typeof window !== 'undefined') {
      const storedAddress = localStorage.getItem('algorand_wallet_address');
      return storedAddress;
    }
    return null;
  }

  private getUserId(): string | null {
    // Get user ID from session/auth
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_id') || 'demo_user';
    }
    return null;
  }

  private openBag() {
    this.updateBattleText("You rummage through your bag...");
    // TODO: Implement bag/item usage
    this.time.delayedCall(1000, () => this.wildAttack());
  }

  private async runAway() {
    this.updateBattleText("You ran away! (5% XP penalty)");
    
    // Apply 5% XP penalty
    try {
      const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
      if (wallet) {
        const currentXP = parseInt(localStorage.getItem('trainer_exp') || '0');
        const penalty = Math.floor(currentXP * 0.05);
        const newXP = Math.max(0, currentXP - penalty);
        
        localStorage.setItem('trainer_exp', String(newXP));
        
        // Sync with backend
        await fetch('/api/trainer/battleResult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-wallet-address': wallet },
          body: JSON.stringify({
            walletAddress: wallet,
            outcome: 'run',
            xpGained: -penalty,
          })
        });
        
        window.dispatchEvent(new CustomEvent('trainer-xp-update', { detail: { newXP } }));
      }
    } catch {}
    
    this.time.delayedCall(1500, () => this.endBattle(false));
  }

  private async wildDefeated() {
    // Gym battle hook: victory event
    if (this.gymId && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('yokai-gym-battle-win', { detail: { gymId: this.gymId } }));
    }
    // Calculate EXP: enemyLevel * 5 (as per spec)
    const expGained = this.wildLevel * 5;
    this.updateBattleText(`Wild ${this.capitalize(this.wildPokemon.name)} fainted! Gained ${expGained} EXP!`);

    // Update trainer XP and check for level up
    try {
      const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
      if (wallet) {
        const currentLevel = parseInt(localStorage.getItem('trainer_level') || '1');
        
        // Sync with backend using battleResult endpoint
        const response = await fetch('/api/trainer/battleResult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-wallet-address': wallet },
          body: JSON.stringify({
            walletAddress: wallet,
            outcome: 'win',
            xpGained: expGained,
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          const newLevel = data.trainer?.level || currentLevel;
          const newXP = data.trainer?.xp || 0;
          
          localStorage.setItem('trainer_exp', String(newXP));
          localStorage.setItem('trainer_level', String(newLevel));
          
          // Show level up animation if leveled up
          if (data.leveledUp) {
            this.time.delayedCall(1500, () => {
              this.showLevelUpAnimation(newLevel);
            });
          }
          
          window.dispatchEvent(new CustomEvent('trainer-xp-update', { detail: { newXP, newLevel } }));
        }
      }
    } catch (error) {
      console.error('Failed to sync XP:', error);
    }

    this.time.delayedCall(3000, () => this.endBattle(true));
  }

  private playerDefeated() {
    this.updateBattleText(`${this.capitalize(this.playerPokemon.name)} fainted! You lost the battle!`);
    this.time.delayedCall(3000, () => this.endBattle(false));
  }

  private endBattle(victory: boolean) {
    // Stop BattleScene and resume GameScene
    this.scene.stop();
    this.scene.resume("GameScene");
  }

  private updateHpBars() {
    if (this.wildHpBar && this.wildHpText) {
      const wildHpPercent = this.wildHp / this.wildMaxHp;
      this.wildHpBar.width = 196 * wildHpPercent;
      this.wildHpBar.fillColor = wildHpPercent > 0.5 ? 0x00ff00 : wildHpPercent > 0.2 ? 0xffff00 : 0xff0000;
      this.wildHpText.setText(`${this.capitalize(this.wildPokemon.name)} HP: ${this.wildHp}/${this.wildMaxHp}`);
    }
    
    if (this.playerHpBar && this.playerHpText) {
      const playerHpPercent = this.playerHp / this.playerMaxHp;
      this.playerHpBar.width = 196 * playerHpPercent;
      this.playerHpBar.fillColor = playerHpPercent > 0.5 ? 0x00ff00 : playerHpPercent > 0.2 ? 0xffff00 : 0xff0000;
      this.playerHpText.setText(`${this.capitalize(this.playerPokemon.name)} Lv.${this.playerPokemon.level} HP: ${this.playerHp}/${this.playerMaxHp}`);
    }
  }

  private updateBattleText(text: string) {
    if (!this.battleText) return;
    this.battleText.setText(text);
    this.battleText.setVisible(true);
    this.time.delayedCall(3000, () => {
      if (this.battleText) this.battleText.setVisible(false);
    });
  }

  private showToast(text: string, duration: number = 2000) {
    if (!this.battleText) return;
    this.battleText.setText(text);
    this.battleText.setVisible(true);
    this.time.delayedCall(duration, () => {
      if (this.battleText) this.battleText.setVisible(false);
    });
  }

  private async loadTrainerTeam() {
    try {
      const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
      if (!wallet) return;
      const res = await fetch(`/api/trainer/load/${encodeURIComponent(wallet)}`, { headers: { 'x-wallet-address': wallet } });
      if (!res.ok) return;
      const data = await res.json();
      const trainer = data?.trainer;
      
      // Load Pokemon with proper data from PokeAPI
      const fromStorage = await Promise.all(
        (trainer?.storage || []).slice(0, 6).map(async (p: any) => {
          const pokeId = p.pokeId || p.id;
          if (!pokeId) return null;
          
          // Fetch Pokemon data from PokeAPI
          let pokemonData = null;
          try {
            const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokeId}`);
            if (pokeRes.ok) pokemonData = await pokeRes.json();
          } catch {}
          
          return {
            id: pokeId,
            name: p.name,
            data: pokemonData, // Full PokeAPI data for moves/types
            sprite: p.image_url || pokemonData?.sprites?.back_default || this.playerPokemon.spriteUrl,
            level: p.level || 1,
            maxHp: p.hp || 50,
          };
        })
      );
      
      const validTeam = fromStorage.filter((p): p is NonNullable<typeof p> => p !== null);
      if (validTeam.length) this.playerTeam = validTeam;
    } catch {}
  }

private getStatValue(pokemonData: any, statName: string, level: number = 1): number {
    const base = pokemonData?.stats?.find((s: any) => s.stat.name === statName)?.base_stat;
    const b = typeof base === 'number' ? base : 50;
    // Include IV ~31 and scale by level: floor(((2*base + 31) * L) / 100) + 5
    return Math.max(1, Math.floor(((2 * b + 31) * level) / 100) + 5);
  }

  private showLevelUpAnimation(newLevel: number) {
    const { width, height } = this.scale;
    
    // Create level up overlay
    const overlay = this.add.container(width / 2, height / 2);
    
    // Background
    const bg = this.add.rectangle(0, 0, 400, 200, 0x000000, 0.85);
    const border = this.add.rectangle(0, 0, 400, 200).setStrokeStyle(4, 0xffd700);
    
    // "Level Up!" text
    const titleText = this.add.text(0, -50, '🎉 LEVEL UP! 🎉', {
      fontSize: '32px',
      color: '#ffd700',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // New level text
    const levelText = this.add.text(0, 10, `Level ${newLevel}`, {
      fontSize: '24px',
      color: '#fff'
    }).setOrigin(0.5);
    
    // Congratulations message
    const congrats = this.add.text(0, 50, 'You are getting stronger!', {
      fontSize: '16px',
      color: '#aaa',
      fontStyle: 'italic'
    }).setOrigin(0.5);
    
    overlay.add([bg, border, titleText, levelText, congrats]);
    overlay.setDepth(2000);
    overlay.setAlpha(0);
    
    // Animate in
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 500,
      ease: 'Back.easeOut'
    });
    
    // Pulse animation
    this.tweens.add({
      targets: titleText,
      scale: { from: 1, to: 1.2 },
      duration: 600,
      yoyo: true,
      repeat: 2
    });
    
    // Auto dismiss after 3 seconds
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 300,
        onComplete: () => overlay.destroy()
      });
    });
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
