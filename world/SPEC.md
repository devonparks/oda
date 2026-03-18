# ODA World — Character Creator V3 Spec

## Vision
Sims-level character creator for ODA World. Every kid should be able to create a character that looks like them and is instantly recognizable across the hub at 32px. Target audience: elementary & middle school, majority Black students.

## Current State (on `oda-world` branch)
- Basic layered canvas renderer (character-renderer.js)
- Gender picker (Boy/Girl)
- 8 skin tones, 23 hair styles, 10 hair colors
- 12 outfits with silhouette differences
- Drawn faces (eyes, brows, mouth)
- Hair volume/top split layering system
- Everything saves to localStorage

## What Needs to Change (from Devon's feedback)

### 1. FULL FACE BUILDER (Sims-level detail)

Replace the current single "expression" picker with individual facial feature categories:

**Eyes (shape)**
- Round, Almond, Hooded, Wide, Narrow, Upturned, Downturned, Monolid
- Each drawn as a distinct canvas path for the eye outline

**Eye Color**
- Dark Brown (default for most Black students), Light Brown, Hazel, Green, Blue, Gray, Amber
- Color picker for iris fill inside the eye shape

**Eyebrows**
- Thick Straight, Thin Arched, Bushy, Flat, High Arch, Rounded, Feathered
- Each a distinct canvas stroke/fill

**Eyebrow Color**
- Should default to hair color but be independently pickable
- Same color palette as hair colors

**Eyelashes**
- None, Short, Medium, Long, Dramatic
- Drawn as small lines extending from eye edges

**Eyelash Color**
- Black (default), Brown, matches hair color option

**Nose**
- Button, Wide, Narrow, Rounded, Flat Bridge, Pointed, Upturned
- Important: include wide/flat bridge noses that are common among Black people
- Drawn as simple lines/curves on the face

**Mouth**
- Small Smile, Big Smile, Grin (with teeth), Smirk, Neutral, Open/Surprised, Pout
- Full lips should be the default/prominent option (not thin lines)

**Ears**
- Default (current), Small, Large, Pointed
- Keep simple — these aren't a major differentiator

**Face Config Object:**
```js
face: {
  eyeShape: 'round',
  eyeColor: '#2D1B00',
  eyebrowStyle: 'thick_straight',
  eyebrowColor: '#1a1a2e',  // defaults to hair color
  eyelashStyle: 'short',
  eyelashColor: '#1a1a2e',
  noseStyle: 'wide',
  mouthStyle: 'smile',
  earStyle: 'default'
}
```

### 2. HAIR OVERHAUL (Research-Based)

Current hair looks like programmer art. Needs complete visual redesign based on real barbershop/salon references.

#### Boys — Short Styles (Barbershop)
- **Low Fade** — clean taper on sides, natural curls/waves on top
- **Mid Fade** — fade starts higher, more contrast
- **High Fade** — dramatic contrast, almost bald sides
- **Burst Fade** — fade curves around ear in a burst pattern
- **Taper Fade** — gradual blend, more conservative
- **Buzz Cut** — uniform short all over
- **High Top Fade** — flat top, sharp geometric shape
- **Flat Top** — boxy geometric cut (think Kid 'n Play)
- **Sponge Curls** — defined coils on top using curl sponge, faded sides
- **360 Waves** — wave pattern visible across the head
- **South of France / Usher Cut** — burst fade with curly mohawk strip
- **Frohawk** — faded sides, textured mohawk center strip
- **Line Up / Edge Up** — sharp hairline with any style

#### Boys — Medium/Long Styles
- **Short Locs** — starter locs, 2-3 inches
- **Medium Locs** — shoulder length, can be pulled up
- **Long Locs** — past shoulders, often colored tips
- **Freeform Locs** — irregular, organic growth pattern
- **Two-Strand Twists** — neat twisted sections
- **Mini Twists** — smaller, more defined twist sections
- **Twist Out** — twists removed to show defined curl pattern
- **Cornrows Straight Back** — clean parallel rows going back
- **Cornrows with Design** — zig-zag or geometric patterns
- **Box Braids (short)** — individual braids, jaw length

#### Girls — Natural Styles
- **TWA (Teeny Weeny Afro)** — very short natural
- **Small Afro** — close to head, defined texture
- **Medium Afro** — rounder, more volume
- **Big Afro** — maximum volume, statement look
- **Afro Puffs (two)** — two round puffs with hair ties
- **Afro Puff (one)** — single puff on top
- **Pineapple** — high puff/ponytail on top of head
- **Twist Out** — defined spiral curls from removed twists
- **Wash and Go** — defined curls, shrinkage visible
- **Bantu Knots** — coiled knots across the head

#### Girls — Protective Styles
- **Box Braids (long)** — classic long individual braids
- **Box Braids (bob)** — shorter box braids at jaw/shoulder
- **Knotless Braids** — smoother, no bulky knot at root
- **Cornrows Straight Back** — neat parallel rows
- **Cornrows into Ponytail** — rows leading to a gathered back
- **Fulani Braids** — cornrow center + hanging side braids with beads
- **Goddess Braids** — large, thick raised braids
- **Lemonade Braids** — side-swept cornrows (Beyoncé style)
- **Feed-in Braids** — start thin, get thicker
- **Faux Locs** — wrapped to look like locs, temporary
- **Passion Twists** — bohemian curly twist style
- **Butterfly Locs** — distressed, looped locs look
- **Crochet Braids** — curly or straight hair crocheted onto cornrow base

#### Girls — Styled
- **Straightened / Flat Ironed** — sleek, straight
- **Silk Press** — straight with bounce and movement
- **Space Buns** — two buns on top of head
- **Low Bun** — elegant bun at nape
- **High Ponytail** — sleek pulled-up ponytail
- **Two Ponytails** — pigtails
- **Half Up Half Down** — top section up, rest flowing

#### Unisex
- **Buzz Cut** — very short all over
- **Short Crop** — slightly longer than buzz
- **Wavy** — loose wave pattern
- **Curly** — visible curl definition

#### Drawing Approach
Each hairstyle should be drawn considering:
- **Silhouette** — what shape does it make at 32px? Must be distinctive
- **Texture** — small lines/dots to suggest curl pattern or loc texture
- **Volume** — how far does it extend from the head?
- **Hair color contrast** — must be visible against dark AND light backgrounds

The preview background should NOT be black — use a medium gray or the ODA surface color so dark hair is visible.

### 3. OUTFIT SYSTEM (Color + Pattern Picker)

Replace the current fixed-color outfits with a 2-step system:

**Step 1: Pick Garment Type**
- Each garment has a distinct silhouette drawn on canvas

**Step 2: Pick Color/Pattern**
- Primary color picker (full palette, not preset swatches)
- Optional secondary color (for accents, stripes)
- Optional pattern: Solid, Striped, Camo, Plaid, Polka Dot, Tie-Dye, ODA Logo

**Garment Types:**

Boy:
- T-Shirt, Hoodie (with hood shape), Jersey (sleeveless + number), Varsity Jacket (two-tone sleeves), Polo (collar), Tank Top, Crewneck Sweater, Denim Jacket, Long Sleeve Tee

Girl:
- T-Shirt, Hoodie, Dress (A-line), Skirt + Top (two-piece), Crop Top + High Waist, Jumpsuit, Tank Top, Off-Shoulder Top, Cardigan

Both:
- Overalls, Blazer, Zip-Up Hoodie

**Config:**
```js
outfit: {
  garment: 'hoodie',
  primaryColor: '#7c3aed',
  secondaryColor: '#6929c4',
  pattern: 'solid'
}
```

### 4. SHOE SYSTEM (Silhouettes + Color)

Same treatment as outfits — pick the shoe type, then the color:

**Shoe Types:**
- Sneakers (Nike AF1 style — chunky, visible sole)
- Jordans (high-top, ankle coverage, Air Jordan silhouette)
- High Tops (Converse style — canvas, star)
- Slides (open-toe, strap across)
- Boots (ankle height, chunky sole)
- Crocs (distinctive clog shape with holes)
- Running Shoes (streamlined, swoosh-like shape)
- Platform Sneakers (thick sole)

**Config:**
```js
shoes: {
  type: 'jordans',
  color: '#2c3e50',
  accentColor: '#e74c3c'
}
```

### 5. UI CHANGES

- **Smaller gender picker** — inline with other options, not dominating the top
- **Preview background** — medium gray (#2a2d3a) not black, so dark hair is visible
- **Color pickers** — use a proper color picker component (HSL wheel or grid) not just preset swatches
- **Category tabs redesign** — more compact, scrollable on mobile
- **Face sub-tabs** — when on "Face" tab, show sub-tabs: Eyes, Brows, Nose, Mouth, Lashes
- **Outfit flow** — pick garment → pick color → pick pattern (3-step within the tab)
- **Shoe flow** — pick type → pick color (2-step within the tab)

### 6. RENDERING FIXES

- **Sweater arms** — sleeves must draw OVER the skin arms, not under
- **Dark hair visibility** — add a subtle lighter outline or highlight to dark hair on dark backgrounds
- **Small size face** — at 32px, simplify face to just 2 dots for eyes + small arc for mouth
- **Arm layering** — outfit sleeves always on top of skin-colored arm layer

### 7. TECHNICAL ARCHITECTURE

**Config object (full):**
```js
{
  gender: 'boy',
  skinTone: 'skin1',

  // Face
  face: {
    eyeShape: 'round',
    eyeColor: '#2D1B00',
    eyebrowStyle: 'thick_straight',
    eyebrowColor: '#1a1a2e',
    eyelashStyle: 'short',
    eyelashColor: '#1a1a2e',
    noseStyle: 'wide',
    mouthStyle: 'smile',
    earStyle: 'default'
  },

  // Hair
  hairStyle: 'hair_low_fade',
  hairColor: '#1a1a2e',

  // Body
  bodyType: 'body_boy_avg',

  // Outfit
  outfit: {
    garment: 'hoodie',
    primaryColor: '#7c3aed',
    secondaryColor: '#6929c4',
    pattern: 'solid'
  },

  // Shoes
  shoes: {
    type: 'jordans',
    color: '#2c3e50',
    accentColor: '#e74c3c'
  }
}
```

**Rendering layers (top to bottom in draw order):**
1. Shadow (ellipse under feet)
2. Shoes
3. Legs / Pants
4. Skirt overlay (if dress/skirt)
5. Outfit torso + sleeves (sleeves OVER arms)
6. Hood back (if hoodie)
7. Hair volume (behind head)
8. Head (skin oval — covers hair in face zone)
9. Ears
10. Nose
11. Mouth
12. Eyes + Eyebrows + Eyelashes
13. Hair top (fades, picks, hair ties — over forehead)
14. Name tag (if in-world)
15. Shop cosmetic overlays (border glow, title)

**Universal rule:** The head (skin oval) ALWAYS draws on top of hair volume. Face features ALWAYS draw on top of head. Hair-top details ALWAYS draw on top of face. This guarantees face visibility for all hairstyles.

### 8. FILE STRUCTURE

```
world/
  js/
    character-parts.js    — Data catalog (all options, colors, configs)
    character-renderer.js — Canvas drawing engine
    character-face.js     — Face rendering (eyes, brows, nose, mouth) — NEW
    character-hair.js     — Hair rendering (all styles) — NEW
    character-outfit.js   — Outfit rendering (garments + patterns) — NEW
    character-shoes.js    — Shoe rendering — NEW
  css/
    creator.css           — Creator page styles
  creator.html            — Character creator page
  SPEC.md                 — This file
```

Split the monolithic renderer into focused modules so each system (face, hair, outfit, shoes) can be developed independently.

### 9. PRIORITY ORDER FOR IMPLEMENTATION

1. **Face builder** — This is the most impactful. Eyes, nose, mouth make the character feel like a person.
2. **Hair overhaul** — Research-based, visually accurate Black hairstyles.
3. **Preview background fix** — Quick win, makes everything look better.
4. **Outfit color/pattern system** — Pick garment then customize.
5. **Shoe silhouettes + color** — Same treatment as outfits.
6. **Rendering fixes** — Arm layering, small-size optimization.
7. **UI polish** — Smaller gender picker, sub-tabs, color picker widget.

### 10. WHAT NOT TO CHANGE

- Keep canvas-based rendering (no external images needed)
- Keep the hair volume/head/face layering system
- Keep gender-filtered options
- Keep the save-to-localStorage approach for now (Firestore later)
- Keep the `oda-world` branch — don't merge to main until ready
