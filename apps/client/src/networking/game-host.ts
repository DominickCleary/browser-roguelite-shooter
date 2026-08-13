import type { GameSnapshot, PlayerInput } from '@game/protocol'

export interface HostInfo {
  mode: 'local' | 'online'
  roomCode: string | null
  ping: number | null
  controlledPlayerIds: number[]
  isRoomHost: boolean
}

export interface GameHost {
  readonly info: HostInfo
  submitInput(playerId: number, input: PlayerInput): void
  update(dt: number): void
  getSnapshot(): GameSnapshot
  start(): void
  resetRound(): void
  dispose(): Promise<void>
}
