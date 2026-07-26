/**
 * Diagnostic: the kid renders solid black.
 *
 * The kid GLBs are the one asset in this project that DOES ship a texture
 * (EXT_texture_webp, required), unlike the park which is pure vertex colour.
 * So the suspects are: the texture never loaded, the material is not lit, or
 * the mesh has a COLOR_0 attribute that is multiplying everything to zero.
 *
 *   node tools/engine/probe_kidmat.mjs
 */
import { boot, peek } from './probe_lib.mjs';

const { browser, page } = await boot();

const mats = await peek(page, () => {
  const e = window.__engine;
  const out = [];
  for (const m of e.scene.meshes) {
    if (!m.name.startsWith('kid') && m.parent !== e.player.model && m !== e.player.model) continue;
    if (!m.material) continue;
    const mat = m.material;
    out.push({
      mesh: m.name,
      material: mat.name,
      cls: mat.getClassName(),
      verts: m.getTotalVertices?.() ?? 0,
      hasVertexColor: !!m.getVerticesData?.('color'),
      useVertexColors: m.useVertexColors,
      albedo: mat.albedoColor?.asArray?.().map((v) => +v.toFixed(2)) ?? null,
      diffuse: mat.diffuseColor?.asArray?.().map((v) => +v.toFixed(2)) ?? null,
      albedoTex: mat.albedoTexture ? { url: mat.albedoTexture.name, ready: mat.albedoTexture.isReady(), w: mat.albedoTexture.getSize?.().width } : null,
      diffuseTex: mat.diffuseTexture ? { url: mat.diffuseTexture.name, ready: mat.diffuseTexture.isReady() } : null,
      metallic: mat.metallic,
      roughness: mat.roughness,
      unlit: mat.unlit,
    });
  }
  return out;
});
console.log('\nkid materials:');
for (const m of mats) console.log(' ', JSON.stringify(m));

const tex = await peek(page, () => window.__engine.scene.textures.map((t) => ({
  name: t.name, ready: t.isReady(), size: t.getSize ? t.getSize().width : null,
})));
console.log('\nscene textures:', JSON.stringify(tex));

const net = await peek(page, () => performance.getEntriesByType('resource')
  .filter((r) => /webp|png|jpg|kid/i.test(r.name))
  .map((r) => ({ url: r.name.split('/').pop(), size: r.transferSize, dur: Math.round(r.duration) })));
console.log('\nimage requests:', JSON.stringify(net));

const lights = await peek(page, () => window.__engine.scene.lights.map((l) => ({
  name: l.name, cls: l.getClassName(), intensity: l.intensity,
  excluded: l.excludedMeshes.length, included: l.includedOnlyMeshes.length,
})));
console.log('\nlights:', JSON.stringify(lights));

await browser.close();
