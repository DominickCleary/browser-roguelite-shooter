import { sanitiseInput } from '@game/protocol'
import { describe, expect, it } from 'vitest'

describe('input processing', () => {
  it('clamps movement and normalises aim', () => {
    const result = sanitiseInput({
      moveX: 5,
      moveY: -4,
      aimX: 3,
      aimY: 4,
      jump: true,
      fire: false,
      reload: false,
      block: false,
    })
    expect(result.moveX).toBe(1)
    expect(result.moveY).toBe(-1)
    expect(result.aimX).toBeCloseTo(0.6)
    expect(result.aimY).toBeCloseTo(0.8)
  })
})
