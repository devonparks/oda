// AMGActionBaker — author AMG World's ACTIVITY animations on the real Polygon
// Kid rig inside Unity, and export them in the exact same wire format the world's
// existing clips use.
//
// WHY THIS EXISTS
// ---------------
// The park's activities were borrowing emote clips as poses: 'squat' frozen at
// 1.8 s stood in for every sit (benches, swings, seesaw, spring riders, kart,
// slides), the 'twist' dance was the hula hoop, and the 'baseball' bat swing was
// the fishing cast. Those are placeholders, and they read as placeholders.
//
// None of the three Synty animation packs in this project (Base Locomotion,
// Idles, Emotes and Taunts — 816 Polygon clips) contains a sit, a swing pump, a
// slide ride, a fishing cast or a hula. Neither do the three Synty packs we do
// NOT own (Sword Combat, Bow Combat, Goblin Locomotion) — checked, nothing to
// buy. So the activity poses are authored here, on the rig, against measured
// world-space contact points — and the LIVING part (breath, sway, micro weight
// shift) is sampled from the real Synty idle and layered on top. Authored pose
// plus real secondary motion, not a frozen frame.
//
// THE FORMAT (do not change without changing the Node side)
// ---------------------------------------------------------
// Output matches _unity_export/rig/locomotion_bindref.json byte-for-concept:
//   { fps, format:'delta', bones:[22], bindPose:{bone:{q,parent}},
//     clips:{ id:{ dur, loop, frames, rot:[f*22*4 floats], hipY:[f floats] } } }
// where rot holds BIND-REFERENCED deltas — Unity local = bind ⊗ Δ — and hipY is
// the Hips joint's world-Y offset from its rest height, in metres.
//
// This exact recipe was verified against the committed locomotion_bindref.json:
// re-exporting A_POLY_IDL_Base_Masc off Assets/PolygonKids/Models/Characters_Kids.fbx
// reproduces its bindPose and its frame-0 deltas to the 4 decimals that file
// carries. Same rig, same sampling, same delta convention — so the Node-side
// retarget (tools/world/bake_actions_v2.mjs, itself a copy of emote_lab.mjs
// step 6) needs no new math.
//
// AUTHORING MODEL
// ---------------
// Poses are expressed as WORLD-SPACE aim directions and hand target POSITIONS,
// never as raw Euler angles, so there are no bind-axis sign guesses: a thigh is
// "point forward and 15 degrees down", a hand is "be at this point in space".
// Arms are solved with analytic two-bone IK, so a grip lands ON the swing chain
// / the seat edge / the rod, at whatever length that particular chain is.
//
// The rig faces +Z, up is +Y, and the character's own left is at -X. Measured
// rest geometry (Characters_Kids.fbx, root at origin):
//   Hips joint      y 0.5437     thigh 0.2437   shin 0.1837   ankle→ball 0.1021
//   Shoulder        (±0.138, 0.871, -0.034)     upper arm 0.1962  forearm 0.1482
//
// RUN:  menu  AMG > Bake World Action Clips
//       then, in the ODA repo:  node tools/world/bake_actions_v2.mjs verify
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEditor;
using UnityEngine;

public static class AMGActionBaker
{
    const string KID = "Assets/PolygonKids/Models/Characters_Kids.fbx";
    // The standing Synty idle. Its per-frame residual (frame0⁻¹ ⊗ frameN) is the
    // breath/sway layer stamped onto every authored pose's torso.
    const string LIFE = "Assets/Synty/AnimationIdles/Animations/Polygon/Masculine/Base/Stances/A_POLY_IDL_Base_Masc.fbx";
    // Committed, unlike _unity_export/ (gitignored) — so the Node bake stays
    // reproducible from a fresh clone without opening Unity at all.
    const string OUT = "C:/Users/devon/OneDrive/Desktop/ODA/tools/world/actions_bindref.json";

    // 20 fps, because RigV2 plays every emote-lane clip at the emote manifest's
    // single global fps (20) — a 30 fps action bin would play 1.5x fast.
    const int FPS = 20;

    static readonly string[] BONES = {
        "Hips","Spine_01","Spine_02","Spine_03","Neck","Head",
        "Clavicle_L","Shoulder_L","Elbow_L","Hand_L",
        "Clavicle_R","Shoulder_R","Elbow_R","Hand_R",
        "UpperLeg_L","LowerLeg_L","Ankle_L","Ball_L",
        "UpperLeg_R","LowerLeg_R","Ankle_R","Ball_R",
    };
    // Torso bones that receive the sampled Synty breath residual. Legs and arms
    // are authored to contact points and must not drift off them.
    static readonly string[] LIFE_BONES = { "Spine_01", "Spine_02", "Spine_03", "Neck", "Head" };
    const float LIFE_GAIN = 3.5f;   // see the note where it is applied

    // ── clip table ───────────────────────────────────────────────────────────
    class Spec
    {
        public string id; public int frames; public bool loop; public string label;
        public Spec(string i, int f, bool l, string lb) { id = i; frames = f; loop = l; label = lb; }
    }
    static readonly Spec[] CLIPS = {
        new Spec("sit",         60, true,  "Sit"),           // bench: hands on the seat edge, legs dangling
        new Spec("sit_swing",   44, true,  "Swing sit"),     // gripping the chains, at rest
        new Spec("swing_pump",  24, true,  "Swing pump"),    // ONE full pump cycle — rides.js drives the playhead off the swing phase
        new Spec("slide_ride",  30, true,  "Slide"),         // legs out, leaning back, arms up
        new Spec("sit_kart",    40, true,  "Kart sit"),      // hands forward on the rope, legs to the front axle
        new Spec("sit_seesaw",  40, true,  "Seesaw sit"),    // astride the plank, gripping the handle
        new Spec("sit_rocker",  40, true,  "Rocker sit"),    // astride the spring rider
        new Spec("hula",        30, true,  "Hula hoop"),     // hips circling, arms up and out
        new Spec("fish_cast",   22, false, "Cast"),          // wind up over the shoulder, whip, settle
        new Spec("fish_wait",   50, true,  "Waiting"),       // rod out, watching the bobber
        new Spec("fish_reel",   24, true,  "Reeling"),       // left hand cranking the reel
        new Spec("climb",       28, true,  "Climbing"),      // hand over hand up a ladder
        new Spec("climb_top",   20, false, "Topping out"),   // the last heave onto the deck
        new Spec("ride_stand",  36, true,  "Riding"),        // skateboard / scooter
        new Spec("bike_pedal",  24, true,  "Pedalling"),     // bike / trike
        new Spec("pogo",        18, true,  "Pogo"),          // spring in the knees
        new Spec("monkey",      40, true,  "Monkey bars"),   // hanging, hand over hand
        new Spec("sit_table",   60, true,  "At the table"),  // picnic bench, hands on the top
        new Spec("spin_ride",   50, true,  "Spinning"),      // roundabout, gripping the bar
        new Spec("board_push",  24, true,  "Push off"),      // skateboard kick — rides.js drives the playhead off its push cycle
        new Spec("crawl",       24, true,  "Crawling"),      // hands-and-knees clamber (tyres, low ledges)
        new Spec("board_stand", 36, true,  "Board stance"),  // SIDEWAYS skate stance — ride_stand stays forward-facing for scooters
        new Spec("scoot_stand", 36, true,  "Scooting"),      // forward stance, hands ON the scooter bars (low and close)

        // ── the engine prop database's bespoke set ───────────────────────────
        // One clip per prop KIND that was riding a near-neighbour placeholder
        // (engine/assets/prop_db.json tracks the gap as clipStatus). Every
        // seated one inherits the -0.261 pelvis contract via Seated().
        new Spec("sit_dragon",    44, true,  "Dragon ride"),   // straddling the coin dragon, hands on its neck
        new Spec("sit_coin_car",  44, true,  "Car ride"),      // in the coin car cockpit, hands on the wheel
        new Spec("sit_rocket",    44, true,  "Rocket ride"),   // knees-up cockpit sit, gripping the rim, leaning back
        new Spec("sit_tyre_swing",48, true,  "Tyre swing"),    // in the hanging tyre, hands up on the rope
        new Spec("sit_trike",     24, true,  "Trike pedal"),   // upright toddler-trike ride, pedalling the FRONT wheel
        new Spec("sit_sled",      50, true,  "Sled sit"),      // legs out front, gripping the rim beside the hips
        new Spec("sit_wagon",     50, true,  "Wagon sit"),     // knees up in the little tray, hands on the rim
        new Spec("sit_float",     60, true,  "Float lounge"),  // reclined in the pool ring, arms draped over it
        new Spec("zip_hang",      40, true,  "Zip hang"),      // both hands together on the trolley handle, legs tucked
    };

    // ── the pose a single frame resolves to ──────────────────────────────────
    struct Pose
    {
        public Vector3 pelvis;                 // aim: Hips → Spine_01
        public float pelvisTwist;              // extra spin about that aim axis (deg)
        public float neckTwist;                // head turn about the neck axis (deg)
        public Vector3 spine1, spine2, spine3, neck;
        public Vector3 thighL, thighR, shinL, shinR, footL, footR;
        public Vector3 handL, handR;           // world-space grip targets
        public Vector3 poleL, poleR;           // which way each elbow breaks
        public float hipY;                     // Hips vertical offset from rest (m)
        /**
         * Optional LEG IK: when legIK is set, the ankles are placed AT these
         * world points (two-bone IK, same solver as the arms) instead of via
         * the thigh/shin aims. This exists for the skateboard stance, where
         * "the feet are ON the board line" is an exact contact requirement —
         * aims put them near it; IK puts them on it.
         */
        public bool legIK;
        public Vector3 ankleL, ankleR;
        public Vector3 legPoleL, legPoleR;     // which way each knee breaks
    }

    /** The neutral standing skeleton, as aim directions — every pose starts here. */
    static Pose Rest()
    {
        return new Pose {
            pelvis = new Vector3(0f, 0.973f, -0.231f), pelvisTwist = 0f,
            spine1 = new Vector3(0f, 0.995f, -0.104f),
            spine2 = new Vector3(0f, 0.999f, 0.032f),
            spine3 = new Vector3(-0.819f, 0.388f, 0.422f),
            neck = new Vector3(0f, 0.982f, 0.187f),
            thighL = new Vector3(-0.025f, -0.999f, 0.025f), thighR = new Vector3(0.026f, -1f, -0.010f),
            shinL = new Vector3(-0.015f, -0.998f, -0.068f), shinR = new Vector3(0.015f, -0.996f, -0.091f),
            footL = new Vector3(0.001f, -0.574f, 0.819f), footR = new Vector3(0.001f, -0.592f, 0.806f),
            handL = new Vector3(-0.150f, 0.545f, 0.030f), handR = new Vector3(0.150f, 0.545f, 0.030f),
            poleL = new Vector3(-0.55f, -0.45f, -0.70f), poleR = new Vector3(0.55f, -0.45f, -0.70f),
            hipY = 0f,
        };
    }

    static float Tau(float u) { return u * Mathf.PI * 2f; }

    /**
     * The difference between a pose and a mannequin. The Synty idle residual
     * layered on later is real but TINY (its Spine_02 travels 0.4° over the
     * whole clip — that idle is very still), so a held pose needs authored life
     * on top: two breaths per loop through the chest, one slow weight shift, and
     * a head that turns to look around. All at whole-clip periods, so it loops.
     */
    static Pose Alive(Pose p, float u, float amount)
    {
        float br = Mathf.Sin(Tau(u) * 2f);     // breathing, twice per loop
        float sw = Mathf.Sin(Tau(u));          // weight shift / looking, once
        p.spine1 = new Vector3(p.spine1.x - 0.012f * amount * sw, p.spine1.y, p.spine1.z + 0.022f * amount * br);
        p.spine2 = new Vector3(p.spine2.x - 0.007f * amount * sw, p.spine2.y, p.spine2.z - 0.018f * amount * br);
        p.neck = new Vector3(p.neck.x, p.neck.y, p.neck.z + 0.012f * amount * br);
        p.pelvis = new Vector3(p.pelvis.x + 0.020f * amount * sw, p.pelvis.y, p.pelvis.z);
        p.neckTwist += 11f * amount * sw;
        return p;
    }

    /**
     * How much authored life each clip needs. Clips that already move a lot
     * (the pump, the cast) get none — they would only look twitchy.
     */
    static float LifeAmount(string id)
    {
        switch (id)
        {
            case "climb": return 0f;
            case "climb_top": return 0f;
            case "monkey": return 0f;
            case "pogo": return 0f;
            case "bike_pedal": return 0f;
            case "ride_stand": return 0.30f;
            case "board_stand": return 0.30f;
            case "scoot_stand": return 0.30f;
            case "sit_table": return 0.85f;
            case "spin_ride": return 0.55f;
            case "sit": return 1.00f;
            case "sit_swing": return 0.70f;
            case "sit_kart": return 0.55f;
            case "sit_seesaw": return 0.70f;
            case "sit_rocker": return 0.45f;
            case "slide_ride": return 0.35f;
            case "fish_wait": return 0.65f;
            case "fish_reel": return 0.30f;
            case "sit_dragon": return 0.45f;
            case "sit_coin_car": return 0.55f;
            case "sit_rocket": return 0.45f;
            case "sit_tyre_swing": return 0.70f;
            case "sit_sled": return 0.80f;
            case "sit_wagon": return 0.80f;
            case "sit_float": return 1.00f;
            default: return 0f;    // swing_pump, hula, fish_cast, sit_trike, zip_hang move plenty
        }
    }

    /**
     * How far a SEATED pelvis sits below the standing bind height, in metres.
     *
     * This is not cosmetic — it is the contract with the world's ride code. Every
     * seat offset in world/js/rides.js and main.js was tuned against the old
     * stand-in (the 'squat' emote frozen at 1.8 s), whose deepest frame carries
     * hipY = -0.261, putting its pelvis 0.283 above the avatar origin. Baking the
     * same drop into the sits means the new pose lands exactly where the old one
     * did, and not one of those tuned numbers has to move. Feet then hang just
     * below the pelvis instead of standing under it, which is the whole point.
     */
    const float SIT_HIP_DROP = -0.261f;
    static bool Seated(string id)
    {
        return id == "sit" || id == "sit_swing" || id == "swing_pump" || id == "slide_ride"
            || id == "sit_kart" || id == "sit_seesaw" || id == "sit_rocker"
            || id == "bike_pedal" || id == "sit_table" || id == "spin_ride"
            || id == "sit_dragon" || id == "sit_coin_car" || id == "sit_rocket"
            || id == "sit_tyre_swing" || id == "sit_trike" || id == "sit_sled"
            || id == "sit_wagon" || id == "sit_float";
        // zip_hang is a HANG — the engine places the feet-origin directly
    }

    /** @param u normalised playhead in [0,1) for loops, [0,1] for one-shots. */
    static Pose Build(string id, float u)
    {
        var p = BuildRaw(id, u);
        float life = LifeAmount(id);
        if (life > 0f) p = Alive(p, u, life);
        if (Seated(id)) p.hipY += SIT_HIP_DROP;
        return p;
    }

    /** The pose itself. Clips inherit from each other through HERE, so the life
     *  layer is never applied twice to one frame. */
    static Pose BuildRaw(string id, float u)
    {
        var p = Rest();
        float s = Mathf.Sin(Tau(u)), c = Mathf.Cos(Tau(u));

        switch (id)
        {
            // ── seated family ────────────────────────────────────────────────
            // Thighs forward and slightly down, shins hanging back under the
            // knee, pelvis tipped back onto the sit bones. Hands rest on the
            // seat beside the hips — a kid's arms cannot reach their own knees
            // from a seated shoulder height (0.33 of reach vs 0.45 of distance),
            // so "hands on knees" would silently become "arms stretched at air".
            case "sit":
                p.pelvis = new Vector3(0f, 0.955f, -0.296f);
                p.spine1 = new Vector3(0f, 0.985f, -0.172f);
                p.spine2 = new Vector3(0f, 0.999f, 0.040f);
                p.neck = new Vector3(0f, 0.980f, 0.199f);
                p.thighL = new Vector3(-0.100f, -0.258f, 0.961f);
                p.thighR = new Vector3(0.100f, -0.258f, 0.961f);
                p.shinL = new Vector3(-0.010f, -0.985f, -0.172f);
                p.shinR = new Vector3(0.010f, -0.985f, -0.172f);
                p.footL = new Vector3(0f, -0.550f, 0.835f);
                p.footR = new Vector3(0f, -0.550f, 0.835f);
                // Hands on the tops of the thighs, near the hips. NOT on the
                // knees: seated, a kid's shoulder-to-knee distance (0.45) beats
                // its whole arm (0.344), so "hands on knees" silently becomes
                // "arms stretched at air".
                p.handL = new Vector3(-0.130f, 0.560f, 0.100f);
                p.handR = new Vector3(0.130f, 0.560f, 0.100f);
                // feet swing gently — the tell that a kid is sitting, not parked
                p.shinL.z += 0.10f * s; p.shinR.z += 0.10f * Mathf.Sin(Tau(u) + 0.7f);
                break;

            case "sit_swing":
                p = BuildRaw("sit", u);
                p.pelvis = new Vector3(0f, 0.970f, -0.243f);
                // legs a touch forward and together, feet pointed — swing shape
                p.thighL = new Vector3(-0.070f, -0.330f, 0.941f);
                p.thighR = new Vector3(0.070f, -0.330f, 0.941f);
                p.shinL = new Vector3(0f, -0.960f, 0.020f + 0.06f * s);
                p.shinR = new Vector3(0f, -0.960f, 0.020f + 0.06f * s);
                p.footL = new Vector3(0f, -0.400f, 0.917f);
                p.footR = new Vector3(0f, -0.400f, 0.917f);
                // Hands on the chains at x = ±0.19 — and 6 cm LOWER than the
                // natural reach: the wrist joint is what lands on the target,
                // so dropping it puts the PALM (which extends up the reach
                // line) around the chain instead of leaving it floating beside.
                p.handL = new Vector3(-0.190f, 1.125f, 0.005f);
                p.handR = new Vector3(0.190f, 1.125f, 0.005f);
                p.poleL = new Vector3(-0.80f, -0.55f, -0.25f);
                p.poleR = new Vector3(0.80f, -0.55f, -0.25f);
                break;

            // The real thing: legs shoot out and the torso lays back at one end
            // of the arc, legs tuck and the torso pulls upright at the other,
            // while the hands stay welded to the chains (the IK holds them, so
            // the arms pull and straighten on their own). rides.js drives u off
            // the swing's own phase, so the kid pumps in time with the swing.
            case "swing_pump":
                p = BuildRaw("sit_swing", 0f);
                p.pelvis = new Vector3(0f, 1f, -0.30f - 0.30f * s).normalized;
                p.spine1 = new Vector3(0f, 1f, -0.14f - 0.16f * s).normalized;
                p.spine2 = new Vector3(0f, 1f, 0.02f - 0.06f * s).normalized;
                p.thighL = new Vector3(-0.085f, -0.30f + 0.46f * s, 0.95f).normalized;
                p.thighR = new Vector3(0.085f, -0.30f + 0.46f * s, 0.95f).normalized;
                {   // knees straighten as the legs kick out, fold hard on the tuck
                    float k = (s + 1f) * 0.5f;
                    p.shinL = Vector3.Lerp(new Vector3(-0.01f, -0.93f, -0.37f), p.thighL, k).normalized;
                    p.shinR = Vector3.Lerp(new Vector3(0.01f, -0.93f, -0.37f), p.thighR, k).normalized;
                    p.footL = Vector3.Lerp(new Vector3(0f, -0.62f, 0.78f), new Vector3(0f, -0.22f, 0.98f), k).normalized;
                    p.footR = p.footL;
                }
                break;

            case "slide_ride":
                p.pelvis = new Vector3(0f, 0.900f, -0.436f);
                p.spine1 = new Vector3(0f, 0.960f, -0.280f);
                p.spine2 = new Vector3(0f, 0.995f, -0.100f);
                p.neck = new Vector3(0f, 0.975f, 0.222f);
                p.thighL = new Vector3(-0.090f, -0.100f, 0.991f);
                p.thighR = new Vector3(0.090f, -0.100f, 0.991f);
                p.shinL = new Vector3(-0.020f, -0.430f, 0.902f);
                p.shinR = new Vector3(0.020f, -0.430f, 0.902f);
                p.footL = new Vector3(0f, -0.330f, 0.944f);
                p.footR = new Vector3(0f, -0.330f, 0.944f);
                // arms up — the universal "wheee". Slight scissor so it isn't a statue.
                p.handL = new Vector3(-0.285f - 0.03f * s, 1.155f + 0.03f * s, 0.055f);
                p.handR = new Vector3(0.285f + 0.03f * s, 1.155f - 0.03f * s, 0.055f);
                p.poleL = new Vector3(-0.70f, -0.60f, -0.38f);
                p.poleR = new Vector3(0.70f, -0.60f, -0.38f);
                p.pelvisTwist = 3f * s;
                break;

            case "sit_kart":
                p = BuildRaw("sit", u);
                p.pelvis = new Vector3(0f, 0.940f, -0.341f);
                p.thighL = new Vector3(-0.110f, -0.120f, 0.987f);
                p.thighR = new Vector3(0.110f, -0.120f, 0.987f);
                p.shinL = new Vector3(-0.020f, -0.580f, 0.814f);
                p.shinR = new Vector3(0.020f, -0.580f, 0.814f);
                p.footL = new Vector3(0f, -0.480f, 0.877f);
                p.footR = new Vector3(0f, -0.480f, 0.877f);
                // both hands forward on the steering rope
                p.handL = new Vector3(-0.160f, 0.862f, 0.300f);
                p.handR = new Vector3(0.160f, 0.862f, 0.300f);
                p.poleL = new Vector3(-0.85f, -0.50f, -0.15f);
                p.poleR = new Vector3(0.85f, -0.50f, -0.15f);
                break;

            case "sit_seesaw":
                p = BuildRaw("sit", u);
                p.pelvis = new Vector3(0f, 0.985f, -0.173f);
                p.spine1 = new Vector3(0f, 0.995f, -0.100f);
                // Straddling the plank: thighs out and forward, and the knees
                // actually FOLD (~75°). Straddle without the fold reads as a kid
                // standing there leaning — which is exactly what the first bake
                // rendered.
                p.thighL = new Vector3(-0.300f, -0.205f, 0.931f);
                p.thighR = new Vector3(0.300f, -0.205f, 0.931f);
                p.shinL = new Vector3(-0.190f, -0.965f, -0.180f);
                p.shinR = new Vector3(0.190f, -0.965f, -0.180f);
                p.footL = new Vector3(-0.100f, -0.560f, 0.822f);
                p.footR = new Vector3(0.100f, -0.560f, 0.822f);
                p.handL = new Vector3(-0.130f, 0.800f, 0.262f);
                p.handR = new Vector3(0.130f, 0.800f, 0.262f);
                p.poleL = new Vector3(-0.90f, -0.40f, -0.18f);
                p.poleR = new Vector3(0.90f, -0.40f, -0.18f);
                break;

            case "sit_rocker":
                p = BuildRaw("sit_seesaw", u);
                p.pelvis = new Vector3(0f, 0.995f, -0.100f);
                p.thighL = new Vector3(-0.335f, -0.235f, 0.912f);
                p.thighR = new Vector3(0.335f, -0.235f, 0.912f);
                p.shinL = new Vector3(-0.230f, -0.950f, -0.210f);
                p.shinR = new Vector3(0.230f, -0.950f, -0.210f);
                p.handL = new Vector3(-0.122f, 0.820f, 0.242f);
                p.handR = new Vector3(0.122f, 0.820f, 0.242f);
                p.hipY = 0.018f * Mathf.Sin(Tau(u) * 2f);   // a little bounce
                break;

            // ── hula hoop ────────────────────────────────────────────────────
            // The pelvis traces a cone while the spine counter-tilts, so the
            // shoulders stay roughly over the feet and only the hips orbit —
            // which is exactly what makes a hula read as a hula.
            case "hula":
                p.pelvis = new Vector3(0.430f * s, 1f, -0.231f + 0.430f * c).normalized;
                p.pelvisTwist = 18f * Mathf.Sin(Tau(u) + 1.0f);
                p.spine1 = new Vector3(-0.235f * s, 1f, -0.104f - 0.235f * c).normalized;
                p.spine2 = new Vector3(-0.110f * s, 1f, 0.032f - 0.110f * c).normalized;
                p.neck = new Vector3(0f, 0.982f, 0.187f);
                // knees soft and springy — thigh forward, shin back under it
                p.thighL = new Vector3(-0.045f, -0.982f, 0.180f + 0.040f * c);
                p.thighR = new Vector3(0.045f, -0.982f, 0.180f + 0.040f * c);
                p.shinL = new Vector3(-0.015f, -0.993f, -0.110f);
                p.shinR = new Vector3(0.015f, -0.993f, -0.110f);
                // arms out and up, counter-orbiting the hips
                p.handL = new Vector3(-0.330f - 0.03f * c, 1.090f + 0.05f * s, 0.020f - 0.05f * s);
                p.handR = new Vector3(0.330f + 0.03f * c, 1.090f - 0.05f * s, 0.020f + 0.05f * s);
                p.poleL = new Vector3(-0.75f, -0.60f, -0.28f);
                p.poleR = new Vector3(0.75f, -0.60f, -0.28f);
                p.hipY = 0.016f * Mathf.Sin(Tau(u) * 2f);
                break;

            // ── vehicles and the rest of the park ────────────────────────────

            // Standing on a deck: feet across the board, knees loose, arms out
            // for balance. Skateboards and scooters share it — a scooter rider
            // just gets their hands put on the bars by the ride code.
            case "ride_stand":
                {
                    float sw = Mathf.Sin(Tau(u));
                    p.pelvis = new Vector3(0.04f * sw, 1f, -0.06f).normalized;
                    p.spine1 = new Vector3(0.03f * sw, 1f, 0.04f).normalized;
                    p.neck = new Vector3(0f, 0.97f, 0.24f).normalized;
                    // left foot forward and turned out, right foot back — a stance
                    p.thighL = new Vector3(-0.16f, -0.94f, 0.30f).normalized;
                    p.thighR = new Vector3(0.20f, -0.96f, -0.19f).normalized;
                    p.shinL = new Vector3(-0.05f, -0.98f, -0.19f).normalized;
                    p.shinR = new Vector3(0.06f, -0.97f, 0.22f).normalized;
                    p.footL = new Vector3(-0.30f, -0.38f, 0.87f).normalized;
                    p.footR = new Vector3(0.34f, -0.42f, 0.84f).normalized;
                    p.handL = new Vector3(-0.34f - 0.03f * sw, 0.82f, 0.10f);
                    p.handR = new Vector3(0.34f + 0.03f * sw, 0.80f, -0.02f);
                    p.poleL = new Vector3(-0.75f, -0.55f, -0.36f);
                    p.poleR = new Vector3(0.75f, -0.55f, -0.36f);
                    p.hipY = -0.06f + 0.015f * sw;          // knees always a bit bent
                    break;
                }

            // Scooter: same staggered stance as ride_stand, but the hands GRIP
            // THE BARS — low, close together, forward — instead of ballooning
            // out for balance (the audit caught them holding air a head above
            // the toy scooter's bars). Slight forward lean into the push.
            case "scoot_stand":
                {
                    p = BuildRaw("ride_stand", u);
                    p.pelvis = new Vector3(0f, 1f, 0.02f).normalized;
                    p.spine1 = new Vector3(0f, 1f, 0.10f).normalized;
                    p.handL = new Vector3(-0.11f, 0.625f, 0.295f);
                    p.handR = new Vector3(0.11f, 0.625f, 0.295f);
                    p.poleL = new Vector3(-0.72f, -0.52f, -0.30f);
                    p.poleR = new Vector3(0.72f, -0.52f, -0.30f);
                    break;
                }

            // Seated, hands forward on the bars, legs turning a real circle.
            case "bike_pedal":
                {
                    float a1 = Tau(u), a2 = Tau(u) + Mathf.PI;   // legs half a turn apart
                    p.pelvis = new Vector3(0f, 0.985f, -0.170f);
                    p.spine1 = new Vector3(0f, 0.976f, 0.220f).normalized;   // leaning to the bars
                    p.spine2 = new Vector3(0f, 0.990f, 0.140f).normalized;
                    p.neck = new Vector3(0f, 0.960f, 0.280f).normalized;
                    // thigh sweeps up and down; shin follows a beat behind
                    p.thighL = new Vector3(-0.10f, -0.42f + 0.34f * Mathf.Sin(a1), 0.86f).normalized;
                    p.thighR = new Vector3(0.10f, -0.42f + 0.34f * Mathf.Sin(a2), 0.86f).normalized;
                    p.shinL = new Vector3(-0.03f, -0.90f, 0.10f + 0.42f * Mathf.Cos(a1)).normalized;
                    p.shinR = new Vector3(0.03f, -0.90f, 0.10f + 0.42f * Mathf.Cos(a2)).normalized;
                    p.footL = new Vector3(0f, -0.36f, 0.93f);
                    p.footR = new Vector3(0f, -0.36f, 0.93f);
                    // reach DOWN to the toy bike's bars (they're at a kid's
                    // thigh height — the audit caught the hands hovering high)
                    p.handL = new Vector3(-0.17f, 0.79f, 0.36f);
                    p.handR = new Vector3(0.17f, 0.79f, 0.36f);
                    p.poleL = new Vector3(-0.88f, -0.44f, -0.18f);
                    p.poleR = new Vector3(0.88f, -0.44f, -0.18f);
                    break;
                }

            // Both feet on the pegs, both hands on the handle, knees springing.
            // The world bounces the avatar; this is the body doing the spring.
            case "pogo":
                {
                    float sp = Mathf.Sin(Tau(u));
                    p.pelvis = new Vector3(0f, 1f, -0.10f).normalized;
                    p.spine1 = new Vector3(0f, 1f, 0.10f).normalized;
                    p.neck = new Vector3(0f, 0.97f, 0.24f).normalized;
                    p.thighL = new Vector3(-0.11f, -0.90f + 0.22f * sp, 0.42f).normalized;
                    p.thighR = new Vector3(0.11f, -0.90f + 0.22f * sp, 0.42f).normalized;
                    p.shinL = new Vector3(-0.03f, -0.94f, -0.32f + 0.24f * sp).normalized;
                    p.shinR = new Vector3(0.03f, -0.94f, -0.32f + 0.24f * sp).normalized;
                    p.footL = new Vector3(0f, -0.30f, 0.95f);
                    p.footR = new Vector3(0f, -0.30f, 0.95f);
                    // hands ON the pogo's grips: the stick runs up the body's
                    // centre, so the grips are close in, not out front (the
                    // audit caught the hands holding air 20 cm ahead of it)
                    p.handL = new Vector3(-0.11f, 0.95f, 0.09f);
                    p.handR = new Vector3(0.11f, 0.95f, 0.09f);
                    p.poleL = new Vector3(-0.90f, -0.40f, -0.16f);
                    p.poleR = new Vector3(0.90f, -0.40f, -0.16f);
                    p.hipY = -0.05f + 0.05f * sp;
                    break;
                }

            // Hanging by the hands under the bars, body long, legs swinging in
            // opposition as each hand reaches. Devon: the monkey bars need "an
            // animation for going across".
            case "monkey":
                {
                    float m = Mathf.Sin(Tau(u)), mc = Mathf.Cos(Tau(u));
                    p.pelvis = new Vector3(0.06f * m, 1f, -0.10f).normalized;
                    p.spine1 = new Vector3(0.05f * m, 1f, -0.04f).normalized;
                    p.spine2 = new Vector3(0.03f * m, 1f, 0.02f).normalized;
                    p.neck = new Vector3(0f, 0.95f, 0.30f).normalized;      // looking ahead
                    // one hand ahead and high, the other behind — hand over hand
                    p.handL = new Vector3(-0.13f, 1.34f, 0.16f + 0.26f * mc);
                    p.handR = new Vector3(0.13f, 1.34f, 0.16f - 0.26f * mc);
                    p.poleL = new Vector3(-0.55f, -0.80f, -0.24f);
                    p.poleR = new Vector3(0.55f, -0.80f, -0.24f);
                    // legs hang and swing opposite the arms
                    p.thighL = new Vector3(-0.06f, -0.95f, 0.26f - 0.24f * mc).normalized;
                    p.thighR = new Vector3(0.06f, -0.95f, 0.26f + 0.24f * mc).normalized;
                    p.shinL = new Vector3(-0.03f, -0.93f, -0.36f).normalized;
                    p.shinR = new Vector3(0.03f, -0.93f, -0.36f).normalized;
                    p.footL = new Vector3(0f, -0.62f, 0.78f);
                    p.footR = new Vector3(0f, -0.62f, 0.78f);
                    p.hipY = -0.02f + 0.02f * m;
                    break;
                }

            // Picnic bench: legs tucked UNDER the table, forearms on the top.
            case "sit_table":
                {
                    p = BuildRaw("sit", u);
                    p.pelvis = new Vector3(0f, 0.990f, -0.140f).normalized;
                    p.spine1 = new Vector3(0f, 0.985f, 0.170f).normalized;   // leaning in
                    p.spine2 = new Vector3(0f, 0.995f, 0.100f).normalized;
                    p.thighL = new Vector3(-0.090f, -0.300f, 0.950f).normalized;
                    p.thighR = new Vector3(0.090f, -0.300f, 0.950f).normalized;
                    p.shinL = new Vector3(-0.010f, -0.975f, -0.220f).normalized;
                    p.shinR = new Vector3(0.010f, -0.975f, -0.220f).normalized;
                    // Hands resting ON the tabletop — measured, not guessed:
                    // the picnic table's top sits 0.344 m above its seat plank,
                    // and a seated rider's origin is (seat + 0.04 − 0.2827), so
                    // the top lands at local y 0.60. The old 0.76 hovered them
                    // 15 cm above the wood.
                    p.handL = new Vector3(-0.175f, 0.600f, 0.330f);
                    p.handR = new Vector3(0.175f, 0.600f, 0.330f);
                    p.poleL = new Vector3(-0.88f, -0.42f, -0.22f);
                    p.poleR = new Vector3(0.88f, -0.42f, -0.22f);
                    break;
                }

            // Roundabout: sitting on the deck, hanging on to the bar, leaning
            // OUT against the spin.
            case "spin_ride":
                {
                    p = BuildRaw("sit", u);
                    p.pelvis = new Vector3(0f, 0.945f, -0.327f).normalized;   // leaning back
                    p.spine1 = new Vector3(0f, 0.975f, -0.222f).normalized;
                    p.thighL = new Vector3(-0.150f, -0.180f, 0.972f).normalized;
                    p.thighR = new Vector3(0.150f, -0.180f, 0.972f).normalized;
                    p.shinL = new Vector3(-0.040f, -0.700f, 0.713f).normalized;
                    p.shinR = new Vector3(0.040f, -0.700f, 0.713f).normalized;
                    p.footL = new Vector3(0f, -0.480f, 0.877f);
                    p.footR = new Vector3(0f, -0.480f, 0.877f);
                    // both hands on the grab bar in front
                    p.handL = new Vector3(-0.165f, 0.880f, 0.300f);
                    p.handR = new Vector3(0.165f, 0.880f, 0.300f);
                    p.poleL = new Vector3(-0.86f, -0.48f, -0.18f);
                    p.poleR = new Vector3(0.86f, -0.48f, -0.18f);
                    break;
                }

            // ── the SIDEWAYS skate stance ────────────────────────────────────
            // Devon: "the character doesn't stay sideways on the skateboard —
            // it looks impossible… the feet should be ON TOP of the skateboard."
            // Regular stance: the BOARD points along travel (+Z), the feet
            // stand ON its line (x ≈ 0) — left foot near the nose, right near
            // the tail — and the BODY faces across it (+X), head turned to
            // look where you're going. Feet are exact leg-IK contacts, not
            // aims: this pose IS its contacts.
            case "board_stand":
                {
                    float sw2 = Mathf.Sin(Tau(u));
                    p.legIK = true;
                    p.ankleL = new Vector3(-0.015f, 0.088f, 0.235f);   // front foot, on the nose
                    p.ankleR = new Vector3(0.015f, 0.088f, -0.235f);   // back foot, on the tail
                    p.legPoleL = new Vector3(0.85f, -0.30f, 0.25f);    // knees break toward the chest side
                    p.legPoleR = new Vector3(0.85f, -0.30f, -0.15f);
                    p.footL = new Vector3(0.79f, -0.42f, 0.44f).normalized;   // toes across the deck, front angled
                    p.footR = new Vector3(0.88f, -0.45f, 0.12f).normalized;
    // hips over the board, chest opened toward +X — 45°, not more: the
                    // audit read the harder twist as "not possible" against
                    // legs that stay on the board line
                    p.pelvis = new Vector3(0.06f * sw2, 1f, -0.05f).normalized;
                    p.pelvisTwist = -45f;
                    p.spine1 = new Vector3(0.05f, 1f, 0.02f).normalized;
                    p.spine2 = new Vector3(0.03f, 1f, 0.03f).normalized;
                    // shoulder line runs along the BOARD: Clavicle_L toward the nose
                    p.spine3 = new Vector3(0.30f, 0.40f, 0.87f).normalized;
                    // head turns to look down the line of travel
                    p.neck = new Vector3(0.05f, 0.97f, 0.24f).normalized;
                    p.neckTwist = 30f;
                    // arms loose along the board — elbows soft, not a T-pose
                    p.handL = new Vector3(-0.05f - 0.02f * sw2, 0.80f, 0.34f);
                    p.handR = new Vector3(0.10f, 0.76f, -0.30f + 0.02f * sw2);
                    p.poleL = new Vector3(-0.30f, -0.55f, 0.72f);
                    p.poleR = new Vector3(0.55f, -0.55f, -0.55f);
                    p.hipY = -0.055f + 0.012f * sw2;     // knees always a bit bent
                    break;
                }

            // Skateboard push-off, in the SAME sideways frame as board_stand:
            // the front (left) foot stays welded to the deck while the back
            // (right) foot steps off, drives back along the ground beside the
            // board, lifts and returns to the tail. rides.js drives u off its
            // own push cycle, so the kick lands exactly when the speed surges.
            // The ground is a deck-height BELOW the origin (the origin rides
            // the deck top), so contact frames reach y ≈ -0.04 and the hips
            // dip to keep the stance knee honest.
            // Timeline (starts and ends ON the tail, so the loop is seamless):
            // step-off 0-0.14, reach 0.14-0.30, DRIVE 0.30-0.60, lift 0.60-0.76,
            // back to the tail 0.76-1.
            case "board_push":
                {
                    p = BuildRaw("board_stand", 0f);
                    Vector3 tail = new Vector3(0.015f, 0.088f, -0.235f);
                    Vector3 reach = new Vector3(0.185f, -0.035f, 0.30f);
                    Vector3 back = new Vector3(0.165f, -0.035f, -0.44f);
                    Vector3 lift = new Vector3(0.13f, 0.16f, -0.02f);
                    float dip;
                    if (u < 0.14f)
                    {
                        float k = Ease(u / 0.14f);
                        p.ankleR = Vector3.Lerp(tail, lift, k);
                        dip = 0f;
                    }
                    else if (u < 0.30f)
                    {
                        float k = Ease((u - 0.14f) / 0.16f);
                        p.ankleR = Vector3.Lerp(lift, reach, k);
                        dip = k;
                    }
                    else if (u < 0.60f)
                    {
                        float k = Ease((u - 0.30f) / 0.30f);
                        p.ankleR = Vector3.Lerp(reach, back, k);
                        dip = 1f;
                    }
                    else if (u < 0.76f)
                    {
                        float k = Ease((u - 0.60f) / 0.16f);
                        p.ankleR = Vector3.Lerp(back, lift, k);
                        dip = 1f - k;
                    }
                    else
                    {
                        float k = Ease((u - 0.76f) / 0.24f);
                        p.ankleR = Vector3.Lerp(lift, tail, k);
                        dip = 0f;
                    }
                    p.footR = new Vector3(0.55f, -0.50f, 0.67f).normalized;   // push foot points along travel
                    p.hipY = -0.055f - 0.075f * dip;
                    p.pelvis = new Vector3(0.10f * dip, 1f, -0.05f + 0.06f * dip).normalized;
                    p.handR = new Vector3(0.10f + 0.06f * dip, 0.76f, -0.30f + 0.10f * dip);
                    break;
                }

            // Hands-and-knees crawl: trunk pitched forward until the near-straight
            // arms reach the ground (shoulder height ≈ arm length), knees under
            // the hips, opposite hand and knee advancing together. Used for the
            // tyre mounds — Devon: "a crawl state to climb them, rather than one
            // locked animation."
            case "crawl":
                {
                    float cs = Mathf.Cos(Tau(u)), sn = Mathf.Sin(Tau(u));
                    p.pelvis = new Vector3(0.03f * sn, 0.30f, 0.95f).normalized;
                    p.spine1 = new Vector3(0f, 0.35f, 0.94f).normalized;
                    p.spine2 = new Vector3(0f, 0.45f, 0.89f).normalized;
                    p.neck = new Vector3(0f, 0.85f, 0.53f).normalized;      // eyes ahead
                    p.handL = new Vector3(-0.145f, 0.05f + 0.05f * Mathf.Max(0f, sn), 0.34f + 0.10f * cs);
                    p.handR = new Vector3(0.145f, 0.05f + 0.05f * Mathf.Max(0f, -sn), 0.34f - 0.10f * cs);
                    p.poleL = new Vector3(-0.50f, -0.25f, -0.83f);
                    p.poleR = new Vector3(0.50f, -0.25f, -0.83f);
                    p.thighL = new Vector3(-0.09f, -0.90f, -0.30f - 0.22f * cs).normalized;
                    p.thighR = new Vector3(0.09f, -0.90f, -0.30f + 0.22f * cs).normalized;
                    p.shinL = new Vector3(-0.03f, -0.20f, -0.98f).normalized;
                    p.shinR = new Vector3(0.03f, -0.20f, -0.98f).normalized;
                    p.footL = new Vector3(0f, -0.40f, 0.92f);
                    p.footR = new Vector3(0f, -0.40f, 0.92f);
                    p.hipY = -0.250f + 0.015f * Mathf.Sin(Tau(u) * 2f);
                    break;
                }

            // ── climbing ─────────────────────────────────────────────────────
            // Hand over hand, opposite arm and leg together, hips close to the
            // rungs. Devon: the treehouse "has to actually be a separate
            // climbing animation" — you should not be able to stroll up a
            // ladder, and this is what plays instead.
            case "climb":
                {
                    float c2 = Mathf.Cos(Tau(u)), s2 = Mathf.Sin(Tau(u));
                    p.pelvis = new Vector3(0.05f * s2, 1f, 0.16f).normalized;   // chest to the wall
                    p.spine1 = new Vector3(0.04f * s2, 1f, 0.10f).normalized;
                    p.spine2 = new Vector3(0.02f * s2, 1f, 0.05f).normalized;
                    p.neck = new Vector3(0f, 0.94f, 0.34f).normalized;          // looking up
                    // reach: one hand high while the other is at chest height
                    p.handL = new Vector3(-0.17f, 1.16f + 0.30f * c2, 0.30f);
                    p.handR = new Vector3(0.17f, 1.16f - 0.30f * c2, 0.30f);
                    p.poleL = new Vector3(-0.85f, -0.45f, -0.28f);
                    p.poleR = new Vector3(0.85f, -0.45f, -0.28f);
                    // opposite legs: the one under the RAISED hand is planted
                    p.thighL = new Vector3(-0.10f, -0.80f + 0.34f * c2, 0.59f).normalized;
                    p.thighR = new Vector3(0.10f, -0.80f - 0.34f * c2, 0.59f).normalized;
                    p.shinL = new Vector3(-0.05f, -0.93f, -0.36f + 0.30f * c2).normalized;
                    p.shinR = new Vector3(0.05f, -0.93f, -0.36f - 0.30f * c2).normalized;
                    p.footL = new Vector3(0f, -0.45f, 0.89f);
                    p.footR = new Vector3(0f, -0.45f, 0.89f);
                    p.hipY = -0.03f + 0.03f * c2;
                    break;
                }

            // The heave over the lip: both hands plant on the deck, the body
            // folds forward over them, a knee comes up, then stand.
            case "climb_top":
                {
                    float k = Ease(u);
                    p.pelvis = new Vector3(0f, 1f, 0.62f - 0.62f * k).normalized;
                    p.spine1 = new Vector3(0f, 1f, 0.40f - 0.44f * k).normalized;
                    p.spine2 = new Vector3(0f, 1f, 0.20f - 0.20f * k).normalized;
                    p.neck = new Vector3(0f, 0.96f, 0.28f);
                    p.handL = new Vector3(-0.26f, 1.02f + 0.08f * k, 0.34f - 0.30f * k);
                    p.handR = new Vector3(0.26f, 1.02f + 0.08f * k, 0.34f - 0.30f * k);
                    p.poleL = new Vector3(-0.80f, -0.40f, -0.44f);
                    p.poleR = new Vector3(0.80f, -0.40f, -0.44f);
                    // the knee that comes up first, then both legs straighten
                    p.thighL = Vector3.Lerp(new Vector3(-0.12f, -0.32f, 0.94f), new Vector3(-0.03f, -0.99f, 0.10f), k).normalized;
                    p.thighR = Vector3.Lerp(new Vector3(0.12f, -0.86f, 0.49f), new Vector3(0.03f, -0.99f, 0.02f), k).normalized;
                    p.shinL = Vector3.Lerp(new Vector3(-0.05f, -0.96f, -0.28f), new Vector3(-0.02f, -1f, 0.04f), k).normalized;
                    p.shinR = Vector3.Lerp(new Vector3(0.05f, -0.94f, -0.34f), new Vector3(0.02f, -1f, 0.02f), k).normalized;
                    p.footL = new Vector3(0f, -0.55f, 0.84f);
                    p.footR = new Vector3(0f, -0.55f, 0.84f);
                    break;
                }

            // ── fishing ──────────────────────────────────────────────────────
            // One shot in three beats: load the rod back over the right
            // shoulder, whip it forward, settle into the watching hold. The
            // world draws the rod from the Hand_R bone, so the arm IS the cast.
            case "fish_cast":
                {
                    Vector3 hold = new Vector3(0.170f, 0.930f, 0.262f);
                    Vector3 back = new Vector3(0.205f, 1.128f, -0.198f);
                    Vector3 fwd = new Vector3(0.098f, 1.000f, 0.378f);
                    Vector3 r;
                    float lean;
                    if (u < 0.36f) { float k = Ease(u / 0.36f); r = Vector3.Lerp(hold, back, k); lean = -0.16f * k; }
                    else if (u < 0.56f) { float k = Ease((u - 0.36f) / 0.20f); r = Vector3.Lerp(back, fwd, k); lean = -0.16f + 0.30f * k; }
                    else { float k = Ease((u - 0.56f) / 0.44f); r = Vector3.Lerp(fwd, hold, k); lean = 0.14f * (1f - k); }
                    p = FishStance(p, r, lean);
                    break;
                }

            case "fish_wait":
                p = FishStance(p, new Vector3(0.170f, 0.928f + 0.012f * s, 0.264f), 0.02f * s);
                break;

            case "fish_reel":
                {
                    // right hand steadies the rod, left hand cranks the reel
                    Vector3 r = new Vector3(0.170f, 0.945f, 0.240f);
                    p = FishStance(p, r, -0.05f + 0.05f * s);
                    p.handL = new Vector3(0.020f + 0.062f * Mathf.Cos(Tau(u)), 0.868f + 0.062f * Mathf.Sin(Tau(u)), 0.238f + 0.02f * s);
                    break;
                }

            // ── the prop database's bespoke rides ────────────────────────────

            // Straddling the coin dragon: the rocker straddle with both hands
            // stacked forward on the dragon's neck, torso leaning gently into
            // the ride's rock (the prop's own motion supplies the big movement).
            case "sit_dragon":
                p = BuildRaw("sit_rocker", u);
                p.pelvis = new Vector3(0f, 0.990f, -0.141f).normalized;
                p.spine1 = new Vector3(0f, 0.992f, 0.126f).normalized;   // chest toward the neck
                p.handL = new Vector3(-0.115f, 0.885f, 0.265f);
                p.handR = new Vector3(0.115f, 0.885f, 0.265f);
                p.poleL = new Vector3(-0.86f, -0.44f, -0.16f);
                p.poleR = new Vector3(0.86f, -0.44f, -0.16f);
                p.neck = new Vector3(0f, 0.965f, 0.262f).normalized;     // eyes over the head
                p.hipY = 0.014f * Mathf.Sin(Tau(u) * 2f);
                break;

            // The coin car cockpit: kart legs into the footwell, hands ON the
            // little steering wheel, sawing it a few degrees back and forth.
            case "sit_coin_car":
                p = BuildRaw("sit_kart", u);
                p.handL = new Vector3(-0.150f, 0.880f + 0.012f * s, 0.290f);
                p.handR = new Vector3(0.150f, 0.880f - 0.012f * s, 0.290f);
                p.poleL = new Vector3(-0.84f, -0.50f, -0.16f);
                p.poleR = new Vector3(0.84f, -0.50f, -0.16f);
                p.neck = new Vector3(0f, 0.968f, 0.251f).normalized;     // watching the "road"
                break;

            // The rocket cockpit is CRAMPED: knees up near the rim, torso laid
            // back against the seat, narrow grips at the cockpit edge.
            case "sit_rocket":
                p = BuildRaw("sit", u);
                p.pelvis = new Vector3(0f, 0.930f, -0.368f).normalized;  // laid back
                p.spine1 = new Vector3(0f, 0.975f, -0.222f).normalized;
                p.neck = new Vector3(0f, 0.945f, 0.327f).normalized;     // looking up and out
                p.thighL = new Vector3(-0.100f, 0.100f, 0.990f).normalized;   // knees UP
                p.thighR = new Vector3(0.100f, 0.100f, 0.990f).normalized;
                p.shinL = new Vector3(-0.020f, -0.970f, -0.240f).normalized;
                p.shinR = new Vector3(0.020f, -0.970f, -0.240f).normalized;
                p.footL = new Vector3(0f, -0.500f, 0.866f);
                p.footR = new Vector3(0f, -0.500f, 0.866f);
                p.handL = new Vector3(-0.125f, 0.900f, 0.240f);
                p.handR = new Vector3(0.125f, 0.900f, 0.240f);
                p.poleL = new Vector3(-0.86f, -0.46f, -0.20f);
                p.poleR = new Vector3(0.86f, -0.46f, -0.20f);
                break;

            // Sitting IN the hanging tyre: legs together and dangling, both
            // hands up the single centre rope (staggered, one above the other),
            // the whole body swaying gently with the hang.
            case "sit_tyre_swing":
                p = BuildRaw("sit", u);
                p.pelvis = new Vector3(0.040f * s, 0.965f, -0.259f).normalized;
                p.thighL = new Vector3(-0.055f, -0.350f, 0.935f).normalized;
                p.thighR = new Vector3(0.055f, -0.350f, 0.935f).normalized;
                p.shinL = new Vector3(0f, -0.930f, -0.360f).normalized;
                p.shinR = new Vector3(0f, -0.930f, -0.360f).normalized;
                p.footL = new Vector3(0f, -0.350f, 0.937f);
                p.footR = new Vector3(0f, -0.350f, 0.937f);
                p.handL = new Vector3(-0.055f, 1.190f, 0.030f);          // lower grip
                p.handR = new Vector3(0.055f, 1.215f, 0.055f);           // upper grip
                p.poleL = new Vector3(-0.85f, -0.40f, -0.30f);
                p.poleR = new Vector3(0.85f, -0.40f, -0.30f);
                p.hipY += 0.008f * s;
                break;

            // A toddler trike: bolt upright, pedalling the FRONT wheel — the
            // circle sits forward and high compared to a bike's.
            case "sit_trike":
                {
                    float a1 = Tau(u), a2 = Tau(u) + Mathf.PI;
                    p.pelvis = new Vector3(0f, 0.995f, -0.100f).normalized;
                    p.spine1 = new Vector3(0f, 0.995f, 0.100f).normalized;
                    p.neck = new Vector3(0f, 0.975f, 0.222f).normalized;
                    p.thighL = new Vector3(-0.100f, -0.080f + 0.280f * Mathf.Sin(a1), 0.950f).normalized;
                    p.thighR = new Vector3(0.100f, -0.080f + 0.280f * Mathf.Sin(a2), 0.950f).normalized;
                    p.shinL = new Vector3(-0.030f, -0.780f, 0.300f + 0.380f * Mathf.Cos(a1)).normalized;
                    p.shinR = new Vector3(0.030f, -0.780f, 0.300f + 0.380f * Mathf.Cos(a2)).normalized;
                    p.footL = new Vector3(0f, -0.380f, 0.925f);
                    p.footR = new Vector3(0f, -0.380f, 0.925f);
                    p.handL = new Vector3(-0.145f, 0.820f, 0.300f);
                    p.handR = new Vector3(0.145f, 0.820f, 0.300f);
                    p.poleL = new Vector3(-0.87f, -0.45f, -0.18f);
                    p.poleR = new Vector3(0.87f, -0.45f, -0.18f);
                    break;
                }

            // Sled: legs stretched out along the deck, leaning back a touch,
            // hands gripping the rim right beside the hips.
            case "sit_sled":
                p = BuildRaw("sit", u);
                p.pelvis = new Vector3(0f, 0.940f, -0.341f).normalized;
                p.spine1 = new Vector3(0f, 0.975f, -0.222f).normalized;
                p.thighL = new Vector3(-0.090f, -0.150f, 0.985f).normalized;
                p.thighR = new Vector3(0.090f, -0.150f, 0.985f).normalized;
                p.shinL = new Vector3(-0.020f, -0.500f, 0.866f).normalized;
                p.shinR = new Vector3(0.020f, -0.500f, 0.866f).normalized;
                p.footL = new Vector3(0f, -0.350f, 0.937f);
                p.footR = new Vector3(0f, -0.350f, 0.937f);
                p.handL = new Vector3(-0.155f, 0.575f, 0.045f);
                p.handR = new Vector3(0.155f, 0.575f, 0.045f);
                p.poleL = new Vector3(-0.72f, -0.50f, -0.48f);
                p.poleR = new Vector3(0.72f, -0.50f, -0.48f);
                break;

            // The little red wagon: the tray is tiny, so the knees fold HIGH
            // (feet close to the butt) and the hands hold the rim at the sides.
            case "sit_wagon":
                p = BuildRaw("sit", u);
                p.spine1 = new Vector3(0f, 0.990f, 0.141f).normalized;   // slightly hunched in
                p.thighL = new Vector3(-0.110f, 0.350f, 0.930f).normalized;   // knees up
                p.thighR = new Vector3(0.110f, 0.350f, 0.930f).normalized;
                p.shinL = new Vector3(-0.020f, -0.995f, -0.100f).normalized;
                p.shinR = new Vector3(0.020f, -0.995f, -0.100f).normalized;
                p.footL = new Vector3(0f, -0.550f, 0.835f);
                p.footR = new Vector3(0f, -0.550f, 0.835f);
                p.handL = new Vector3(-0.175f, 0.600f, 0.010f);
                p.handR = new Vector3(0.175f, 0.600f, 0.010f);
                p.poleL = new Vector3(-0.70f, -0.48f, -0.53f);
                p.poleR = new Vector3(0.70f, -0.48f, -0.53f);
                break;

            // Pool float: fully reclined into the ring, legs floating up in
            // front, arms DRAPED out over the ring's sides. Maximum holiday.
            case "sit_float":
                p = BuildRaw("sit", u);
                p.pelvis = new Vector3(0f, 0.870f, -0.493f).normalized;  // way back
                p.spine1 = new Vector3(0f, 0.940f, -0.341f).normalized;
                p.spine2 = new Vector3(0f, 0.990f, -0.141f).normalized;
                p.neck = new Vector3(0f, 0.995f, 0.100f).normalized;
                p.thighL = new Vector3(-0.090f, 0.050f + 0.030f * s, 0.995f).normalized;
                p.thighR = new Vector3(0.090f, 0.050f + 0.030f * Mathf.Sin(Tau(u) + 0.9f), 0.995f).normalized;
                p.shinL = new Vector3(-0.020f, -0.550f, 0.834f).normalized;
                p.shinR = new Vector3(0.020f, -0.550f, 0.834f).normalized;
                p.footL = new Vector3(0f, -0.300f, 0.954f);
                p.footR = new Vector3(0f, -0.300f, 0.954f);
                p.handL = new Vector3(-0.295f, 0.620f, 0.020f);
                p.handR = new Vector3(0.295f, 0.620f, 0.020f);
                p.poleL = new Vector3(-0.90f, -0.30f, -0.32f);
                p.poleR = new Vector3(0.90f, -0.30f, -0.32f);
                break;

            // Hanging from the zip trolley: both hands TOGETHER on the handle
            // overhead (out-of-reach IK resolves to straight arms, which is the
            // hang), knees tucked, the body swinging softly under the traverse.
            case "zip_hang":
                {
                    float m = Mathf.Sin(Tau(u));
                    p.pelvis = new Vector3(0.05f * m, 1f, -0.08f).normalized;
                    p.spine1 = new Vector3(0.04f * m, 1f, -0.02f).normalized;
                    p.neck = new Vector3(0f, 0.950f, 0.312f).normalized;      // looking ahead
                    p.handL = new Vector3(-0.055f, 1.320f, 0.100f);
                    p.handR = new Vector3(0.055f, 1.320f, 0.100f);
                    p.poleL = new Vector3(-0.60f, -0.75f, -0.28f);
                    p.poleR = new Vector3(0.60f, -0.75f, -0.28f);
                    // knees tucked and swinging a beat behind the body
                    float k = Mathf.Sin(Tau(u) - 0.7f);
                    p.thighL = new Vector3(-0.070f, -0.700f + 0.10f * k, 0.707f).normalized;
                    p.thighR = new Vector3(0.070f, -0.700f + 0.10f * k, 0.707f).normalized;
                    p.shinL = new Vector3(-0.020f, -0.820f, -0.570f).normalized;
                    p.shinR = new Vector3(0.020f, -0.820f, -0.570f).normalized;
                    p.footL = new Vector3(0f, -0.620f, 0.780f);
                    p.footR = new Vector3(0f, -0.620f, 0.780f);
                    p.hipY = -0.02f + 0.015f * m;
                    break;
                }
        }
        return p;
    }

    /** Smoothstep — every fishing beat eases, nothing snaps. */
    static float Ease(float k) { k = Mathf.Clamp01(k); return k * k * (3f - 2f * k); }

    /** Standing angler: right hand on the rod at `rod`, left hand supporting,
     *  torso leaning by `lean` (+ forward), left foot forward for balance. */
    static Pose FishStance(Pose p, Vector3 rod, float lean)
    {
        p.pelvis = new Vector3(0f, 1f, -0.231f + lean * 0.55f).normalized;
        p.spine1 = new Vector3(0f, 1f, -0.104f + lean * 0.75f).normalized;
        p.spine2 = new Vector3(0f, 1f, 0.032f + lean * 0.45f).normalized;
        p.neck = new Vector3(0f, 0.982f, 0.187f - lean * 0.30f).normalized;
        p.thighL = new Vector3(-0.045f, -0.985f, 0.170f);      // left foot forward
        p.thighR = new Vector3(0.045f, -0.995f, -0.090f);
        p.shinL = new Vector3(-0.015f, -0.998f, -0.060f);
        p.shinR = new Vector3(0.015f, -0.985f, 0.170f);
        p.handR = rod;
        p.handL = rod + new Vector3(-0.205f, -0.078f, -0.030f);
        p.poleR = new Vector3(0.80f, -0.55f, -0.25f);
        p.poleL = new Vector3(-0.60f, -0.60f, -0.53f);
        return p;
    }

    // ── rig helpers ──────────────────────────────────────────────────────────

    /** Rotate `b` so the direction to `child` points along `dir` (minimal turn). */
    static void Aim(Transform b, Transform child, Vector3 dir)
    {
        if (b == null || child == null) return;
        Vector3 cur = child.position - b.position;
        if (cur.sqrMagnitude < 1e-10f || dir.sqrMagnitude < 1e-10f) return;
        b.rotation = Quaternion.FromToRotation(cur.normalized, dir.normalized) * b.rotation;
    }

    /**
     * Analytic two-bone IK: put `c` at `target`, breaking the joint toward
     * `pole`. Out-of-reach targets resolve to a straight arm pointing at them,
     * which is the behaviour we want for "reach up as far as you can".
     */
    static void IK2(Transform a, Transform b, Transform c, Vector3 target, Vector3 pole)
    {
        float l1 = (b.position - a.position).magnitude;
        float l2 = (c.position - b.position).magnitude;
        Vector3 toT = target - a.position;
        float dist = toT.magnitude;
        if (dist < 1e-5f) return;
        Vector3 dir = toT / dist;
        float d = Mathf.Clamp(dist, Mathf.Abs(l1 - l2) + 1e-4f, l1 + l2 - 1e-4f);
        float cosA = Mathf.Clamp((l1 * l1 + d * d - l2 * l2) / (2f * l1 * d), -1f, 1f);
        Vector3 axis = Vector3.Cross(dir, pole.normalized);
        if (axis.sqrMagnitude < 1e-8f) axis = Vector3.Cross(dir, Vector3.up);
        if (axis.sqrMagnitude < 1e-8f) axis = Vector3.right;
        Vector3 dirB = Quaternion.AngleAxis(Mathf.Acos(cosA) * Mathf.Rad2Deg, axis.normalized) * dir;
        Aim(a, b, dirB);
        Aim(b, c, target - b.position);
    }

    static void ApplyPose(Dictionary<string, Transform> M, Pose p, float restHipY)
    {
        // Pelvis first — it carries both legs and the whole spine.
        Aim(M["Hips"], M["Spine_01"], p.pelvis);
        if (Mathf.Abs(p.pelvisTwist) > 1e-4f)
            M["Hips"].rotation = Quaternion.AngleAxis(p.pelvisTwist, p.pelvis.normalized) * M["Hips"].rotation;

        Aim(M["Spine_01"], M["Spine_02"], p.spine1);
        Aim(M["Spine_02"], M["Spine_03"], p.spine2);
        Aim(M["Spine_03"], M["Clavicle_L"], p.spine3);
        Aim(M["Neck"], M["Head"], p.neck);
        if (Mathf.Abs(p.neckTwist) > 1e-4f)
            M["Neck"].rotation = Quaternion.AngleAxis(p.neckTwist, p.neck.normalized) * M["Neck"].rotation;

        if (p.legIK)
        {
            IK2(M["UpperLeg_L"], M["LowerLeg_L"], M["Ankle_L"], p.ankleL, p.legPoleL);
            IK2(M["UpperLeg_R"], M["LowerLeg_R"], M["Ankle_R"], p.ankleR, p.legPoleR);
            Aim(M["Ankle_L"], M["Ball_L"], p.footL);
            Aim(M["Ankle_R"], M["Ball_R"], p.footR);
        }
        else
        {
            Aim(M["UpperLeg_L"], M["LowerLeg_L"], p.thighL);
            Aim(M["LowerLeg_L"], M["Ankle_L"], p.shinL);
            Aim(M["Ankle_L"], M["Ball_L"], p.footL);
            Aim(M["UpperLeg_R"], M["LowerLeg_R"], p.thighR);
            Aim(M["LowerLeg_R"], M["Ankle_R"], p.shinR);
            Aim(M["Ankle_R"], M["Ball_R"], p.footR);
        }

        IK2(M["Shoulder_L"], M["Elbow_L"], M["Hand_L"], p.handL, p.poleL);
        IK2(M["Shoulder_R"], M["Elbow_R"], M["Hand_R"], p.handR, p.poleR);

        // Offset the pelvis the way the RUNTIME does it (RigV2.update step 4):
        // along WORLD up expressed in the parent's space, scale-corrected — not
        // along the parent's local +Y, which would slide the pelvis sideways for
        // any rig whose Root carries a rotation.
        var hips = M["Hips"];
        var parent = hips.parent;
        Vector3 up = parent != null ? parent.InverseTransformDirection(Vector3.up) : Vector3.up;
        float sy = parent != null ? Mathf.Max(1e-4f, parent.lossyScale.y) : 1f;
        hips.localPosition = hips.localPosition + up * (p.hipY / sy);
    }

    // ── bake ─────────────────────────────────────────────────────────────────

    [MenuItem("AMG/Bake World Action Clips")]
    public static void BakeAll()
    {
        var src = AssetDatabase.LoadAssetAtPath<GameObject>(KID);
        if (src == null) { Debug.LogError("[AMGActionBaker] kid rig not found: " + KID); return; }

        var life = LoadClip(LIFE);
        if (life == null) { Debug.LogError("[AMGActionBaker] life clip not found: " + LIFE); return; }

        var inst = (GameObject)Object.Instantiate(src);
        inst.transform.position = Vector3.zero;
        inst.transform.rotation = Quaternion.identity;
        inst.transform.localScale = Vector3.one;
        var M = new Dictionary<string, Transform>();
        foreach (var t in inst.GetComponentsInChildren<Transform>(true)) if (!M.ContainsKey(t.name)) M[t.name] = t;

        // BIND — rest locals, and the rest Hips height every hipY is measured from
        var bind = new Dictionary<string, Quaternion>();
        var bindLocalPos = new Dictionary<string, Vector3>();
        foreach (var b in BONES) { bind[b] = M[b].localRotation; bindLocalPos[b] = M[b].localPosition; }
        float restHipY = M["Hips"].position.y;
        var rootT = M.ContainsKey("Root") ? M["Root"] : null;
        Quaternion rootRestRot = rootT != null ? rootT.localRotation : Quaternion.identity;
        Vector3 rootRestPos = rootT != null ? rootT.localPosition : Vector3.zero;

        // LIFE — residual per torso bone per frame: r_f = local_0⁻¹ ⊗ local_f
        int lifeFrames = Mathf.Max(2, Mathf.RoundToInt(life.length * FPS));
        var residual = new Dictionary<string, Quaternion[]>();
        foreach (var b in LIFE_BONES) residual[b] = new Quaternion[lifeFrames];
        var life0 = new Dictionary<string, Quaternion>();
        for (int f = 0; f < lifeFrames; f++)
        {
            life.SampleAnimation(inst, (float)f / FPS);
            foreach (var b in LIFE_BONES)
            {
                if (f == 0) life0[b] = M[b].localRotation;
                residual[b][f] = Quaternion.Inverse(life0[b]) * M[b].localRotation;
            }
        }

        var sb = new StringBuilder();
        sb.Append("{\"fps\":").Append(FPS).Append(",\"format\":\"delta\",\"source\":\"AMGActionBaker\",\"bones\":[");
        for (int i = 0; i < BONES.Length; i++) { if (i > 0) sb.Append(','); sb.Append('"').Append(BONES[i]).Append('"'); }
        sb.Append("],\"restHipY\":").Append(F(restHipY)).Append(",\"bindPose\":{");
        for (int i = 0; i < BONES.Length; i++)
        {
            if (i > 0) sb.Append(',');
            var q = bind[BONES[i]];
            sb.Append('"').Append(BONES[i]).Append("\":{\"q\":[").Append(F(q.x)).Append(',').Append(F(q.y)).Append(',')
              .Append(F(q.z)).Append(',').Append(F(q.w)).Append("],\"parent\":\"").Append(M[BONES[i]].parent.name).Append("\"}");
        }
        sb.Append("},\"clips\":{");

        var report = new StringBuilder();
        bool firstClip = true;
        foreach (var spec in CLIPS)
        {
            if (!firstClip) sb.Append(','); firstClip = false;
            sb.Append('"').Append(spec.id).Append("\":{\"dur\":").Append(F((float)spec.frames / FPS))
              .Append(",\"loop\":").Append(spec.loop ? "true" : "false")
              .Append(",\"label\":\"").Append(spec.label).Append('"')
              .Append(",\"frames\":").Append(spec.frames).Append(",\"rot\":[");

            var hip = new float[spec.frames];
            for (int f = 0; f < spec.frames; f++)
            {
                // Reset to bind, then author this frame. Root too: sampling the
                // life clip above can leave root motion on it, and hipY is a
                // WORLD measurement — a tilted Root would poison every frame.
                // (Node's fkUnity treats Root as identity: it is in no bindPose.)
                inst.transform.localPosition = Vector3.zero;
                inst.transform.localRotation = Quaternion.identity;
                if (rootT != null) { rootT.localRotation = rootRestRot; rootT.localPosition = rootRestPos; }
                foreach (var b in BONES) { M[b].localRotation = bind[b]; M[b].localPosition = bindLocalPos[b]; }
                float u = spec.loop ? (float)f / spec.frames : (spec.frames > 1 ? (float)f / (spec.frames - 1) : 0f);
                var pose = Build(spec.id, u);
                ApplyPose(M, pose, restHipY);

                // stamp the Synty breath residual onto the torso (post-multiply =
                // rotate in the authored bone's own frame, so contacts hold)
                // (amplified: the source idle is very still — 0.4° of Spine_02
                // over the whole clip — so at 1x it is invisible on a held pose)
                int lf = f % lifeFrames;
                foreach (var b in LIFE_BONES)
                    M[b].localRotation = M[b].localRotation * Quaternion.SlerpUnclamped(Quaternion.identity, residual[b][lf], LIFE_GAIN);

                for (int i = 0; i < BONES.Length; i++)
                {
                    var d = Quaternion.Inverse(bind[BONES[i]]) * M[BONES[i]].localRotation;
                    if (f > 0 || i > 0) sb.Append(',');
                    sb.Append(F(d.x)).Append(',').Append(F(d.y)).Append(',').Append(F(d.z)).Append(',').Append(F(d.w));
                }
                hip[f] = M["Hips"].position.y - restHipY;

                if (f == 0) report.AppendLine(Measure(spec.id, M, restHipY));
            }
            sb.Append("],\"hipY\":[");
            for (int f = 0; f < spec.frames; f++) { if (f > 0) sb.Append(','); sb.Append(F(hip[f])); }
            sb.Append("]}");
        }
        sb.Append("}}");

        foreach (var b in BONES) { M[b].localRotation = bind[b]; M[b].localPosition = bindLocalPos[b]; }
        Object.DestroyImmediate(inst);

        System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(OUT));
        System.IO.File.WriteAllText(OUT, sb.ToString());
        Debug.Log("[AMGActionBaker] wrote " + OUT + "  (" + CLIPS.Length + " clips, " + (sb.Length / 1024) + " KB)\n" + report);
    }

    /** Frame-0 contact readout — the numbers that say whether a pose is real. */
    static string Measure(string id, Dictionary<string, Transform> M, float restHipY)
    {
        float knee = Vector3.Angle(M["LowerLeg_L"].position - M["UpperLeg_L"].position,
                                   M["Ankle_L"].position - M["LowerLeg_L"].position);
        float hipA = Vector3.Angle(Vector3.down, M["LowerLeg_L"].position - M["UpperLeg_L"].position);
        return string.Format(CultureInfo.InvariantCulture,
            "  {0,-12} hipY {1:F3}  head {2:F3}  ankleL ({3:F3},{4:F3})  handL ({5:F3},{6:F3},{7:F3})  handR ({8:F3},{9:F3},{10:F3})  knee {11:F0}d  hipFlex {12:F0}d",
            id, M["Hips"].position.y - restHipY, M["Head"].position.y,
            M["Ankle_L"].position.y, M["Ankle_L"].position.z,
            M["Hand_L"].position.x, M["Hand_L"].position.y, M["Hand_L"].position.z,
            M["Hand_R"].position.x, M["Hand_R"].position.y, M["Hand_R"].position.z,
            180f - knee, hipA);
    }

    static AnimationClip LoadClip(string path)
    {
        foreach (var o in AssetDatabase.LoadAllAssetsAtPath(path))
        {
            var c = o as AnimationClip;
            if (c != null && !c.name.StartsWith("__preview")) return c;
        }
        return null;
    }

    static string F(float v)
    {
        if (Mathf.Abs(v) < 1e-6f) v = 0f;
        return v.ToString("0.######", CultureInfo.InvariantCulture);
    }
}
