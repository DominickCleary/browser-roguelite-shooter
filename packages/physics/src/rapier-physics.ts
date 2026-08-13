import type * as RAPIER from '@dimforge/rapier2d-compat'
import { ARENA } from '@game/config'
import type {
  EntityId,
  PhysicsBodyDescription,
  PhysicsCollision,
  PhysicsPort,
  PhysicsVector
} from '@game/simulation'

type ColliderRole = 'main' | 'foot'

const PIXELS_PER_METRE = 50
const PHYSICS_SUBSTEPS = 2

interface ColliderMetadata {
  entityId: EntityId
  role: ColliderRole
  sensor: boolean
}

export class RapierPhysics implements PhysicsPort {
  private readonly world: RAPIER.World
  private readonly events: RAPIER.EventQueue
  private readonly bodies = new Map<EntityId, RAPIER.RigidBody>()
  private readonly colliderMetadata = new Map<number, ColliderMetadata>()
  private readonly groundContacts = new Map<EntityId, Set<number>>()

  constructor(private readonly rapier: typeof RAPIER) {
    this.world = new rapier.World({ x: 0, y: ARENA.gravity })
    // The simulation uses pixels. Calibrating Rapier's length-dependent
    // tolerances prevents contacts from being corrected a fraction of a pixel
    // at a time, which otherwise looks like bodies slowly leaving colliders.
    this.world.lengthUnit = PIXELS_PER_METRE
    // Resolve landing overlap quickly enough that characters don't visibly
    // sink into platforms and rise back out over several frames.
    this.world.integrationParameters.contact_natural_frequency = 60
    this.world.integrationParameters.numSolverIterations = 8
    this.world.integrationParameters.numAdditionalFrictionIterations = 8
    this.world.integrationParameters.maxCcdSubsteps = 4
    this.events = new rapier.EventQueue(true)
  }

  get bodyCount(): number {
    return this.bodies.size
  }

  createBody(description: PhysicsBodyDescription): void {
    const bodyDescription = this.createRigidBodyDescription(description)
    const body = this.world.createRigidBody(bodyDescription)
    const isCharacter = description.footSensor ?? false
    const friction = isCharacter ? 0 : description.bodyType === 'static' ? 0.7 : 0.15
    const colliderDescription = this.createColliderDescription(description)
      .setActiveEvents(this.rapier.ActiveEvents.COLLISION_EVENTS)
      .setFriction(friction)
    if (isCharacter) colliderDescription.setFrictionCombineRule(this.rapier.CoefficientCombineRule.Min)
    if (description.sensor) colliderDescription.setSensor(true)
    if (description.mass !== undefined) colliderDescription.setMass(description.mass)
    if (description.restitution !== undefined) colliderDescription.setRestitution(description.restitution)
    const collider = this.world.createCollider(colliderDescription, body)
    this.bodies.set(description.entityId, body)
    this.colliderMetadata.set(collider.handle, {
      entityId: description.entityId,
      role: 'main',
      sensor: description.sensor ?? false
    })

    if (description.footSensor) {
      const foot = this.rapier.ColliderDesc.cuboid(description.width * 0.32, 3)
        .setTranslation(0, description.height / 2 + 3)
        .setDensity(0)
        .setSensor(true)
        .setActiveEvents(this.rapier.ActiveEvents.COLLISION_EVENTS)
      const footCollider = this.world.createCollider(foot, body)
      this.colliderMetadata.set(footCollider.handle, {
        entityId: description.entityId,
        role: 'foot',
        sensor: true
      })
      this.groundContacts.set(description.entityId, new Set())
    }
  }

  removeBody(entityId: EntityId): void {
    const body = this.bodies.get(entityId)
    if (!body) return
    for (let index = 0; index < body.numColliders(); index++) {
      const collider = body.collider(index)
      if (collider) this.colliderMetadata.delete(collider.handle)
    }
    this.world.removeRigidBody(body)
    this.bodies.delete(entityId)
    this.groundContacts.delete(entityId)
    for (const contacts of this.groundContacts.values()) {
      for (const handle of [...contacts]) {
        if (!this.colliderMetadata.has(handle)) contacts.delete(handle)
      }
    }
  }

  setPosition(entityId: EntityId, position: PhysicsVector): void {
    this.getBody(entityId).setTranslation(position, true)
  }

  setVelocity(entityId: EntityId, velocity: PhysicsVector): void {
    this.getBody(entityId).setLinvel(velocity, true)
  }

  getPosition(entityId: EntityId): PhysicsVector {
    const translation = this.getBody(entityId).translation()
    return { x: translation.x, y: translation.y }
  }

  getRotation(entityId: EntityId): number {
    return this.getBody(entityId).rotation()
  }

  getVelocity(entityId: EntityId): PhysicsVector {
    const velocity = this.getBody(entityId).linvel()
    return { x: velocity.x, y: velocity.y }
  }

  applyImpulse(entityId: EntityId, impulse: PhysicsVector): void {
    this.getBody(entityId).applyImpulse(impulse, true)
  }

  canOccupyPosition(entityId: EntityId, position: PhysicsVector): boolean {
    const body = this.getBody(entityId)
    const collider = body.collider(0)
    if (!collider) return false

    const hit = this.world.intersectionWithShape(
      position,
      body.rotation(),
      collider.shape,
      this.rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      collider,
      body
    )
    return hit === null
  }

  isGrounded(entityId: EntityId): boolean {
    return (this.groundContacts.get(entityId)?.size ?? 0) > 0
  }

  step(dt: number): PhysicsCollision[] {
    const collisions: PhysicsCollision[] = []
    this.world.timestep = dt / PHYSICS_SUBSTEPS
    for (let substep = 0; substep < PHYSICS_SUBSTEPS; substep++) {
      this.world.step(this.events)
      this.events.drainCollisionEvents((firstHandle, secondHandle, started) => {
        const first = this.colliderMetadata.get(firstHandle)
        const second = this.colliderMetadata.get(secondHandle)
        if (!first || !second) return
        this.updateFootContact(first, second, secondHandle, started)
        this.updateFootContact(second, first, firstHandle, started)
        if (started && first.role === 'main' && second.role === 'main') {
          collisions.push({ a: first.entityId, b: second.entityId })
        }
      })
    }
    return collisions
  }

  private updateFootContact(
    possibleFoot: ColliderMetadata,
    other: ColliderMetadata,
    otherHandle: number,
    started: boolean
  ): void {
    if (possibleFoot.role !== 'foot' || other.sensor) return
    const contacts = this.groundContacts.get(possibleFoot.entityId)
    if (!contacts) return
    if (started) contacts.add(otherHandle)
    else contacts.delete(otherHandle)
  }

  private createRigidBodyDescription(description: PhysicsBodyDescription): RAPIER.RigidBodyDesc {
    let result: RAPIER.RigidBodyDesc
    if (description.bodyType === 'static') result = this.rapier.RigidBodyDesc.fixed()
    else if (description.bodyType === 'kinematic') result = this.rapier.RigidBodyDesc.kinematicVelocityBased()
    else result = this.rapier.RigidBodyDesc.dynamic()
    result.setTranslation(description.x, description.y)
    if (description.gravityScale !== undefined) result.setGravityScale(description.gravityScale)
    if (description.lockRotations) result.lockRotations()
    if (description.ccd) result.setCcdEnabled(true)
    if (description.softCcdPrediction !== undefined)
      result.setSoftCcdPrediction(description.softCcdPrediction)
    return result
  }

  private createColliderDescription(description: PhysicsBodyDescription): RAPIER.ColliderDesc {
    return description.shape === 'ball'
      ? this.rapier.ColliderDesc.ball(description.width / 2)
      : this.rapier.ColliderDesc.cuboid(description.width / 2, description.height / 2)
  }

  private getBody(entityId: EntityId): RAPIER.RigidBody {
    const body = this.bodies.get(entityId)
    if (!body) throw new Error(`Unknown physics body for entity ${entityId}`)
    return body
  }
}
