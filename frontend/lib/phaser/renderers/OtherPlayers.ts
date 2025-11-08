// frontend/lib/phaser/renderers/OtherPlayers.ts

export default class OtherPlayers {
  private scene: Phaser.Scene;
  private sprites: any = {};
  private myWallet?: string;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    if (typeof window !== 'undefined') {
      this.myWallet = localStorage.getItem('algorand_wallet_address') || undefined;
    }
  }

  updatePlayers(data: Record<string, any>) {
    for (const wallet in data) {
      // Skip self
      if (wallet === this.myWallet) continue;
      
      const p = data[wallet];

      if (!this.sprites[wallet]) {
        this.sprites[wallet] = this.scene.add.sprite(p.x, p.y, "player");
        this.sprites[wallet].setTint(0x4a90e2); // Blue tint for other players
        this.sprites[wallet].setScale(0.75); // Smaller than player
        this.sprites[wallet].setDepth(9);
      }

      const sprite = this.sprites[wallet];

      // Interpolate movement (0.2 smoothing)
      sprite.x += (p.x - sprite.x) * 0.2;
      sprite.y += (p.y - sprite.y) * 0.2;
    }

    // Remove disconnected players
    for (const w in this.sprites) {
      if (!data[w] || w === this.myWallet) {
        this.sprites[w].destroy();
        delete this.sprites[w];
      }
    }
  }

  destroy() {
    for (const w in this.sprites) {
      if (this.sprites[w]) {
        this.sprites[w].destroy();
      }
    }
    this.sprites = {};
  }
}

