/**
 * AMG World Engine — the object layer.
 *
 * Devon: *"I want to have Unity running through three.js… every single item is
 * a prefab, and then you could pick it up, delete it, add properties to it. You
 * should be able to just click on the bicycles and then just remove them."*
 *
 * That is what this is. The park now ships as prototypes + placements (see
 * tools/world/unity/AMGParkExporter.cs), so every one of the 1103 things in the
 * world is already a named row pointing at a prefab. This turns those rows into
 * live OBJECTS: each one knows its prefab, its transform, its world bounds and
 * — the load-bearing part — exactly which slice of the merged vertex buffer
 * draws it.
 *
 * THE TRICK: rendering merges everything static into two big meshes, which is
 * what keeps a school Chromebook at ~50 draw calls. Merging normally destroys
 * identity — you can't hide one bench inside a 130k-triangle mesh. So the merge
 * RECORDS each placement's vertex range as it goes, and hiding an object is
 * then just collapsing its own vertices to a point and flagging the attribute.
 * O(1), no rebuild, instantly reversible, and the draw-call budget never moves.
 *
 * What you get:
 *   - click any object to select it (ray vs the placement's world AABB)
 *   - a panel naming the prefab, the object and where it is
 *   - Delete removes it; Ctrl+Z puts it back
 *   - removals persist per map in localStorage, and `exportEdits()` prints the
 *     JSON to commit if a change should ship to everyone
 *
 * It is deliberately NOT a full editor yet: no move/rotate gizmo, no property
 * sheet. Those hang off the same registry when they're wanted.
 */

/** Registry of every placed object in the world. */
export class WorldObjects {
  constructor(mapId = 'park') {
    this.mapId = mapId;
    /** @type {Array<{id:number, name:string, prefab:string, layer:string,
     *   pos:number[], quat:number[], scale:number[],
     *   min:number[], max:number[],
     *   mesh:THREE.Mesh|null, start:number, count:number,
     *   saved:Float32Array|null, hidden:boolean, kind:string}>} */
    this.items = [];
    this.removed = this._loadRemoved();
  }

  _key() { return 'amgWorldEdits_' + this.mapId; }

  _loadRemoved() {
    try {
      const raw = JSON.parse(localStorage.getItem(this._key()) || 'null');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (e) { return new Set(); }
  }

  _saveRemoved() {
    try { localStorage.setItem(this._key(), JSON.stringify([...this.removed])); } catch (e) {}
  }

  /**
   * Record one placement.
   * @param {object} o  {name, prefab, layer, pos, quat, scale, min, max, kind}
   *        `min`/`max` are the world-space AABB. `kind` is how it lives in the
   *        world: 'merged' (a slice of a batch), 'object' (its own mesh) or
   *        'dynamic' (physics owns it).
   */
  add(o) {
    const it = Object.assign({
      id: this.items.length, mesh: null, start: 0, count: 0,
      saved: null, hidden: false, kind: 'merged',
    }, o);
    this.items.push(it);
    return it;
  }

  /** A stable identity for persistence: the object's name plus where it sits. */
  static tagOf(it) {
    return it.name + '@' + it.pos.map((n) => n.toFixed(2)).join(',');
  }

  /** Apply the saved removals. Call once, after every layer is registered. */
  applyRemoved() {
    if (!this.removed.size) return 0;
    let n = 0;
    for (const it of this.items) {
      if (this.removed.has(WorldObjects.tagOf(it))) { this.setHidden(it, true, false); n++; }
    }
    return n;
  }

  /**
   * Hide or restore one object.
   *
   * For a merged object this collapses its own vertex range to a single point
   * — degenerate triangles, which draw nothing — and keeps a copy so it can
   * come back. For an object with its own mesh it is just `.visible`.
   */
  setHidden(it, hidden, persist = true) {
    if (it.hidden === hidden) return;
    it.hidden = hidden;
    if (it.kind === 'merged' && it.mesh && it.count) {
      const pos = it.mesh.geometry.attributes.position;
      if (hidden) {
        if (!it.saved) it.saved = pos.array.slice(it.start * 3, (it.start + it.count) * 3);
        const x = pos.array[it.start * 3], y = pos.array[it.start * 3 + 1], z = pos.array[it.start * 3 + 2];
        for (let i = 0; i < it.count; i++) {
          pos.array[(it.start + i) * 3] = x;
          pos.array[(it.start + i) * 3 + 1] = y;
          pos.array[(it.start + i) * 3 + 2] = z;
        }
      } else if (it.saved) {
        pos.array.set(it.saved, it.start * 3);
      }
      pos.needsUpdate = true;
    } else if (it.mesh) {
      it.mesh.visible = !hidden;
    }
    if (persist) {
      const tag = WorldObjects.tagOf(it);
      if (hidden) this.removed.add(tag); else this.removed.delete(tag);
      this._saveRemoved();
    }
  }

  /**
   * The object under a ray: nearest AABB hit. ~1100 slab tests per click,
   * which is nothing, and it needs no per-object mesh to exist.
   * @returns {object|null}
   */
  pick(ray) {
    const o = ray.origin, d = ray.direction;
    let best = null, bestT = Infinity;
    for (const it of this.items) {
      if (it.hidden) continue;
      let t0 = 0, t1 = Infinity, ok = true;
      for (let a = 0; a < 3; a++) {
        const oa = a === 0 ? o.x : a === 1 ? o.y : o.z;
        const da = a === 0 ? d.x : a === 1 ? d.y : d.z;
        if (Math.abs(da) < 1e-9) {
          if (oa < it.min[a] || oa > it.max[a]) { ok = false; break; }
        } else {
          let ta = (it.min[a] - oa) / da, tb = (it.max[a] - oa) / da;
          if (ta > tb) { const s = ta; ta = tb; tb = s; }
          if (ta > t0) t0 = ta;
          if (tb < t1) t1 = tb;
          if (t0 > t1) { ok = false; break; }
        }
      }
      if (ok && t0 < bestT && t1 > 0) { bestT = t0; best = it; }
    }
    return best;
  }

  /** The removals as JSON, to commit as a permanent change to the map. */
  exportEdits() {
    return JSON.stringify({ map: this.mapId, removed: [...this.removed] }, null, 2);
  }

  stats() {
    const byPrefab = new Map();
    for (const it of this.items) byPrefab.set(it.prefab, (byPrefab.get(it.prefab) || 0) + 1);
    return {
      objects: this.items.length,
      prefabs: byPrefab.size,
      hidden: this.items.filter((i) => i.hidden).length,
    };
  }
}
