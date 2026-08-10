import { describe, expect, it } from "vitest";
import { applyDamage, canBlockProjectile } from "./combat.js";

describe("combat", () => {
  it("applies damage without taking health below zero", () => {
    const health = { current: 20, maximum: 100 };
    expect(applyDamage(health, 35)).toBe(20);
    expect(health.current).toBe(0);
  });

  it("blocks projectiles in front during the active window", () => {
    const activeBlock = { activeRemaining: 0.1, cooldownRemaining: 0.9 };
    const player = { x: 10, y: 10, rotation: 0 };
    expect(canBlockProjectile(activeBlock, player, { x: 1, y: 0 }, { x: 20, y: 10, rotation: 0 })).toBe(true);
    expect(canBlockProjectile(activeBlock, player, { x: 1, y: 0 }, { x: 0, y: 10, rotation: 0 })).toBe(false);
  });

  it("does not block outside the active window", () => {
    expect(
      canBlockProjectile(
        { activeRemaining: 0, cooldownRemaining: 0.5 },
        { x: 0, y: 0, rotation: 0 },
        { x: 1, y: 0 },
        { x: 10, y: 0, rotation: 0 },
      ),
    ).toBe(false);
  });
});
