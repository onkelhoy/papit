# @papit/game-network

Peer-to-peer multiplayer for browser games: a lobby, games joined by a short code, messages. Built on
[`@papit/webrtc`](https://github.com/onkelhoy/papit/tree/main/packages/network/webrtc).

```bash
npm install @papit/game-network
```

## Quick start

```ts
import { GameNetwork } from "@papit/game-network";

const net = new GameNetwork({
  signal: "wss://my-signal-server",
  app: "my-game",
  lobby: true,
  profile: { name: "Ada" },
});

// back into the game of before a reload (seen < 5 min ago), as host or guest
net.addEventListener("trying", e => showReconnecting(e.detail));   // net.cancel() gives up
await net.resume();

// host
const game = await net.createGame({
  name: "Ada's game",
  public: true,
  max: 4,
  password: "optional",
});
share(net.inviteLink()); // https://…/?g=K7QF2M  (URL or QR)

// guest, from the link
const code = GameNetwork.inviteCode(); // "K7QF2M" or null
const game = await net.joinGame(code, { password });

// play
game.onMessage("move", (data, from) => {});
game.broadcast("move", { x: 1 });
game.send(peerId, "hit", { hp: 3 });
game.on("join", ({ player }) => {});
game.on("leave", ({ player, reason }) => {});
game.on("end", (reason) => {});

// lobby (lobby: true)
await net.listGames(); // public, open games
await net.listPlayers(); // who's around
```

## How it works

```
signal server ── sees one network: the lobby ("my-game")
      │
   lobby  (chord, every player of the app)
      │   ├─ directory "games":   code → how to join   (+ list of public games)
      │   └─ directory "players": who's in the lobby   (lobby: true)
      │
      ├── game K7QF2M  (mesh, carried by the lobby)
      └── game P3WX9A
```

- **Lobby**: one public network per app (and `version`). The first player makes it, the others join it.
  If two get made at the same time, they merge. The signal server only sees this one network.
- **Games**: mesh networks whose first contact goes _through the lobby_, so the server never sees them.
  Once connected, links are direct: **a game keeps playing when the lobby goes**.
- **Directory**: a small key/value table living inside the lobby (no server). The host writes its game
  under its code every few seconds; a guest asks for the code and gets what it needs to join.
- **Host** keeps a lobby open (so newcomers and the dropped find the game), and finds or makes one again when it's lost.
- **Guest** leaves the lobby once it's let in, unless it's the lobby's anchor (the one keeping the server socket).
- **Admission**: the host answers each guest's `hello` with `welcome` or `denied` (full, locked,
  password, kicked). See `src/game/protocol.ts` for every message.
- **Drops and reloads**: `sessionStorage` remembers the code, role and a token, kept fresh while in
  the game. After a reload `resume()` reconnects to a game seen less than `timing.resume` (5 min) ago,
  and keeps trying for `timing.reconnect` (`reconnecting`, `trying` events, `cancel()`). A guest gets its
  place back (the token skips lock/max/password). A host takes its game back from whoever holds it, and
  only opens it fresh when the lobby clearly knows nothing of the code: never on silence, so no two games.
- **The host drops**: the next player in join order steps in, and hands it back when the owner returns
  (e.g. after a reload, `resume()`). `createGame({ ownership })` decides what the stand-in may do:

  - `single` (default): it only holds the game: no newcomers, and it ends if the owner isn't back in `timing.reconnect`.
    The owner leaving on purpose ends it for everyone.
  - `shared`: it's a full host, the game goes on without the owner.

  So anyone can step in, every player keeps the host's state (password, kicks, who's who). Tokens are
  only shared as hashes: a stand-in knows a returning player, but can't pretend to be one.

## Settings

|           |                      |                                                                                             |
| --------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `signal`  | required             | `ws://` / `wss://` signal server. `/health` and `/networks` are fetched from its HTTP side. |
| `app`     | required             | The lobby's name. Also prefixes game ids and storage keys.                                  |
| `lobby`   | `false`              | `true` lists games and players. Off: games are joined by code only.                         |
| `profile` | `{}`                 | Sent when joining, shown in the lobby. `setProfile()` to change it.                         |
| `version` | `1`                  | Bump when your messages change: other versions get their own lobby.                         |
| `rtc`     | Google STUN          | `RTCConfiguration`. Add TURN for strict networks.                                           |
| `timing`  | see `DEFAULT_TIMING` | Every wait and interval, in ms.                                                             |
| `storage` | `sessionStorage`     | Where the last game is remembered. `null` turns resume off.                                 |

## API

**`GameNetwork`**: `ready`, `status`, `game`, `createGame(options)`, `joinGame(code, options)`, `leaveGame()`,
`resume()`, `reconnecting`, `cancel()`, `last`, `inviteLink(code?)`, `listGames()`, `listPlayers()`, `setProfile()`, `close()`.
Events: `status`, `game`, `trying`.

**`Game`**: `code`, `me`, `host`, `isHost`, `info`, `players`, `player(id)`, `network` (papit, for `media`),
`send`, `broadcast`, `onMessage(type | "*")`, `on(event)`, `leave()`.
Events also: `host` (someone else hosts now). Host only: `lock()`, `update({ name, public, max, password, meta })`, `kick(id)`.
Events: `join`, `leave`, `update`, `reconnecting`, `reconnected`, `end`.

`joinGame` rejects with a `GameError`; its `reason` is `not-found`, `full`, `locked`, `password`, `kicked` or `gone`.

## Files

```
src/
  network.ts        GameNetwork: the one class you use
  settings.ts       Settings → Config, defaults, timing
  types.ts          shared types, GameError
  lobby/
    lobby.ts        finding / making / merging the one lobby
    directory.ts    key/value records kept inside the lobby
  game/
    game.ts         Game: host and guest logic
    protocol.ts     the game's own messages
    code.ts         codes (K7QF2M) and invite links
    memory.ts       the tab's last game, for reloads
```

## Tests

```bash
npm test                      # all browsers; the game tests run in chromium only
npm run test:chrome
```

The game tests use real WebRTC between browser contexts, through a local signal server
(`@papit/signal-server` on port 3599, started by `tests/playwright.config.ts`).

## Known gaps

- A player that only lost its own link to the host can step in alone (a split). Rare in small games.
- The directory's lists live on one peer each, fine for a few hundred players.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.
