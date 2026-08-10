import { FIXED_DT } from "@game/config";
import { createPhysics } from "@game/physics";
import type { GameSnapshot, PlayerInput } from "@game/protocol";
import { GameSimulation } from "@game/simulation";
import type { GameHost, HostInfo } from "./game-host.js";

export class LocalGameHost implements GameHost {
  readonly info: HostInfo;
  private accumulator = 0;

  private constructor(private readonly simulation: GameSimulation, playerIds: number[]) {
    this.info = {
      mode: "local",
      roomCode: null,
      ping: null,
      controlledPlayerIds: playerIds,
      isRoomHost: true,
    };
  }

  static async create(): Promise<LocalGameHost> {
    const simulation = new GameSimulation(await createPhysics());
    const playerIds = [simulation.addPlayer("local:keyboard-1"), simulation.addPlayer("local:keyboard-2")];
    simulation.startMatch();
    return new LocalGameHost(simulation, playerIds);
  }

  submitInput(playerId: number, input: PlayerInput): void {
    this.simulation.submitInput(playerId, input);
  }

  update(dt: number): void {
    this.accumulator = Math.min(this.accumulator + dt, FIXED_DT * 5);
    while (this.accumulator >= FIXED_DT) {
      this.simulation.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
  }

  getSnapshot(): GameSnapshot {
    return this.simulation.getSnapshot();
  }

  start(): void {
    this.simulation.startMatch();
  }

  resetRound(): void {
    this.simulation.resetRoundNow();
  }

  async dispose(): Promise<void> {}
}
