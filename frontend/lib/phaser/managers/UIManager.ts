export class UIManager {
  private scene: Phaser.Scene;
  private toast?: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene) { this.scene = scene; }

  toastTop(message: string, time = 3000) {
    if (this.toast) { 
      this.toast.destroy(); 
      this.toast = undefined; 
    }
    
    const t = this.scene.add.text(
      this.scene.scale.width / 2, 
      -30, // Start above screen
      message, 
      { 
        fontSize: '14px', 
        color: '#fff', 
        backgroundColor: '#000000aa', 
        padding: { x: 12, y: 6 },
        fontStyle: 'bold'
      }
    )
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setDepth(3000);
    
    this.toast = t;
    
    // Fade in animation
    this.scene.tweens.add({
      targets: t,
      y: 8,
      alpha: 1,
      duration: 300,
      ease: 'Power2'
    });
    
    // Fade out and destroy
    this.scene.time.delayedCall(time, () => {
      if (t.scene) {
        this.scene.tweens.add({
          targets: t,
          y: -30,
          alpha: 0,
          duration: 300,
          ease: 'Power2',
          onComplete: () => {
            t.destroy();
            if (this.toast === t) this.toast = undefined;
          }
        });
      }
    });
  }
  
  showToast(message: string, time = 3000) {
    this.toastTop(message, time);
  }
}
