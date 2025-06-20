// Dynamic scaling system for responsive viewport
export class ScaleManager {
  private static instance: ScaleManager;
  private currentPPM: number = 50; // Default fallback

  // Configuration for responsive scaling
  private config = {
    targetRingScreenRatio: 0.75, // Ring diameter should be 75% of smaller screen dimension
    minPPM: 20,  // Minimum pixels per meter (prevents too-small elements)
    maxPPM: 100, // Maximum pixels per meter (prevents too-large elements on huge screens)
    ringPhysicsRadius: 5.5 // The ring's radius in physics units
  };

  static getInstance(): ScaleManager {
    if (!ScaleManager.instance) {
      ScaleManager.instance = new ScaleManager();
    }
    return ScaleManager.instance;
  }

  /**
   * Calculate optimal PPM based on screen dimensions and target ring appearance
   */
  calculateOptimalPPM(screenWidth: number, screenHeight: number): number {
    // Use the smaller dimension to ensure ring fits in both orientations
    const minScreenDimension = Math.min(screenWidth, screenHeight);

    // Calculate target ring diameter in pixels
    const targetRingDiameterPx = minScreenDimension * this.config.targetRingScreenRatio;

    // Calculate required PPM: target pixels / physics diameter
    const physicsRingDiameter = this.config.ringPhysicsRadius * 2;
    const requiredPPM = targetRingDiameterPx / physicsRingDiameter;

    // Clamp to min/max bounds
    return Math.max(this.config.minPPM, Math.min(this.config.maxPPM, requiredPPM));
  }

  /**
   * Update the current PPM and return it
   */
  updatePPM(screenWidth: number, screenHeight: number): number {
    this.currentPPM = this.calculateOptimalPPM(screenWidth, screenHeight);
    return this.currentPPM;
  }

  /**
   * Get current PPM
   */
  getPPM(): number {
    return this.currentPPM;
  }

  /**
   * Get configuration (for debugging/tweaking)
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<typeof this.config>) {
    this.config = { ...this.config, ...newConfig };
  }
}

// Singleton instance
const scaleManager = ScaleManager.getInstance();

// Export conversion functions (now dynamic)
export const m2p = (m: number) => m * scaleManager.getPPM();
export const p2m = (px: number) => px / scaleManager.getPPM();

// Export the scale manager for direct access
export { scaleManager };

// Legacy export for backward compatibility
export const PPM = 50; // This is now just a fallback constant