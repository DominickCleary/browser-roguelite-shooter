import { ARENA } from '@game/config'
import type { EntitySnapshot, GameSnapshot } from '@game/protocol'
import { Application, Container, Graphics, Text } from 'pixi.js'

interface EntityVisual {
  container: Container
  body: Graphics
  health: Graphics
  label: Text | null
  weaponStatus: Text | null
}

interface ProjectileEffect {
  graphic: Graphics
  elapsed: number
  duration: number
  startScale: number
  endScale: number
  spin: number
}

export class RenderSystem {
  readonly app = new Application()
  private readonly world = new Container()
  private readonly arenaBorder = new Graphics()
  private readonly visuals = new Map<number, EntityVisual>()
  private readonly projectileEffects: ProjectileEffect[] = []
  private lastEffectTick: number | null = null
  private lastRenderAt = performance.now()
  private debugVisible = false

  async initialise(target: HTMLElement): Promise<void> {
    await this.app.init({
      background: '#08111f',
      resizeTo: target,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true
    })
    target.appendChild(this.app.canvas)
    this.arenaBorder
      .rect(2, 2, ARENA.width - 4, ARENA.height - 4)
      .stroke({ color: 0x78e3fd, width: 3, alpha: 0.5 })
    this.world.addChild(this.arenaBorder)
    this.app.stage.addChild(this.world)
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  render(snapshot: GameSnapshot): void {
    const now = performance.now()
    const dt = (now - this.lastRenderAt) / 1_000
    this.lastRenderAt = now
    this.updateProjectileEffects(dt)
    this.processProjectileEvents(snapshot)

    const present = new Set(snapshot.entities.map((entity) => entity.id))
    for (const [id, visual] of this.visuals) {
      if (!present.has(id)) {
        visual.container.destroy({ children: true })
        this.visuals.delete(id)
      }
    }
    for (const entity of snapshot.entities) {
      const visual = this.visuals.get(entity.id) ?? this.createVisual(entity)
      visual.container.position.set(entity.x, entity.y)
      visual.container.rotation = entity.rotation
      visual.container.alpha = entity.alive === false ? 0.25 : 1
      this.drawEntity(visual, entity)
    }
  }

  private processProjectileEvents(snapshot: GameSnapshot): void {
    if (snapshot.tick === this.lastEffectTick) return
    this.lastEffectTick = snapshot.tick
    for (const event of snapshot.events) {
      if (event.type === 'ProjectileBounce') {
        this.spawnProjectileEffect('bounce', event.x, event.y)
      } else if (event.type === 'ProjectileDestroyed') {
        this.spawnProjectileEffect('destroyed', event.x, event.y)
      }
    }
  }

  private spawnProjectileEffect(type: 'bounce' | 'destroyed', x: number, y: number): void {
    const graphic = new Graphics()
    if (type === 'bounce') {
      graphic.circle(0, 0, 9).stroke({
        color: 0xfff275,
        width: 3,
        alpha: 0.95
      })
      for (let index = 0; index < 4; index++) {
        const angle = (index * Math.PI) / 2
        graphic
          .moveTo(Math.cos(angle) * 12, Math.sin(angle) * 12)
          .lineTo(Math.cos(angle) * 18, Math.sin(angle) * 18)
      }
      graphic.stroke({ color: 0xffffff, width: 2, alpha: 0.8 })
    } else {
      graphic.circle(0, 0, 6).fill(0xfff275)
      for (let index = 0; index < 8; index++) {
        const angle = (index * Math.PI) / 4
        graphic
          .moveTo(Math.cos(angle) * 9, Math.sin(angle) * 9)
          .lineTo(Math.cos(angle) * 20, Math.sin(angle) * 20)
      }
      graphic.stroke({ color: 0xfff275, width: 3, alpha: 0.9 })
    }

    graphic.position.set(x, y)
    this.world.addChild(graphic)
    this.projectileEffects.push({
      graphic,
      elapsed: 0,
      duration: type === 'bounce' ? 0.18 : 0.28,
      startScale: type === 'bounce' ? 0.65 : 0.8,
      endScale: type === 'bounce' ? 1.65 : 1.8,
      spin: type === 'bounce' ? 0 : 2.5
    })
  }

  private updateProjectileEffects(dt: number): void {
    for (let index = this.projectileEffects.length - 1; index >= 0; index--) {
      const effect = this.projectileEffects[index]
      if (!effect) continue
      effect.elapsed += dt
      const progress = Math.min(1, effect.elapsed / effect.duration)
      const scale = effect.startScale + (effect.endScale - effect.startScale) * progress
      effect.graphic.scale.set(scale)
      effect.graphic.alpha = 1 - progress
      effect.graphic.rotation += effect.spin * dt
      if (progress < 1) continue
      effect.graphic.removeFromParent()
      effect.graphic.destroy()
      this.projectileEffects.splice(index, 1)
    }
  }

  toggleDebug(): boolean {
    this.debugVisible = !this.debugVisible
    return this.debugVisible
  }

  private createVisual(entity: EntitySnapshot): EntityVisual {
    const container = new Container()
    const body = new Graphics()
    const health = new Graphics()
    container.addChild(body, health)
    const label =
      entity.kind === 'player'
        ? new Text({
            text: `P${(entity.playerIndex ?? 0) + 1}`,
            style: { fill: 0xffffff, fontSize: 16, fontWeight: 'bold' }
          })
        : null
    const weaponStatus =
      entity.kind === 'player'
        ? new Text({
            text: '',
            style: {
              fill: 0xffffff,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 13,
              fontWeight: 'bold',
              lineHeight: 17
            }
          })
        : null
    if (label) {
      label.anchor.set(0.5)
      container.addChild(label)
    }
    if (weaponStatus) {
      weaponStatus.anchor.set(0, 0.5)
      container.addChild(weaponStatus)
    }
    this.world.addChild(container)
    const visual = { container, body, health, label, weaponStatus }
    this.visuals.set(entity.id, visual)
    return visual
  }

  private drawEntity(visual: EntityVisual, entity: EntitySnapshot): void {
    visual.body.clear()
    visual.health.clear()
    const outline = this.debugVisible ? { color: 0x00ffcc, width: 2 } : undefined
    if (entity.kind === 'projectile') {
      visual.body.circle(0, 0, entity.width / 2).fill(0xfff275)
      if (outline) visual.body.circle(0, 0, entity.width / 2).stroke(outline)
    } else {
      const colour =
        entity.kind === 'player' ? (entity.colour ?? 0xffffff) : entity.kind === 'crate' ? 0xb7793e : 0x475569
      visual.body.rect(-entity.width / 2, -entity.height / 2, entity.width, entity.height).fill(colour)
      if (outline)
        visual.body.rect(-entity.width / 2, -entity.height / 2, entity.width, entity.height).stroke(outline)
    }
    if (entity.kind === 'crate') {
      visual.body
        .moveTo(-22, -22)
        .lineTo(22, 22)
        .moveTo(22, -22)
        .lineTo(-22, 22)
        .stroke({ color: 0x70451f, width: 4 })
    }
    if (entity.kind === 'player') {
      if (visual.label) visual.label.position.set(0, 0)
      const aimLength = Math.hypot(entity.aimX ?? 1, entity.aimY ?? 0) || 1
      const aimX = (entity.aimX ?? 1) / aimLength
      const aimY = (entity.aimY ?? 0) / aimLength
      if (visual.weaponStatus) {
        const ammo = entity.ammo ?? 0
        const maximum = entity.maxAmmo ?? 0
        const reloadRemaining = entity.reloadRemaining ?? 0
        visual.weaponStatus.text =
          `${String(ammo)}/${String(maximum)}` +
          (reloadRemaining > 0 ? `\nRELOAD ${reloadRemaining.toFixed(1)}s` : '')
        const placeOnLeft = aimX >= 0
        visual.weaponStatus.anchor.set(placeOnLeft ? 1 : 0, 0.5)
        visual.weaponStatus.position.set((entity.width / 2 + 12) * (placeOnLeft ? -1 : 1), 0)
      }
      visual.health
        .moveTo(aimX * 31, aimY * 31)
        .lineTo(aimX * 47, aimY * 47)
        .stroke({ color: 0xffffff, width: 4, alpha: 0.9 })
      visual.health
        .circle(aimX * 49, aimY * 49, 4)
        .fill(entity.colour ?? 0xffffff)
        .stroke({ color: 0xffffff, width: 2, alpha: 0.9 })

      const healthRatio = (entity.health ?? 0) / (entity.maxHealth ?? 1)
      visual.health.rect(-24, -entity.height / 2 - 13, 48, 6).fill(0x111827)
      visual.health
        .rect(-24, -entity.height / 2 - 13, 48 * healthRatio, 6)
        .fill(healthRatio > 0.35 ? 0x6bf178 : 0xff5964)
      if (entity.blocking) visual.health.circle(0, 0, 42).stroke({ color: 0x78e3fd, width: 6, alpha: 0.85 })
    }
  }

  private resize(): void {
    const scale = Math.min(this.app.screen.width / ARENA.width, this.app.screen.height / ARENA.height)
    this.world.scale.set(scale)
    this.world.position.set(
      (this.app.screen.width - ARENA.width * scale) / 2,
      (this.app.screen.height - ARENA.height * scale) / 2
    )
  }
}
