/**
 * AMG World Engine — blob shadows.
 *
 * WHY THESE EXIST, honestly. Real shadow mapping in this scene is two
 * bugs deep and one unknown deep. Two were found and fixed (the park
 * material was frozen before the ShadowGenerator existed, so its shader
 * carried no SHADOW defines; and the automatic frustum put the caster at
 * negative clip depth in this right-handed scene, so the shadow map was
 * empty). After both, the kid IS in the map at a valid depth — and the
 * park's thin-instanced ground still shows nothing, while a plain mesh in
 * the same scene does. That last step is unresolved and the brief ranks
 * shadows last, so this is the answer that ships: a soft dark ellipse
 * under each character, which is what kid-facing games have always used.
 *
 * It is not a compromise on the thing that actually matters. What grounds
 * a character is contact — knowing where they stand — and a blob gives
 * that, at one downward ray per character per frame, with no shadow map,
 * no bias, no frustum, and no dependence on how the receiver is drawn.
 *
 * ONE MESH, N THIN INSTANCES: every blob in the world is one draw call,
 * the same trick the park and the tree belts use. The softness is a 64px
 * radial gradient generated at runtime, so it costs no download.
 */
import {
  MeshBuilder, StandardMaterial, DynamicTexture, Color3, Matrix, Vector3, Quaternion,
} from 'babylon';

/** Blob size relative to a kid, and how high they can get before it fades out. */
const RADIUS = 0.34;
const FADE_HEIGHT = 2.2;
const BASE_ALPHA = 0.38;

const _m = new Matrix();
const _from = new Vector3();
const _to = new Vector3();

export class BlobShadows {
  /**
   * @param {Scene} scene
   * @param {() => Array<{position:Vector3}>} subjects  called each frame
   */
  constructor(scene, subjects) {
    this.scene = scene;
    this.subjects = subjects;
    this.max = 12;

    // a soft round falloff, drawn once into a small texture
    const tex = new DynamicTexture('blob_tex', { width: 64, height: 64 }, scene, false);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.72)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    tex.update();
    tex.hasAlpha = true;

    const mat = new StandardMaterial('blob_mat', scene);
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.emissiveColor = Color3.Black();
    mat.disableLighting = true;        // a shadow is not lit by the sun
    mat.opacityTexture = tex;
    mat.alpha = BASE_ALPHA;
    mat.backFaceCulling = false;
    mat.zOffset = -4;                  // never z-fight the ground it lies on

    const quad = MeshBuilder.CreateGround('blob_shadows', { width: 1, height: 1 }, scene);
    quad.material = mat;
    quad.isPickable = false;
    quad.receiveShadows = false;
    quad.alwaysSelectAsActiveMesh = true;
    quad.doNotSyncBoundingInfo = true;
    this.mesh = quad;

    this.buf = new Float32Array(this.max * 16);
    quad.thinInstanceSetBuffer('matrix', this.buf, 16, false);
    this.count = 0;
  }

  /** One downward ray per subject; blobs shrink and fade with height. */
  update() {
    const pe = this.scene.getPhysicsEngine();
    if (!pe) return;
    const subs = this.subjects();
    let n = 0;
    for (const s of subs) {
      if (n >= this.max) break;
      const p = s.position;
      _from.set(p.x, p.y + 1.0, p.z);
      _to.set(p.x, p.y - 3.0, p.z);
      const hit = pe.raycast(_from, _to);
      if (!hit || !hit.hasHit) continue;
      const gy = hit.hitPointWorld.y;
      const air = Math.max(0, p.y - gy);
      if (air > FADE_HEIGHT) continue;
      // higher off the ground: bigger and fainter, like a real penumbra
      const t = air / FADE_HEIGHT;
      const r = RADIUS * (1 + t * 0.7);
      Matrix.ComposeToRef(
        new Vector3(r * 2, 1, r * 2),
        Quaternion.Identity(),
        new Vector3(p.x, gy + 0.015, p.z),
        _m,
      );
      _m.copyToArray(this.buf, n * 16);
      n++;
    }
    // park unused slots at zero scale — the same way the object layer hides
    // a placement, so the buffer never changes size
    for (let i = n; i < this.count; i++) {
      for (let k = 0; k < 16; k++) this.buf[i * 16 + k] = 0;
    }
    this.count = n;
    this.mesh.thinInstanceCount = this.max;
    this.mesh.thinInstanceBufferUpdated('matrix');
  }
}
