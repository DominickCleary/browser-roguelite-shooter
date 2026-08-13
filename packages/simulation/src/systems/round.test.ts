import { describe, expect, it } from 'vitest'
import { createRoundState, finishRound } from './round.js'

describe('round state', () => {
  it('awards a win and reaches match-over at three wins', () => {
    const state = createRoundState()
    finishRound(state, 7)
    finishRound(state, 7)
    finishRound(state, 7)
    expect(state.scores.get(7)).toBe(3)
    expect(state.phase).toBe('match-over')
  })

  it('supports a round ending without a winner', () => {
    const state = createRoundState()
    finishRound(state, null)
    expect(state.phase).toBe('round-over')
    expect(state.scores.size).toBe(0)
  })
})
