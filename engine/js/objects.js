/**
 * AMG World Engine — the object layer.
 *
 * Devon: *"I want Unity running through three.js… every single item is a
 * prefab, and you should be able to just click on the bicycles and then just
 * remove them."*
 *
 * COMPARE THIS FILE TO world/js/editor.js. That version had to record, for
 * every one of the 1103 placements, the exact slice of a merged vertex buffer
 * that drew it — because the only way three.js could hold the draw-call budget
 * was to merge the park into two big meshes, and merging destroys identity.
 * Hiding one bench meant collapsing its own vertex range to a point and
 * flagging the attribute dirty. It worked, and it was load-bearing, and it was
 * the wrong shape for the problem.
 *
 * Thin instances give the same 275 draw calls WITHOUT giving up identity, so
 * all of that goes away:
 *   - picking is native (`pickInfo.thinInstanceIndex`)
 *   - hiding is writing one matrix in the instance buffer
 *   - nothing is rebuilt, nothing is O(n), the batch never changes size
 *
 * That is the concrete payoff of the engine move, in one file.
 */
import { Matrix, Vector3, Quaternion } from 'babylon';

const _m = new Matrix();
const _zero = Matrix.Scaling(0, 0, 0);

export class WorldObjects {
  /**
   * @param {Scene} scene
   * @param {{items:Array, protos:Map<string,Mesh>}} park
   * @param {string} mapId
   */
  constructor(scene, park, mapId = 'park') {
    this.scene = scene;
    this.park = park;
    this.mapId = mapId;
    this.items = park.items;
    this.sel = null;
    this.enabled = false;
    this._undo = [];

    // Cache each placement's own matrix so hiding is reversible without
    // recomputing it from the layout row.
    for (const it of this.items) {
      Matrix.ComposeToRef(
        new Vector3(it.scale[0], it.scale[1], it.scale[2]),
        new Quaternion(it.quat[0], it.quat[1], it.quat[2], it.quat[3]),
        new Vector3(it.pos[0], it.pos[1], it.pos[2]),
        _m,
      );
      it.matrix = _m.clone();
      it.hidden = false;
    }
    this.removed = this._load();
  }

  _key() { return 'amgEngineEdits_' + this.mapId; }

  _load() {
    try {
      const raw = JSON.parse(localStorage.getItem(this._key()) || 'null');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (e) { return new Set(); }
  }

  _save() {
    try { localStorage.setItem(this._key(), JSON.stringify([...this.removed])); } catch (e) {}
  }

  /** A stable identity across reloads: the object's name plus where it stands. */
  static tagOf(it) {
    return it.name + '@' + it.pos.map((n) => n.toFixed(2)).join(',');
  }

  /**
   * Hide or restore one placement.
   *
   * Hiding writes a zero-scale matrix into the instance's slot — the instance
   * still exists and still costs nothing, it just draws no area. Restoring
   * writes the cached matrix back. One 16-float write either way.
   */
  setHidden(it, hidden, persist = true) {
    if (it.hidden === hidden || !it.mesh) return;
    it.hidden = hidden;
    it.mesh.thinInstanceSetMatrixAt(it.index, hidden ? _zero : it.matrix, true);
    if (persist) {
      const tag = WorldObjects.tagOf(it);
      if (hidden) this.removed.add(tag); else this.removed.delete(tag);
      this._save();
    }
  }

  /** Apply saved removals. Call once, after the park is built. */
  applyRemoved() {
    if (!this.removed.size) return 0;
    let n = 0;
    for (const it of this.items) {
      if (this.removed.has(WorldObjects.tagOf(it))) { this.setHidden(it, true, false); n++; }
    }
    return n;
  }

  /**
   * The object under the pointer.
   *
   * `thinInstanceIndex` is the whole trick — Babylon tells us WHICH instance
   * the ray hit, so the merged-batch identity problem simply does not arise.
   * The park's own meshes are the only pickable ones (the kid is set
   * unpickable at load), so no filtering is needed here.
   */
  pick(x, y) {
    const hit = this.scene.pick(x, y, (m) => m.isPickable && m.thinInstanceCount > 0);
    if (!hit || !hit.hit || hit.thinInstanceIndex < 0) return null;
    const proto = hit.pickedMesh.name;
    return this.items.find((it) => it.proto === proto && it.index === hit.thinInstanceIndex) || null;
  }

  select(it) {
    this.sel = it || null;
    return this.sel;
  }

  /** Remove the selection (or a given item), undoably. */
  remove(it = this.sel) {
    if (!it || it.hidden) return null;
    this.setHidden(it, true);
    this._undo.push(it);
    if (this.sel === it) this.sel = null;
    return it;
  }

  undo() {
    const it = this._undo.pop();
    if (it) this.setHidden(it, false);
    return it || null;
  }

  /** Every placement whose prototype or object name matches. */
  find(pattern) {
    const re = new RegExp(pattern, 'i');
    return this.items.filter((it) => re.test(it.proto) || re.test(it.name));
  }

  /** Bulk remove, for "get rid of all the bicycles". */
  removeAll(pattern) {
    const hits = this.find(pattern).filter((it) => !it.hidden);
    for (const it of hits) { this.setHidden(it, true); this._undo.push(it); }
    return hits.length;
  }

  /** The removals as JSON, to commit as a permanent change to the map. */
  exportEdits() {
    return JSON.stringify({ map: this.mapId, removed: [...this.removed] }, null, 2);
  }

  stats() {
    const byProto = new Map();
    for (const it of this.items) byProto.set(it.proto, (byProto.get(it.proto) || 0) + 1);
    return {
      objects: this.items.length,
      prototypes: byProto.size,
      hidden: this.items.filter((i) => i.hidden).length,
    };
  }
}
