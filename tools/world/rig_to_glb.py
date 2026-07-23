"""
Convert a Unity-exported character FBX into a web GLB, preserving the skeleton
and its BIND POSE.

  blender -b --factory-startup --python tools/world/rig_to_glb.py -- <repo> <in.fbx> <out.glb>

Why this exists: the kid GLBs that shipped originally rest with their arms
hanging down, while the Synty animation clips are authored against Unity's
T-pose bind. That mismatch lives in the arm chain's bone offsets, so no runtime
correction fixes it — the emotes play with the arms in the air. See
docs/EMOTE_RIG_ISSUE.md.

Re-exporting straight out of Unity gives a GLB whose rest IS Unity's rest, so
the baked deltas apply exactly.

Textures: Synty characters use one shared atlas plus a face sheet. The FBX
carries material names but not usable image paths, so they're re-bound here from
_polygon_kids_src/PolygonKids/Textures.
"""
import bpy, sys, os, glob, re

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT, SRC_FBX, OUT_GLB = ARGV[0], ARGV[1], ARGV[2]
TEXDIR = os.path.join(ROOT, "_polygon_kids_src", "PolygonKids", "Textures")


def log(*a):
    print("[rig]", *a, flush=True)


def find_texture(mat_name):
    """Map a Synty material name onto its atlas PNG."""
    n = mat_name.lower()
    if "face" in n and "freckle" in n:
        cands = glob.glob(os.path.join(TEXDIR, "**", "*Facial_Freckles*.png"), recursive=True)
    elif "face" in n:
        cands = glob.glob(os.path.join(TEXDIR, "**", "*Facial_Phonemes*.png"), recursive=True)
    else:
        # PolygonKids_Material_01_A -> PolygonKids_Texture_01_A.png
        import re
        m = re.search(r"(\d\d)_([ABC])", mat_name)
        suffix = f"{m.group(1)}_{m.group(2)}" if m else "01_A"
        cands = glob.glob(os.path.join(TEXDIR, f"PolygonKids_Texture_{suffix}.png"))
        if not cands:
            cands = glob.glob(os.path.join(TEXDIR, "PolygonKids_Texture_01_A.png"))
    return cands[0] if cands else None


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC_FBX, use_custom_normals=True,
                         ignore_leaf_bones=True, automatic_bone_orientation=False)

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
log("imported", len(meshes), "meshes,", len(arms), "armatures")
for a in arms:
    log("  armature", a.name, len(a.data.bones), "bones")

# ---- keep only the parts this character actually wears ---------------------
# The Synty prefab carries every modular variant (106 meshes for one kid), so
# without this the GLB is 24 MB instead of ~400 KB. The wanted part list comes
# from the character GLB that shipped originally — see _part_map.json.
KEEP = [k.strip() for k in (ARGV[3].split(",") if len(ARGV) > 3 else []) if k.strip()]
if KEEP:
    def canon(n):
        """Normalise a part name for matching.

        Careful here: importers append dedup suffixes (`.001`, or `_1` on a name
        that already ends in `_01`), but a bare trailing `_02` is a real VARIANT
        number and must not be stripped — doing so matched Hoodie_02/_03 and
        dropped the actual Hoodie_01.
        """
        n = n.replace("HAIR_", "")
        n = re.sub(r"\.\d+$", "", n)               # Blender dedup
        n = re.sub(r"(?<=_\d\d)_\d+$", "", n)      # FBX dedup, only after _NN
        return n.lower()
    wanted = {canon(k) for k in KEEP}
    dropped = 0
    for o in list(meshes):
        if canon(o.name) not in wanted:
            bpy.data.objects.remove(o, do_unlink=True)
            dropped += 1
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    log("  kept", len(meshes), "of", len(meshes) + dropped, "meshes:",
        ", ".join(sorted(o.name for o in meshes)))

# ---- rebind materials to the atlas ----------------------------------------
for mat in bpy.data.materials:
    tex_path = find_texture(mat.name)
    if not tex_path:
        log("  !! no texture for", mat.name)
        continue
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    # drop any image nodes the importer guessed at
    for n in [n for n in nt.nodes if n.type == "TEX_IMAGE"]:
        nt.nodes.remove(n)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(tex_path, check_existing=True)
    tex.interpolation = "Closest"          # flat Synty swatches, keep edges crisp
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Metallic"].default_value = 0.0
    # Kill any emission the FBX import carried over from the Unity material —
    # Synty's atlas material imports with a CYAN emissive that the glTF
    # exporter writes as emissiveFactor, washing the whole character pale blue.
    for _k in ("Emission Strength",):
        if _k in bsdf.inputs:
            bsdf.inputs[_k].default_value = 0.0
    for _k in ("Emission Color", "Emission"):
        if _k in bsdf.inputs:
            try:
                bsdf.inputs[_k].default_value = (0.0, 0.0, 0.0, 1.0)
            except Exception:
                pass
    if "face" in mat.name.lower():
        # face sheets are cut-outs over the head
        nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        mat.blend_method = "CLIP"
    log("  bound", mat.name, "->", os.path.basename(tex_path))

# ---- shrink the atlas ------------------------------------------------------
# Synty atlases are 2048 sheets of flat colour swatches. 512 keeps every swatch
# distinct and takes the character from ~1 MB to a few hundred KB, which matters
# when 16 of these ship to a Chromebook.
ATLAS_MAX = 512
for img in bpy.data.images:
    if img.size[0] > ATLAS_MAX or img.size[1] > ATLAS_MAX:
        w, h = img.size
        scale = ATLAS_MAX / max(w, h)
        img.scale(max(1, int(w * scale)), max(1, int(h * scale)))
        log("  scaled", img.name, f"{w}x{h} -> {img.size[0]}x{img.size[1]}")

for o in bpy.context.selected_objects:
    o.select_set(False)
for o in bpy.data.objects:
    o.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_skins=True,
    export_animations=False,
    export_image_format="WEBP",
    export_image_quality=85,
    export_cameras=False,
    export_lights=False,
    export_apply=False,          # MUST stay false: applying modifiers destroys the armature bind
)
log("wrote", OUT_GLB, os.path.getsize(OUT_GLB) // 1024, "KB")
