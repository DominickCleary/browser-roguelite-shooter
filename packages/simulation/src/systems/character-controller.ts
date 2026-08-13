import { BLOCK, PLAYER } from '@game/config'
import { NEUTRAL_INPUT } from '@game/protocol'
import type { EntityId, WeaponDefinition } from '../components'
import type { World } from '../ecs/world.js'
import type { PhysicsPort } from '../physics-port.js'

/**
 * Everything that turns player input into character actions lives here.
 *
 * Edit this file for movement, jumping, aim, reload, block, firing, spread,
 * and recoil behaviour. Numeric tuning values live in @game/config.
 */
export interface CharacterControllerDependencies {
  world: World
  physics: PhysicsPort
  playerIds: readonly EntityId[]
  spawnProjectile: (ownerId: EntityId, aimX: number, aimY: number, definition: WeaponDefinition) => void
}

const moveToward = (current: number, target: number, maximumDelta: number): number =>
  Math.abs(target - current) <= maximumDelta ? target : current + Math.sign(target - current) * maximumDelta

export const updateHorizontalVelocity = (
  current: number,
  inputX: number,
  grounded: boolean,
  dt: number
): number => {
  const target = inputX * PLAYER.moveSpeed
  let accelerationRate: number

  if (Math.abs(inputX) < 0.001) {
    accelerationRate = grounded ? PLAYER.groundFriction : PLAYER.airFriction
  } else if (Math.abs(current) > 0.001 && Math.sign(inputX) !== Math.sign(current)) {
    accelerationRate = grounded ? PLAYER.groundTurnAcceleration : PLAYER.airTurnAcceleration
  } else {
    accelerationRate = grounded ? PLAYER.groundAcceleration : PLAYER.airAcceleration
  }

  return moveToward(current, target, accelerationRate * dt)
}

const JUMP_VELOCITY = -(2 * PLAYER.jump.height) / PLAYER.jump.timeToApex
const UP_GRAVITY = (2 * PLAYER.jump.height) / PLAYER.jump.timeToApex ** 2
const DOWN_GRAVITY = (2 * PLAYER.jump.height) / PLAYER.jump.timeToFall ** 2
const SHORT_HOP_GRAVITY = JUMP_VELOCITY ** 2 / (2 * PLAYER.jump.minimumHeight)

export const updateVerticalVelocity = (
  current: number,
  jumpHeld: boolean,
  executeJump: boolean,
  grounded: boolean,
  releaseGravityBlend: number,
  dt: number
): number => {
  if (executeJump) return JUMP_VELOCITY
  if (grounded) return current

  const blend = Math.max(0, Math.min(1, releaseGravityBlend))
  const smoothBlend = blend * blend * (3 - 2 * blend)
  const releasedGravity = UP_GRAVITY + (SHORT_HOP_GRAVITY - UP_GRAVITY) * smoothBlend
  const gravity = current < 0 ? (jumpHeld ? UP_GRAVITY : releasedGravity) : DOWN_GRAVITY
  return current + gravity * dt
}

export const findCornerCorrection = (
  maximumDistance: number,
  preferredDirection: number,
  hasClearance: (offsetX: number) => boolean
): number => {
  const firstDirection = preferredDirection < 0 ? -1 : 1
  for (let distance = 1; distance <= maximumDistance; distance++) {
    const preferredOffset = distance * firstDirection
    if (hasClearance(preferredOffset)) return preferredOffset
    const otherOffset = -preferredOffset
    if (hasClearance(otherOffset)) return otherOffset
  }
  return 0
}

export class CharacterController {
  private readonly previousVerticalVelocities = new Map<EntityId, number>()

  constructor(private readonly dependencies: CharacterControllerDependencies) {}

  resetPlayer(playerId: EntityId): void {
    this.previousVerticalVelocities.delete(playerId)
  }

  private correctCeilingCorner(
    playerId: EntityId,
    currentVelocityY: number,
    preferredDirection: number,
    grounded: boolean
  ): number {
    const { physics } = this.dependencies
    const previousVelocityY = this.previousVerticalVelocities.get(playerId)
    const hitCeiling =
      !grounded && previousVelocityY !== undefined && previousVelocityY < -1 && currentVelocityY >= -1
    if (!hitCeiling) return currentVelocityY

    const position = physics.getPosition(playerId)
    const correction = findCornerCorrection(
      PLAYER.jump.cornerCorrectionDistance,
      preferredDirection,
      (offsetX) =>
        physics.canOccupyPosition(playerId, {
          x: position.x + offsetX,
          y: position.y - PLAYER.jump.cornerProbeDistance
        })
    )
    if (correction === 0) return currentVelocityY

    physics.setPosition(playerId, {
      x: position.x + correction,
      y: position.y
    })
    return previousVelocityY
  }

  updatePlayers(dt: number): void {
    const { world, physics, playerIds, spawnProjectile } = this.dependencies
    const components = world.components

    for (const playerId of playerIds) {
      const player = components.players.get(playerId)
      const weapon = components.weapons.get(playerId)
      const block = components.blocks.get(playerId)
      if (!player?.alive || !weapon || !block) continue

      const input = components.inputs.get(playerId) ?? NEUTRAL_INPUT

      // Aim
      if (Math.hypot(input.aimX, input.aimY) > 0.1) {
        player.aimX = input.aimX
        player.aimY = input.aimY
      }

      // Weapon cooldown and reload
      weapon.cooldown = Math.max(0, weapon.cooldown - dt)
      const wasReloading = weapon.reloadRemaining > 0
      weapon.reloadRemaining = Math.max(0, weapon.reloadRemaining - dt)
      if (wasReloading && weapon.reloadRemaining === 0) {
        weapon.ammo = weapon.definition.magazineSize
      }

      const reloadPressed = input.reload && !weapon.previousReload
      weapon.previousReload = input.reload
      const shouldReload =
        reloadPressed && weapon.ammo < weapon.definition.magazineSize && weapon.reloadRemaining === 0
      if (shouldReload) weapon.reloadRemaining = weapon.definition.reloadDuration

      // Block
      block.activeRemaining = Math.max(0, block.activeRemaining - dt)
      block.cooldownRemaining = Math.max(0, block.cooldownRemaining - dt)
      if (input.block && block.cooldownRemaining === 0) {
        block.activeRemaining = BLOCK.activeDuration
        block.cooldownRemaining = BLOCK.cooldown
      }

      // Horizontal movement and jump
      const velocity = physics.getVelocity(playerId)
      const grounded = physics.isGrounded(playerId)

      velocity.y = this.correctCeilingCorner(
        playerId,
        velocity.y,
        Math.sign(velocity.x) || Math.sign(input.moveX),
        grounded
      )
      velocity.x = updateHorizontalVelocity(velocity.x, input.moveX, grounded, dt)

      const jumpPressed = input.jump && !player.previousJump

      if (jumpPressed) {
        player.jumpBufferRemaining = PLAYER.jump.bufferTime
      } else {
        player.jumpBufferRemaining = Math.max(0, (player.jumpBufferRemaining ?? 0) - dt)
      }

      if (grounded) {
        player.coyoteRemaining = PLAYER.jump.coyoteTime
      } else {
        player.coyoteRemaining = Math.max(0, (player.coyoteRemaining ?? 0) - dt)
      }

      const executeJump = player.jumpBufferRemaining > 0 && player.coyoteRemaining > 0

      if (executeJump) {
        player.jumpBufferRemaining = 0
        player.coyoteRemaining = 0
      }

      const releaseGravityBlend =
        PLAYER.jump.releaseGravityRampTime > 0
          ? player.releaseGravityElapsed / PLAYER.jump.releaseGravityRampTime
          : 1
      velocity.y = updateVerticalVelocity(
        velocity.y,
        input.jump,
        executeJump,
        grounded,
        releaseGravityBlend,
        dt
      )
      if (!grounded && !input.jump && velocity.y < 0 && !executeJump) {
        player.releaseGravityElapsed = Math.min(
          PLAYER.jump.releaseGravityRampTime,
          player.releaseGravityElapsed + dt
        )
      } else {
        player.releaseGravityElapsed = 0
      }
      player.previousJump = input.jump
      this.previousVerticalVelocities.set(playerId, velocity.y)
      physics.setVelocity(playerId, velocity)

      // Fire, projectile spread, and recoil
      const canFire =
        input.fire &&
        weapon.cooldown === 0 &&
        weapon.reloadRemaining === 0 &&
        weapon.ammo > 0 &&
        block.activeRemaining === 0
      if (!canFire) continue

      const { projectileCount, projectileSpread } = weapon.definition
      const firstOffset = (-projectileSpread * (projectileCount - 1)) / 2
      for (let shot = 0; shot < projectileCount; shot++) {
        const angle = firstOffset + shot * projectileSpread
        const cosine = Math.cos(angle)
        const sine = Math.sin(angle)
        spawnProjectile(
          playerId,
          player.aimX * cosine - player.aimY * sine,
          player.aimX * sine + player.aimY * cosine,
          weapon.definition
        )
      }

      const aimLength = Math.hypot(player.aimX, player.aimY) || 1
      physics.applyImpulse(playerId, {
        x: -(player.aimX / aimLength) * weapon.definition.recoil,
        y: -(player.aimY / aimLength) * weapon.definition.recoil
      })
      weapon.ammo--
      weapon.cooldown = 1 / weapon.definition.fireRate
      if (weapon.ammo === 0) weapon.reloadRemaining = weapon.definition.reloadDuration
    }
  }
}
