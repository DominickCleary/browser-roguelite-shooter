import { FIXED_DT } from '@game/config'
import { describe, expect, it } from 'vitest'
import {
  findCornerCorrection,
  updateHorizontalVelocity,
  updateVerticalVelocity
} from './character-controller.js'

describe('horizontal movement', () => {
  it('applies air friction without directional input', () => {
    expect(updateHorizontalVelocity(420, 0, false, FIXED_DT)).toBeCloseTo(413.33, 2)
  })

  it('allows directional air control', () => {
    expect(updateHorizontalVelocity(0, 1, false, FIXED_DT)).toBeCloseTo(13.33, 2)
  })

  it('decelerates toward zero while grounded', () => {
    expect(updateHorizontalVelocity(420, 0, true, FIXED_DT)).toBe(370)
  })
})

describe('jump movement', () => {
  it('launches upward when jump is pressed on the ground', () => {
    expect(updateVerticalVelocity(0, true, true, true, 0, FIXED_DT)).toBeLessThan(0)
  })

  it('slows upward movement with gravity', () => {
    expect(updateVerticalVelocity(-500, true, false, false, 0, FIXED_DT)).toBeGreaterThan(-500)
  })

  it('smoothly ramps toward stronger gravity after an early release', () => {
    const held = updateVerticalVelocity(-500, true, false, false, 0, FIXED_DT)
    const beginning = updateVerticalVelocity(-500, false, false, false, 0, FIXED_DT)
    const halfway = updateVerticalVelocity(-500, false, false, false, 0.5, FIXED_DT)
    const released = updateVerticalVelocity(-500, false, false, false, 1, FIXED_DT)
    expect(beginning).toBe(held)
    expect(halfway).toBeGreaterThan(beginning)
    expect(released).toBeGreaterThan(held)
    expect(released).toBeGreaterThan(halfway)
  })
})

describe('corner correction', () => {
  it('uses the smallest offset with overhead clearance', () => {
    expect(findCornerCorrection(12, 1, (offset) => offset >= 4)).toBe(4)
  })

  it('checks the preferred travel direction first', () => {
    const checked: number[] = []
    findCornerCorrection(2, -1, (offset) => {
      checked.push(offset)
      return offset === -2
    })
    expect(checked).toEqual([-1, 1, -2])
  })

  it('does not move when neither side has clearance', () => {
    expect(findCornerCorrection(12, 1, () => false)).toBe(0)
  })
})
