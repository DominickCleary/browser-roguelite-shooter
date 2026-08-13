import { ARENA, PLAYER, PLAYER_COLOURS, WEAPON } from '@game/config'
import {
  type EntitySnapshot,
  type GameEvent,
  type GameSnapshot,
  NEUTRAL_INPUT,
  type PlayerInput,
  sanitiseInput
} from '@game/protocol'
import type { EntityId, Projectile, WeaponDefinition } from './components'
import { World } from './ecs/world.js'
import { EventPipeline } from './events/event-pipeline.js'
import type { PhysicsCollision, PhysicsPort } from './physics-port.js'
import { CharacterController } from './systems/character-controller.js'
import { applyDamage, canBlockProjectile } from './systems/combat.js'
import { createRoundState, finishRound } from './systems/round.js'

const PLAYER_SPAWNS = [
  { x: 320, y: 940 },
  { x: 1_600, y: 940 },
  { x: 620, y: 720 },
  { x: 1_300, y: 720 }
] as const

export class GameSimulation {
  readonly world = new World()
  readonly round = createRoundState()
  readonly playerIds: EntityId[] = []
  tick = 0
  private elapsed = 0
  private readonly events = new EventPipeline()
  private recentEvents: GameEvent[] = []
  private readonly arenaEntityIds: EntityId[] = []
  private crateId: EntityId | null = null
  private readonly characterController: CharacterController

  constructor(readonly physics: PhysicsPort) {
    this.characterController = new CharacterController({
      world: this.world,
      physics: this.physics,
      playerIds: this.playerIds,
      spawnProjectile: (ownerId, aimX, aimY, definition) =>
        this.spawnProjectile(ownerId, aimX, aimY, definition)
    })
    this.createArena()
  }

  addPlayer(ownerId: string | null = null, playerIndex = this.playerIds.length): EntityId {
    if (playerIndex < 0 || playerIndex >= PLAYER_SPAWNS.length) {
      throw new Error('The prototype supports up to four players.')
    }
    const id = this.world.createEntity()
    const spawn = PLAYER_SPAWNS[playerIndex] ?? PLAYER_SPAWNS[0]
    const components = this.world.components
    components.kinds.set(id, 'player')
    components.transforms.set(id, { ...spawn, rotation: 0 })
    components.velocities.set(id, { x: 0, y: 0 })
    components.players.set(id, {
      playerIndex,
      colour: PLAYER_COLOURS[playerIndex] ?? 0xffffff,
      alive: true,
      aimX: playerIndex % 2 === 0 ? 1 : -1,
      aimY: 0,
      previousJump: false,
      coyoteRemaining: 0,
      jumpBufferRemaining: 0,
      releaseGravityElapsed: 0
    })
    components.health.set(id, {
      current: PLAYER.maxHealth,
      maximum: PLAYER.maxHealth
    })
    const weaponDefinition = { ...WEAPON }
    components.weapons.set(id, {
      cooldown: 0,
      ammo: weaponDefinition.magazineSize,
      reloadRemaining: 0,
      previousReload: false,
      definition: weaponDefinition
    })
    components.blocks.set(id, { activeRemaining: 0, cooldownRemaining: 0 })
    components.physicsBodies.set(id, { bodyType: 'dynamic' })
    components.colliders.set(id, {
      width: PLAYER.width,
      height: PLAYER.height,
      sensor: false
    })
    components.networkIdentities.set(id, { ownerId })
    components.inputs.set(id, { ...NEUTRAL_INPUT })
    this.physics.createBody({
      entityId: id,
      bodyType: 'dynamic',
      shape: 'box',
      ...spawn,
      width: PLAYER.width,
      height: PLAYER.height,
      gravityScale: 0,
      lockRotations: true,
      footSensor: true,
      mass: PLAYER.mass,
      softCcdPrediction: PLAYER.collisionPredictionDistance
    })
    this.playerIds.push(id)
    this.round.scores.set(id, 0)
    return id
  }

  removePlayer(playerId: EntityId): void {
    this.characterController.resetPlayer(playerId)
    this.physics.removeBody(playerId)
    this.world.deleteEntity(playerId)
    const index = this.playerIds.indexOf(playerId)
    if (index >= 0) this.playerIds.splice(index, 1)
    this.round.scores.delete(playerId)
  }

  startMatch(): void {
    if (this.playerIds.length < 2) return
    this.round.phase = 'playing'
    this.round.winnerId = null
    this.round.resetIn = 0
  }

  resetRoundNow(): void {
    if (this.playerIds.length >= 2) this.resetRound(false)
  }

  submitInput(playerId: EntityId, input: PlayerInput): void {
    if (this.world.components.players.has(playerId)) {
      this.world.components.inputs.set(playerId, sanitiseInput(input))
    }
  }

  update(dt: number): void {
    this.tick++
    this.elapsed += dt
    this.recentEvents = []
    if (this.round.phase === 'playing') this.characterController.updatePlayers(dt)
    const collisions = this.physics.step(dt)
    this.syncPhysics()
    if (this.round.phase === 'playing') {
      this.processCollisions(collisions)
      this.updateProjectiles(dt)
      this.checkFallenPlayers()
      this.checkRoundEnd()
    } else if (this.round.phase === 'round-over' || this.round.phase === 'match-over') {
      this.round.resetIn = Math.max(0, this.round.resetIn - dt)
      if (this.round.resetIn === 0) this.resetRound(this.round.phase === 'match-over')
    }
    this.recentEvents = this.events.drain()
  }

  getSnapshot(): GameSnapshot {
    const components = this.world.components
    const entities: EntitySnapshot[] = []
    for (const [id, kind] of components.kinds) {
      const transform = components.transforms.get(id)
      const collider = components.colliders.get(id)
      if (!transform || !collider) continue
      const snapshot: EntitySnapshot = {
        id,
        kind,
        x: transform.x,
        y: transform.y,
        rotation: transform.rotation,
        width: collider.width,
        height: collider.height
      }
      const player = components.players.get(id)
      const health = components.health.get(id)
      const block = components.blocks.get(id)
      const weapon = components.weapons.get(id)
      if (player) {
        snapshot.colour = player.colour
        snapshot.playerIndex = player.playerIndex
        snapshot.alive = player.alive
        snapshot.aimX = player.aimX
        snapshot.aimY = player.aimY
      }
      if (health) {
        snapshot.health = health.current
        snapshot.maxHealth = health.maximum
      }
      if (block) snapshot.blocking = block.activeRemaining > 0
      if (weapon) {
        snapshot.ammo = weapon.ammo
        snapshot.maxAmmo = weapon.definition.magazineSize
        snapshot.reloadRemaining = weapon.reloadRemaining
        snapshot.reloadDuration = weapon.definition.reloadDuration
      }
      entities.push(snapshot)
    }
    return {
      tick: this.tick,
      serverTime: this.elapsed,
      physicsBodyCount: this.physics.bodyCount,
      entities,
      round: {
        phase: this.round.phase,
        number: this.round.number,
        winnerId: this.round.winnerId,
        resetIn: this.round.resetIn,
        scores: Object.fromEntries(this.round.scores)
      },
      events: [...this.recentEvents]
    }
  }

  private createArena(): void {
    const platforms = [
      { x: 960, y: -25, width: 1_920, height: 50 },
      { x: 960, y: 1_050, width: 1_920, height: 60 },
      { x: 300, y: 830, width: 360, height: 28 },
      { x: 960, y: 850, width: 400, height: 28 },
      { x: 1_620, y: 830, width: 360, height: 28 },
      { x: 570, y: 610, width: 320, height: 28 },
      { x: 1_350, y: 610, width: 320, height: 28 },
      { x: 960, y: 390, width: 320, height: 28 },
      { x: 250, y: 330, width: 220, height: 28 },
      { x: 1_670, y: 330, width: 220, height: 28 },
      { x: -25, y: 540, width: 50, height: 1_080 },
      { x: 1_945, y: 540, width: 50, height: 1_080 }
    ]
    for (const platform of platforms) {
      const id = this.world.createEntity()
      this.arenaEntityIds.push(id)
      this.world.components.kinds.set(id, 'platform')
      this.world.components.transforms.set(id, {
        x: platform.x,
        y: platform.y,
        rotation: 0
      })
      this.world.components.colliders.set(id, {
        width: platform.width,
        height: platform.height,
        sensor: false
      })
      this.world.components.physicsBodies.set(id, { bodyType: 'static' })
      this.physics.createBody({
        entityId: id,
        bodyType: 'static',
        shape: 'box',
        ...platform
      })
    }
    this.crateId = this.createCrate()
  }

  private createCrate(): EntityId {
    const id = this.world.createEntity()
    this.world.components.kinds.set(id, 'crate')
    this.world.components.transforms.set(id, { x: 960, y: 760, rotation: 0 })
    this.world.components.velocities.set(id, { x: 0, y: 0 })
    this.world.components.colliders.set(id, {
      width: 64,
      height: 64,
      sensor: false
    })
    this.world.components.physicsBodies.set(id, { bodyType: 'dynamic' })
    this.physics.createBody({
      entityId: id,
      bodyType: 'dynamic',
      shape: 'box',
      x: 960,
      y: 760,
      width: 64,
      height: 64
    })
    return id
  }

  private spawnProjectile(ownerId: EntityId, aimX: number, aimY: number, definition: WeaponDefinition): void {
    const ownerTransform = this.world.components.transforms.get(ownerId)
    if (!ownerTransform) return

    const length = Math.hypot(aimX, aimY) || 1
    const directionX = aimX / length
    const directionY = aimY / length
    const id = this.world.createEntity()
    const x = ownerTransform.x + directionX * 42
    const y = ownerTransform.y + directionY * 25
    const initialVelocity = {
      x: directionX * definition.projectileSpeed,
      y: directionY * definition.projectileSpeed
    }
    const projectile: Projectile = {
      ownerId,
      damage: definition.damage,
      knockback: definition.knockback,
      lifetime: definition.projectileLifetime,
      bouncesRemaining: definition.projectileBounces
    }

    const components = this.world.components
    components.kinds.set(id, 'projectile')
    components.transforms.set(id, {
      x,
      y,
      rotation: Math.atan2(directionY, directionX)
    })
    components.velocities.set(id, { ...initialVelocity })
    components.projectiles.set(id, projectile)
    components.colliders.set(id, { width: 16, height: 16, sensor: false })
    components.physicsBodies.set(id, { bodyType: 'dynamic' })

    this.physics.createBody({
      entityId: id,
      bodyType: 'dynamic',
      shape: 'ball',
      x,
      y,
      width: 16,
      height: 16,
      gravityScale: definition.projectileGravityScale,
      mass: definition.projectileMass,
      restitution: definition.projectileRestitution,
      ccd: true
    })
    this.physics.setVelocity(id, initialVelocity)
  }

  private syncPhysics(): void {
    const components = this.world.components
    for (const [id] of components.physicsBodies) {
      const transform = components.transforms.get(id)
      if (!transform) continue
      const position = this.physics.getPosition(id)
      transform.rotation = this.physics.getRotation(id)
      const velocity = this.physics.getVelocity(id)
      transform.x = position.x
      transform.y = position.y
      const storedVelocity = components.velocities.get(id)
      if (storedVelocity) Object.assign(storedVelocity, velocity)
    }
  }

  private processCollisions(collisions: PhysicsCollision[]): void {
    const handled = new Set<EntityId>()
    for (const collision of collisions) {
      const projectileId = this.world.components.projectiles.has(collision.a)
        ? collision.a
        : this.world.components.projectiles.has(collision.b)
          ? collision.b
          : null
      if (projectileId === null || handled.has(projectileId)) continue
      const targetId = projectileId === collision.a ? collision.b : collision.a
      const projectile = this.world.components.projectiles.get(projectileId)
      if (!projectile || targetId === projectile.ownerId) continue
      handled.add(projectileId)
      if (this.world.components.players.has(targetId)) {
        this.events.emit({
          type: 'ProjectileHit',
          projectileId,
          targetId,
          ownerId: projectile.ownerId
        })
        this.resolvePlayerHit(targetId, projectileId, projectile)
        this.destroyProjectile(projectileId)
      } else if (projectile.bouncesRemaining > 0) {
        projectile.bouncesRemaining--
        const transform = this.world.components.transforms.get(projectileId)
        if (transform) {
          this.events.emit({
            type: 'ProjectileBounce',
            projectileId,
            x: transform.x,
            y: transform.y
          })
        }
      } else {
        this.destroyProjectile(projectileId)
      }
    }
  }

  private resolvePlayerHit(targetId: EntityId, projectileId: EntityId, projectile: Projectile): void {
    const components = this.world.components
    const player = components.players.get(targetId)
    const health = components.health.get(targetId)
    const block = components.blocks.get(targetId)
    const playerTransform = components.transforms.get(targetId)
    const projectileTransform = components.transforms.get(projectileId)
    if (!player || !health || !block || !playerTransform || !projectileTransform || !player.alive) return
    if (canBlockProjectile(block, playerTransform, { x: player.aimX, y: player.aimY }, projectileTransform)) {
      this.events.emit({
        type: 'BlockSuccess',
        playerId: targetId,
        sourceId: projectile.ownerId
      })
      return
    }
    const amount = applyDamage(health, projectile.damage)
    this.events.emit({
      type: 'Damage',
      targetId,
      sourceId: projectile.ownerId,
      amount
    })
    const impactVelocity = this.physics.getVelocity(projectileId)
    const length = Math.hypot(impactVelocity.x, impactVelocity.y) || 1
    this.physics.applyImpulse(targetId, {
      x: (impactVelocity.x / length) * projectile.knockback,
      y: (impactVelocity.y / length) * projectile.knockback - projectile.knockback * 0.25
    })
    if (health.current <= 0) this.killPlayer(targetId, projectile.ownerId)
  }

  private updateProjectiles(dt: number): void {
    for (const [id, projectile] of [...this.world.components.projectiles]) {
      projectile.lifetime -= dt
      const transform = this.world.components.transforms.get(id)
      if (
        projectile.lifetime <= 0 ||
        !transform ||
        transform.x < -100 ||
        transform.x > ARENA.width + 100 ||
        transform.y > ARENA.killY
      ) {
        this.destroyProjectile(id)
      }
    }
  }

  private checkFallenPlayers(): void {
    for (const id of this.playerIds) {
      const player = this.world.components.players.get(id)
      const transform = this.world.components.transforms.get(id)
      if (player?.alive && transform && transform.y > ARENA.killY) this.killPlayer(id, null)
    }
  }

  private killPlayer(playerId: EntityId, killerId: EntityId | null): void {
    const player = this.world.components.players.get(playerId)
    if (!player?.alive) return
    player.alive = false
    this.events.emit({ type: 'PlayerDeath', playerId, killerId })
  }

  private checkRoundEnd(): void {
    if (this.playerIds.length < 2) return
    const alive = this.playerIds.filter((id) => this.world.components.players.get(id)?.alive)
    if (alive.length > 1) return
    const winnerId = alive[0] ?? null
    finishRound(this.round, winnerId)
    this.events.emit({ type: 'RoundEnd', winnerId, round: this.round.number })
  }

  private resetRound(resetMatch: boolean): void {
    for (const id of [...this.world.components.projectiles.keys()]) this.destroyProjectile(id)
    if (resetMatch) {
      for (const playerId of this.playerIds) this.round.scores.set(playerId, 0)
      this.round.number = 1
    } else {
      this.round.number++
    }
    this.round.phase = 'playing'
    this.round.winnerId = null
    this.round.resetIn = 0
    this.playerIds.forEach((id, index) => {
      this.characterController.resetPlayer(id)
      const spawn = PLAYER_SPAWNS[index] ?? PLAYER_SPAWNS[0]
      const player = this.world.components.players.get(id)
      const health = this.world.components.health.get(id)
      const block = this.world.components.blocks.get(id)
      const weapon = this.world.components.weapons.get(id)
      if (player) {
        player.alive = true
        player.previousJump = false
        player.coyoteRemaining = 0
        player.jumpBufferRemaining = 0
        player.releaseGravityElapsed = 0
      }
      if (health) health.current = health.maximum
      if (block) {
        block.activeRemaining = 0
        block.cooldownRemaining = 0
      }
      if (weapon) {
        weapon.cooldown = 0
        weapon.ammo = weapon.definition.magazineSize
        weapon.reloadRemaining = 0
        weapon.previousReload = false
      }
      this.physics.setPosition(id, spawn)
      this.physics.setVelocity(id, { x: 0, y: 0 })
    })
    if (this.crateId !== null) {
      this.physics.setPosition(this.crateId, { x: 960, y: 760 })
      this.physics.setVelocity(this.crateId, { x: 0, y: 0 })
    }
  }

  private destroyProjectile(projectileId: EntityId): void {
    if (!this.world.components.projectiles.has(projectileId)) return
    const transform = this.world.components.transforms.get(projectileId)
    if (transform) {
      this.events.emit({
        type: 'ProjectileDestroyed',
        projectileId,
        x: transform.x,
        y: transform.y
      })
    }
    this.deleteEntity(projectileId)
  }

  private deleteEntity(entityId: EntityId): void {
    this.physics.removeBody(entityId)
    this.world.deleteEntity(entityId)
  }
}
