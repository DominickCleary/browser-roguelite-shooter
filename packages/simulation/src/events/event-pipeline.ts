import type { GameEvent } from "@game/protocol";

export class EventPipeline {
  private current: GameEvent[] = [];

  emit(event: GameEvent): void {
    this.current.push(event);
  }

  drain(): GameEvent[] {
    const result = this.current;
    this.current = [];
    return result;
  }

  snapshot(): readonly GameEvent[] {
    return this.current;
  }
}
