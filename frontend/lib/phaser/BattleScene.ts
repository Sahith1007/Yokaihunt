import * as Phaser from "phaser";

interface BattleData {
  wildPokemon: {
    name: string;
    pokeId: number;
    data: any;
    spriteUrl: string;
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
}

export class BattleScene extends Phaser.Scene {
  private wildPokemon!: BattleData["wildPokemon"];
  private playerPokemon!: BattleData["playerPokemon"];
  private wildSprite?: Phaser.GameObjects.Image;
  private playerSprite?: Phaser.GameObjects.Image;
  private wildHp: number = 0;
  private wildMaxHp: number = 0;
  private playerHp: number = 0;
  private playerMaxHp: number = 0;
  
  // UI Elements
  private battleUI?: Phaser.GameObjects.Container;
  private wildHpBar?: Phaser.GameObjects.Rectangle;
  private playerHpBar?: Phaser.GameObjects.Rectangle;
  private wildHpText?: Phaser.GameObjects.Text;
  private playerHpText?: Phaser.GameObjects.Text;
  private battleText?: Phaser.GameObjects.Text;
  private actionButtons?: Phaser.GameObjects.Container;

  constructor() {
    super("BattleScene");
  }

  init(data: BattleData) {
    this.wildPokemon = data.wildPokemon;
    this.playerPokemon = data.playerPokemon;
    
    // Calculate HP from stats
    const wildHpStat = this.wildPokemon.data?.stats?.find((s: any) => s.stat.name === 'hp')?.base_stat || 50;
    this.wildMaxHp = Math.floor(wildHpStat * 1.5); // Level scaling
    this.wildHp = this.wildMaxHp;
    
    this.playerMaxHp = this.playerPokemon.maxHp;
    this.playerHp = this.playerPokemon.currentHp;
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

    // Wild Pokémon (enemy, top right)
    this.wildSprite = this.add.image(width * 0.75, height * 0.3, `wild-${this.wildPokemon.pokeId}`)
      .setScale(2)
      .setFlipX(false);

    // Player Pokémon (bottom left, back sprite)
    this.playerSprite = this.add.image(width * 0.25, height * 0.65, `player-${this.playerPokemon.pokeId}`)
      .setScale(2)
      .setFlipX(true);

    this.createUI();
    this.updateBattleText(`A wild ${this.capitalize(this.wildPokemon.name)} appeared!`);
    
    // Auto-hide the appearance message after 3 seconds
    this.time.delayedCall(3000, () => {
      this.updateBattleText('What will you do?');
    });
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

    // Battle text area
    const textBg = this.add.rectangle(20, height - 150, width - 40, 100, 0xffffff, 0.9).setOrigin(0);
    this.battleText = this.add.text(30, height - 140, '', {
      fontSize: '16px',
      color: '#000',
      wordWrap: { width: width - 60 }
    });

    // Action buttons
    this.createActionButtons();

    this.battleUI.add([wildHpBg, this.wildHpBar, this.wildHpText, playerHpBg, this.playerHpBar, this.playerHpText, textBg, this.battleText]);
  }

  private createActionButtons() {
    const { width, height } = this.scale;
    
    this.actionButtons = this.add.container(0, 0);
    
    const buttonData = [
      { text: 'FIGHT', x: width - 200, y: height - 40, action: () => this.showMoveSelection() },
      { text: 'BAG', x: width - 150, y: height - 40, action: () => this.openBag() },
      { text: 'CATCH', x: width - 100, y: height - 40, action: () => this.attemptCatch() },
      { text: 'RUN', x: width - 50, y: height - 40, action: () => this.runAway() }
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
    // Hide main action buttons
    if (this.actionButtons) this.actionButtons.setVisible(false);

    const { width, height } = this.scale;
    const moves = this.getPlayerMoves();

    // Create move selection container
    const moveContainer = this.add.container(0, 0);

    // Background for move selection
    const moveBg = this.add.rectangle(width - 320, height - 120, 300, 100, 0x222222, 0.95).setOrigin(0);
    moveContainer.add(moveBg);

    // Display up to 4 moves in a 2x2 grid
    moves.slice(0, 4).forEach((move, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = width - 310 + col * 150;
      const y = height - 110 + row * 45;

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
    const backButton = this.add.text(width - 250, height - 20, 'BACK', {
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

  private getPlayerMoves() {
    // Get moves from Pokemon data
    const moves = this.playerPokemon.data?.moves || [];
    
    // If Pokemon has no moves, provide default moves based on type or generic attacks
    if (moves.length === 0) {
      // Fallback moves if Pokemon has no move data
      const types = this.playerPokemon.data?.types || [];
      const primaryType = types[0]?.type?.name || 'normal';
      
      return [
        { name: 'Tackle', type: 'normal' },
        { name: 'Scratch', type: 'normal' },
        { name: this.getTypedMove(primaryType), type: primaryType },
        { name: 'Quick Attack', type: 'normal' }
      ];
    }
    
    // Filter to get learned moves (simplified - just take first 4)
    return moves.slice(0, 4).map((m: any) => ({
      name: m.move.name.replace(/-/g, ' '),
      url: m.move.url,
      type: 'normal' // Default type, would need to fetch move details for actual type
    }));
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
      normal: 'Tackle'
    };
    return typeMoves[type] || 'Tackle';
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
    const playerAttack = this.getStatValue(this.playerPokemon.data, 'attack');
    const wildDefense = this.getStatValue(this.wildPokemon.data, 'defense');
    
    const baseDamage = Math.max(1, playerAttack - wildDefense);
    const damage = Math.floor(baseDamage * (0.8 + Math.random() * 0.4)); // 0.8-1.2 multiplier
    
    this.wildHp = Math.max(0, this.wildHp - damage);
    this.updateBattleText(`${this.capitalize(this.playerPokemon.name)} used ${move.name}! Dealt ${damage} damage!`);
    
    this.updateHpBars();
    
    if (this.wildHp <= 0) {
      this.wildDefeated();
    } else {
      this.time.delayedCall(1500, () => this.wildAttack());
    }
  }

  private playerAttack() {
    const playerAttack = this.getStatValue(this.playerPokemon.data, 'attack');
    const wildDefense = this.getStatValue(this.wildPokemon.data, 'defense');
    
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
    const wildAttack = this.getStatValue(this.wildPokemon.data, 'attack');
    const playerDefense = this.getStatValue(this.playerPokemon.data, 'defense');
    
    const baseDamage = Math.max(1, wildAttack - playerDefense);
    const damage = Math.floor(baseDamage * (0.8 + Math.random() * 0.4));
    
    this.playerHp = Math.max(0, this.playerHp - damage);
    this.updateBattleText(`Wild ${this.capitalize(this.wildPokemon.name)} attacks! Dealt ${damage} damage!`);
    
    this.updateHpBars();
    
    if (this.playerHp <= 0) {
      this.playerDefeated();
    }
  }

  private attemptCatch() {
    const catchRate = this.wildHp < (this.wildMaxHp * 0.2) ? 0.8 : 0.3; // Higher rate if HP < 20%
    
    if (Math.random() < catchRate) {
      this.updateBattleText(`Gotcha! ${this.capitalize(this.wildPokemon.name)} was caught!`);
      this.time.delayedCall(2000, () => this.endBattle(true));
    } else {
      this.updateBattleText(`${this.capitalize(this.wildPokemon.name)} broke free!`);
      this.time.delayedCall(1500, () => this.wildAttack());
    }
  }

  private openBag() {
    this.updateBattleText("You rummage through your bag...");
    // TODO: Implement bag/item usage
    this.time.delayedCall(1000, () => this.wildAttack());
  }

  private runAway() {
    this.updateBattleText("You ran away safely!");
    this.time.delayedCall(1500, () => this.endBattle(false));
  }

  private wildDefeated() {
    const expGained = Math.floor(this.getStatValue(this.wildPokemon.data, 'attack') * 1.5);
    this.updateBattleText(`Wild ${this.capitalize(this.wildPokemon.name)} fainted! ${this.capitalize(this.playerPokemon.name)} gained ${expGained} EXP!`);
    this.time.delayedCall(3000, () => this.endBattle(true));
  }

  private playerDefeated() {
    this.updateBattleText(`${this.capitalize(this.playerPokemon.name)} fainted! You lost the battle!`);
    this.time.delayedCall(3000, () => this.endBattle(false));
  }

  private endBattle(victory: boolean) {
    // Return to GameScene
    this.scene.start("GameScene");
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
    if (this.battleText) {
      this.battleText.setText(text);
    }
  }

  private getStatValue(pokemonData: any, statName: string): number {
    const stat = pokemonData?.stats?.find((s: any) => s.stat.name === statName);
    return stat?.base_stat || 50;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}