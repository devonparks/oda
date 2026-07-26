/**
 * The Inspector, on the backtick key.
 *
 * Having one at all is a third of the reason this project left three.js —
 * every check there was a puppeteer probe because there was no way to look at
 * the scene graph. It only exists in the dev bundle (`/engine/?dev`), because
 * it costs ~900 KB gzipped and students never need it. See
 * tools/engine/build_vendor.mjs for why it is a whole second bundle rather
 * than a lazily-loaded chunk.
 */
import { HAS_INSPECTOR } from 'babylon';

export function toggleInspector(scene) {
  if (!HAS_INSPECTOR) {
    console.warn('[engine] The Inspector is only in the dev bundle — reload with /engine/?dev');
    return false;
  }
  if (scene.debugLayer.isVisible()) {
    scene.debugLayer.hide();
    return false;
  }
  scene.debugLayer.show({ embedMode: true, overlay: true });
  return true;
}
