export const TICK_RATE = 60
export const FIXED_DT = 1 / TICK_RATE
export const SNAPSHOT_RATE = 20

export const ARENA = {
  width: 1_920,
  height: 1_080,
  gravity: 2_600,
  killY: 1_260
} as const

export const PLAYER = {
  // Body
  width: 42,
  height: 62,
  maxHealth: 100,
  mass: 1,
  collisionPredictionDistance: 10,

  // Horizontal movement
  moveSpeed: 500,
  groundAcceleration: 2500,
  airAcceleration: 1200,
  groundFriction: 3_000,
  airFriction: 400,
  groundTurnAcceleration: 4_000,
  airTurnAcceleration: 3_000,

  jump: {
    height: 250,
    minimumHeight: 40,
    timeToApex: 0.45,
    timeToFall: 0.35,
    coyoteTime: 0.1,
    bufferTime: 0.1,
    releaseGravityRampTime: 0.1,
    cornerCorrectionDistance: 12,
    cornerProbeDistance: 2
  }
} as const

export const WEAPON = {
  magazineSize: 3,
  reloadDuration: 1.2,
  fireRate: 4,
  damage: 40,
  projectileSpeed: 1_150,
  projectileGravityScale: 0.8,
  projectileBounces: 2,
  projectileRestitution: 0.75,
  projectileMass: 0.08,
  projectileCount: 1,
  projectileSpread: 0,
  recoil: 130,
  projectileLifetime: 2.2,
  knockback: 390
} as const

export const BLOCK = {
  activeDuration: 0.22,
  cooldown: 1.0,
  frontalDotThreshold: 0.15
} as const

export const ROUND = {
  winsToMatch: 3,
  resetDelay: 2.25
} as const

export const PLAYER_COLOURS = [0x35a7ff, 0xff5964, 0x6bf178, 0xffca3a] as const
