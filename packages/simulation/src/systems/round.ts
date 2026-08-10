import { ROUND } from "@game/config";
import type { RoundPhase } from "@game/protocol";

export interface RoundState {
  phase: RoundPhase;
  number: number;
  winnerId: number | null;
  resetIn: number;
  scores: Map<number, number>;
}

export const createRoundState = (): RoundState => ({
  phase: "lobby",
  number: 1,
  winnerId: null,
  resetIn: 0,
  scores: new Map(),
});

export const finishRound = (state: RoundState, winnerId: number | null): void => {
  state.winnerId = winnerId;
  state.resetIn = ROUND.resetDelay;
  if (winnerId !== null) {
    const score = (state.scores.get(winnerId) ?? 0) + 1;
    state.scores.set(winnerId, score);
    state.phase = score >= ROUND.winsToMatch ? "match-over" : "round-over";
  } else {
    state.phase = "round-over";
  }
};
