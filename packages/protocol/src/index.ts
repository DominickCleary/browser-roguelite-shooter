export interface PlayerInput {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  jump: boolean;
  fire: boolean;
  block: boolean;
}

export const NEUTRAL_INPUT: Readonly<PlayerInput> = {
  moveX: 0,
  moveY: 0,
  aimX: 1,
  aimY: 0,
  jump: false,
  fire: false,
  block: false,
};

export type EntityKind = "player" | "projectile" | "platform" | "crate";

export interface EntitySnapshot {
  id: number;
  kind: EntityKind;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  colour?: number;
  playerIndex?: number;
  health?: number;
  maxHealth?: number;
  blocking?: boolean;
  alive?: boolean;
}

export type RoundPhase = "lobby" | "playing" | "round-over" | "match-over";

export interface RoundSnapshot {
  phase: RoundPhase;
  number: number;
  winnerId: number | null;
  resetIn: number;
  scores: Record<number, number>;
}

export interface GameSnapshot {
  tick: number;
  serverTime: number;
  physicsBodyCount: number;
  entities: EntitySnapshot[];
  round: RoundSnapshot;
  events: GameEvent[];
}

export interface ClientInputMessage {
  playerId: number;
  sequence: number;
  input: PlayerInput;
}

export interface WelcomeMessage {
  playerIds: number[];
  roomCode: string;
  isHost: boolean;
}

export type GameEvent =
  | { type: "ProjectileHit"; projectileId: number; targetId: number; ownerId: number }
  | { type: "Damage"; targetId: number; sourceId: number; amount: number }
  | { type: "BlockSuccess"; playerId: number; sourceId: number }
  | { type: "PlayerDeath"; playerId: number; killerId: number | null }
  | { type: "RoundEnd"; winnerId: number | null; round: number };

export const sanitiseInput = (input: PlayerInput): PlayerInput => {
  const clamp = (value: number) => Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
  const aimLength = Math.hypot(input.aimX, input.aimY);
  return {
    moveX: clamp(input.moveX),
    moveY: clamp(input.moveY),
    aimX: aimLength > 0.001 ? input.aimX / aimLength : 1,
    aimY: aimLength > 0.001 ? input.aimY / aimLength : 0,
    jump: Boolean(input.jump),
    fire: Boolean(input.fire),
    block: Boolean(input.block),
  };
};
