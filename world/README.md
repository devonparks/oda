# AMG World — Recess Park

A persistent 3D hub for AMG Hub. Students walk around a park as their own kid
character, run into classmates, collect coins and step into games. The brief was
Poptropica × Club Penguin × PlayStation Home; it has to run in a browser on a
school Chromebook.

Entry point: **student.html → World tab**, or `world/index.html` directly.

---

## What's in it

| | |
|---|---|
| **World** | The Synty POLYGON Kids demo park — playground, skate park, pond, sandpit, picnic lawn, sports field. ~52 × 43 m. |
| **Character** | Any of the 16 kid GLBs already in `assets/characters/`. Picked on entry, remembered after. |
| **Movement** | WASD/arrows + Shift to run + Space to jump; touch stick on the left half; tap the ground to walk there. |
| **Zones** | 6 glowing portals. Each opens a *category* of hub games (Multiplayer, Action, Sports, Puzzle, Word, Strategy) rather than one fixed game. |
| **Activities** | Coin rides (spend 5, small chance of a payout), the duck pond, the bike rack. |
| **Coins** | 30 pickups along the paths, respawning after 90 s, paid into the shared `students/{id}.coins` balance in batches. |
| **Social** | 8 emotes, safe canned chat, nametags, speech bubbles, live player count. |
| **Multiplayer** | Firebase Realtime Database presence. Runs solo and says so if no RTDB instance exists. |

---

## Turning multiplayer on

The world ships working but solo. To enable presence:

1. Firebase console → **Realtime Database** → Create Database → locked mode.
2. ```bash
   firebase deploy --only database
   ```
   (rules live in `database.rules.json` at the repo root)

That's it — `presence.js` finds the instance and switches itself on. If the
instance is missing it logs one warning, shows "Playing solo", and everything
else keeps working. A missing backend is never a black screen for a classroom.

### Why RTDB and not Firestore

Firestore bills per document write. Even a polite 2 Hz position feed is roughly
2,400 writes per player per 20-minute session — one class would burn the daily
free quota before lunch. RTDB is priced on bandwidth, keeps one socket open, and
gives us `onDisconnect()` so a kid who shuts the lid actually disappears.

---

## Safety

There is **no free-text chat and there must never be**. Real 9–13 year olds use
this in classrooms, and an open text field is a moderation obligation nobody is
staffed for.

Chat is a fixed phrase book (`js/chat.js`) and the network only ever carries an
**index** into it. `renderPhrase()` is the single place a number becomes words.
A hostile client can at worst make someone say "Nice one!".

Display names come from the teacher-managed roster and are re-sanitised on
render (`safeName()`), so a nametag can't smuggle in markup or a URL.

Presence nodes are keyed by the anonymous-auth UID, not the roster studentId —
that's what lets `database.rules.json` enforce "you may only move your own
avatar". A client-supplied roster id proves nothing.

---

## Performance

The budget is a school Chromebook (Intel UHD / Mali), which starts dropping
frames somewhere past ~200 draw calls.

| | |
|---|---|
| Static park | **1** draw call — 930 renderers pre-merged at build time |
| Props | **1** merged batch + ~12 that actually animate |
| Coins | **1** InstancedMesh |
| Avatars | ~4 each (body, hood, eyes, face), capped at the 24 nearest players |
| Download | 1.34 MB park + 417 KB props + ~400 KB character. **No textures at all** — the Synty atlas is baked into vertex colours. |

Measured solo on `medium` with shadows on: **49 draw calls, 206k triangles**.
(The shadow pass re-draws casters, which is most of the gap between that and
the object count.) `low` turns shadows off and roughly halves it.

Three quality tiers (`low` / `medium` / `high`) are offered on the entry screen
and control pixel ratio, shadows and fog distance. "Smooth (Chromebook)" turns
shadows off entirely.

---

## Files

```
world/
  index.html        shell: loading, character picker, HUD, modals
  css/world.css     HUD + screens (inherits ../css/oda-theme.css tokens)
  js/
    main.js         bootstrap, frame loop, coins, HUD wiring
    world.js        renderer, sky, terrain load, player physics, camera
    avatar.js       player + remote avatars, nametags, bubbles
    animator.js     procedural walk/run/idle/jump + 8 emotes
    collision.js    uniform-grid AABB collision with step-up
    input.js        keyboard + touch stick + tap-to-move
    presence.js     RTDB multiplayer, with a solo fallback
    chat.js         the phrase book — index-only on the wire
    zones.js        portals, activities, coin spots, spawn
  assets/           generated — see tools/world/README.md
```

`window.__world` is exposed for debugging: `__world.stats()` for draw calls and
position, `__world.tp(x, z)` to teleport. Same idea as Drop4's
`window.__gameStore`.

---

## Known gaps

- **Mobile has not been tested on a real device.** The touch stick, tap-to-move
  and safe-area insets are all implemented, but browser window resizing doesn't
  faithfully reproduce a phone — this needs a real phone/tablet pass.
- Playground structures are solid obstacles rather than climbable. Boxes under
  0.42 m are stepped onto, so kerbs and edges are fine, but you can't currently
  climb to the top of the slide.
- Audio covers footsteps, coins, jump, emotes, chat and zone entry via `odaSfx`,
  but there's no ambience (birds, distant playground) and no music.
- Only one room ("park"). `presence.js` already keys on a room name, so a second
  zone is mostly a matter of building it.
