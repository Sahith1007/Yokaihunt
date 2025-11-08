export interface XPUpdateEvent {
  oldXP: number;
  newXP: number;
  oldLevel: number;
  newLevel: number;
  currentXP: number;
  nextLevelXP: number;
  xpGained: number;
  leveledUp: boolean;
}

export class XPManager {
  private static listeners: Set<(event: XPUpdateEvent) => void> = new Set();
  private currentXP: number = 0;
  private currentLevel: number = 1;

  constructor(initialXP: number = 0) {
    const levelData = XPManager.levelFromXP(initialXP);
    this.currentXP = initialXP;
    this.currentLevel = levelData.level;
  }

  static trainerAward({ base = 0, attempt = false, success = false }) {
    let xp = base + (attempt ? 5 : 0) + (success ? 25 : 0);
    return xp;
  }

  static levelFromXP(totalXP: number) {
    let lv = 1; 
    let rem = Math.max(0, Math.floor(totalXP));
    while (rem >= (100 * Math.pow(lv, 2)) && lv < 50) { 
      rem -= 100 * Math.pow(lv, 2); 
      lv += 1; 
    }
    return { level: lv, currentXP: rem, nextLevelXP: 100 * Math.pow(lv, 2) };
  }

  addXP(amount: number): XPUpdateEvent {
    const oldXP = this.currentXP;
    const oldLevel = this.currentLevel;
    
    this.currentXP += amount;
    const levelData = XPManager.levelFromXP(this.currentXP);
    const newLevel = levelData.level;
    const leveledUp = newLevel > oldLevel;
    
    this.currentLevel = newLevel;
    
    const event: XPUpdateEvent = {
      oldXP,
      newXP: this.currentXP,
      oldLevel,
      newLevel,
      currentXP: levelData.currentXP,
      nextLevelXP: levelData.nextLevelXP,
      xpGained: amount,
      leveledUp
    };
    
    // Notify listeners
    this.notifyListeners(event);
    
    return event;
  }

  getCurrentXP(): number {
    return this.currentXP;
  }

  getCurrentLevel(): number {
    return this.currentLevel;
  }

  getLevelData() {
    return XPManager.levelFromXP(this.currentXP);
  }

  setXP(totalXP: number) {
    const levelData = XPManager.levelFromXP(totalXP);
    this.currentXP = totalXP;
    this.currentLevel = levelData.level;
  }

  static onXPUpdate(callback: (event: XPUpdateEvent) => void): () => void {
    XPManager.listeners.add(callback);
    return () => XPManager.listeners.delete(callback);
  }

  private notifyListeners(event: XPUpdateEvent) {
    XPManager.listeners.forEach(cb => {
      try {
        cb(event);
      } catch {}
    });
    
    // Also dispatch global event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('yokai-xp-update', { detail: event }));
    }
  }
}
