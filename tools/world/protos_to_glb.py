"""
Convert the Unity-exported park PROTOTYPES into one web GLB.

  blender -b --factory-startup --python tools/world/protos_to_glb.py -- <repo-root> [prefix]

Input (see tools/world/README.md and unity/AMGParkExporter.cs):
  _polygon_kids_src/obj/<prefix>_protos.obj   one OBJ group per unique mesh,
                                              LOCAL space, vertex-coloured

Output:
  world/assets/<prefix>_protos.glb            one glTF node per prototype
  world/assets/<prefix>_proto_names.txt       the node names, for eyeballing

This replaces the old park_static.glb + park_props.glb split. The scene is
1103 placements of only 275 unique meshes, so shipping the UNIQUE meshes and
letting the runtime place them is both smaller and — the whole point —
individually addressable: nothing is welded into a merged shell, so making any
prop interactive is a name lookup rather than triangle surgery.

Draco is on. Keep the object split (no join): each prototype must stay its own
node so world.js can look it up by name.
"""
import bpy, sys, os

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT = ARGV[0] if ARGV else os.getcwd()
PREFIX = ARGV[1] if len(ARGV) > 1 else "park"
SRC = os.path.join(ROOT, "_polygon_kids_src", "obj")
OUT = os.path.join(ROOT, "world", "assets")
os.makedirs(OUT, exist_ok=True)


def log(*a):
    print("[glb]", *a, flush=True)


def vertex_colour_material(name):
    """Vertex colour -> base colour, matte. Synty art is flat colour swatches."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Metallic"].default_value = 0.0
    for key in ("Specular IOR Level", "Specular"):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = 0.15
            break
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Color"
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


bpy.ops.wm.read_factory_settings(use_empty=True)
path = os.path.join(SRC, PREFIX + "_protos.obj")

# The exporter already writes glTF-space coordinates (it negates X), so import
# with Blender's DEFAULT axes and let export_yup rotate back. Declaring up="Z"
# here lands the whole park on its side — see tools/world/README.md.
# use_split_groups: the exporter writes one OBJ `g <name>` per prototype, and
# Blender's importer only splits on `o` by default — without this the whole
# file arrives as ONE object and every prototype name is lost.
before = set(bpy.data.objects)
bpy.ops.wm.obj_import(filepath=path, forward_axis="NEGATIVE_Z", up_axis="Y",
                      use_split_groups=True)
objs = [o for o in set(bpy.data.objects) - before if o.type == "MESH"]
log(PREFIX + "_protos.obj ->", len(objs), "prototypes")
if not objs:
    raise SystemExit("nothing imported from " + path)

mat = vertex_colour_material("AMG_Park_VC")
if objs[0].data.color_attributes:
    layer = objs[0].data.color_attributes[0].name
    for n in mat.node_tree.nodes:
        if n.type == "VERTEX_COLOR":
            n.layer_name = layer
for o in objs:
    o.data.materials.clear()
    o.data.materials.append(mat)
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]

total = sum(len(o.data.vertices) for o in objs)
log("exporting", len(objs), "prototypes", total, "verts")

bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, PREFIX + "_protos.glb"),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_normals=True,
    export_colors=True,
    export_texcoords=False,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=12,
    export_draco_normal_quantization=8,
    export_draco_color_quantization=8,
)

names = sorted(o.name for o in objs)
with open(os.path.join(OUT, "_" + PREFIX + "_proto_names.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(names))
log("done:", len(names), "prototypes ->", PREFIX + "_protos.glb")
