import { BLOCK } from '@game/config'
import type { Block, Health, Transform } from '../components'

export const applyDamage = (health: Health, amount: number): number => {
  const applied = Math.max(0, Math.min(health.current, amount))
  health.current -= applied
  return applied
}

export const canBlockProjectile = (
  block: Block,
  playerTransform: Transform,
  playerAim: { x: number; y: number },
  projectileTransform: Transform,
): boolean => {
  if (block.activeRemaining <= 0) return false
  const dx = projectileTransform.x - playerTransform.x
  const dy = projectileTransform.y - playerTransform.y
  const distance = Math.hypot(dx, dy)
  if (distance < 0.001) return true
  return (
    (dx / distance) * playerAim.x + (dy / distance) * playerAim.y >=
    BLOCK.frontalDotThreshold
  )
}
