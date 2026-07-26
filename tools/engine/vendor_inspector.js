/**
 * The Inspector, as its own lazily-loaded entry.
 *
 * Built alongside vendor_entry.js with esbuild code splitting so both share
 * ONE copy of Babylon — see the comment in build_vendor.mjs for why a CDN
 * <script> inspector cannot work against a vendored ESM engine.
 *
 * Importing this module is enough: `Inspector` registers itself on
 * `scene.debugLayer`, so engine/js/devtools.js only has to import it and then
 * call `scene.debugLayer.show()`.
 */
import "@babylonjs/core/Debug/debugLayer.js";
export { Inspector } from "@babylonjs/inspector";
