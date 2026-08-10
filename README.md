# Browser Brawl

A browser-first 2D PvP shooter vertical slice using strict TypeScript, PixiJS rendering, Rapier 2D physics, and an authoritative Colyseus server.

## Run it

Requirements: Node 20+ and pnpm 10.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`. Local Game runs the simulation and Rapier entirely in the browser. Host Online requires the server on port `2567`; share the four-character room code with a second browser.

Useful checks:

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Controls

- Player 1: WASD, mouse aim, click/F shoot, Space jump, Left Shift/G block.
- Player 2: arrow keys, IJKL aim, O/Numpad 1 shoot, Enter/Numpad 0 jump, P/Numpad 2 block.
- Gamepad: left stick move, right stick aim, A jump, RT/X shoot, LB block.
- F3 toggles the debug and collider overlay. Ctrl+R forces a round reset.

## Architecture

`@game/simulation` owns entity IDs, composable gameplay data, systems, events, and snapshots. It imports neither PixiJS nor Colyseus. `@game/physics` implements its small physics port with Rapier. The client chooses either `LocalGameHost` (direct fixed-step simulation) or `OnlineGameHost` (input messages and interpolated snapshots). PixiJS only maintains a visual registry keyed by entity ID. The server runs the same simulation and physics packages at 60 Hz and publishes compact snapshots at 20 Hz.

A network connection owns an array of player IDs, leaving room for hybrid couch/online players without changing authoritative ownership.

## Intentionally deferred

Roguelite cards and drafting, synergy rules, Supernova/Overpower/Reflect, destructible terrain and materials, advanced rigid-body level mechanics, client reconciliation, lag compensation, matchmaking, accounts, persistence, statistics, mobile UI, cosmetics, procedural generation, and offline PWA caching are all later milestones.
