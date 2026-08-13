import type { EntityId } from './components'

export interface PhysicsBodyDescription {
  entityId: EntityId
  bodyType: 'static' | 'dynamic' | 'kinematic'
  shape: 'box' | 'ball'
  x: number
  y: number
  width: number
  height: number
  sensor?: boolean
  gravityScale?: number
  lockRotations?: boolean
  ccd?: boolean
  softCcdPrediction?: number
  footSensor?: boolean
  mass?: number
  restitution?: number
}

export interface PhysicsCollision {
  a: EntityId
  b: EntityId
}

export interface PhysicsVector {
  x: number
  y: number
}

export interface PhysicsPort {
  readonly bodyCount: number
  createBody(description: PhysicsBodyDescription): void
  removeBody(entityId: EntityId): void
  setPosition(entityId: EntityId, position: PhysicsVector): void
  setVelocity(entityId: EntityId, velocity: PhysicsVector): void
  getPosition(entityId: EntityId): PhysicsVector
  getRotation(entityId: EntityId): number
  getVelocity(entityId: EntityId): PhysicsVector
  applyImpulse(entityId: EntityId, impulse: PhysicsVector): void
  canOccupyPosition(entityId: EntityId, position: PhysicsVector): boolean
  isGrounded(entityId: EntityId): boolean
  step(dt: number): PhysicsCollision[]
}
