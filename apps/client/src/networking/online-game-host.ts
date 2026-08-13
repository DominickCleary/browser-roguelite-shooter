import type { GameSnapshot, PlayerInput, WelcomeMessage } from '@game/protocol'
import { Client, type Room } from 'colyseus.js'
import type { GameHost, HostInfo } from './game-host.js'

const emptySnapshot = (): GameSnapshot => ({
  tick: 0,
  serverTime: 0,
  physicsBodyCount: 0,
  entities: [],
  round: { phase: 'lobby', number: 1, winnerId: null, resetIn: 0, scores: {} },
  events: [],
})

const serverUrl = (): string => {
  const configured = import.meta.env.VITE_SERVER_URL as string | undefined
  if (configured) return configured
  if (import.meta.env.DEV)
    return `${location.protocol}//${location.hostname}:2567`
  return location.origin
}

export class OnlineGameHost implements GameHost {
  readonly info: HostInfo = {
    mode: 'online',
    roomCode: null,
    ping: null,
    controlledPlayerIds: [],
    isRoomHost: false,
  }
  private latest = emptySnapshot()
  private previous = emptySnapshot()
  private receivedAt = performance.now()
  private sequence = 0
  private pingTimer = 0

  private constructor(private readonly room: Room) {
    room.onMessage('welcome', (message: WelcomeMessage) => {
      this.info.controlledPlayerIds = message.playerIds
      this.info.roomCode = message.roomCode
      this.info.isRoomHost = message.isHost
    })
    room.onMessage('snapshot', (snapshot: GameSnapshot) => {
      this.previous = this.latest
      this.latest = snapshot
      this.receivedAt = performance.now()
    })
    room.onMessage('pong', (sentAt: number) => {
      this.info.ping = Math.round(performance.now() - sentAt)
    })
    room.send('hello')
  }

  static async createRoom(): Promise<OnlineGameHost> {
    const room = await new Client(serverUrl()).create('arena', {})
    return new OnlineGameHost(room)
  }

  static async joinRoom(code: string): Promise<OnlineGameHost> {
    const response = await fetch(
      `${serverUrl()}/api/rooms/${encodeURIComponent(code.toUpperCase())}`,
    )
    if (!response.ok)
      throw new Error('Room not found. Check the four-letter code.')
    const { roomId } = (await response.json()) as { roomId: string }
    const room = await new Client(serverUrl()).joinById(roomId, {})
    return new OnlineGameHost(room)
  }

  submitInput(playerId: number, input: PlayerInput): void {
    this.room.send('input', { playerId, sequence: ++this.sequence, input })
  }

  update(dt: number): void {
    this.pingTimer -= dt
    if (this.pingTimer <= 0) {
      this.pingTimer = 1
      this.room.send('ping', performance.now())
    }
  }

  getSnapshot(): GameSnapshot {
    if (this.previous.tick === 0 || this.latest.tick === this.previous.tick)
      return this.latest
    const alpha = Math.min(1, (performance.now() - this.receivedAt) / 50)
    const oldEntities = new Map(
      this.previous.entities.map((entity) => [entity.id, entity]),
    )
    return {
      ...this.latest,
      entities: this.latest.entities.map((entity) => {
        const old = oldEntities.get(entity.id)
        return old
          ? {
              ...entity,
              x: old.x + (entity.x - old.x) * alpha,
              y: old.y + (entity.y - old.y) * alpha,
              rotation: old.rotation + (entity.rotation - old.rotation) * alpha,
            }
          : entity
      }),
    }
  }

  start(): void {
    this.room.send('start')
  }

  resetRound(): void {
    this.room.send('reset-round')
  }

  async dispose(): Promise<void> {
    await this.room.leave()
  }
}
