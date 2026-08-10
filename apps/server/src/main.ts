import { WebSocketTransport } from "@colyseus/ws-transport";
import { Server } from "colyseus";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRoom } from "./networking/room-registry.js";
import { ArenaRoom } from "./rooms/arena-room.js";

const port = Number(process.env.PORT ?? 2567);
const app = express();
app.use(cors());
app.use(express.json());
app.get("/api/health", (_request, response) => response.json({ ok: true }));
app.get("/api/rooms/:code", (request, response) => {
  const roomId = resolveRoom(request.params.code);
  if (!roomId) return response.status(404).json({ error: "Room not found" });
  return response.json({ roomId });
});

const clientDist = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("/{*splat}", (_request, response) => response.sendFile(resolve(clientDist, "index.html")));
}

const httpServer = createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define("arena", ArenaRoom);

await gameServer.listen(port);
console.log(`Browser Brawl server listening on http://localhost:${port}`);
