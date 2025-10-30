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

  constructor() {
    super("BattleScene");
  }

  init(data: BattleData) {
    this.wildPokemon = data.wildPokemon;
    this.playerPokemon = data.playerPokemon;
    this.playerTeam = data.playerTeam || [];
    this.trainerLevel = data.trainerLevel || 1;
    
    // Calculate wild Pokemon HP with level scaling
    this.wildLevel = this.wildPokemon.level || 5;
    const wildHpStat = this.wildPokemon.data?.stats?.find((s: any) => s.stat.name === 'hp')?.base_stat || 50;
    this.wildMaxHp = Math.floor((wildHpStat * 2 * this.wildLevel) / 100 + this.wildLevel + 10);
    this.wildHp = this.wildMaxHp;
    
    this.playerMaxHp = this.playerPokemon.maxHp;
    this.playerHp = this.playerPokemon.currentHp;
    
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
      { text: 'FIGHT', x: width - 250, y: height - 120, action: () => this.showMoveSelection() },
      { text: 'SWITCH', x: width - 190, y: height - 120, action: () => this.showTeamSelection() },
      { text: 'BAG', x: width - 130, y: height - 120, action: () => this.openBag() },
      { text: 'CATCH', x: width - 80, y: height - 120, action: () => this.attemptCatch() },
      { text: 'RUN', x: width - 30, y: height - 120, action: () => this.runAway() }
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
  
  private showTeamSelection() {
    if (!this.isPlayerTurn || this.battleInProgress || this.playerTeam.length === 0) return;
    
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
      const currentHp = pokemon.currentHp || pokemon.maxHp || 100;
      const maxHp = pokemon.maxHp || 100;
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
    if (this.battleInProgress) return;
    this.battleInProgress = true;
    this.isPlayerTurn = false;
    
    // Get move data
    const moveData = getMoveData(move.name);
    const playerAttack = this.getStatValue(this.playerPokemon.data, moveData.category === 'physical' ? 'attack' : 'special-attack');
    const wildDefense = this.getStatValue(this.wildPokemon.data, moveData.category === 'physical' ? 'defense' : 'special-defense');
    
    // Get Pokemon types
    const wildTypes = (this.wildPokemon.data?.types || []).map((t: any) => t.type.name) as PokemonType[];
    
    // Calculate damage with type effectiveness
    const damageResult = calculateDamage(
      this.playerPokemon.level,
      moveData.power,
      playerAttack,
      wildDefense,
      moveData.type as PokemonType,
      wildTypes
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
    
    // Update player Pokemon
    this.playerPokemon = {
      name: newPokemon.name,
      pokeId: newPokemon.id,
      data: newPokemon.data,
      spriteUrl: newPokemon.sprite,
      level: newPokemon.level || 1,
      currentHp: newPokemon.currentHp || newPokemon.maxHp,
      maxHp: newPokemon.maxHp,
    };
    
    this.playerHp = this.playerPokemon.currentHp;
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
    if (this.battleInProgress) return;
    this.battleInProgress = true;
    
    // Pick a random move type based on wild Pokemon's types
    const wildTypes = (this.wildPokemon.data?.types || []).map((t: any) => t.type.name);
    const attackType = (wildTypes[0] || 'normal') as PokemonType;
    const movePower = 50; // Base move power for wild Pokemon
    
    const wildAttack = this.getStatValue(this.wildPokemon.data, 'attack');
    const playerDefense = this.getStatValue(this.playerPokemon.data, 'defense');
    
    // Get player Pokemon types
    const playerTypes = (this.playerPokemon.data?.types || []).map((t: any) => t.type.name) as PokemonType[];
    
    // Calculate damage with type effectiveness
    const damageResult = calculateDamage(
      this.wildLevel,
      movePower,
      wildAttack,
      playerDefense,
      attackType,
      playerTypes
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

  private async attemptCatch() {
    const catchRate = this.wildHp < (this.wildMaxHp * 0.2) ? 0.8 : 0.3; // Higher rate if HP < 20%
    
    if (Math.random() < catchRate) {
      this.updateBattleText(`Gotcha! ${this.capitalize(this.wildPokemon.name)} was caught!`);
      
      // Mint NFT on blockchain
      await this.mintCaughtPokemonNFT();

      // Save caught pokemon to trainer storage
      try {
        const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
        if (wallet) {
          const { saveTrainer } = await import('../../src/services/trainer');
          const caught = {
            name: this.wildPokemon.name,
            level: this.wildLevel,
            hp: this.wildMaxHp,
            attack: this.getStatValue(this.wildPokemon.data, 'attack'),
            defense: this.getStatValue(this.wildPokemon.data, 'defense'),
            moves: (this.wildPokemon.data?.moves || []).slice(0, 4).map((m: any) => m.move?.name?.replace(/-/g, ' ')).filter(Boolean),
            rarity: this.determineRarity(this.wildPokemon.data),
            caughtAt: new Date(),
          };
          await saveTrainer({ walletAddress: wallet, storageAppend: [caught] });
        }
      } catch {}
      
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

  private runAway() {
    this.updateBattleText("You ran away safely!");
    this.time.delayedCall(1500, () => this.endBattle(false));
  }

  private async wildDefeated() {
    // Calculate EXP based on wild Pokemon level and base stats
    const baseExp = this.wildPokemon.data?.base_experience || 50;
    const expGained = 10 + (this.wildLevel * 2);
    this.updateBattleText(`Wild ${this.capitalize(this.wildPokemon.name)} fainted! ${this.capitalize(this.playerPokemon.name)} gained ${expGained} EXP!`);

    // Update local cache and backend XP sync
    try {
      const wallet = typeof window !== 'undefined' ? localStorage.getItem('algorand_wallet_address') : null;
      if (wallet) {
        const cur = parseInt(localStorage.getItem('trainer_exp') || '0');
        const newTotal = cur + expGained;
        localStorage.setItem('trainer_exp', String(newTotal));
        const { xpSync } = await import('../../src/services/trainer');
        await xpSync({ walletAddress: wallet, newXP: newTotal });
        window.dispatchEvent(new CustomEvent('trainer-xp-update', { detail: { newXP: newTotal } }));
      }
    } catch {}

    // 25% auto-catch chance
    if (Math.random() < 0.25) {
      await this.attemptCatch();
    }

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