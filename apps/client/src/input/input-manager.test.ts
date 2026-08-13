import { ARENA } from '@game/config'
import { describe, expect, it } from 'vitest'
import { clientToArenaPoint } from './input-manager.js'

describe('clientToArenaPoint', () => {
  it('maps a matching 16:9 viewport directly into arena coordinates', () => {
    expect(
      clientToArenaPoint(480, 270, {
        left: 0,
        top: 0,
        width: 960,
        height: 540,
      }),
    ).toEqual({ x: ARENA.width / 2, y: ARENA.height / 2 })
  })

  it('accounts for horizontal letterboxing in a wide viewport', () => {
    const viewport = { left: 100, top: 50, width: 1_600, height: 800 }
    const scale = viewport.height / ARENA.height
    const leftEdge = viewport.left + (viewport.width - ARENA.width * scale) / 2

    expect(
      clientToArenaPoint(
        leftEdge,
        viewport.top + viewport.height / 2,
        viewport,
      ),
    ).toEqual({ x: 0, y: ARENA.height / 2 })
  })

  it('accounts for vertical letterboxing in a tall viewport', () => {
    const viewport = { left: 25, top: 40, width: 900, height: 900 }
    const scale = viewport.width / ARENA.width
    const topEdge = viewport.top + (viewport.height - ARENA.height * scale) / 2

    expect(
      clientToArenaPoint(viewport.left + viewport.width / 2, topEdge, viewport),
    ).toEqual({ x: ARENA.width / 2, y: 0 })
  })

  it('falls back to the arena centre for a zero-size viewport', () => {
    expect(
      clientToArenaPoint(0, 0, { left: 0, top: 0, width: 0, height: 0 }),
    ).toEqual({ x: ARENA.width / 2, y: ARENA.height / 2 })
  })
})
