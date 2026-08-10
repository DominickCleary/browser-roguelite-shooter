import type { GameSnapshot } from "@game/protocol";
import { InputManager } from "./input/input-manager.js";
import type { GameHost } from "./networking/game-host.js";
import { LocalGameHost } from "./networking/local-game-host.js";
import { OnlineGameHost } from "./networking/online-game-host.js";
import { RenderSystem } from "./rendering/render-system.js";
import "./styles.css";

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.querySelector<T>(`#${id}`);
  if (!found) throw new Error(`Missing #${id}`);
  return found;
};

const canvasTarget = element<HTMLDivElement>("game-canvas");
const lobby = element<HTMLElement>("lobby");
const roomPanel = element<HTMLElement>("room-panel");
const roomTitle = element<HTMLElement>("room-title");
const roomPlayers = element<HTMLElement>("room-players");
const startButton = element<HTMLButtonElement>("start-button");
const message = element<HTMLElement>("lobby-message");
const scoreboard = element<HTMLElement>("scoreboard");
const banner = element<HTMLElement>("round-banner");
const debug = element<HTMLElement>("debug");
const leaveButton = element<HTMLButtonElement>("leave-button");
const renderSystem = new RenderSystem();
await renderSystem.initialise(canvasTarget);
const inputs = new InputManager(canvasTarget);

let host: GameHost | null = null;
let lastTime = performance.now();
let frames = 0;
let fps = 0;
let fpsTimer = 0;
let debugEnabled = false;

const setBusy = (text: string): void => {
  message.textContent = text;
  for (const button of lobby.querySelectorAll("button")) button.setAttribute("disabled", "true");
};

const clearBusy = (): void => {
  for (const button of lobby.querySelectorAll("button")) button.removeAttribute("disabled");
};

const enterGame = (newHost: GameHost): void => {
  host = newHost;
  lobby.classList.add("hidden");
  scoreboard.classList.remove("hidden");
  leaveButton.classList.remove("hidden");
  if (newHost.info.mode === "online") {
    roomPanel.classList.remove("hidden");
    refreshRoomPanel(newHost.getSnapshot());
  }
};

const refreshRoomPanel = (snapshot: GameSnapshot): void => {
  if (!host || host.info.mode !== "online") return;
  roomTitle.textContent = `ROOM ${host.info.roomCode ?? "----"}`;
  if (host.info.roomCode && new URLSearchParams(location.search).get("room") !== host.info.roomCode) {
    history.replaceState(null, "", `?room=${host.info.roomCode}`);
  }
  const players = snapshot.entities.filter((entity) => entity.kind === "player").length;
  roomPlayers.textContent = `${players} player${players === 1 ? "" : "s"} connected${players < 2 ? " · waiting for a friend" : " · ready"}`;
  startButton.classList.toggle("hidden", !host.info.isRoomHost);
  if (snapshot.round.phase !== "lobby") roomPanel.classList.add("hidden");
};

element<HTMLButtonElement>("local-button").addEventListener("click", async () => {
  setBusy("Starting local physics…");
  try { enterGame(await LocalGameHost.create()); } catch (error) { message.textContent = String(error); clearBusy(); }
});

element<HTMLButtonElement>("host-button").addEventListener("click", async () => {
  setBusy("Creating room…");
  try { enterGame(await OnlineGameHost.createRoom()); } catch (error) { message.textContent = `Could not reach the server: ${String(error)}`; clearBusy(); }
});

element<HTMLButtonElement>("join-button").addEventListener("click", async () => {
  const code = element<HTMLInputElement>("room-code").value.trim();
  if (code.length !== 4) { message.textContent = "Enter a four-letter room code."; return; }
  setBusy("Joining room…");
  try { enterGame(await OnlineGameHost.joinRoom(code)); } catch (error) { message.textContent = error instanceof Error ? error.message : String(error); clearBusy(); }
});

startButton.addEventListener("click", () => host?.start());
leaveButton.addEventListener("click", async () => {
  await host?.dispose();
  host = null;
  roomPanel.classList.add("hidden");
  scoreboard.classList.add("hidden");
  banner.classList.add("hidden");
  leaveButton.classList.add("hidden");
  lobby.classList.remove("hidden");
  message.textContent = "";
  history.replaceState(null, "", location.pathname);
  clearBusy();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "F3") {
    event.preventDefault();
    debugEnabled = renderSystem.toggleDebug();
    debug.classList.toggle("hidden", !debugEnabled);
  }
  if (event.code === "KeyR" && event.ctrlKey) host?.resetRound();
});

const updateHud = (snapshot: GameSnapshot): void => {
  const players = snapshot.entities.filter((entity) => entity.kind === "player");
  scoreboard.textContent = players.map((player) => `P${(player.playerIndex ?? 0) + 1}  ${snapshot.round.scores[player.id] ?? 0}`).join("   ·   ");
  if (snapshot.round.phase === "round-over" || snapshot.round.phase === "match-over") {
    const winner = players.find((player) => player.id === snapshot.round.winnerId);
    banner.textContent = `${snapshot.round.phase === "match-over" ? "MATCH" : "ROUND"} — ${winner ? `P${(winner.playerIndex ?? 0) + 1} WINS` : "DRAW"}`;
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
};

const frame = (now: number): void => {
  const dt = Math.min((now - lastTime) / 1_000, 0.1);
  lastTime = now;
  frames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) { fps = Math.round(frames / fpsTimer); frames = 0; fpsTimer = 0; }
  if (host) {
    const before = host.getSnapshot();
    host.info.controlledPlayerIds.forEach((playerId, slot) => host?.submitInput(playerId, inputs.sample(slot, playerId, before)));
    host.update(dt);
    const snapshot = host.getSnapshot();
    renderSystem.render(snapshot);
    refreshRoomPanel(snapshot);
    updateHud(snapshot);
    if (debugEnabled) {
      debug.textContent = [
        `FPS             ${fps}`,
        `simulation tick ${snapshot.tick}`,
        `ping            ${host.info.ping === null ? "—" : `${host.info.ping} ms`}`,
        `entities        ${snapshot.entities.length}`,
        `physics bodies  ${snapshot.physicsBodyCount}`,
        `room            ${host.info.roomCode ?? "—"}`,
        `mode            ${host.info.mode}`,
        "",
        "F3 debug · Ctrl+R reset",
      ].join("\n");
    }
  }
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

const roomFromUrl = new URLSearchParams(location.search).get("room");
if (roomFromUrl) element<HTMLInputElement>("room-code").value = roomFromUrl.toUpperCase().slice(0, 4);
