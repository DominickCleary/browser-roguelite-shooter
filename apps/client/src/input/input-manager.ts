import { ARENA } from '@game/config'
import type { EntitySnapshot, GameSnapshot, PlayerInput } from '@game/protocol'

interface ViewportBounds {
  left: number
  top: number
  width: number
  height: number
}

export const clientToArenaPoint = (
  clientX: number,
  clientY: number,
  viewport: ViewportBounds
): { x: number; y: number } => {
  if (viewport.width <= 0 || viewport.height <= 0) {
    return { x: ARENA.width / 2, y: ARENA.height / 2 }
  }

  const scale = Math.min(viewport.width / ARENA.width, viewport.height / ARENA.height)
  const offsetX = (viewport.width - ARENA.width * scale) / 2
  const offsetY = (viewport.height - ARENA.height * scale) / 2

  return {
    x: (clientX - viewport.left - offsetX) / scale,
    y: (clientY - viewport.top - offsetY) / scale
  }
}

interface InputAdapter {
  sample(slot: number, player: EntitySnapshot | undefined): PlayerInput
}

const deadzone = (value: number): number => (Math.abs(value) < 0.18 ? 0 : value)

class KeyboardInput implements InputAdapter {
  private readonly pressed = new Set<string>()
  private mouse = {
    clientX: 0,
    clientY: 0,
    hasPosition: false,
    primaryDown: false,
    secondaryDown: false
  }
  private secondAim = { x: -1, y: 0 }

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', (event) => {
      this.pressed.add(event.code)
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code))
        event.preventDefault()
    })
    window.addEventListener('keyup', (event) => this.pressed.delete(event.code))
    target.addEventListener('pointermove', (event) => {
      this.mouse.clientX = event.clientX
      this.mouse.clientY = event.clientY
      this.mouse.hasPosition = true
    })
    target.addEventListener('pointerdown', (event) => {
      if (event.button === 0) this.mouse.primaryDown = true
      if (event.button === 2) {
        event.preventDefault()
        this.mouse.secondaryDown = true
      }
    })
    window.addEventListener('pointerup', (event) => {
      if (event.button === 0) this.mouse.primaryDown = false
      if (event.button === 2) this.mouse.secondaryDown = false
    })
    window.addEventListener('contextmenu', (event) => event.preventDefault())
    window.addEventListener('blur', () => {
      this.pressed.clear()
      this.mouse.primaryDown = false
      this.mouse.secondaryDown = false
    })
  }

  sample(slot: number, player: EntitySnapshot | undefined): PlayerInput {
    if (slot === 0) {
      const pointer = this.mouse.hasPosition
        ? clientToArenaPoint(this.mouse.clientX, this.mouse.clientY, this.target.getBoundingClientRect())
        : { x: ARENA.width / 2, y: ARENA.height / 2 }
      const dx = pointer.x - (player?.x ?? ARENA.width / 2)
      const dy = pointer.y - (player?.y ?? ARENA.height / 2)
      const length = Math.hypot(dx, dy) || 1
      return {
        moveX: Number(this.pressed.has('KeyD')) - Number(this.pressed.has('KeyA')),
        moveY: Number(this.pressed.has('KeyS')) - Number(this.pressed.has('KeyW')),
        aimX: dx / length,
        aimY: dy / length,
        jump: this.pressed.has('Space'),
        fire: this.mouse.primaryDown || this.pressed.has('KeyF'),
        reload:
          this.pressed.has('KeyR') && !this.pressed.has('ControlLeft') && !this.pressed.has('ControlRight'),
        block: this.mouse.secondaryDown || this.pressed.has('ShiftLeft') || this.pressed.has('KeyG')
      }
    }
    const aimX = Number(this.pressed.has('KeyL')) - Number(this.pressed.has('KeyJ'))
    const aimY = Number(this.pressed.has('KeyK')) - Number(this.pressed.has('KeyI'))
    if (aimX !== 0 || aimY !== 0) {
      const length = Math.hypot(aimX, aimY)
      this.secondAim = { x: aimX / length, y: aimY / length }
    }
    return {
      moveX: Number(this.pressed.has('ArrowRight')) - Number(this.pressed.has('ArrowLeft')),
      moveY: Number(this.pressed.has('ArrowDown')) - Number(this.pressed.has('ArrowUp')),
      aimX: this.secondAim.x,
      aimY: this.secondAim.y,
      jump: this.pressed.has('Enter') || this.pressed.has('Numpad0'),
      fire: this.pressed.has('KeyO') || this.pressed.has('Numpad1'),
      reload: this.pressed.has('KeyU'),
      block: this.pressed.has('KeyP') || this.pressed.has('Numpad2')
    }
  }
}

class GamepadInput {
  sample(slot: number): PlayerInput | null {
    const gamepad = navigator.getGamepads()[slot]
    if (!gamepad) return null
    const aimX = deadzone(gamepad.axes[2] ?? 0)
    const aimY = deadzone(gamepad.axes[3] ?? 0)
    return {
      moveX: deadzone(gamepad.axes[0] ?? 0),
      moveY: deadzone(gamepad.axes[1] ?? 0),
      aimX: aimX === 0 && aimY === 0 ? (slot === 0 ? 1 : -1) : aimX,
      aimY,
      jump: gamepad.buttons[0]?.pressed ?? false,
      fire: (gamepad.buttons[7]?.pressed ?? false) || (gamepad.buttons[2]?.pressed ?? false),
      reload: gamepad.buttons[3]?.pressed ?? false,
      block: gamepad.buttons[4]?.pressed ?? false
    }
  }
}

export class InputManager {
  private readonly keyboard: KeyboardInput
  private readonly gamepad = new GamepadInput()

  constructor(target: HTMLElement) {
    this.keyboard = new KeyboardInput(target)
  }

  sample(slot: number, playerId: number, snapshot: GameSnapshot): PlayerInput {
    const player = snapshot.entities.find((entity) => entity.id === playerId)
    return this.gamepad.sample(slot) ?? this.keyboard.sample(slot, player)
  }
}
