import type { EntityKind, PlayerInput } from '@game/protocol'

export type EntityId = number

export interface Transform {
  x: number
  y: number
  rotation: number
}

export interface Velocity {
  x: number
  y: number
}

export interface Player {
  playerIndex: number
  colour: number
  alive: boolean
  aimX: number
  aimY: number
  previousJump: boolean
  coyoteRemaining: number
  jumpBufferRemaining: number
  releaseGravityElapsed: number
}

export interface Health {
  current: number
  maximum: number
}

export interface WeaponDefinition {
  magazineSize: number
  reloadDuration: number
  fireRate: number
  damage: number
  projectileSpeed: number
  projectileGravityScale: number
  projectileBounces: number
  projectileRestitution: number
  projectileMass: number
  projectileCount: number
  projectileSpread: number
  recoil: number
  projectileLifetime: number
  knockback: number
}

export interface Weapon {
  cooldown: number
  ammo: number
  reloadRemaining: number
  previousReload: boolean
  definition: WeaponDefinition
}

export interface Projectile {
  ownerId: EntityId
  damage: number
  knockback: number
  lifetime: number
  bouncesRemaining: number
}

export interface PhysicsBody {
  bodyType: 'static' | 'dynamic' | 'kinematic'
}

export interface Collider {
  width: number
  height: number
  sensor: boolean
}

export interface Block {
  activeRemaining: number
  cooldownRemaining: number
}

export interface NetworkIdentity {
  ownerId: string | null
}

export class ComponentStore {
  readonly transforms = new Map<EntityId, Transform>()
  readonly velocities = new Map<EntityId, Velocity>()
  readonly players = new Map<EntityId, Player>()
  readonly health = new Map<EntityId, Health>()
  readonly weapons = new Map<EntityId, Weapon>()
  readonly projectiles = new Map<EntityId, Projectile>()
  readonly physicsBodies = new Map<EntityId, PhysicsBody>()
  readonly colliders = new Map<EntityId, Collider>()
  readonly blocks = new Map<EntityId, Block>()
  readonly networkIdentities = new Map<EntityId, NetworkIdentity>()
  readonly inputs = new Map<EntityId, PlayerInput>()
  readonly kinds = new Map<EntityId, EntityKind>()

  delete(entityId: EntityId): void {
    for (const store of [
      this.transforms,
      this.velocities,
      this.players,
      this.health,
      this.weapons,
      this.projectiles,
      this.physicsBodies,
      this.colliders,
      this.blocks,
      this.networkIdentities,
      this.inputs,
      this.kinds
    ]) {
      store.delete(entityId)
    }
  }
}
