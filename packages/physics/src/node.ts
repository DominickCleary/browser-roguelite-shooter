/// <reference path="./rapier-es.d.ts" />
import * as RAPIER from '@dimforge/rapier2d-compat/rapier.es.js'
import { RapierPhysics } from './rapier-physics.js'

let initialised = false

export const createPhysics = async (): Promise<RapierPhysics> => {
  if (!initialised) {
    await RAPIER.init()
    initialised = true
  }
  return new RapierPhysics(RAPIER)
}

export { RapierPhysics } from './rapier-physics.js'
