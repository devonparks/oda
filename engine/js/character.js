/**
 * AMG World Engine — the player: a Synty kid on a Havok character controller.
 *
 * The three.js park moved the player with a hand-written capsule resolve
 * against an AABB list plus a GPU ground heightfield — several hundred lines
 * whose whole job was "don't fall through the world, do climb the stairs".
 * `PhysicsCharacterController` is that, from Havok, with a proper contact
 * manifold and a simplex solver.
 *
 * THE PIECE THAT MATTERS FOR THIS PARK IS `maxStepHeight`. Devon's complaint
 * about the three.js version was *"you can't climb up the stairs, and that's
 * the whole point of it"* — the playground steps lived in a merged shell, the
 * heightfield masked overhangs so the shade sails erased the ground beneath
 * them, and dropping the export cubes left nothing to stand on. With mesh
 * colliders (js/collision.js) the stairs are real geometry, and this one
 * property is what decides whether the capsule rides up them or is stopped.
 * Babylon 9.18 enforces it independently of the capsule radius, which earlier
 * versions did not.
 *
 * Camera: third person by default, first person on V, following the standard
 * the park already set.
 */
import {
  Vector3, Quaternion, Matrix, Scalar,
  PhysicsCharacterController, CharacterSupportedState,
  SceneLoader, TransformNode, UniversalCamera,
} from 'babylon';
import { Rig } from './rig.js';
import { loadLocomotion, ActionLibrary } from './clips.js';

/** Kid proportions, measured off the rig: ~1.35 m tall. */
const CAPSULE_H = 1.25;
const CAPSULE_R = 0.26;

const WALK = 2.6;
const RUN = 5.0;
const JUMP = 5.4;
const TURN_RATE = 14;            // rad/s the model turns toward its heading

const UP = new Vector3(0, 1, 0);
const DOWN = new Vector3(0, -1, 0);

export class Character {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.spawn = opts.spawn ?? new Vector3(2, 2.5, 20);
    this.model = null;
    this.rig = null;
    this.cc = null;
    this.heading = 0;              // where the model faces, radians
    this.thirdPerson = true;
    this.camYaw = Math.PI;
    this.camPitch = 0.28;
    this.camDist = 5.2;
    this.input = { f: 0, r: 0, run: false, jump: false };
    this._vel = new Vector3();
    this._desired = new Vector3();
    this._fwd = new Vector3();
    this._grounded = true;
  }

  async load(kid = 'kid_hoodie') {
    const [loco, actions, res] = await Promise.all([
      loadLocomotion(),
      ActionLibrary.load(),
      SceneLoader.ImportMeshAsync('', new URL('../../assets/characters/v2/', import.meta.url).href,
        `${kid}.glb`, this.scene),
    ]);

    // `__root__` is the loader's wrapper; in a right-handed scene it is at
    // identity, so it is a clean node to move the whole kid with.
    this.model = res.meshes.find((m) => m.name === '__root__') || res.meshes[0];
    this.model.name = 'player';
    this.model.rotationQuaternion = Quaternion.Identity();

    /**
     * THE KID RENDERS BLACK UNLESS VERTEX COLOURS ARE TURNED OFF.
     *
     * Synty's kid GLBs carry a COLOR_0 attribute that is mostly white but
     * begins with an all-zero entry, and it is not meant to tint anything —
     * these are TEXTURED meshes (the one place in this project that ships a
     * texture at all). Babylon multiplies it in by default and the whole kid
     * comes out solid black.
     *
     * The three.js park hit this exact wall and its avatar.js already says so:
     * *"Synty exports a COLOR_0 attribute that three.js renders black"*, then
     * sets `m.vertexColors = false`. This is the same fix in Babylon's
     * spelling. Note it is the OPPOSITE of the park geometry, which is nothing
     * BUT vertex colours — the two asset families genuinely differ.
     */
    for (const m of res.meshes) {
      m.useVertexColors = false;
      m.isPickable = false;                            // never block object picking
      m.alwaysSelectAsActiveMesh = true;               // skinned bounds lag the pose
    }

    this.rig = new Rig(this.model, loco, actions);
    this.actions = actions;

    // ── the controller ────────────────────────────────────────────────
    this.cc = new PhysicsCharacterController(
      this.spawn.clone(),
      { capsuleHeight: CAPSULE_H, capsuleRadius: CAPSULE_R },
      this.scene,
    );
    /**
     * 45 cm of step. The playground stairs are the tallest thing a kid must
     * walk up without a jump; measured off the export they are ~22 cm a tread,
     * and the kerbs around the paths are 12. Setting this larger starts letting
     * the kid walk up things that should stop them (bench seats at 45 are the
     * next rung), so it is a deliberate ceiling rather than a generous one.
     */
    this.cc.maxStepHeight = 0.45;
    this.cc.maxSlopeCosine = Math.cos(Math.PI * (55 / 180));   // climb up to 55°
    this.cc.staticFriction = 0.4;
    this.cc.dynamicFriction = 0.35;
    this.cc.acceleration = 12;
    this.cc.maxCharacterSpeedForSolver = 12;

    console.log('[character]', kid, 'loaded — rig bound:', this.rig.ok);
    return this;
  }

  attachCamera(canvas) {
    const cam = new UniversalCamera('player', new Vector3(0, 2, 8), this.scene);
    cam.minZ = 0.08;
    cam.maxZ = 400;
    cam.fov = 0.9;
    cam.inputs.clear();                       // we drive it entirely
    this.scene.activeCamera = cam;
    this.camera = cam;

    // Pointer-lock look. The park's own convention: click to capture, Esc frees.
    canvas.addEventListener('click', () => {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.camYaw -= e.movementX * 0.0022;
      this.camPitch = Scalar.Clamp(this.camPitch + e.movementY * 0.0018, -0.45, 1.15);
    });
    addEventListener('wheel', (e) => {
      this.camDist = Scalar.Clamp(this.camDist + Math.sign(e.deltaY) * 0.4, 1.6, 9);
    }, { passive: true });
    return cam;
  }

  bindKeys() {
    const down = (e, on) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.input.f = on ? 1 : 0; break;
        case 'KeyS': case 'ArrowDown': this.input.f = on ? -1 : 0; break;
        case 'KeyA': case 'ArrowLeft': this.input.r = on ? -1 : 0; break;
        case 'KeyD': case 'ArrowRight': this.input.r = on ? 1 : 0; break;
        case 'ShiftLeft': case 'ShiftRight': this.input.run = on; break;
        case 'Space': if (on) this.input.jump = true; break;
        case 'KeyV': if (on) this.thirdPerson = !this.thirdPerson; break;
        default: return;
      }
      e.preventDefault();
    };
    // document.body, not window: window has no .matches, and any handler that
    // filters typing targets throws on it first. Cost the three.js park two
    // "failed" probe runs.
    document.body.addEventListener('keydown', (e) => down(e, true));
    document.body.addEventListener('keyup', (e) => down(e, false));
  }

  /** @param {number} dt seconds */
  update(dt) {
    if (!this.cc) return;
    dt = Math.min(dt, 1 / 20);                 // a long frame must not teleport
    const gravity = this.scene.getPhysicsEngine().gravity;

    const support = this.cc.checkSupport(dt, DOWN);
    this._grounded = support.supportedState === CharacterSupportedState.SUPPORTED;

    /**
     * MOVEMENT IS RELATIVE TO THE CAMERA BOOM, AND THE SIGN IS THE TRAP.
     * `camYaw` is the direction the boom points — from the kid TOWARD the
     * camera — so forward is the OPPOSITE. The three.js park logged two
     * "failures" that were just the kid walking away from the camera.
     *
     * `_fwd` is kept SEPARATE from the desired-velocity maths and never
     * scaled. It is passed to calculateMovement as `forwardWorld`, which
     * builds a surface frame from `forwardWorld × up` and BAILS OUT
     * (returning false, leaving the result vector untouched) if that cross
     * product is degenerate. Scaling it in place by an input of 0 — which is
     * what the first version did — zeroed it whenever the kid stood still,
     * and a silent early return is very hard to see from the outside.
     */
    this._fwd.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const camR = new Vector3(-this._fwd.z, 0, this._fwd.x);
    this._desired.copyFrom(this._fwd).scaleInPlace(this.input.f);
    this._desired.addInPlace(camR.scaleInPlace(this.input.r));

    if (this._desired.lengthSquared() > 1e-4) {
      this._desired.normalize();
      this.heading = Math.atan2(this._desired.x, this._desired.z);
      this._desired.scaleInPlace(this.input.run ? RUN : WALK);
    } else {
      this._desired.setAll(0);
    }

    /**
     * GRAVITY IS OURS TO APPLY. `integrate()` does not accelerate the
     * character — its `gravity` argument is for resolving contacts against
     * dynamic bodies. Babylon's own character-controller sample adds
     * `gravity × dt` to the velocity in user code every airborne frame, and
     * leaving that out is why the first version hung motionless in the air at
     * exactly its spawn height with zero velocity, frame after frame.
     */
    const cur = this.cc.getVelocity();
    const v = this.cc.calculateMovement(
      dt, this._fwd,
      this._grounded ? support.averageSurfaceNormal : UP,
      cur,
      this._grounded ? support.averageSurfaceVelocity : Vector3.ZeroReadOnly,
      this._desired, UP,
    );

    if (this._grounded) {
      if (this.input.jump) {
        v.y = JUMP;
        this._grounded = false;
      } else {
        // A little downward bias keeps the capsule welded to slopes and stairs
        // instead of skipping off the nose of each tread.
        v.y = Math.min(v.y, 0) - 0.2;
      }
    } else {
      // Keep the ballistic vertical component and accelerate it.
      v.y = cur.y + gravity.y * dt;
    }
    this.input.jump = false;

    this.cc.setVelocity(v);
    this.cc.integrate(dt, support, gravity);

    // ── place the model ───────────────────────────────────────────────
    const p = this.cc.getPosition();
    // The controller's position is the capsule CENTRE; the model's origin is
    // at its feet.
    this.model.position.set(p.x, p.y - CAPSULE_H / 2 - CAPSULE_R, p.z);

    const facing = this.model.rotationQuaternion.toEulerAngles().y;
    let d = this.heading - facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    Quaternion.FromEulerAnglesToRef(0, facing + d * Math.min(1, dt * TURN_RATE), 0,
      this.model.rotationQuaternion);

    // ── animation ─────────────────────────────────────────────────────
    const vel = this.cc.getVelocity();
    this.rig.update(dt, {
      speed: Math.hypot(vel.x, vel.z),
      grounded: this._grounded,
      vy: vel.y,
    });

    this._updateCamera(dt);
  }

  _updateCamera() {
    const cam = this.camera;
    if (!cam) return;
    const p = this.model.position;
    if (this.thirdPerson) {
      const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
      cam.position.set(
        p.x + Math.sin(this.camYaw) * this.camDist * cp,
        p.y + 1.15 + sp * this.camDist,
        p.z + Math.cos(this.camYaw) * this.camDist * cp,
      );
      cam.setTarget(new Vector3(p.x, p.y + 1.0, p.z));
    } else {
      cam.position.set(p.x, p.y + 1.24, p.z);
      const f = new Vector3(
        -Math.sin(this.camYaw) * Math.cos(this.camPitch),
        -Math.sin(this.camPitch),
        -Math.cos(this.camYaw) * Math.cos(this.camPitch),
      );
      cam.setTarget(cam.position.add(f));
    }
  }

  /** Teleport, used constantly by the probes. */
  tp(x, z, y = 3) {
    this.cc.setPosition(new Vector3(x, y, z));
    this.cc.setVelocity(Vector3.Zero());
  }

  get position() { return this.model ? this.model.position : this.spawn; }
  get grounded() { return this._grounded; }
}
