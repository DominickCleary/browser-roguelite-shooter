import { FIXED_DT } from '@game/config'
import { describe, expect, it } from 'vitest'
import { createPhysics } from './node.js'

describe('RapierPhysics contacts', () => {
  it('resolves a fast landing without a long visible penetration', async () => {
    const physics = await createPhysics()
    physics.createBody({
      entityId: 1,
      bodyType: 'static',
      shape: 'box',
      x: 0,
      y: 100,
      width: 1_000,
      height: 20
    })
    physics.createBody({
      entityId: 2,
      bodyType: 'dynamic',
      shape: 'box',
      x: 0,
      y: 50,
      width: 20,
      height: 20,
      lockRotations: true,
      mass: 1,
      footSensor: true,
      softCcdPrediction: 10
    })
    physics.setVelocity(2, { x: 420, y: 1_250 })

    let maximumPenetration = 0
    for (let tick = 0; tick < 60; tick++) {
      physics.step(FIXED_DT)
      const position = physics.getPosition(2)
      maximumPenetration = Math.max(maximumPenetration, position.y + 10 - 90)
    }

    expect(maximumPenetration).toBeLessThan(1)
    expect(physics.getPosition(2).y).toBeCloseTo(80, 0)
    expect(physics.getVelocity(2).x).toBeCloseTo(420)
    expect(physics.getVelocity(2).y).toBe(0)
  })

  it('checks whether a body can occupy a corrected position', async () => {
    const physics = await createPhysics()
    physics.createBody({
      entityId: 1,
      bodyType: 'static',
      shape: 'box',
      x: 0,
      y: 0,
      width: 100,
      height: 20
    })
    physics.createBody({
      entityId: 2,
      bodyType: 'dynamic',
      shape: 'box',
      x: 60,
      y: 30,
      width: 20,
      height: 20,
      lockRotations: true,
      footSensor: true
    })

    expect(physics.canOccupyPosition(2, { x: 40, y: 15 })).toBe(false)
    expect(physics.canOccupyPosition(2, { x: 61, y: 15 })).toBe(true)
  })

  it('curves an upward projectile back down under gravity', async () => {
    const physics = await createPhysics()
    physics.createBody({
      entityId: 1,
      bodyType: 'dynamic',
      shape: 'ball',
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      gravityScale: 1.25,
      mass: 0.08,
      ccd: true
    })
    physics.setVelocity(1, { x: 0, y: -1_150 })

    for (let tick = 0; tick < 30; tick++) physics.step(FIXED_DT)

    expect(physics.getVelocity(1).y).toBeGreaterThan(0)
  })
})
