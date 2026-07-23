"""
Convert the Unity-exported park OBJs into web GLBs.

  blender -b --factory-startup --python tools/world/obj_to_glb.py -- <repo-root> [--preview]

Input comes from the Unity side of the pipeline (see tools/world/README.md):
  _polygon_kids_src/obj/park_static.obj   930 renderers merged, vertex-coloured
  _polygon_kids_src/obj/park_props.obj    102 interactive prototypes, at origin

Vertex colours are baked from the Synty atlas at export time, so these GLBs carry
no textures at all — the whole park is one unlit-ish vertex-coloured material.
That is what makes it viable on a school Chromebook: no 2 MB atlas download, no
texture memory, and the static shell collapses to a single draw call.

Draco is on because 300k low-poly verts compress roughly 8-10x.
"""
import bpy, sys, os

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT = ARGV[0] if ARGV else os.getcwd()
SRC = os.path.join(ROOT, "_polygon_kids_src", "obj")
OUT = os.path.join(ROOT, "world", "assets")
os.makedirs(OUT, exist_ok=True)


def log(*a):
    print("[glb]", *a, flush=True)


def vertex_colour_material(name):
    """Vertex-colour -> base colour, matte. Synty art is flat colour swatches."""
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
    # Blender's OBJ importer names the imported colour layer "Color" (or Attribute)
    attr.layer_name = "Color"
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def import_obj(path):
    # The Unity exporter already writes glTF-space coordinates (Y up, Z forward,
    # right-handed) — it only negates X. So the OBJ must be imported with the
    # DEFAULT -Z forward / Y up, letting Blender rotate it into its own Z-up
    # world; export_yup then rotates it back. Declaring up_axis="Z" here instead
    # tells Blender the file is already Z-up, and the export's conversion lands
    # the whole park on its side (Y and Z swapped).
    before = set(bpy.data.objects)
    bpy.ops.wm.obj_import(filepath=path, forward_axis="NEGATIVE_Z", up_axis="Y")
    return [o for o in set(bpy.data.objects) - before if o.type == "MESH"]


def convert(src_name, out_name, join, draco_level):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = os.path.join(SRC, src_name)
    objs = import_obj(path)
    log(src_name, "->", len(objs), "objects")
    if not objs:
        log("!! nothing imported from", src_name)
        return []

    for o in objs:
        log("   ", o.name, len(o.data.vertices), "verts",
            "colours:", [c.name for c in o.data.color_attributes])

    mat = vertex_colour_material("AMG_Park_VC")
    # match whatever the importer actually named the colour layer
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

    if join and len(objs) > 1:
        bpy.ops.object.join()
        objs = [bpy.context.view_layer.objects.active]
        objs[0].name = "ParkStatic"

    names = [o.name for o in objs]
    total = sum(len(o.data.vertices) for o in objs)
    log("exporting", out_name, ":", len(objs), "objects", total, "verts")

    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, out_name),
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
        export_draco_mesh_compression_enable=draco_level > 0,
        export_draco_mesh_compression_level=max(draco_level, 1),
        export_draco_position_quantization=12,
        export_draco_normal_quantization=8,
        export_draco_color_quantization=8,
    )
    return names


static_names = convert("park_static.obj", "park_static.glb", join=True, draco_level=6)
prop_names = convert("park_props.obj", "park_props.glb", join=False, draco_level=6)

with open(os.path.join(OUT, "_prop_names.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(prop_names))
log("done. props:", len(prop_names))
