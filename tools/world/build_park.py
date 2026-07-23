"""
Build the AMG World "Recess Park" GLB from the Synty POLYGON Kids demo scene.

Run headless:
  blender -b --factory-startup --python tools/world/build_park.py -- <repo-root>

Inputs (all produced by tools/world/dump_unity.md steps, checked into _polygon_kids_src/):
  _polygon_kids_src/_mesh_sources.tsv   mesh-name  ->  Assets/PolygonKids/Models/<file>.fbx
  _polygon_kids_src/_demo_scene2.json   1117 placements: mesh, tex, 4x4 matrix, world AABB
  _polygon_kids_src/PolygonKids/...     the raw FBX + PNG atlases

Outputs:
  world/assets/park_static.glb     all scenery merged per-atlas  (a handful of draw calls)
  world/assets/park_props.glb      interactive props, one named object each, at origin
  world/assets/park_layout.json    where to place the props + collision AABBs + spawn points

Why merge: the demo scene is 1117 renderers. Chromebooks (Intel UHD / Mali) fall over
somewhere around 400 draw calls. Synty geometry is low-poly and shares ONE atlas, so
joining every static object per atlas costs ~110k verts and 8 draw calls total.

Coordinate conversion, derived once so nobody has to re-derive it:
  Unity is Y-up LEFT-handed, Blender is Z-up right-handed. Both projects import the same
  FBX, so blender_coords = T(unity_coords) with T = (x, y, z) -> (-x, -z, y).
  A placement matrix converts as  M_blender = T . M_unity . T^-1  (T is orthogonal,
  det -1, so it also accounts for the handedness flip without touching triangle winding).
"""
import bpy, bmesh, json, sys, os, math, csv
from mathutils import Matrix, Vector

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT = ARGV[0] if ARGV else os.getcwd()

SRC = os.path.join(ROOT, "_polygon_kids_src")
MODELS = os.path.join(SRC, "PolygonKids", "Models")
TEXDIR = os.path.join(SRC, "PolygonKids", "Textures")
OUT = os.path.join(ROOT, "world", "assets")
os.makedirs(OUT, exist_ok=True)

# Unity -> Blender basis change (see module docstring).
T = Matrix(((-1, 0, 0, 0),
            (0, 0, -1, 0),
            (0, 1, 0, 0),
            (0, 0, 0, 1)))
T_INV = T.inverted()

# ---------------------------------------------------------------------------
# Props kept as separate, named objects so the runtime can animate / interact
# with them. Everything else gets merged into the static shell.
# Matched as a substring against the mesh name.
# ---------------------------------------------------------------------------
INTERACTIVE = [
    "Playground_Swings", "Playground_Seesaw", "Playground_Rocker", "Rocker_01",
    "Playground_Slide", "Playground_Tunnel", "Playground_Ship",
    "Playground_Track_Ride", "Playground_Monkey_Bars",
    "Coin_Ride", "BouncyCastle", "Park_Seat", "Park_Lamp",
    "Toy_Duck", "Plush_", "Ball_0", "Kite_", "Sand_Castle", "Play_House",
    "Tent_01", "Camp_Fire", "Pool_01", "Red_Wagon", "Skateboard", "Scooter",
    "Trike", "Bike_0", "Soapbox", "Pogo", "Rocking_Horse", "Hoverboard",
]

# Objects the player should be able to walk over rather than bump into.
# (paths, ground tiles, grass, flowers, small litter)
WALKOVER = [
    "Ground_Tile", "Ground_Round", "Path_", "Grass_Tuft", "Grass_Patch",
    "Park_Flower", "Lilly_", "Playground_Edge", "SkatePark_Ground_Tile",
    "Pond_Water", "Adornment",
]


def log(*a):
    print("[park]", *a, flush=True)


def load_inputs():
    sources = {}
    with open(os.path.join(SRC, "_mesh_sources.tsv"), newline="", encoding="utf-8") as f:
        for row in csv.reader(f, delimiter="\t"):
            if len(row) == 2:
                sources[row[0]] = os.path.basename(row[1])
    with open(os.path.join(SRC, "_demo_scene2.json"), encoding="utf-8") as f:
        placements = json.load(f)
    return sources, placements


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(tex_name, cache):
    """One PBR material per atlas. Synty atlases are flat colour swatches, so
    nearest-neighbour filtering keeps swatch edges crisp after downscaling."""
    if tex_name in cache:
        return cache[tex_name]
    mat = bpy.data.materials.new(name="AMG_" + tex_name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Metallic"].default_value = 0.0
    # Blender 4.0 renamed Specular
    for key in ("Specular IOR Level", "Specular"):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = 0.2
            break
    path = os.path.join(TEXDIR, tex_name + ".png")
    if os.path.exists(path):
        img = bpy.data.images.load(path, check_existing=True)
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        tex.interpolation = "Closest"
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        log("!! missing texture", tex_name)
    cache[tex_name] = mat
    return mat


_fbx_cache = {}


def mesh_datablock(mesh_name, fbx_file):
    """Import an FBX once and hand back the mesh datablock with that name.
    Synty ships several meshes per file, so the whole file is cached."""
    key = fbx_file
    if key not in _fbx_cache:
        before = set(bpy.data.objects)
        path = os.path.join(MODELS, fbx_file)
        if not os.path.exists(path):
            log("!! missing fbx", fbx_file)
            _fbx_cache[key] = {}
            return None
        bpy.ops.import_scene.fbx(filepath=path, use_custom_normals=True,
                                 ignore_leaf_bones=True, automatic_bone_orientation=True)
        imported = set(bpy.data.objects) - before
        table = {}
        for o in imported:
            if o.type == "MESH" and o.data:
                # FBX import bakes the file's unit/axis conversion into the object
                # transform; apply it so the mesh datablock is placement-ready.
                o.data.transform(o.matrix_world)
                table.setdefault(o.data.name, o.data)
                table.setdefault(o.name, o.data)
        # drop the import's own objects, we only wanted the mesh data
        for o in imported:
            bpy.data.objects.remove(o, do_unlink=True)
        _fbx_cache[key] = table
    return _fbx_cache[key].get(mesh_name)


def is_match(name, patterns):
    return any(p in name for p in patterns)


def build():
    sources, placements = load_inputs()
    reset_scene()
    scene = bpy.context.scene
    coll = scene.collection
    matcache = {}

    static_by_tex = {}   # tex -> [objects]
    prop_instances = []  # runtime placement records for separate props
    prop_protos = {}     # mesh name -> prototype object at origin
    collision = []
    missing = set()

    for i, pl in enumerate(placements):
        name = pl["mesh"]
        fbx = sources.get(name)
        if not fbx:
            missing.add(name)
            continue
        data = mesh_datablock(name, fbx)
        if data is None:
            missing.add(name)
            continue

        m_u = Matrix([[float(pl["m"][r + c * 4]) for c in range(4)] for r in range(4)])
        m_b = T @ m_u @ T_INV

        interactive = is_match(name, INTERACTIVE)

        # --- collision: reuse Unity's world AABB, converted the same way -----
        if not is_match(name, WALKOVER):
            c = Vector(pl["bc"])
            e = Vector(pl["be"])
            cb = T @ c            # centre converts like a point
            # extents are axis magnitudes: T permutes axes (x, y, z) -> (x, z, y)
            eb = Vector((abs(e.x), abs(e.z), abs(e.y)))
            if eb.x > 0.06 and eb.y > 0.06 and eb.z > 0.12:
                collision.append({
                    "n": name,
                    "c": [round(cb.x, 3), round(cb.y, 3), round(cb.z, 3)],
                    "e": [round(eb.x, 3), round(eb.y, 3), round(eb.z, 3)],
                })

        if interactive:
            if name not in prop_protos:
                proto = bpy.data.objects.new(name, data.copy())
                proto.data.materials.clear()
                proto.data.materials.append(make_material(pl["tex"], matcache))
                coll.objects.link(proto)
                prop_protos[name] = proto
            loc, rot, scl = m_b.decompose()
            prop_instances.append({
                "mesh": name,
                "p": [round(loc.x, 3), round(loc.y, 3), round(loc.z, 3)],
                "q": [round(rot.x, 5), round(rot.y, 5), round(rot.z, 5), round(rot.w, 5)],
                "s": [round(scl.x, 4), round(scl.y, 4), round(scl.z, 4)],
            })
        else:
            obj = bpy.data.objects.new("%s_%04d" % (name, i), data)
            obj.matrix_world = m_b
            obj.data = data.copy()
            obj.data.materials.clear()
            obj.data.materials.append(make_material(pl["tex"], matcache))
            coll.objects.link(obj)
            static_by_tex.setdefault(pl["tex"], []).append(obj)

    if missing:
        log("missing meshes:", sorted(missing))

    # ---- join the static shell, one merged object per atlas ----------------
    merged = []
    for tex, objs in static_by_tex.items():
        for o in bpy.context.selected_objects:
            o.select_set(False)
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        joined = bpy.context.view_layer.objects.active
        joined.name = "STATIC_" + tex
        merged.append(joined)
        log("merged", tex, "<-", len(objs), "objects ->", len(joined.data.vertices), "verts")

    total = sum(len(o.data.vertices) for o in merged)
    log("static verts:", total, "draw calls:", len(merged))
    log("interactive prototypes:", len(prop_protos), "instances:", len(prop_instances))
    log("collision boxes:", len(collision))

    # ---- export ------------------------------------------------------------
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in merged:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, "park_static.glb"),
        export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True,
        export_image_format="WEBP", export_image_quality=80,
        export_draco_mesh_compression_enable=False,
        export_animations=False, export_cameras=False, export_lights=False,
    )

    for o in bpy.context.selected_objects:
        o.select_set(False)
    for name, proto in prop_protos.items():
        proto.matrix_world = Matrix.Identity(4)
        proto.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, "park_props.glb"),
        export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True,
        export_image_format="WEBP", export_image_quality=80,
        export_animations=False, export_cameras=False, export_lights=False,
    )

    # ---- layout json -------------------------------------------------------
    xs = [c["c"][0] for c in collision] or [0]
    zs = [c["c"][2] for c in collision] or [0]
    layout = {
        "generated_by": "tools/world/build_park.py",
        "source": "Synty POLYGON Kids / Scenes/Demo.unity",
        "bounds": {"minX": round(min(xs) - 4, 2), "maxX": round(max(xs) + 4, 2),
                   "minZ": round(min(zs) - 4, 2), "maxZ": round(max(zs) + 4, 2)},
        "props": prop_instances,
        "collision": collision,
    }
    with open(os.path.join(OUT, "park_layout.json"), "w", encoding="utf-8") as f:
        json.dump(layout, f, separators=(",", ":"))
    log("wrote park_layout.json")

    # ---- preview render so the pipeline is verifiable without a browser ----
    if "--preview" in ARGV:
        for name, proto in prop_protos.items():
            pass
        cam_data = bpy.data.cameras.new("cam")
        cam = bpy.data.objects.new("cam", cam_data)
        coll.objects.link(cam)
        cam.location = (34, -34, 26)
        cam.rotation_euler = (math.radians(60), 0, math.radians(45))
        cam_data.lens = 32
        scene.camera = cam
        sun_data = bpy.data.lights.new("sun", type="SUN")
        sun_data.energy = 3.0
        sun = bpy.data.objects.new("sun", sun_data)
        sun.rotation_euler = (math.radians(50), 0, math.radians(30))
        coll.objects.link(sun)
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = 1280
        scene.render.resolution_y = 720
        scene.render.film_transparent = False
        scene.world = bpy.data.worlds.new("w")
        scene.world.use_nodes = True
        scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.75, 1.0, 1)
        scene.render.filepath = os.path.join(OUT, "_preview.png")
        bpy.ops.render.render(write_still=True)
        log("wrote preview")


build()
