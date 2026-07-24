/**
 * AMG World — scene, terrain, player controller and camera.
 *
 * Draw-call budget is the whole design constraint here. Target hardware is a
 * school Chromebook (Intel UHD / Mali), which starts dropping frames somewhere
 * north of ~200 draw calls. So:
 *   - the park's 930 static renderers arrive pre-merged as ONE mesh (1 call)
 *   - the 187 prop placements get merged too, except the dozen that animate
 *   - coins are a single InstancedMesh
 *   - avatars are the only per-player cost, and presence.js caps them at 24
 * That lands a full park with a class in it at roughly 40 draw calls.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { CollisionWorld } from './collision.js';
import { ZONES, ACTIVITIES, COIN_SPOTS, SPAWN } from './zones.js';

/** Props that must stay separate objects because they move. */
const ANIMATED = ['Swings', 'Seesaw', 'Rocker', 'Coin_Ride', 'Track_Ride', 'Kite', 'Ball_0'];

export const QUALITY = {
  low:    { pixelRatio: 1,    shadows: false, shadowSize: 0,    fogNear: 26, fogFar: 62,  antialias: false },
  medium: { pixelRatio: 1.5,  shadows: true,  shadowSize: 1024, fogNear: 40, fogFar: 95,  antialias: true },
  high:   { pixelRatio: 2,    shadows: true,  shadowSize: 2048, fogNear: 55, fogFar: 130, antialias: true },
};

export class World {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.quality = QUALITY[opts.quality] || QUALITY.medium;
    this.qualityName = opts.quality || 'medium';

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: this.quality.antialias, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    if (this.quality.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd0f5);
    this.scene.fog = new THREE.Fog(0xbfe4fb, this.quality.fogNear, this.quality.fogFar);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 240);
    this.camYaw = SPAWN.yaw;
    this.camPitch = 0.30;
    this.camDist = 7.0;
    this.camPos = new THREE.Vector3();

    this._buildLights();
    this._buildSky();

    this.collision = new CollisionWorld();
    this.animatedProps = [];
    this.coins = null;
    this.coinState = [];
    this.zoneMarkers = [];
    this.clock = new THREE.Clock();

    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x5d7a4a, 1.5));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
    sun.position.set(28, 42, 18);
    if (this.quality.shadows) {
      sun.castShadow = true;
      const s = this.quality.shadowSize;
      sun.shadow.mapSize.set(s, s);
      // A tight ortho box around the player keeps texel density usable; the box
      // is re-centred every frame in update().
      const R = 18;
      Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 110 });
      sun.shadow.bias = -0.0012;
      sun.shadow.normalBias = 0.03;
    }
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  /** Big inverted sphere with a vertical gradient — cheaper than a cubemap. */
  _buildSky() {
    const geo = new THREE.SphereGeometry(180, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x3f9fe8) },
        mid: { value: new THREE.Color(0x9ed8f7) },
        bot: { value: new THREE.Color(0xdff1ff) },
      },
      vertexShader: `varying vec3 vPos;
        void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vPos; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
        void main(){
          float h = normalize(vPos).y;
          vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.65)) : mix(mid, bot, pow(-h, 0.5));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false;
    this.scene.add(sky);

    // A few soft clouds so the sky isn't a flat wall.
    const cloudTex = makeCloudTexture();
    const cloudMat = new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.62, depthWrite: false, fog: false,
    });
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(cloudMat);
      const a = (i / 14) * Math.PI * 2 + Math.random();
      const r = 70 + Math.random() * 60;
      s.position.set(Math.cos(a) * r, 34 + Math.random() * 22, Math.sin(a) * r);
      const sc = 26 + Math.random() * 30;
      s.scale.set(sc, sc * 0.5, 1);
      this.scene.add(s);
    }
  }

  /** Load the park. Reports 0..1 progress through onProgress. */
  async load(onProgress = () => {}) {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
    loader.setDRACOLoader(draco);

    onProgress(0.05, 'Loading the park…');
    const [staticGltf, propsGltf, layout, collision] = await Promise.all([
      loader.loadAsync('assets/park_static.glb'),
      loader.loadAsync('assets/park_props.glb'),
      fetch('assets/park_props_layout.json').then((r) => r.json()),
      fetch('assets/park_collision.json').then((r) => r.json()),
    ]);
    onProgress(0.55, 'Building the world…');

    // ---- static shell ----
    const shell = staticGltf.scene;
    shell.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = this.quality.shadows;
      o.castShadow = false;                 // the shell shadowing itself is noise
      o.material = parkMaterial(o.material);
    });
    this.scene.add(shell);
    this.shell = shell;

    // ---- props ----
    const protos = new Map();
    propsGltf.scene.traverse((o) => { if (o.isMesh) protos.set(o.name, o); });
    this._placeProps(protos, layout);
    onProgress(0.78, 'Setting out the toys…');

    // ---- collision ----
    for (const box of collision) this.collision.add(box);
    const xs = collision.map((b) => b.c[0]), zs = collision.map((b) => b.c[2]);
    this.collision.bounds = {
      minX: Math.min(...xs) - 3, maxX: Math.max(...xs) + 3,
      minZ: Math.min(...zs) - 3, maxZ: Math.max(...zs) + 3,
    };

    this._buildCoins();
    this._buildZoneMarkers();
    onProgress(1, 'Ready');
    draco.dispose();
    return this;
  }

  _placeProps(protos, layout) {
    const merge = [];      // geometries for the static-prop batch
    const dummy = new THREE.Object3D();
    for (const p of layout) {
      const proto = protos.get(p.mesh);
      if (!proto) continue;
      dummy.position.fromArray(p.p);
      dummy.quaternion.fromArray(p.q);
      dummy.scale.fromArray(p.s);
      dummy.updateMatrix();

      if (ANIMATED.some((k) => p.mesh.includes(k))) {
        const m = new THREE.Mesh(proto.geometry, parkMaterial(proto.material));
        m.applyMatrix4(dummy.matrix);
        m.castShadow = this.quality.shadows;
        m.receiveShadow = this.quality.shadows;
        m.userData.kind = p.mesh;
        m.userData.rest = m.rotation.clone();
        m.userData.phase = Math.random() * Math.PI * 2;
        this.scene.add(m);
        this.animatedProps.push(m);
      } else {
        merge.push(proto.geometry.clone().applyMatrix4(dummy.matrix));
      }
    }
    if (merge.length) {
      const geo = BufferGeometryUtils.mergeGeometries(merge, false);
      const mesh = new THREE.Mesh(geo, parkMaterial(null));
      mesh.castShadow = this.quality.shadows;
      mesh.receiveShadow = this.quality.shadows;
      this.scene.add(mesh);
      this.propBatch = mesh;
      merge.forEach((g) => g.dispose());
    }
  }

  _buildCoins() {
    const geo = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 14);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd54a, emissive: 0xffae00, emissiveIntensity: 0.45,
      roughness: 0.35, metalness: 0.4,
    });
    const inst = new THREE.InstancedMesh(geo, mat, COIN_SPOTS.length);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.castShadow = false;
    inst.frustumCulled = false;
    this.scene.add(inst);
    this.coins = inst;
    // Ground under a coin never moves, so resolve it ONCE here instead of
    // calling groundAt() per coin every frame (~1800 grid lookups/sec saved).
    this.coinState = COIN_SPOTS.map(([x, z]) => ({
      x, z, y: 0, taken: false, respawnAt: 0, phase: Math.random() * Math.PI * 2,
      groundY: this.collision.groundAt(x, z, 2),
    }));
  }

  _buildZoneMarkers() {
    for (const z of [...ZONES, ...ACTIVITIES]) {
      const group = new THREE.Group();
      const color = z.color ?? 0x7dd3fc;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry((z.radius || 3) * 0.72, (z.radius || 3) * 0.86, 40),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.42,
          side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      group.add(ring);

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry((z.radius || 3) * 0.72, (z.radius || 3) * 0.72, 6, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.09,
          side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      beam.position.y = 3;
      group.add(beam);

      const sign = makeZoneSign(z);
      sign.position.y = 3.6;
      group.add(sign);

      group.position.set(z.pos[0], 0, z.pos[1]);
      group.userData.zone = z;
      group.userData.sign = sign;
      group.userData.ring = ring;
      this.scene.add(group);
      this.zoneMarkers.push(group);
    }
  }

  // ---- player -------------------------------------------------------------

  /** Move the local player for one frame. Returns useful per-frame facts. */
  stepPlayer(avatar, intent, dt) {
    // Kid-scale speeds. These are deliberately slower than a typical 3rd-person
    // game: the avatars are 1.2 m tall and the Synty locomotion clips were
    // authored for adults, so anything faster makes the legs whirl. Keep in
    // sync with GAIT in clips.js.
    const WALK = 1.6, RUN = 3.4, ACCEL = 18, GRAVITY = -19, JUMP = 5.4;

    // Camera-relative desired direction.
    //
    // (fx, fz) is the BOOM direction: updateCamera puts the camera at
    // focus + dir*dist with dir = (sin camYaw, cos camYaw), i.e. it points from
    // the player OUT TO the camera. So the way you're looking is MINUS that.
    // W (move.y = -1, screen-up) therefore has to move along -(fx, fz); using
    // +(fx, fz) walked the kid straight back into the camera, which is why W and
    // S felt swapped. The strafe terms are unchanged — (fz, -fx) is already
    // screen-right for this yaw convention.
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    let dx = intent.move.x * fz + intent.move.y * fx;
    let dz = -intent.move.x * fx + intent.move.y * fz;

    // tap-to-move steers toward a world point until it is reached
    if (intent.target && Math.hypot(intent.move.x, intent.move.y) < 0.05) {
      const tx = intent.target.x - avatar.pos.x, tz = intent.target.z - avatar.pos.z;
      const d = Math.hypot(tx, tz);
      if (d < 0.45) intent.clearTarget && intent.clearTarget();
      else { dx = tx / d; dz = tz / d; }
    }

    const wish = Math.hypot(dx, dz);
    const maxSpeed = intent.run ? RUN : WALK;
    const target = wish > 0.01 ? maxSpeed : 0;
    avatar.speed += THREE.MathUtils.clamp(target - avatar.speed, -ACCEL * dt, ACCEL * dt);
    if (avatar.speed < 0.02) avatar.speed = 0;

    if (wish > 0.01) {
      avatar.targetYaw = Math.atan2(dx, dz);
      // turn toward travel direction rather than snapping — reads as momentum
      let d = (avatar.targetYaw - avatar.yaw) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      avatar.yaw += d * Math.min(1, 14 * dt);
    }

    let nx = avatar.pos.x, nz = avatar.pos.z;
    if (avatar.speed > 0 && wish > 0.01) {
      nx += (dx / wish) * avatar.speed * dt;
      nz += (dz / wish) * avatar.speed * dt;
    }

    const clamped = this.collision.clampToBounds(nx, nz, 1.2);
    const solved = this.collision.resolve(clamped.x, clamped.z, avatar.pos.y);
    avatar.pos.x = solved.x;
    avatar.pos.z = solved.z;

    // vertical
    const ground = this.collision.groundAt(avatar.pos.x, avatar.pos.z, avatar.pos.y);
    if (intent.jump && avatar.grounded) { avatar.vel.y = JUMP; avatar.grounded = false; }
    avatar.vel.y += GRAVITY * dt;
    avatar.pos.y += avatar.vel.y * dt;
    if (avatar.pos.y <= ground) {
      avatar.pos.y = ground;
      avatar.vel.y = 0;
      if (!avatar.grounded) avatar.landedThisFrame = true;
      avatar.grounded = true;
      avatar.airTime = 0;
    } else {
      avatar.grounded = false;
      avatar.airTime += dt;
    }

    return { moving: avatar.speed > 0.05, ground };
  }

  updateCamera(avatar, look, zoom, dt) {
    this.camYaw -= look.x * 0.0045;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + look.y * 0.0035, -0.12, 1.15);
    this.camDist = THREE.MathUtils.clamp(this.camDist + zoom * 3.2, 3.2, 14);

    // Reuse scratch vectors — updateCamera runs every frame, so allocating here
    // is 200+ short-lived Vector3s/sec of GC pressure on a Chromebook.
    const focus = (this._camFocus || (this._camFocus = new THREE.Vector3()))
      .set(avatar.pos.x, avatar.pos.y + 1.25, avatar.pos.z);
    const dir = (this._camDir || (this._camDir = new THREE.Vector3())).set(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch),
    );
    let dist = this.camDist;
    // keep the camera out of scenery: shorten the boom if a box is in the way
    const hitDist = this._boomBlocked(focus, dir, dist);
    if (hitDist != null) dist = Math.max(1.6, hitDist - 0.35);

    const want = (this._camWant || (this._camWant = new THREE.Vector3()))
      .copy(focus).addScaledVector(dir, dist);
    want.y = Math.max(want.y, this.collision.groundAt(want.x, want.z, 0) + 0.7);
    // critically-damped-ish follow: snappy but never jittery. First frame snaps
    // into place instead of swooping in from the world origin (camPos starts 0).
    if (!this._camReady) { this.camPos.copy(want); this._camReady = true; }
    else this.camPos.lerp(want, 1 - Math.exp(-13 * dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(focus);
  }

  /** Cheapest useful boom check: sample along the boom against collision boxes. */
  _boomBlocked(from, dir, dist) {
    const steps = 8;
    for (let i = 2; i <= steps; i++) {
      const t = (i / steps) * dist;
      const x = from.x + dir.x * t, y = from.y + dir.y * t, z = from.z + dir.z * t;
      // nearShared, not near: this ran 7 times a frame and `near()` allocates a
      // fresh Set each call (~420/sec of garbage). Safe here because each result
      // is fully drained inside this loop body before the next collision call.
      for (const idx of this.collision.nearShared(x, z, 0.3)) {
        const b = this.collision.boxes[idx];
        if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && y > b.minY && y < b.maxY) {
          return t;
        }
      }
    }
    return null;
  }

  /** @returns indices of coins collected this frame */
  collectCoins(x, z, y) {
    const got = [];
    const now = performance.now();
    for (let i = 0; i < this.coinState.length; i++) {
      const c = this.coinState[i];
      if (c.taken) { if (now > c.respawnAt) c.taken = false; continue; }
      if (Math.abs(c.x - x) < 0.9 && Math.abs(c.z - z) < 0.9 && Math.abs(c.y + 0.7 - y) < 2.0) {
        c.taken = true;
        c.respawnAt = now + 90000;   // come back in 90s so the park isn't farmable
        got.push(i);
      }
    }
    return got;
  }

  update(dt, t, playerPos) {
    // swings/seesaws/rockers drift so the park never reads as a still photo
    for (const p of this.animatedProps) {
      const ph = p.userData.phase;
      const k = p.userData.kind;
      if (k.includes('Swings')) p.rotation.x = p.userData.rest.x + Math.sin(t * 1.1 + ph) * 0.16;
      else if (k.includes('Seesaw')) p.rotation.z = p.userData.rest.z + Math.sin(t * 0.9 + ph) * 0.18;
      else if (k.includes('Rocker')) p.rotation.x = p.userData.rest.x + Math.sin(t * 1.6 + ph) * 0.12;
      else if (k.includes('Coin_Ride')) p.rotation.y = p.userData.rest.y + Math.sin(t * 1.3 + ph) * 0.10;
      else if (k.includes('Kite')) p.rotation.z = p.userData.rest.z + Math.sin(t * 2.0 + ph) * 0.22;
      else p.rotation.y = p.userData.rest.y + Math.sin(t * 0.7 + ph) * 0.05;
    }

    // coins bob and spin; taken ones are scaled to zero rather than removed.
    // Reuse one dummy (hoisted) and the cached ground — no per-frame allocation
    // and no per-coin grid lookup.
    const dummy = this._coinDummy || (this._coinDummy = new THREE.Object3D());
    let coinsDirty = false;
    for (let i = 0; i < this.coinState.length; i++) {
      const c = this.coinState[i];
      const y = c.groundY + 0.75 + Math.sin(t * 2 + c.phase) * 0.12;
      c.y = y - 0.75;
      dummy.position.set(c.x, y, c.z);
      dummy.rotation.set(0, t * 2.2 + c.phase, 0);
      dummy.scale.setScalar(c.taken ? 0 : 1);
      dummy.updateMatrix();
      this.coins.setMatrixAt(i, dummy.matrix);
      coinsDirty = true;
    }
    if (coinsDirty) this.coins.instanceMatrix.needsUpdate = true;

    // Zone signs face the camera and float. They intentionally draw THROUGH
    // scenery (depthTest off) so a kid can see where to go from anywhere — but
    // that only works if far ones get out of the way, so they shrink and fade
    // with distance and drop out entirely past SIGN_FAR.
    const SIGN_NEAR = 10, SIGN_FAR = 34;
    for (const g of this.zoneMarkers) {
      const sign = g.userData.sign;
      sign.quaternion.copy(this.camera.quaternion);
      const d = Math.hypot(playerPos.x - g.position.x, playerPos.z - g.position.z);
      const near = THREE.MathUtils.clamp(1 - (d - 4) / 10, 0.25, 1);
      g.userData.ring.material.opacity = 0.22 + near * 0.35 + Math.sin(t * 2) * 0.04;
      sign.position.y = 3.6 + Math.sin(t * 1.4 + g.position.x) * 0.12;

      const fade = THREE.MathUtils.clamp((SIGN_FAR - d) / (SIGN_FAR - SIGN_NEAR), 0, 1);
      sign.visible = fade > 0.02;
      sign.material.opacity = 0.35 + fade * 0.65;
      // keep signs a roughly constant on-screen size instead of ballooning up close
      const camD = Math.max(this.camera.position.distanceTo(g.position), 2);
      const s = THREE.MathUtils.clamp(camD * 0.09, 0.9, 3.6);
      sign.scale.set(s * 2.4, s, 1);
    }

    if (this.quality.shadows && this.sun) {
      this.sun.position.set(playerPos.x + 28, 42, playerPos.z + 18);
      this.sun.target.position.set(playerPos.x, 0, playerPos.z);
      this.sun.target.updateMatrixWorld();
    }
  }

  render() { this.renderer.render(this.scene, this.camera); }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}

/**
 * Everything in the park shares one material. The GLBs are vertex-coloured with
 * no textures, so this is deliberately plain: flat-ish, matte, fog-aware.
 */
let _parkMat = null;
function parkMaterial() {
  if (!_parkMat) {
    _parkMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  }
  return _parkMat;
}

function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 9; i++) {
    const x = 40 + Math.random() * 176;
    const y = 60 + Math.random() * 30;
    const r = 22 + Math.random() * 26;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeZoneSign(zone) {
  const w = 384, h = 160, dpr = 2;
  const c = document.createElement('canvas');
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const hex = '#' + (zone.color ?? 0x7dd3fc).toString(16).padStart(6, '0');
  ctx.font = '64px system-ui, "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(zone.icon || '⭐', w / 2, 46);

  ctx.font = '700 30px "Baloo 2", system-ui, sans-serif';
  const tw = ctx.measureText(zone.name).width + 40;
  const x = (w - tw) / 2;
  ctx.fillStyle = 'rgba(10,16,34,0.78)';
  ctx.beginPath();
  const r = 18, y = 90, bh = 44;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + tw, y, x + tw, y + bh, r);
  ctx.arcTo(x + tw, y + bh, x, y + bh, r);
  ctx.arcTo(x, y + bh, x, y, r);
  ctx.arcTo(x, y, x + tw, y, r);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = hex; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#f2fbff';
  ctx.fillText(zone.name, w / 2, y + bh / 2 + 1);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, depthTest: false,
  }));
  sprite.scale.set(3.6, 1.5, 1);
  sprite.renderOrder = 20;
  return sprite;
}
