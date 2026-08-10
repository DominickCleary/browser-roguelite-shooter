import { ARENA } from "@game/config";
import type { EntitySnapshot, GameSnapshot } from "@game/protocol";
import { Application, Container, Graphics, Text } from "pixi.js";

interface EntityVisual {
  container: Container;
  body: Graphics;
  health: Graphics;
  label: Text | null;
}

export class RenderSystem {
  readonly app = new Application();
  private readonly world = new Container();
  private readonly visuals = new Map<number, EntityVisual>();
  private debugVisible = false;

  async initialise(target: HTMLElement): Promise<void> {
    await this.app.init({
      background: "#08111f",
      resizeTo: target,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
    });
    target.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  render(snapshot: GameSnapshot): void {
    const present = new Set(snapshot.entities.map((entity) => entity.id));
    for (const [id, visual] of this.visuals) {
      if (!present.has(id)) {
        visual.container.destroy({ children: true });
        this.visuals.delete(id);
      }
    }
    for (const entity of snapshot.entities) {
      const visual = this.visuals.get(entity.id) ?? this.createVisual(entity);
      visual.container.position.set(entity.x, entity.y);
      visual.container.rotation = entity.rotation;
      visual.container.alpha = entity.alive === false ? 0.25 : 1;
      this.drawEntity(visual, entity);
    }
  }

  toggleDebug(): boolean {
    this.debugVisible = !this.debugVisible;
    return this.debugVisible;
  }

  private createVisual(entity: EntitySnapshot): EntityVisual {
    const container = new Container();
    const body = new Graphics();
    const health = new Graphics();
    container.addChild(body, health);
    const label = entity.kind === "player"
      ? new Text({ text: `P${(entity.playerIndex ?? 0) + 1}`, style: { fill: 0xffffff, fontSize: 16, fontWeight: "bold" } })
      : null;
    if (label) {
      label.anchor.set(0.5);
      container.addChild(label);
    }
    this.world.addChild(container);
    const visual = { container, body, health, label };
    this.visuals.set(entity.id, visual);
    return visual;
  }

  private drawEntity(visual: EntityVisual, entity: EntitySnapshot): void {
    visual.body.clear();
    visual.health.clear();
    const outline = this.debugVisible ? { color: 0x00ffcc, width: 2 } : undefined;
    if (entity.kind === "projectile") {
      visual.body.circle(0, 0, entity.width / 2).fill(0xfff275);
      if (outline) visual.body.circle(0, 0, entity.width / 2).stroke(outline);
    } else {
      const colour = entity.kind === "player" ? (entity.colour ?? 0xffffff) : entity.kind === "crate" ? 0xb7793e : 0x475569;
      visual.body.rect(-entity.width / 2, -entity.height / 2, entity.width, entity.height).fill(colour);
      if (outline) visual.body.rect(-entity.width / 2, -entity.height / 2, entity.width, entity.height).stroke(outline);
    }
    if (entity.kind === "crate") {
      visual.body.moveTo(-22, -22).lineTo(22, 22).moveTo(22, -22).lineTo(-22, 22).stroke({ color: 0x70451f, width: 4 });
    }
    if (entity.kind === "player") {
      if (visual.label) visual.label.position.set(0, 0);
      const healthRatio = (entity.health ?? 0) / (entity.maxHealth ?? 1);
      visual.health.rect(-24, -entity.height / 2 - 13, 48, 6).fill(0x111827);
      visual.health.rect(-24, -entity.height / 2 - 13, 48 * healthRatio, 6).fill(healthRatio > 0.35 ? 0x6bf178 : 0xff5964);
      if (entity.blocking) visual.health.circle(0, 0, 42).stroke({ color: 0x78e3fd, width: 6, alpha: 0.85 });
    }
  }

  private resize(): void {
    const scale = Math.min(this.app.screen.width / ARENA.width, this.app.screen.height / ARENA.height);
    this.world.scale.set(scale);
    this.world.position.set(
      (this.app.screen.width - ARENA.width * scale) / 2,
      (this.app.screen.height - ARENA.height * scale) / 2,
    );
  }
}
