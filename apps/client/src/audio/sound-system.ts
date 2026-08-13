import type { EntitySnapshot, GameSnapshot } from '@game/protocol'

const playersIn = (snapshot: GameSnapshot): EntitySnapshot[] =>
  snapshot.entities.filter((entity) => entity.kind === 'player')

export class SoundSystem {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private lastTick: number | null = null
  private previousPlayers = new Map<number, EntitySnapshot>()
  private previousProjectiles = new Set<number>()
  private previousPhase: GameSnapshot['round']['phase'] | null = null
  private muted = localStorage.getItem('browser-brawl-muted') === 'true'

  get isMuted(): boolean {
    return this.muted
  }

  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext()
      this.master = this.context.createGain()
      this.master.gain.value = this.muted ? 0 : 0.32
      this.master.connect(this.context.destination)
    }
    if (this.context.state === 'suspended') void this.context.resume()
  }

  toggleMuted(): void {
    this.muted = !this.muted
    localStorage.setItem('browser-brawl-muted', String(this.muted))
    if (!this.muted) this.unlock()
    this.master?.gain.setTargetAtTime(this.muted ? 0 : 0.32, this.context?.currentTime ?? 0, 0.015)
  }

  reset(): void {
    this.lastTick = null
    this.previousPlayers.clear()
    this.previousProjectiles.clear()
    this.previousPhase = null
  }

  update(snapshot: GameSnapshot): void {
    if (snapshot.tick === this.lastTick) return
    const players = playersIn(snapshot)
    const projectiles = new Set(
      snapshot.entities.filter((entity) => entity.kind === 'projectile').map((entity) => entity.id)
    )

    if (this.lastTick !== null) {
      if ([...projectiles].some((id) => !this.previousProjectiles.has(id))) this.shoot()
      if (
        players.some((player) => {
          const previous = this.previousPlayers.get(player.id)
          return (player.reloadRemaining ?? 0) > 0 && (previous?.reloadRemaining ?? 0) === 0
        })
      )
        this.reload()

      for (const event of snapshot.events) {
        if (event.type === 'Damage') this.hit()
        if (event.type === 'BlockSuccess') this.block()
        if (event.type === 'PlayerDeath') this.death()
        if (event.type === 'RoundEnd') this.roundEnd()
      }
      if (snapshot.round.phase === 'playing' && this.previousPhase !== 'playing') this.roundStart()
    }

    this.lastTick = snapshot.tick
    this.previousPlayers = new Map(players.map((player) => [player.id, player]))
    this.previousProjectiles = projectiles
    this.previousPhase = snapshot.round.phase
  }

  private tone(
    from: number,
    to: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    delay = 0
  ): void {
    if (this.muted) return
    this.unlock()
    if (!this.context || !this.master) return
    const start = this.context.currentTime + delay
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, start)
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration)
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    oscillator.connect(gain).connect(this.master)
    oscillator.start(start)
    oscillator.stop(start + duration)
  }

  private shoot = (): void => this.tone(190, 70, 0.08, 0.24, 'sawtooth')
  private hit = (): void => this.tone(120, 45, 0.12, 0.3, 'square')
  private death = (): void => this.tone(220, 42, 0.42, 0.26, 'sawtooth')
  private reload(): void {
    this.tone(260, 330, 0.05, 0.16, 'square')
    this.tone(330, 440, 0.06, 0.16, 'square', 0.09)
  }
  private block(): void {
    this.tone(680, 1_100, 0.09, 0.2, 'triangle')
    this.tone(1_100, 780, 0.1, 0.12, 'sine', 0.04)
  }
  private roundStart(): void {
    this.tone(330, 440, 0.1, 0.15, 'triangle')
    this.tone(440, 660, 0.14, 0.17, 'triangle', 0.12)
  }
  private roundEnd(): void {
    this.tone(520, 390, 0.18, 0.14, 'triangle')
    this.tone(390, 260, 0.28, 0.16, 'triangle', 0.16)
  }
}
