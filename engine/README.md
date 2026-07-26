# AMG World Engine — Babylon.js + Havok

The successor to the three.js park. **`/world` stays live and untouched** while
this is built; nothing here writes to it, and both read the same asset files.

```
/engine/?          the engine (student bundle)
/engine/?dev       same, plus the Babylon Inspector on the ~ key
```

## Run it

```bash
python -m http.server 3457
```

Then <http://localhost:3457/engine/> — there is no build step for engine code.
`engine/js/*.js` is plain ESM the browser loads directly: edit, refresh, done.

## Layout

| Path | What |
|---|---|
| `index.html` | picks the Babylon bundle via an import map (`?dev` swaps it) |
| `js/boot.js` | engine, scene, Havok, lights, camera, render loop, `window.__engine` |
| `js/park.js` | loads the export and thin-instances all 1103 placements |
| `js/devtools.js` | the Inspector, on backtick |
| `vendor/` | **committed** prebuilt Babylon + Havok + Draco (see below) |

## The three decisions worth knowing

**1. The scene is RIGHT-handed.** `scene.useRightHandedSystem = true`. The Unity
exporter already converts to glTF/three.js convention, so with this flag
Babylon's glTF loader leaves `__root__` at identity and every number the
three.js park measured — collision boxes, seat positions, the water mask, zone
coordinates — still means what it says. Flip it and the whole park silently
mirrors.

**2. Prototype node transforms are BAKED into the geometry.** The OBJ →
Blender → glTF trip puts Blender's Z-up→Y-up conversion on the exported
*nodes*, not in the vertex data. Resetting those nodes to identity (the obvious
thing) lays the park on its side: measured, the fountain came back
2.91 × 2.91 × 1.21 where `park_collision.json` says 2.91 × 1.21 × 2.91.

**3. Vertex colours are converted to sRGB at load.** The art is entirely vertex
colours and glTF declares them linear. three.js applies a linear→sRGB transfer
at output; Babylon's StandardMaterial path does not, so the park rendered dark
olive against the live park's vivid green. Doing the transfer once on the CPU
is exact and free per frame. Tone mapping is deliberately OFF — turning ACES on
to "match three.js" crushed the midtones and made it worse.

All three have long comments at the code; none of them are guesses, and each
was found by a screenshot rather than by a number.

## The vendored bundle

Babylon ships as thousands of ES modules, which an import map cannot serve, and
the hub is a static push-to-deploy site with no bundler. So the dependency —
and only the dependency — is prebuilt and **committed**:

```bash
cd tools/engine && npm install && npm run vendor
node tools/engine/check_payload.mjs      # what a student actually downloads
```

| File | Size | Who gets it |
|---|---|---|
| `vendor/babylon.js` | 3.2 MB (508 KB gz) | everyone |
| `vendor/HavokPhysics.wasm` + `havok.js` | 2.1 MB (656 KB gz) | everyone |
| `vendor/draco/` | 245 KB (73 KB gz) | everyone |
| `vendor/babylon.dev.js` | 12.5 MB | `?dev` only |

≈1.2 MB gzipped for a Chromebook, which is the whole target. The Draco decoder
is vendored rather than pulled from `cdn.babylonjs.com` because the park GLB
lists Draco as *required* — a school filter blocking that host would otherwise
serve a park with no geometry.

`babylon.dev.js` is committed too, so `?dev` works from a fresh clone and from
the deployed site. Rebuilding it churns a large blob in git history; only do it
when the Babylon version changes.

## Verifying

Every check goes through real Chrome. The in-app browser pane freezes
`requestAnimationFrame`, so the world never steps there.

```bash
node tools/engine/probe_boot.mjs      # 13 invariants + 6 screenshots
node tools/engine/probe_scale.mjs     # prototypes vs park_collision.json
node tools/engine/probe_grade.mjs     # colour A/B against the live park
```

Shots land in `tools/engine/_shots/` (gitignored). **Look at them.** The rule
this project runs on: numbers once said "on the chain" while the picture showed
a hand holding air, and the picture was right.
