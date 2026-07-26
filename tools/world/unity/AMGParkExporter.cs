// AMGParkExporter — export a Synty park scene as PROTOTYPES + PLACEMENTS.
//
// WHY THIS REPLACES THE ORIGINAL EXPORT
// -------------------------------------
// The first export merged the scene's 741 "Environment" renderers into ONE
// baked mesh (park_static.glb) and kept only the 376 "Props" as prototypes.
// That merged shell is the single biggest source of pain in this project:
// the purple Jeep, the pond floaties, the picnic tables, the swing seats and
// the tyre carousel's whole crown were all frozen inside it, so making any of
// them move meant CARVING triangles back out of a merged mesh — which kept
// dragging neighbouring scenery along (a rock, then a plant). Devon, after the
// fourth round of it: "I think this is an export problem. If I open up the
// demo scene in Unity I can select each item, so maybe we need to import those
// separately."
//
// He's right, and the numbers make it obvious: the scene is 1117 renderers
// referencing only 259 unique meshes, and every one is a prefab instance. So
// the honest export is 259 prototypes plus 1117 placements — the same shape
// the Props half already used, applied to everything. Then nothing is ever
// welded to anything: a prop becomes interactive by NAME, at runtime, with no
// geometry surgery at all.
//
// The runtime still merges everything that isn't diverted, so the draw-call
// budget a school Chromebook needs is unchanged — the merge just happens in
// JS, from parts, instead of being frozen at export time.
//
// OUTPUT (into <repo>/_polygon_kids_src/obj/)
//   park_protos.obj    — one OBJ group per unique mesh, LOCAL space, with
//                        atlas colours baked to vertex colours
//   park_layout.json   — { protos:[names], items:[{mesh,name,p,q,s,group}] }
//   park_collision.json— one world-space AABB per renderer (unchanged shape)
//
// COORDINATES (do not "fix" this downstream — see tools/world/README.md)
//   Unity is Y-up LEFT-handed, glTF is Y-up RIGHT-handed. Convert by negating
//   X, which flips winding, so triangles are emitted a,c,b. Rotations convert
//   by negating the quaternion's Y and Z. Scale is unchanged.
//
// RUN:  menu  AMG > Export Park Scene   (exports Demo.unity)
//       menu  AMG > Export Park Scene (Overview)  for the second map
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEditor;
using UnityEngine;

public static class AMGParkExporter
{
    const string OUT_DIR = "C:/Users/devon/OneDrive/Desktop/ODA/_polygon_kids_src/obj";

    [MenuItem("AMG/Export Park Scene")]
    public static void ExportDemo() { Export("Assets/PolygonKids/Scenes/Demo.unity", "park"); }

    [MenuItem("AMG/Export Park Scene (Overview)")]
    public static void ExportOverview() { Export("Assets/PolygonKids/Scenes/Overview.unity", "overview"); }

    /**
     * Sampled atlas colour per (mesh, material) pair.
     *
     * Synty art is flat colour swatches and every face's UVs sit inside one
     * swatch, so sampling the material's texture once per vertex reproduces
     * the look with no textures shipped at all. Cached because 133 grass tiles
     * share one mesh and one material — they must sample once, not 133 times.
     */
    static Dictionary<string, Color[]> _bakeCache = new Dictionary<string, Color[]>();

    static Color[] BakeColours(Mesh mesh, Material mat)
    {
        var key = mesh.GetInstanceID() + "/" + (mat != null ? mat.GetInstanceID() : 0);
        Color[] hit;
        if (_bakeCache.TryGetValue(key, out hit)) return hit;

        var uv = mesh.uv;
        var verts = mesh.vertices;
        var cols = new Color[verts.Length];
        var tex = mat != null ? mat.mainTexture as Texture2D : null;
        Color flat = mat != null && mat.HasProperty("_Color") ? mat.color : Color.white;
        for (int i = 0; i < verts.Length; i++)
        {
            if (tex != null && uv != null && uv.Length == verts.Length)
            {
                // point sample: a swatch is uniform, so no filtering needed
                cols[i] = tex.GetPixelBilinear(uv[i].x, uv[i].y);
            }
            else cols[i] = flat;
        }
        _bakeCache[key] = cols;
        return cols;
    }

    static string F(float v)
    {
        if (Mathf.Abs(v) < 1e-6f) v = 0f;
        return v.ToString("0.#####", CultureInfo.InvariantCulture);
    }

    static void Export(string scenePath, string prefix)
    {
        _bakeCache.Clear();
        var scn = UnityEditor.SceneManagement.EditorSceneManager.OpenPreviewScene(scenePath);
        System.IO.Directory.CreateDirectory(OUT_DIR);

        // ── pass 1: collect unique (mesh, material) prototypes ──
        // Keyed by mesh+material so two tints of one mesh stay distinct; in
        // this pack that is almost always 1:1 with the mesh.
        var protoIndex = new Dictionary<string, int>();
        var protoName = new List<string>();
        var protoMesh = new List<Mesh>();
        var protoMat = new List<Material>();
        var items = new StringBuilder();
        var boxes = new StringBuilder();
        int nItems = 0, nBoxes = 0;

        foreach (var root in scn.GetRootGameObjects())
        {
            if (root.name == "Scene") continue;      // lights + camera, no geometry
            foreach (var mf in root.GetComponentsInChildren<MeshFilter>(true))
            {
                var rend = mf.GetComponent<MeshRenderer>();
                if (mf.sharedMesh == null || rend == null) continue;
                if (!rend.enabled || !mf.gameObject.activeInHierarchy) continue;

                var mesh = mf.sharedMesh;
                var mat = rend.sharedMaterial;
                var key = mesh.name + "|" + (mat != null ? mat.name : "none");
                int pi;
                if (!protoIndex.TryGetValue(key, out pi))
                {
                    pi = protoName.Count;
                    protoIndex[key] = pi;
                    /**
                     * Prototype names are `<mesh>#<n>`, where n counts the
                     * materials seen on that mesh — NOT `<mesh>$<material>`.
                     * Blender truncates object names at 63 characters, and
                     * "SM_Prop_Playground_Track_Ride_01_Handle$PolygonKids_
                     * Material_01_A" is 65: the zip line's handle came back
                     * from the GLB under a clipped name, the runtime couldn't
                     * find its prototype, and the zip line silently vanished.
                     */
                    int n = 0;
                    foreach (var existing in protoMesh) if (existing == mesh) n++;
                    protoName.Add((mesh.name + (n > 0 ? "#" + n : "")).Replace(' ', '_'));
                    protoMesh.Add(mesh);
                    protoMat.Add(mat);
                }

                var t = mf.transform;
                var p = t.position;
                var q = t.rotation;
                var s = t.lossyScale;
                // Unity → glTF: negate X; negate quaternion Y and Z.
                if (nItems > 0) items.Append(',');
                items.Append("{\"m\":").Append(pi)
                     .Append(",\"n\":\"").Append(mf.gameObject.name.Replace('"', '\'')).Append('"')
                     .Append(",\"g\":\"").Append(root.name).Append('"')
                     .Append(",\"p\":[").Append(F(-p.x)).Append(',').Append(F(p.y)).Append(',').Append(F(p.z))
                     .Append("],\"q\":[").Append(F(q.x)).Append(',').Append(F(-q.y)).Append(',').Append(F(-q.z)).Append(',').Append(F(q.w))
                     .Append("],\"s\":[").Append(F(s.x)).Append(',').Append(F(s.y)).Append(',').Append(F(s.z))
                     .Append("]}");
                nItems++;

                // collision: the renderer's world AABB, same shape as before
                var b = rend.bounds;
                if (nBoxes > 0) boxes.Append(',');
                boxes.Append("{\"n\":\"").Append(mesh.name).Append('"')
                     .Append(",\"c\":[").Append(F(-b.center.x)).Append(',').Append(F(b.center.y)).Append(',').Append(F(b.center.z))
                     .Append("],\"e\":[").Append(F(b.extents.x)).Append(',').Append(F(b.extents.y)).Append(',').Append(F(b.extents.z))
                     .Append("]}");
                nBoxes++;
            }
        }

        // ── pass 2: write the prototype OBJ, one group per prototype ──
        var obj = new StringBuilder();
        obj.AppendLine("# AMG park prototypes — LOCAL space, vertex-coloured, glTF handedness");
        int vBase = 1;
        for (int i = 0; i < protoMesh.Count; i++)
        {
            var mesh = protoMesh[i];
            var cols = BakeColours(mesh, protoMat[i]);
            var verts = mesh.vertices;
            obj.Append("g ").AppendLine(protoName[i]);
            for (int v = 0; v < verts.Length; v++)
            {
                var c = cols[v];
                obj.Append("v ").Append(F(-verts[v].x)).Append(' ').Append(F(verts[v].y)).Append(' ').Append(F(verts[v].z))
                   .Append(' ').Append(F(c.r)).Append(' ').Append(F(c.g)).Append(' ').Append(F(c.b)).Append('\n');
            }
            for (int sub = 0; sub < mesh.subMeshCount; sub++)
            {
                var tris = mesh.GetTriangles(sub);
                // negating X flipped the winding, so emit a, c, b
                for (int k = 0; k < tris.Length; k += 3)
                {
                    obj.Append("f ").Append(vBase + tris[k]).Append(' ')
                       .Append(vBase + tris[k + 2]).Append(' ')
                       .Append(vBase + tris[k + 1]).Append('\n');
                }
            }
            vBase += verts.Length;
        }

        var protos = new StringBuilder();
        protos.Append('[');
        for (int i = 0; i < protoName.Count; i++)
        {
            if (i > 0) protos.Append(',');
            protos.Append('"').Append(protoName[i]).Append('"');
        }
        protos.Append(']');

        System.IO.File.WriteAllText(OUT_DIR + "/" + prefix + "_protos.obj", obj.ToString());
        System.IO.File.WriteAllText(OUT_DIR + "/" + prefix + "_layout.json",
            "{\"protos\":" + protos + ",\"items\":[" + items + "]}");
        System.IO.File.WriteAllText(OUT_DIR + "/" + prefix + "_collision.json", "[" + boxes + "]");

        UnityEditor.SceneManagement.EditorSceneManager.ClosePreviewScene(scn);
        Debug.Log("[AMGParkExporter] " + scenePath + " -> " + protoName.Count + " prototypes, "
            + nItems + " placements, " + nBoxes + " collision boxes  (" + OUT_DIR + "/" + prefix + "_*)");
    }
}
