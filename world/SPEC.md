# ODA World — Character Creator V3 Spec

## Vision
Sims-level character creator for ODA World. Every kid should be able to create a character that looks like them and is instantly recognizable across the hub at 32px. Target audience: elementary & middle school, majority Black students.

## Key Research Finding
Per ACM IX Magazine study on designing Black children in video games: kids specifically requested braids, locs, afros, updos, frohawks, sponge twists, and curly bobs as must-haves. Children expressed strong desire for hairstyle variety in character creators regardless of character gender. Wide/flat bridge noses and full lips should be prominent defaults, not afterthoughts.

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

#### Boys — Short Styles (Barbershop) [13 styles]
- **Low Fade** — gradual taper starting low on sides, natural curls on top. Silhouette: compact rounded top, clean tight sides
- **Mid Fade** — taper starts at ear level, more contrast. Silhouette: distinct separation between fuller top and cropped sides
- **High Fade / Skin Fade** — hair on top only, sides shaved to skin. Silhouette: volume only at crown, bare sides
- **Burst Fade** — fade curves in arc around ear. Silhouette: rounded fade lines behind ears
- **Taper** — subtle gradual reduction to neckline. Silhouette: neat natural head shape, slightly fuller top
- **Buzz Cut** — uniform very short all over. Silhouette: follows head shape, minimal texture
- **High Top Fade** — tall volume on top, sharp faded sides (Kid 'n Play). Silhouette: dramatic vertical height, bare sides — one of the most recognizable at any size
- **Flat Top** — hair shaped into flat boxy platform, sides faded. Silhouette: squared-off top edge, very distinctive even at 32px
- **Sponge Curls with Fade** — defined coils on top from curl sponge, faded sides. Silhouette: textured popcorn-like top, clean sides
- **360 Waves** — wave pattern brushed across the head. Silhouette: close like buzz cut but with visible wavy lines radiating from crown
- **South of France / Usher Cut** — burst fade with curly rounded mohawk strip. Silhouette: soft rounded mohawk with curved side contours
- **Frohawk** — faded sides, center strip of textured natural hair. Silhouette: peaked center ridge, narrow sides
- **Line Up / Edge Up** — razor-sharp geometric hairline (pairs with any style). Distinctive: crisp straight lines at forehead visible even at small sizes
- **Caesar Cut** — short even length with straight-across fringe. Silhouette: compact, uniform, with visible horizontal bang line

#### Boys — Medium/Long Styles [16 styles]
- **Two-Strand Twists** — hair sectioned and twisted into rope-like strands. Silhouette: bumpy textured top with visible twist segments
- **Mini Twists** — smaller, thinner, more numerous twists. Silhouette: dense fine textured top
- **Twist-Out** — twists unraveled for defined stretched curls. Silhouette: fuller, rounded, fluffy with visible curl definition
- **Cornrows Straight Back** — flat braids in parallel rows front to back. Silhouette: visible linear stripes across head
- **Cornrows with Designs** — zigzag, curved, or geometric patterns. Silhouette: non-linear braid patterns on head
- **Cornrows with Fade** — braids on top, faded sides. Silhouette: lined top, clean bare sides
- **Box Braids (short)** — individual braids, jaw length. Silhouette: dangling strands framing face
- **Starter Locs / Baby Locs** — newly formed, short, slightly spiky. Silhouette: short nubby textured protrusions
- **Short Locs** — 2-3 inches, defined cylindrical strands
- **Medium Locs** — shoulder length, can be pulled up
- **Long Locs** — past shoulders, often with colored tips
- **Freeform Locs** — organic irregular growth, varied widths. Silhouette: non-uniform rope strands
- **Locs with Fade** — maintained locs on top, faded sides. Silhouette: rope strands sprouting from top, clean sides
- **Locs with Top Knot** — locs gathered into bun/knot at crown. Silhouette: rounded knot on top
- **Braided Man Bun** — cornrows or twists into small bun. Silhouette: braided texture leading to rounded knot
- **Mohawk Braids** — cornrows braided front-to-back in center, sides faded. Silhouette: central ridged strip

#### Girls — Natural Styles [10 styles]
- **TWA (Teeny Weeny Afro)** — very short natural, close to head. Silhouette: thin textured cap hugging head
- **Small Afro** — 2-3 inches, compact rounded shape
- **Medium Afro** — fuller, rounder volume
- **Big Afro** — maximum volume, statement halo. Silhouette: large round cloud around head, unmistakable at any size
- **Single Afro Puff** — all hair in one round puff on top. Silhouette: single ball on crown
- **Double Afro Puffs** — two round puffs on either side. Silhouette: two symmetrical balls — iconic, instantly readable at 32px
- **Pineapple Puff** — high puff at very top with curls spilling out. Silhouette: volume at top, cascading
- **Twist-Out** — unraveled twists for defined spirals. Silhouette: voluminous with visible spiral texture
- **Wash-and-Go** — defined curls with product, air dried. Silhouette: rounded, voluminous, visible curl clumping
- **Bantu Knots** — coiled knots all over head. Silhouette: multiple small cone/spiral shapes — very distinctive at small sizes

#### Girls — Protective Styles [20 styles]
- **Box Braids (long)** — classic individual braids, square partings. Silhouette: many parallel hanging strands
- **Box Braids (bob)** — shorter box braids at jaw/shoulder
- **Knotless Braids** — smoother, no bulky knot at root, flatter at scalp
- **Bohemian Box Braids** — braids with curly hair woven through for wispy ends
- **Cornrows Straight Back** — flat braids front to back
- **Cornrows into Ponytail/Bun** — rows leading to gathered back. Silhouette: lined scalp leading to rounded shape
- **Lemonade Braids** — side-swept cornrows. Silhouette: diagonal lines across head, braids over one shoulder
- **Fulani Braids** — center cornrow + hanging side braids with beads/cowrie shells. Silhouette: distinctive center braid, face-framing side braids
- **Ghana Braids / Feed-In Braids** — start thin at hairline, thicken as hair added. Silhouette: smooth thick rows tapering at front
- **Goddess Braids** — large thick cornrows (2-6 total). Silhouette: few large prominent ridges
- **Two-Strand Twists** — rope-like twisted sections hanging down
- **Flat Twists** — twists done flat against scalp (like cornrows but twisted)
- **Flat Twists into Puffs** — flat twists leading to puffs. Silhouette: textured front, rounded puffs on top/back
- **Bantu Knots** — (same as natural but also protective)
- **Faux Locs** — wrapped extensions looking like locs. Silhouette: uniform cylindrical hanging strands
- **Butterfly Locs** — distressed looped texture along each loc. Silhouette: thick bumpy strands with visible loops
- **Passion Twists** — curly/wavy bohemian twist style. Silhouette: twists with fluffy wavy texture
- **Crochet Braids** — curly or straight hair crocheted onto cornrow base. Silhouette: full, voluminous
- **Braids with Beads** — any braid style + colorful beads at ends. Silhouette: braids ending in small round color spots — very readable at small sizes
- **Starter Locs / Baby Locs** — short newly formed real locs

#### Girls — Styled [8 styles]
- **Silk Press** — natural hair flat-ironed for sleek straight finish with bounce. Silhouette: smooth flowing hair with body
- **Blowout** — stretched with blow dryer for voluminous fluffy straight look. Silhouette: big, full, puffy shape
- **Press and Curl** — straightened then curled for bouncy curls. Silhouette: smooth roots with curled/flipped ends
- **Flexi Rod / Perm Rod Set** — tight spiral curls from flexible rods. Silhouette: springy spirals with lots of volume
- **Space Buns** — two buns on top of head. Silhouette: two rounded shapes on crown
- **High Ponytail** — sleek pulled-up ponytail
- **Two Ponytails** — pigtails on either side
- **Half Up Half Down** — top section up, rest flowing

#### Unisex [12 styles]
- **Tapered Afro** — full afro tapering shorter on sides. Silhouette: rounded top, narrowing at ears
- **Short Afro / Mini Afro** — few inches, compact rounded shape
- **TWA** — very short natural all around
- **Two-Strand Twists (short)** — short twisted sections
- **Finger Coils** — small individual spirals wound around finger. Silhouette: many small springy dangles
- **Freeform Locs** — organic varied-width rope strands
- **Cornrows** — flat braids any pattern
- **Frohawk** — center natural mohawk, sides cut/pinned
- **Fade with Natural Top** — any fade + natural curl texture on top
- **Wash-and-Go** — natural defined curls
- **Buzz Cut** — very short all over
- **Braids with Fade** — any braid style on top + faded sides

#### Most Distinctive Silhouettes at 32px (prioritize these for V3 launch)
Based on research, these read most clearly at tiny game sprite sizes:
1. High Top Fade (tall rectangular top)
2. Full Afro (large round halo)
3. Double Puffs (two ball shapes)
4. Bantu Knots (multiple small bumps)
5. Flat Top (squared top edge)
6. Cornrows (linear stripe pattern)
7. Box Braids (many hanging strands)
8. Locs (thick dangling rope strands)
9. Frohawk (peaked center ridge)
10. Single Puff (one ball on top)
11. Braids with Beads (braids + colored dots at tips)

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
