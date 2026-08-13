import { ComponentStore, type EntityId } from '../components'

export class World {
  readonly components = new ComponentStore()
  private nextId = 1

  createEntity(): EntityId {
    return this.nextId++
  }

  deleteEntity(entityId: EntityId): void {
    this.components.delete(entityId)
  }

  get entityCount(): number {
    return this.components.kinds.size
  }
}
