/* ============================================================
   ODA World — Character Renderer V3 (Orchestrator)
   Thin layer that calls sub-modules in correct layer order.
   ============================================================ */

const ODA_RENDER = (() => {

  // ── Utility Helpers (HSL-based to preserve hue) ─────────────
  function hexToHsl(hex) {
    let r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h = 0, s = 0, l = (max+min)/2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      if (max === r) h = ((g-b)/d + (g<b?6:0))/6;
      else if (max === g) h = ((b-r)/d+2)/6;
      else h = ((r-g)/d+4)/6;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; } else {
      const hue2rgb = (p, q, t) => { if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
      const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
      r = hue2rgb(p,q,h+1/3); g = hue2rgb(p,q,h); b = hue2rgb(p,q,h-1/3);
    }
    return '#'+((1<<24)+(Math.round(r*255)<<16)+(Math.round(g*255)<<8)+Math.round(b*255)).toString(16).slice(1);
  }
  function darken(hex, amt) {
    const [h, s, l] = hexToHsl(hex);
    return hslToHex(h, s, Math.max(0, l * (1 - amt)));
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }

  // ── Body Dimensions ─────────────────────────────────────────
  function getBodyDims(bodyTypeId, gender, s) {
    let bh, shoulderW, waistW, hipW;
    const id = bodyTypeId || '';

    if (gender === 'girl') {
      bh = id.indexOf('tall') >= 0 ? 70 : 64;
      if (id.indexOf('slim') >= 0)       { shoulderW = 34; waistW = 28; hipW = 34; }
      else if (id.indexOf('curvy') >= 0) { shoulderW = 38; waistW = 30; hipW = 42; }
      else if (id.indexOf('tall') >= 0)  { shoulderW = 36; waistW = 30; hipW = 36; }
      else                               { shoulderW = 36; waistW = 30; hipW = 38; }
    } else {
      bh = id.indexOf('tall') >= 0 ? 72 : 64;
      if (id.indexOf('slim') >= 0)        { shoulderW = 38; waistW = 34; hipW = 34; }
      else if (id.indexOf('stocky') >= 0) { shoulderW = 50; waistW = 48; hipW = 46; }
      else if (id.indexOf('tall') >= 0)   { shoulderW = 44; waistW = 38; hipW = 38; }
      else                                { shoulderW = 44; waistW = 40; hipW = 40; }
    }
    return { bh, shoulderW, waistW, hipW, bw: Math.max(shoulderW, hipW), s };
  }

  // ── Head ────────────────────────────────────────────────────
  function drawHead(ctx, cx, s, skinHex) {
    ctx.save();
    ctx.fillStyle = skinHex;
    roundRect(ctx, cx - 28*s, 42*s, 56*s, 54*s, 22*s);
    ctx.fill();
    ctx.restore();
  }

  // ── Legs ────────────────────────────────────────────────────
  function drawLegs(ctx, cx, s, skinHex, outfitConfig, bd) {
    const garment = ODA_PARTS.find(ODA_PARTS.GARMENTS, outfitConfig.garment);
    const hasSkirt = garment && garment.skirt;
    const isJumpsuit = outfitConfig.garment === 'gar_jumpsuit';
    const isOveralls = outfitConfig.garment === 'gar_overalls';
    const legTop = 160*s;
    const legH = hasSkirt ? 34*s : 46*s;
    const legY = hasSkirt ? legTop + 12*s : legTop;

    ctx.save();
    let pantColor;
    if (isJumpsuit || isOveralls) {
      pantColor = outfitConfig.primaryColor;
    } else {
      pantColor = darken(outfitConfig.primaryColor, 0.15);
    }
    ctx.fillStyle = pantColor;
    roundRect(ctx, cx - 16*s, legY, 13*s, legH, 5*s); ctx.fill();
    roundRect(ctx, cx + 3*s, legY, 13*s, legH, 5*s); ctx.fill();

    // Skin below skirts
    if (hasSkirt) {
      ctx.fillStyle = skinHex;
      ctx.fillRect(cx - 14*s, legY + legH - 6*s, 10*s, 12*s);
      ctx.fillRect(cx + 4*s, legY + legH - 6*s, 10*s, 12*s);
    }
    ctx.restore();
  }

  // ── Shadow ──────────────────────────────────────────────────
  function drawShadow(ctx, cx, s) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(cx, 230*s, 36*s, 8*s, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // ── Main Draw ───────────────────────────────────────────────
  function drawPreview(canvas, config, opts) {
    opts = opts || {};
    const size = opts.size || 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const s = size / 256;
    const gender = config.gender || 'boy';
    const isSmall = size <= 32;

    // Look up skin hex
    const skin = ODA_PARTS.find(ODA_PARTS.SKIN_TONES, config.skinTone);
    const skinHex = skin ? skin.hex : '#6B4226';
    const hairColor = config.hairColor || '#1c1410';
    const bd = getBodyDims(config.bodyType, gender, s);
    const garment = ODA_PARTS.find(ODA_PARTS.GARMENTS, (config.outfit && config.outfit.garment) || '');

    // Face dims object shared by face module
    const faceDims = {
      cx, s,
      eyeY: 64*s,
      eyeSpacing: 12*s,
      mouthY: 78*s,
      noseY: 72*s,
      browY: 56*s,
      skinHex,
    };

    // ── Layer Order ──────────────────────────────────────
    // 1. Shadow
    drawShadow(ctx, cx, s);

    // 2. Shoes
    ODA_SHOES.drawShoes(ctx, config.shoes || { type: 'shoe_sneakers', color: '#2c3e50', accentColor: '#e74c3c' }, cx, s);

    // 3. Legs
    drawLegs(ctx, cx, s, skinHex, config.outfit || {}, bd);

    // 4. Skirt (if applicable)
    if (garment && garment.skirt) {
      const skirtColor = config.outfit.garment === 'gar_skirt_top'
        ? config.outfit.secondaryColor
        : config.outfit.primaryColor;
      ODA_OUTFIT.drawSkirt(ctx, cx, s, skirtColor, bd);
    }

    // 5. Outfit torso + sleeves
    ODA_OUTFIT.drawOutfit(ctx, config.outfit || {}, gender, skinHex, bd, cx, s);

    // 6. Hood back (if hoodie/zipup) — draw in hair color so it doesn't bleed through hair gaps
    if (garment && garment.hood) {
      ODA_OUTFIT.drawHoodBack(ctx, cx, s, hairColor);
    }

    // 7. Arms (skin below sleeves + hands)
    const sleeveType = garment ? garment.sleeve : 'short';
    ODA_OUTFIT.drawArms(ctx, cx, s, skinHex, bd, sleeveType, config.outfit ? config.outfit.primaryColor : '#7c3aed');

    // 8. Hair volume (behind head)
    ODA_HAIR.drawHairVolume(ctx, config.hairStyle, hairColor, cx, s);

    // 9. Head (covers hair in face zone)
    drawHead(ctx, cx, s, skinHex);

    // 10. Ears
    if (config.face) {
      ODA_FACE.drawEars(ctx, config.face, skinHex, faceDims);
    }

    // 11. Face features
    if (isSmall) {
      ODA_FACE.drawFaceSimple(ctx, faceDims);
    } else if (config.face) {
      ODA_FACE.drawNose(ctx, config.face, faceDims);
      ODA_FACE.drawMouth(ctx, config.face, faceDims);
      ODA_FACE.drawEyes(ctx, config.face, faceDims);
      ODA_FACE.drawEyebrows(ctx, config.face, faceDims);
      ODA_FACE.drawEyelashes(ctx, config.face, faceDims);
    }

    // 12. Hair top (over forehead)
    ODA_HAIR.drawHairTop(ctx, config.hairStyle, hairColor, cx, s);

    // 13. Dark hair outline for visibility
    ODA_HAIR.drawHairOutline(ctx, config.hairStyle, hairColor, cx, s);

    // 14. Name tag
    if (opts.showName) {
      ctx.save();
      ctx.font = 'bold ' + (13*s) + 'px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = opts.nameColor || '#e2e8f0';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3*s;
      ctx.strokeText(opts.showName, cx, 250*s);
      ctx.fillText(opts.showName, cx, 250*s);
      ctx.restore();
    }
  }

  // ── Head-Only Preview (for hair/face thumbnails) ────────────
  // Renders full character at 256px on offscreen canvas, then crops head region
  function drawHeadPreview(canvas, config, opts) {
    opts = opts || {};
    const size = opts.size || 64;
    canvas.width = size;
    canvas.height = size;

    // Render full character at 256px offscreen
    const offscreen = document.createElement('canvas');
    offscreen.width = 256;
    offscreen.height = 256;
    drawPreview(offscreen, config, { size: 256 });

    // Crop head region (y: 0-110px, centered) and draw scaled into target
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    // Source region: head + hair area
    const srcX = 48, srcY = 2, srcW = 160, srcH = 110;
    ctx.drawImage(offscreen, srcX, srcY, srcW, srcH, 0, 0, size, size);
  }

  return { drawPreview, drawHeadPreview, getBodyDims };
})();
