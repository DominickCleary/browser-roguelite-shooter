import type { EntitySnapshot, GameSnapshot, PlayerInput } from "@game/protocol";

interface InputAdapter {
  sample(slot: number, player: EntitySnapshot | undefined): PlayerInput | null;
}

const deadzone = (value: number): number => (Math.abs(value) < 0.18 ? 0 : value);

class KeyboardInput implements InputAdapter {
  private readonly pressed = new Set<string>();
  private mouse = { x: 640, y: 360, down: false };
  private arenaRect: DOMRect | null = null;
  private secondAim = { x: -1, y: 0 };

  constructor(target: HTMLElement) {
    window.addEventListener("keydown", (event) => {
      this.pressed.add(event.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    });
    window.addEventListener("keyup", (event) => this.pressed.delete(event.code));
    target.addEventListener("pointermove", (event) => {
      this.arenaRect = target.getBoundingClientRect();
      const rect = this.arenaRect;
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 1280;
      this.mouse.y = ((event.clientY - rect.top) / rect.height) * 720;
    });
    target.addEventListener("pointerdown", () => (this.mouse.down = true));
    window.addEventListener("pointerup", () => (this.mouse.down = false));
    window.addEventListener("blur", () => this.pressed.clear());
  }

  sample(slot: number, player: EntitySnapshot | undefined): PlayerInput | null {
    if (slot === 0) {
      const dx = this.mouse.x - (player?.x ?? 640);
      const dy = this.mouse.y - (player?.y ?? 360);
      const length = Math.hypot(dx, dy) || 1;
      return {
        moveX: Number(this.pressed.has("KeyD")) - Number(this.pressed.has("KeyA")),
        moveY: Number(this.pressed.has("KeyS")) - Number(this.pressed.has("KeyW")),
        aimX: dx / length,
        aimY: dy / length,
        jump: this.pressed.has("Space"),
        fire: this.mouse.down || this.pressed.has("KeyF"),
        block: this.pressed.has("ShiftLeft") || this.pressed.has("KeyG"),
      };
    }
    const aimX = Number(this.pressed.has("KeyL")) - Number(this.pressed.has("KeyJ"));
    const aimY = Number(this.pressed.has("KeyK")) - Number(this.pressed.has("KeyI"));
    if (aimX !== 0 || aimY !== 0) {
      const length = Math.hypot(aimX, aimY);
      this.secondAim = { x: aimX / length, y: aimY / length };
    }
    return {
      moveX: Number(this.pressed.has("ArrowRight")) - Number(this.pressed.has("ArrowLeft")),
      moveY: Number(this.pressed.has("ArrowDown")) - Number(this.pressed.has("ArrowUp")),
      aimX: this.secondAim.x,
      aimY: this.secondAim.y,
      jump: this.pressed.has("Enter") || this.pressed.has("Numpad0"),
      fire: this.pressed.has("KeyO") || this.pressed.has("Numpad1"),
      block: this.pressed.has("KeyP") || this.pressed.has("Numpad2"),
    };
  }
}

class GamepadInput implements InputAdapter {
  sample(slot: number): PlayerInput | null {
    const gamepad = navigator.getGamepads()[slot];
    if (!gamepad) return null;
    const aimX = deadzone(gamepad.axes[2] ?? 0);
    const aimY = deadzone(gamepad.axes[3] ?? 0);
    return {
      moveX: deadzone(gamepad.axes[0] ?? 0),
      moveY: deadzone(gamepad.axes[1] ?? 0),
      aimX: aimX === 0 && aimY === 0 ? (slot === 0 ? 1 : -1) : aimX,
      aimY,
      jump: gamepad.buttons[0]?.pressed ?? false,
      fire: (gamepad.buttons[7]?.pressed ?? false) || (gamepad.buttons[2]?.pressed ?? false),
      block: gamepad.buttons[4]?.pressed ?? false,
    };
  }
}

export class InputManager {
  private readonly keyboard: KeyboardInput;
  private readonly gamepad = new GamepadInput();

  constructor(target: HTMLElement) {
    this.keyboard = new KeyboardInput(target);
  }

  sample(slot: number, playerId: number, snapshot: GameSnapshot): PlayerInput {
    const player = snapshot.entities.find((entity) => entity.id === playerId);
    return this.gamepad.sample(slot) ?? this.keyboard.sample(slot, player)!;
  }
}
