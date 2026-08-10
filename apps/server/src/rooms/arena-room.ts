import { FIXED_DT, SNAPSHOT_RATE } from "@game/config";
import { createPhysics } from "@game/physics/node";
import type { ClientInputMessage, WelcomeMessage } from "@game/protocol";
import { GameSimulation } from "@game/simulation";
import { Client, Room } from "colyseus";
import { registerRoom, unregisterRoom } from "../networking/room-registry.js";

export class ArenaRoom extends Room {
  override maxClients = 4;
  private simulation!: GameSimulation;
  private roomCode = "";
  private hostSessionId = "";
  private readonly playersBySession = new Map<string, number[]>();
  private accumulator = 0;
  private snapshotAccumulator = 0;

  override async onCreate(): Promise<void> {
    this.simulation = new GameSimulation(await createPhysics());
    this.roomCode = registerRoom(this.roomId);
    this.setMetadata({ code: this.roomCode });
    this.onMessage("input", (client, message: ClientInputMessage) => {
      if (!this.playersBySession.get(client.sessionId)?.includes(message.playerId)) return;
      this.simulation.submitInput(message.playerId, message.input);
    });
    this.onMessage("start", (client) => {
      if (client.sessionId === this.hostSessionId) this.simulation.startMatch();
    });
    this.onMessage("reset-round", (client) => {
      if (client.sessionId === this.hostSessionId) this.simulation.resetRoundNow();
    });
    this.onMessage("ping", (client, sentAt: number) => client.send("pong", sentAt));
    this.onMessage("hello", (client) => this.sendWelcome(client));
    this.setSimulationInterval((deltaMilliseconds) => this.simulate(deltaMilliseconds / 1_000), 1_000 / 60);
  }

  override onJoin(client: Client): void {
    if (!this.hostSessionId) this.hostSessionId = client.sessionId;
    // A connection owns a list, not a single ID, so adding couch players later does not alter the protocol.
    const playerId = this.simulation.addPlayer(client.sessionId, this.playersBySession.size);
    this.playersBySession.set(client.sessionId, [playerId]);
    this.broadcast("snapshot", this.simulation.getSnapshot());
  }

  override onLeave(client: Client): void {
    for (const playerId of this.playersBySession.get(client.sessionId) ?? []) this.simulation.removePlayer(playerId);
    this.playersBySession.delete(client.sessionId);
    if (client.sessionId === this.hostSessionId) {
      const nextHost = this.clients[0];
      this.hostSessionId = nextHost?.sessionId ?? "";
      if (nextHost) {
        this.sendWelcome(nextHost);
      }
    }
  }

  override onDispose(): void {
    unregisterRoom(this.roomCode);
  }

  private simulate(dt: number): void {
    this.accumulator = Math.min(this.accumulator + dt, FIXED_DT * 5);
    while (this.accumulator >= FIXED_DT) {
      this.simulation.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
      this.snapshotAccumulator += FIXED_DT;
    }
    if (this.snapshotAccumulator >= 1 / SNAPSHOT_RATE) {
      this.snapshotAccumulator = 0;
      this.broadcast("snapshot", this.simulation.getSnapshot());
    }
  }

  private sendWelcome(client: Client): void {
    const message: WelcomeMessage = {
      playerIds: this.playersBySession.get(client.sessionId) ?? [],
      roomCode: this.roomCode,
      isHost: client.sessionId === this.hostSessionId,
    };
    client.send("welcome", message);
  }
}
