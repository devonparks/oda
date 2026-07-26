/**
 * The DEV bundle: everything the student bundle exports, plus the Inspector.
 *
 * Same module specifier (`babylon`) either way, so engine source never knows
 * which one it got — engine/index.html swaps the import map on `?dev`.
 * See build_vendor.mjs for why this is a second self-contained bundle rather
 * than a shared chunk or a CDN script.
 *
 * Importing `@babylonjs/inspector` is enough to register it on
 * `scene.debugLayer`; `showInspector()` in engine/js/devtools.js then just
 * calls `scene.debugLayer.show()`.
 */
export * from './vendor_entry.js';

import '@babylonjs/core/Debug/debugLayer.js';
import '@babylonjs/inspector';

/** True only in the dev bundle — devtools.js uses it to decide if `~` works. */
export const HAS_INSPECTOR = true;
