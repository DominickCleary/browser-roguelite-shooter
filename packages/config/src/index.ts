export const TICK_RATE = 60;
export const FIXED_DT = 1 / TICK_RATE;
export const SNAPSHOT_RATE = 20;

export const ARENA = {
  width: 1280,
  height: 720,
  gravity: 1_900,
  killY: 900,
} as const;

export const PLAYER = {
  width: 42,
  height: 62,
  moveSpeed: 330,
  groundAcceleration: 2_800,
  airAcceleration: 1_500,
  jumpSpeed: 700,
  maxHealth: 100,
  mass: 1,
} as const;

export const WEAPON = {
  fireRate: 4,
  damage: 22,
  projectileSpeed: 820,
  projectileLifetime: 1.8,
  knockback: 390,
} as const;

export const BLOCK = {
  activeDuration: 0.22,
  cooldown: 1.0,
  frontalDotThreshold: 0.15,
} as const;

export const ROUND = {
  winsToMatch: 3,
  resetDelay: 2.25,
} as const;

export const PLAYER_COLOURS = [0x35a7ff, 0xff5964, 0x6bf178, 0xffca3a] as const;
