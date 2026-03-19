/* ============================================================
   ODA World — Hair Renderer (V3)
   79 hairstyles across 6 categories.
   Two entry points: drawHairVolume (behind head) and drawHairTop (over forehead).
   ============================================================ */

const ODA_HAIR = (() => {

  // ── Color Helpers (HSL-based to preserve hue) ──────────────
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
  function lighten(hex, amt) {
    const [h, s, l] = hexToHsl(hex);
    return hslToHex(h, s, Math.min(1, l + (1 - l) * amt));
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }

  // ── Shared Drawing Helpers ──────────────────────────────────

  /** Draw a fade gradient on the sides of the head */
  function drawFade(ctx, cx, s, hc, level) {
    // level: 'low' = just sideburns, 'mid' = half ear, 'high' = above ear, 'burst' = around ear
    const fadeG = ctx.createLinearGradient(cx - 32*s, 42*s, cx - 32*s, 80*s);
    fadeG.addColorStop(0, hc);
    fadeG.addColorStop(1, 'rgba(0,0,0,0)');

    let startY, height;
    switch (level) {
      case 'low':   startY = 58*s; height = 22*s; break;
      case 'mid':   startY = 50*s; height = 26*s; break;
      case 'high':  startY = 42*s; height = 28*s; break;
      case 'burst': startY = 50*s; height = 24*s; break;
      default:      startY = 50*s; height = 26*s;
    }

    ctx.save();
    ctx.fillStyle = fadeG;
    // Left side
    ctx.fillRect(cx - 34*s, startY, 10*s, height);
    // Right side
    const fadeR = ctx.createLinearGradient(cx + 24*s, 42*s, cx + 34*s, 80*s);
    fadeR.addColorStop(0, hc);
    fadeR.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fadeR;
    ctx.fillRect(cx + 24*s, startY, 10*s, height);
    ctx.restore();

    if (level === 'burst') {
      // Burst fade: circular fade around ear
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = hc;
      ctx.beginPath(); ctx.arc(cx - 30*s, 66*s, 12*s, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 30*s, 66*s, 12*s, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  /** Draw hanging braid strands */
  function drawBraidStrands(ctx, cx, s, hc, count, length, startY, spacing, thickness) {
    ctx.fillStyle = hc;
    const half = Math.floor(count / 2);
    for (let i = -half; i <= half; i++) {
      const bx = cx + i * spacing * s;
      const wave = (i % 2) ? 3 : -3;
      // Braid body — zigzag texture
      ctx.beginPath();
      ctx.moveTo(bx - thickness*s, startY);
      for (let seg = 0; seg < 4; seg++) {
        const sy = startY + (length*s/4) * seg;
        const sy2 = startY + (length*s/4) * (seg + 1);
        const dir = seg % 2 ? 1 : -1;
        ctx.quadraticCurveTo(bx + dir*2*s + wave*0.5*s, (sy+sy2)/2, bx + thickness*s*dir*0.3, sy2);
      }
      ctx.lineTo(bx + thickness*s, startY + length*s);
      ctx.lineTo(bx + thickness*s, startY);
      ctx.closePath();
      ctx.fill();
      // Braid tip
      ctx.beginPath();
      ctx.arc(bx, startY + length*s, thickness*s*0.8, 0, Math.PI*2);
      ctx.fill();
    }
  }

  /** Draw hanging loc strands */
  function drawLocStrands(ctx, cx, s, hc, count, length, startY, spacing, freeform) {
    ctx.fillStyle = hc;
    const half = Math.floor(count / 2);
    for (let i = -half; i <= half; i++) {
      const lx = cx + i * spacing * s;
      const curve = freeform ? (i % 2 ? 8 : -6) : (i % 2 ? 4 : -3);
      const thick = freeform ? (2 + Math.abs(i % 3)) : 2.5;
      ctx.beginPath();
      ctx.moveTo(lx - thick*s, startY);
      ctx.quadraticCurveTo(lx + curve*s, startY + length*s*0.5, lx, startY + length*s);
      ctx.quadraticCurveTo(lx - curve*0.5*s, startY + length*s*0.5, lx + thick*s, startY);
      ctx.closePath();
      ctx.fill();
      // Loc texture bumps
      ctx.fillStyle = darken(hc, 0.08);
      for (let b = 0; b < 3; b++) {
        const by = startY + (length*s/4)*(b+1);
        ctx.beginPath();
        ctx.arc(lx + (b%2?1:-1)*s, by, thick*s*0.6, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.fillStyle = hc;
    }
  }

  /** Draw curl texture dots/circles in an area */
  function drawCurlTexture(ctx, cx, s, hc, radius, centerY, density) {
    ctx.save();
    ctx.fillStyle = darken(hc, 0.12);
    const step = (radius*2) / density;
    for (let row = -density/2; row < density/2; row++) {
      for (let col = -density/2; col < density/2; col++) {
        const px = cx + col*step*s + (row%2?step*0.5*s:0);
        const py = centerY + row*step*s;
        const dist = Math.sqrt((px-cx)**2 + (py-centerY)**2);
        if (dist < radius*s) {
          ctx.beginPath();
          ctx.arc(px, py, 1.5*s, 0, Math.PI*2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  /** Draw Bantu knots */
  function drawKnots(ctx, cx, s, hc, positions) {
    for (const [kx, ky] of positions) {
      ctx.fillStyle = hc;
      ctx.beginPath();
      ctx.arc(cx + kx*s, ky*s, 10*s, 0, Math.PI*2);
      ctx.fill();
      // Spiral detail
      ctx.fillStyle = darken(hc, 0.15);
      ctx.beginPath();
      ctx.arc(cx + kx*s, ky*s - 3*s, 6*s, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = lighten(hc, 0.05);
      ctx.beginPath();
      ctx.arc(cx + kx*s, ky*s - 4*s, 3*s, 0, Math.PI*2);
      ctx.fill();
    }
  }

  /** Draw cornrow lines on top of head */
  function drawCornrowLines(ctx, cx, s, hc, count, curved) {
    ctx.save();
    ctx.strokeStyle = darken(hc, 0.25);
    ctx.lineWidth = 1.8*s;
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const offset = (i - (count-1)/2) * (46/(count-1));
      ctx.beginPath();
      if (curved) {
        ctx.moveTo(cx + offset*s*0.5, 32*s);
        ctx.quadraticCurveTo(cx + offset*s*0.8, 42*s, cx + offset*s, 52*s);
      } else {
        ctx.moveTo(cx + offset*s*0.6, 32*s);
        ctx.lineTo(cx + offset*s, 52*s);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Hair cap (base shape on top of head) */
  function drawHairCap(ctx, cx, s, hc, width, height, topY) {
    ctx.fillStyle = hc;
    ctx.beginPath();
    ctx.ellipse(cx, topY, width*s, height*s, 0, Math.PI, Math.PI*2);
    ctx.fill();
  }

  // ================================================================
  //  VOLUME LAYER — draws BEHIND the head
  //  The head oval will cover the face/neck area naturally.
  // ================================================================
  function drawHairVolume(ctx, styleId, hc, cx, s) {
    if (!styleId) return;
    ctx.save();
    ctx.fillStyle = hc;

    switch (styleId) {

      // ═══════════════════════════════════════════════════════
      //  BOYS — SHORT (Barbershop)
      // ═══════════════════════════════════════════════════════

      case 'hair_low_fade':
      case 'hair_mid_fade':
      case 'hair_high_fade':
      case 'hair_burst_fade':
      case 'hair_taper':
      case 'hair_buzz':
      case 'hair_lineup':
      case 'hair_caesar':
      case 'hair_sponge_curls':
      case 'hair_360_waves':
      case 'hair_south_france':
        // Short cuts have no volume behind head — all drawn in top layer
        break;

      case 'hair_high_top':
        // Slight volume above head for the tall top
        break;

      case 'hair_flat_top':
        break;

      case 'hair_frohawk_boy':
        // Mohawk strip volume
        ctx.beginPath();
        ctx.ellipse(cx, 34*s, 12*s, 20*s, 0, Math.PI, Math.PI*2);
        ctx.fill();
        break;

      // ═══════════════════════════════════════════════════════
      //  BOYS — MEDIUM / LONG
      // ═══════════════════════════════════════════════════════

      case 'hair_twists_boy':
        drawHairCap(ctx, cx, s, hc, 30, 10, 40);
        drawLocStrands(ctx, cx, s, hc, 7, 45, 40*s, 8, false);
        break;

      case 'hair_mini_twists':
        drawHairCap(ctx, cx, s, hc, 30, 10, 40);
        drawLocStrands(ctx, cx, s, hc, 9, 38, 40*s, 6.5, false);
        break;

      case 'hair_twistout_boy':
        // Voluminous twist-out behind head
        ctx.beginPath();
        ctx.arc(cx, 50*s, 38*s, 0, Math.PI*2);
        ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 35, 50*s, 8);
        break;

      case 'hair_cornrows_boy':
        drawHairCap(ctx, cx, s, hc, 30, 12, 40);
        break;

      case 'hair_cornrows_designs':
        drawHairCap(ctx, cx, s, hc, 30, 12, 40);
        break;

      case 'hair_cornrows_fade':
        drawHairCap(ctx, cx, s, hc, 28, 10, 42);
        break;

      case 'hair_box_braids_short':
        drawHairCap(ctx, cx, s, hc, 30, 12, 38);
        drawBraidStrands(ctx, cx, s, hc, 7, 35, 42*s, 8, 2.5);
        break;

      case 'hair_starter_locs_boy':
        drawHairCap(ctx, cx, s, hc, 30, 10, 40);
        drawLocStrands(ctx, cx, s, hc, 7, 28, 40*s, 8, false);
        break;

      case 'hair_short_locs':
        drawHairCap(ctx, cx, s, hc, 32, 12, 40);
        drawLocStrands(ctx, cx, s, hc, 7, 40, 38*s, 8, false);
        break;

      case 'hair_medium_locs':
        drawHairCap(ctx, cx, s, hc, 32, 12, 40);
        drawLocStrands(ctx, cx, s, hc, 9, 55, 38*s, 7, false);
        break;

      case 'hair_long_locs':
        drawHairCap(ctx, cx, s, hc, 32, 12, 40);
        drawLocStrands(ctx, cx, s, hc, 9, 75, 38*s, 7, false);
        break;

      case 'hair_freeform_locs_boy':
        drawHairCap(ctx, cx, s, hc, 32, 12, 40);
        drawLocStrands(ctx, cx, s, hc, 9, 60, 38*s, 7, true);
        break;

      case 'hair_locs_fade':
        // Locs on top, faded sides
        drawLocStrands(ctx, cx, s, hc, 5, 45, 36*s, 8, false);
        break;

      case 'hair_locs_topknot':
        // Gathered locs in bun on top
        drawHairCap(ctx, cx, s, hc, 28, 10, 40);
        ctx.beginPath();
        ctx.arc(cx, 24*s, 14*s, 0, Math.PI*2);
        ctx.fill();
        break;

      case 'hair_braided_manbun':
        drawHairCap(ctx, cx, s, hc, 30, 12, 38);
        ctx.beginPath();
        ctx.arc(cx, 24*s, 12*s, 0, Math.PI*2);
        ctx.fill();
        break;

      case 'hair_mohawk_braids':
        // Central strip of braids
        ctx.beginPath();
        ctx.moveTo(cx - 8*s, 48*s);
        ctx.lineTo(cx, 18*s);
        ctx.lineTo(cx + 8*s, 48*s);
        ctx.closePath();
        ctx.fill();
        drawBraidStrands(ctx, cx, s, hc, 3, 20, 25*s, 5, 2);
        break;

      // ═══════════════════════════════════════════════════════
      //  GIRLS — NATURAL
      // ═══════════════════════════════════════════════════════

      case 'hair_twa_girl':
        // Teeny weeny afro — very close to head
        break; // drawn in top layer

      case 'hair_afro_small':
        ctx.beginPath(); ctx.arc(cx, 56*s, 32*s, 0, Math.PI*2); ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 28, 56*s, 6);
        break;

      case 'hair_afro_medium':
        ctx.beginPath(); ctx.arc(cx, 54*s, 42*s, 0, Math.PI*2); ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 38, 54*s, 8);
        break;

      case 'hair_afro_big':
        ctx.beginPath(); ctx.arc(cx, 50*s, 55*s, 0, Math.PI*2); ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 50, 50*s, 10);
        break;

      case 'hair_single_puff':
        // Single puff on top
        ctx.beginPath();
        ctx.arc(cx, 26*s, 22*s, 0, Math.PI*2);
        ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 18, 26*s, 5);
        break;

      case 'hair_double_puffs':
        ctx.beginPath(); ctx.arc(cx - 22*s, 34*s, 18*s, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 22*s, 34*s, 18*s, 0, Math.PI*2); ctx.fill();
        drawCurlTexture(ctx, cx - 22*s, s, hc, 14, 34*s, 4);
        drawCurlTexture(ctx, cx + 22*s, s, hc, 14, 34*s, 4);
        break;

      case 'hair_pineapple_puff':
        // High puff on top of head
        drawHairCap(ctx, cx, s, hc, 28, 10, 42);
        ctx.beginPath();
        ctx.arc(cx, 20*s, 20*s, 0, Math.PI*2);
        ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 16, 20*s, 5);
        break;

      case 'hair_twistout_girl':
        ctx.beginPath(); ctx.arc(cx, 48*s, 44*s, 0, Math.PI*2); ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 40, 48*s, 9);
        break;

      case 'hair_washgo_girl':
        ctx.beginPath(); ctx.arc(cx, 50*s, 40*s, 0, Math.PI*2); ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 36, 50*s, 9);
        break;

      case 'hair_bantu_knots_girl':
        drawKnots(ctx, cx, s, hc, [[-18,28],[0,22],[18,28],[-10,40],[10,40]]);
        break;

      // ═══════════════════════════════════════════════════════
      //  GIRLS — PROTECTIVE
      // ═══════════════════════════════════════════════════════

      case 'hair_box_braids_long':
        roundRect(ctx, cx - 28*s, 30*s, 56*s, 18*s, 10*s); ctx.fill();
        drawBraidStrands(ctx, cx, s, hc, 9, 60, 46*s, 7, 2.5);
        break;

      case 'hair_box_braids_bob':
        roundRect(ctx, cx - 28*s, 30*s, 56*s, 18*s, 10*s); ctx.fill();
        drawBraidStrands(ctx, cx, s, hc, 9, 30, 46*s, 7, 2.5);
        break;

      case 'hair_knotless_braids':
        roundRect(ctx, cx - 28*s, 30*s, 56*s, 18*s, 10*s); ctx.fill();
        // Knotless = thinner at root, thicker at end
        drawBraidStrands(ctx, cx, s, hc, 9, 55, 46*s, 7, 2);
        break;

      case 'hair_bohemian_braids':
        roundRect(ctx, cx - 28*s, 30*s, 56*s, 18*s, 10*s); ctx.fill();
        drawBraidStrands(ctx, cx, s, hc, 9, 55, 46*s, 7, 2.5);
        // Loose curly bits between braids
        ctx.fillStyle = lighten(hc, 0.08);
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.arc(cx + i*8*s + 3*s, 60*s + Math.abs(i)*4*s, 3*s, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.fillStyle = hc;
        break;

      case 'hair_cornrows_girl':
        drawHairCap(ctx, cx, s, hc, 30, 12, 40);
        break;

      case 'hair_cornrows_ponytail':
        drawHairCap(ctx, cx, s, hc, 30, 12, 40);
        // Ponytail out the back
        ctx.beginPath();
        ctx.moveTo(cx, 42*s);
        ctx.quadraticCurveTo(cx + 38*s, 35*s, cx + 34*s, 68*s);
        ctx.quadraticCurveTo(cx + 28*s, 74*s, cx + 18*s, 66*s);
        ctx.fill();
        break;

      case 'hair_lemonade_braids':
        // Side-swept cornrows
        drawHairCap(ctx, cx, s, hc, 30, 12, 40);
        drawBraidStrands(ctx, cx + 16*s, s, hc, 5, 50, 44*s, 6, 2.5);
        break;

      case 'hair_fulani_braids':
        roundRect(ctx, cx - 30*s, 36*s, 60*s, 12*s, 8*s); ctx.fill();
        // Side braids with beads
        for (let fu = -3; fu <= 3; fu += 2) {
          const fux = cx + fu*9*s;
          ctx.fillStyle = hc;
          ctx.fillRect(fux - 2*s, 48*s, 4*s, 28*s);
          ctx.fillStyle = '#ffd166';
          ctx.beginPath(); ctx.arc(fux, 78*s, 3*s, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = hc;
        break;

      case 'hair_ghana_braids':
        // Thick cornrow braids going back
        drawHairCap(ctx, cx, s, hc, 30, 14, 38);
        drawBraidStrands(ctx, cx, s, hc, 5, 45, 44*s, 10, 4);
        break;

      case 'hair_goddess_braids':
        // 2-4 thick braids with curly bits
        for (let gb = -2; gb <= 2; gb++) {
          ctx.fillStyle = hc;
          ctx.beginPath();
          const gx = cx + gb*12*s;
          ctx.moveTo(gx - 5*s, 34*s);
          ctx.quadraticCurveTo(gx + 4*s, 44*s, gx + gb*3*s, 54*s);
          ctx.lineTo(gx + gb*3*s + 5*s, 54*s);
          ctx.quadraticCurveTo(gx + 9*s, 44*s, gx + 5*s, 34*s);
          ctx.fill();
        }
        // Curly loose bits
        ctx.fillStyle = lighten(hc, 0.06);
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(cx + i*14*s, 50*s, 3*s, 0, Math.PI*2);
          ctx.fill();
        }
        break;

      case 'hair_twists_girl':
        drawHairCap(ctx, cx, s, hc, 30, 10, 40);
        drawLocStrands(ctx, cx, s, hc, 9, 55, 40*s, 7, false);
        break;

      case 'hair_flat_twists':
        drawHairCap(ctx, cx, s, hc, 30, 12, 40);
        break;

      case 'hair_flat_twists_puffs':
        drawHairCap(ctx, cx, s, hc, 28, 10, 42);
        // Two puffs at ends
        ctx.beginPath(); ctx.arc(cx - 18*s, 36*s, 12*s, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 18*s, 36*s, 12*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'hair_bantu_knots_prot':
        drawKnots(ctx, cx, s, hc, [[-20,26],[0,20],[20,26],[-12,40],[12,40],[-22,48],[22,48]]);
        break;

      case 'hair_faux_locs':
        drawHairCap(ctx, cx, s, hc, 32, 12, 38);
        drawLocStrands(ctx, cx, s, hc, 9, 65, 38*s, 7, false);
        break;

      case 'hair_butterfly_locs':
        drawHairCap(ctx, cx, s, hc, 32, 12, 38);
        // Distressed/loopy locs
        const half = 4;
        for (let i = -half; i <= half; i++) {
          const lx = cx + i*7*s;
          ctx.fillStyle = hc;
          ctx.beginPath();
          ctx.moveTo(lx - 2.5*s, 38*s);
          // Loopy shape
          ctx.quadraticCurveTo(lx + 6*s, 50*s, lx - 4*s, 62*s);
          ctx.quadraticCurveTo(lx + 5*s, 75*s, lx, 88*s);
          ctx.lineTo(lx + 2.5*s, 88*s);
          ctx.quadraticCurveTo(lx + 7*s, 75*s, lx + 4*s, 62*s);
          ctx.quadraticCurveTo(lx - 3*s, 50*s, lx + 2.5*s, 38*s);
          ctx.closePath();
          ctx.fill();
        }
        break;

      case 'hair_passion_twists':
        drawHairCap(ctx, cx, s, hc, 32, 12, 38);
        drawLocStrands(ctx, cx, s, hc, 9, 60, 38*s, 7, true);
        break;

      case 'hair_crochet_braids':
        // Voluminous crochet with curls
        ctx.beginPath(); ctx.arc(cx, 48*s, 42*s, 0, Math.PI*2); ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 38, 48*s, 8);
        break;

      case 'hair_braids_beads':
        roundRect(ctx, cx - 28*s, 30*s, 56*s, 18*s, 10*s); ctx.fill();
        // Braids
        for (let bb = -4; bb <= 4; bb++) {
          ctx.fillStyle = hc;
          ctx.fillRect(cx + bb*7*s - 2.5*s, 46*s, 5*s, 38*s);
          // Beads at ends — colorful
          const beadColors = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#fd79a8', '#e74c3c'];
          ctx.fillStyle = beadColors[bb + 4];
          ctx.beginPath(); ctx.arc(cx + bb*7*s, 86*s, 3*s, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(cx + bb*7*s, 80*s, 2.5*s, 0, Math.PI*2); ctx.fill();
        }
        break;

      case 'hair_starter_locs_girl':
        drawHairCap(ctx, cx, s, hc, 30, 10, 40);
        drawLocStrands(ctx, cx, s, hc, 9, 30, 40*s, 7, false);
        break;

      // ═══════════════════════════════════════════════════════
      //  GIRLS — STYLED
      // ═══════════════════════════════════════════════════════

      case 'hair_silk_press':
        // Sleek straight hair flowing down
        drawHairCap(ctx, cx, s, hc, 30, 14, 38);
        // Straight sheets of hair on sides
        ctx.fillRect(cx - 32*s, 44*s, 10*s, 40*s);
        ctx.fillRect(cx + 22*s, 44*s, 10*s, 40*s);
        // Shine highlight
        ctx.fillStyle = lighten(hc, 0.15);
        ctx.fillRect(cx - 30*s, 46*s, 3*s, 34*s);
        ctx.fillRect(cx + 27*s, 46*s, 3*s, 34*s);
        ctx.fillStyle = hc;
        break;

      case 'hair_blowout':
        // Big, voluminous blown-out hair
        ctx.beginPath(); ctx.arc(cx, 46*s, 48*s, 0, Math.PI*2); ctx.fill();
        // Texture — slightly different from afro (smoother)
        ctx.fillStyle = lighten(hc, 0.06);
        for (let i = 0; i < 12; i++) {
          const ang = (Math.PI*2/12)*i;
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(ang)*32*s, 46*s + Math.sin(ang)*32*s, 8*s, 4*s, ang, 0, Math.PI*2);
          ctx.fill();
        }
        break;

      case 'hair_press_curl':
        drawHairCap(ctx, cx, s, hc, 30, 14, 38);
        // Curled ends flowing down
        for (let side of [-1, 1]) {
          for (let i = 0; i < 4; i++) {
            const cy2 = 52*s + i*10*s;
            ctx.beginPath();
            ctx.arc(cx + side*28*s, cy2, 6*s, 0, Math.PI*2);
            ctx.fill();
          }
        }
        break;

      case 'hair_flexi_rod':
        // Bouncy defined curls
        drawHairCap(ctx, cx, s, hc, 30, 12, 40);
        for (let i = -3; i <= 3; i++) {
          for (let j = 0; j < 3; j++) {
            ctx.beginPath();
            ctx.arc(cx + i*10*s, 48*s + j*12*s, 6*s, 0, Math.PI*2);
            ctx.fill();
          }
        }
        break;

      case 'hair_space_buns':
        drawHairCap(ctx, cx, s, hc, 28, 10, 42);
        ctx.beginPath(); ctx.arc(cx - 22*s, 28*s, 14*s, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 22*s, 28*s, 14*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'hair_high_ponytail':
        drawHairCap(ctx, cx, s, hc, 30, 12, 40);
        // Ponytail going back/down
        ctx.beginPath();
        ctx.moveTo(cx, 34*s);
        ctx.quadraticCurveTo(cx + 36*s, 28*s, cx + 32*s, 70*s);
        ctx.quadraticCurveTo(cx + 26*s, 76*s, cx + 16*s, 68*s);
        ctx.fill();
        break;

      case 'hair_two_ponytails':
        drawHairCap(ctx, cx, s, hc, 28, 10, 42);
        // Two pigtails hanging down
        for (let side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + side*20*s, 44*s);
          ctx.quadraticCurveTo(cx + side*32*s, 55*s, cx + side*28*s, 80*s);
          ctx.quadraticCurveTo(cx + side*22*s, 84*s, cx + side*18*s, 78*s);
          ctx.fill();
        }
        break;

      case 'hair_half_up':
        drawHairCap(ctx, cx, s, hc, 30, 12, 40);
        // Half down, half up bun
        ctx.beginPath(); ctx.arc(cx, 28*s, 10*s, 0, Math.PI*2); ctx.fill();
        // Flowing hair below
        ctx.fillRect(cx - 30*s, 46*s, 8*s, 34*s);
        ctx.fillRect(cx + 22*s, 46*s, 8*s, 34*s);
        break;

      // ═══════════════════════════════════════════════════════
      //  UNISEX
      // ═══════════════════════════════════════════════════════

      case 'hair_tapered_afro':
        ctx.beginPath(); ctx.arc(cx, 50*s, 36*s, 0, Math.PI*2); ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 32, 50*s, 7);
        break;

      case 'hair_short_afro':
        ctx.beginPath(); ctx.arc(cx, 54*s, 30*s, 0, Math.PI*2); ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 26, 54*s, 6);
        break;

      case 'hair_twa':
        // Very short — drawn in top layer
        break;

      case 'hair_short_twists':
        drawHairCap(ctx, cx, s, hc, 30, 10, 40);
        drawLocStrands(ctx, cx, s, hc, 7, 25, 40*s, 8, false);
        break;

      case 'hair_finger_coils':
        ctx.beginPath(); ctx.arc(cx, 48*s, 36*s, 0, Math.PI*2); ctx.fill();
        // Tight springy coils
        drawCurlTexture(ctx, cx, s, hc, 32, 48*s, 10);
        break;

      case 'hair_freeform_locs':
        drawHairCap(ctx, cx, s, hc, 32, 12, 40);
        drawLocStrands(ctx, cx, s, hc, 9, 55, 38*s, 7, true);
        break;

      case 'hair_cornrows':
        drawHairCap(ctx, cx, s, hc, 30, 12, 40);
        break;

      case 'hair_frohawk':
        ctx.beginPath();
        ctx.moveTo(cx - 14*s, 50*s);
        ctx.quadraticCurveTo(cx, 10*s, cx + 14*s, 50*s);
        ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 12, 35*s, 5);
        break;

      case 'hair_fade_natural':
        ctx.beginPath(); ctx.arc(cx, 42*s, 30*s, Math.PI, Math.PI*2); ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 26, 36*s, 5);
        break;

      case 'hair_washgo':
        ctx.beginPath(); ctx.arc(cx, 50*s, 38*s, 0, Math.PI*2); ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 34, 50*s, 8);
        break;

      case 'hair_buzz_uni':
        // Drawn in top layer only
        break;

      case 'hair_braids_fade':
        drawBraidStrands(ctx, cx, s, hc, 5, 35, 38*s, 8, 2.5);
        break;
    }

    ctx.restore();
  }

  // ================================================================
  //  TOP LAYER — draws AFTER face, on top of forehead
  //  Crown details, hairline, fade details, accessories.
  // ================================================================
  function drawHairTop(ctx, styleId, hc, cx, s) {
    if (!styleId) return;
    ctx.save();
    ctx.fillStyle = hc;

    switch (styleId) {

      // ═══════════════════════════════════════════════════════
      //  BOYS — SHORT
      // ═══════════════════════════════════════════════════════

      case 'hair_low_fade':
        // Hair on top, low fade on sides
        ctx.beginPath(); ctx.ellipse(cx, 42*s, 28*s, 16*s, 0, Math.PI, Math.PI*2); ctx.fill();
        drawFade(ctx, cx, s, hc, 'low');
        break;

      case 'hair_mid_fade':
        ctx.beginPath(); ctx.ellipse(cx, 42*s, 28*s, 16*s, 0, Math.PI, Math.PI*2); ctx.fill();
        drawFade(ctx, cx, s, hc, 'mid');
        break;

      case 'hair_high_fade':
        ctx.beginPath(); ctx.ellipse(cx, 42*s, 26*s, 14*s, 0, Math.PI, Math.PI*2); ctx.fill();
        drawFade(ctx, cx, s, hc, 'high');
        break;

      case 'hair_burst_fade':
        ctx.beginPath(); ctx.ellipse(cx, 42*s, 28*s, 16*s, 0, Math.PI, Math.PI*2); ctx.fill();
        drawFade(ctx, cx, s, hc, 'burst');
        break;

      case 'hair_taper':
        ctx.beginPath(); ctx.ellipse(cx, 42*s, 30*s, 16*s, 0, Math.PI, Math.PI*2); ctx.fill();
        // Gradual taper — more hair on sides than fade
        ctx.globalAlpha = 0.5;
        ctx.fillRect(cx - 32*s, 46*s, 8*s, 20*s);
        ctx.fillRect(cx + 24*s, 46*s, 8*s, 20*s);
        ctx.globalAlpha = 1;
        break;

      case 'hair_buzz':
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.ellipse(cx, 44*s, 29*s, 12*s, 0, Math.PI, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        break;

      case 'hair_high_top':
        // Tall flat-ish top
        ctx.fillRect(cx - 22*s, 18*s, 44*s, 28*s);
        roundRect(ctx, cx - 24*s, 14*s, 48*s, 8*s, 4*s); ctx.fill();
        drawFade(ctx, cx, s, hc, 'high');
        drawCurlTexture(ctx, cx, s, hc, 18, 28*s, 5);
        break;

      case 'hair_flat_top':
        // Perfectly flat top — distinctive silhouette
        ctx.fillRect(cx - 24*s, 22*s, 48*s, 24*s);
        // Flat edge on top
        ctx.fillStyle = lighten(hc, 0.05);
        ctx.fillRect(cx - 24*s, 20*s, 48*s, 4*s);
        ctx.fillStyle = hc;
        drawFade(ctx, cx, s, hc, 'mid');
        break;

      case 'hair_sponge_curls':
        ctx.beginPath(); ctx.ellipse(cx, 40*s, 28*s, 18*s, 0, Math.PI, Math.PI*2); ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 24, 34*s, 6);
        drawFade(ctx, cx, s, hc, 'mid');
        break;

      case 'hair_360_waves':
        ctx.beginPath(); ctx.ellipse(cx, 44*s, 30*s, 14*s, 0, Math.PI, Math.PI*2); ctx.fill();
        // Wave lines
        ctx.strokeStyle = lighten(hc, 0.1);
        ctx.lineWidth = 1*s;
        for (let w = 0; w < 4; w++) {
          ctx.beginPath();
          const wy = 36*s + w*3*s;
          ctx.moveTo(cx - 24*s, wy);
          ctx.quadraticCurveTo(cx - 12*s, wy - 2*s, cx, wy);
          ctx.quadraticCurveTo(cx + 12*s, wy + 2*s, cx + 24*s, wy);
          ctx.stroke();
        }
        break;

      case 'hair_south_france':
        // Hair on front/top only, sides shaved
        ctx.beginPath(); ctx.ellipse(cx + 4*s, 40*s, 22*s, 16*s, 0.2, Math.PI, Math.PI*2); ctx.fill();
        drawFade(ctx, cx, s, hc, 'high');
        break;

      case 'hair_frohawk_boy':
        // Mohawk strip on top
        ctx.beginPath();
        ctx.moveTo(cx - 10*s, 48*s);
        ctx.quadraticCurveTo(cx, 16*s, cx + 10*s, 48*s);
        ctx.fill();
        drawCurlTexture(ctx, cx, s, hc, 8, 34*s, 4);
        drawFade(ctx, cx, s, hc, 'high');
        break;

      case 'hair_lineup':
        // Clean edge-up / line-up — sharp hairline
        ctx.beginPath(); ctx.ellipse(cx, 44*s, 30*s, 14*s, 0, Math.PI, Math.PI*2); ctx.fill();
        // Sharp edge line
        ctx.strokeStyle = darken(hc, 0.4);
        ctx.lineWidth = 1.5*s;
        ctx.beginPath();
        ctx.moveTo(cx - 26*s, 46*s);
        ctx.lineTo(cx - 24*s, 42*s);
        ctx.lineTo(cx + 24*s, 42*s);
        ctx.lineTo(cx + 26*s, 46*s);
        ctx.stroke();
        break;

      case 'hair_caesar':
        // Short with straight-across fringe
        ctx.beginPath(); ctx.ellipse(cx, 44*s, 30*s, 12*s, 0, Math.PI, Math.PI*2); ctx.fill();
        // Straight fringe line
        ctx.fillStyle = hc;
        ctx.fillRect(cx - 24*s, 42*s, 48*s, 5*s);
        ctx.fillStyle = darken(hc, 0.08);
        ctx.fillRect(cx - 24*s, 45*s, 48*s, 2*s);
        break;

      // ═══════════════════════════════════════════════════════
      //  BOYS — MEDIUM / LONG
      // ═══════════════════════════════════════════════════════

      case 'hair_twists_boy':
      case 'hair_mini_twists':
      case 'hair_twistout_boy':
        // Texture visible on top
        drawCurlTexture(ctx, cx, s, hc, 22, 38*s, 5);
        break;

      case 'hair_cornrows_boy':
        drawCornrowLines(ctx, cx, s, hc, 5, false);
        break;

      case 'hair_cornrows_designs':
        // Cornrows with creative patterns
        drawCornrowLines(ctx, cx, s, hc, 5, true);
        // Design line
        ctx.strokeStyle = darken(hc, 0.3);
        ctx.lineWidth = 1*s;
        ctx.beginPath();
        ctx.moveTo(cx - 15*s, 38*s);
        ctx.quadraticCurveTo(cx, 32*s, cx + 15*s, 38*s);
        ctx.stroke();
        break;

      case 'hair_cornrows_fade':
        drawCornrowLines(ctx, cx, s, hc, 4, false);
        drawFade(ctx, cx, s, hc, 'mid');
        break;

      case 'hair_box_braids_short':
        // Braid texture on top
        ctx.strokeStyle = darken(hc, 0.2);
        ctx.lineWidth = 1*s;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i*8*s, 32*s);
          ctx.lineTo(cx + i*8*s, 46*s);
          ctx.stroke();
        }
        break;

      case 'hair_starter_locs_boy':
      case 'hair_short_locs':
      case 'hair_medium_locs':
      case 'hair_long_locs':
        // Loc roots visible on top
        ctx.strokeStyle = darken(hc, 0.15);
        ctx.lineWidth = 2*s;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i*8*s, 32*s);
          ctx.lineTo(cx + i*8*s + (i%2?2:-2)*s, 44*s);
          ctx.stroke();
        }
        break;

      case 'hair_freeform_locs_boy':
        ctx.strokeStyle = darken(hc, 0.15);
        ctx.lineWidth = 2*s;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i*8*s, 32*s);
          ctx.quadraticCurveTo(cx + i*9*s + (i%2?4:-4)*s, 38*s, cx + i*8*s, 44*s);
          ctx.stroke();
        }
        break;

      case 'hair_locs_fade':
        // Loc parts on top + fade sides
        ctx.strokeStyle = darken(hc, 0.15);
        ctx.lineWidth = 2*s;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath(); ctx.moveTo(cx + i*10*s, 30*s); ctx.lineTo(cx + i*10*s, 44*s); ctx.stroke();
        }
        drawFade(ctx, cx, s, hc, 'mid');
        break;

      case 'hair_locs_topknot':
      case 'hair_braided_manbun':
        // Just the gathered top detail
        ctx.fillStyle = darken(hc, 0.1);
        ctx.beginPath(); ctx.arc(cx, 24*s, 8*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'hair_mohawk_braids':
        // Central braid detail on top
        ctx.strokeStyle = darken(hc, 0.2);
        ctx.lineWidth = 2*s;
        ctx.beginPath(); ctx.moveTo(cx, 22*s); ctx.lineTo(cx, 44*s); ctx.stroke();
        drawFade(ctx, cx, s, hc, 'high');
        break;

      // ═══════════════════════════════════════════════════════
      //  GIRLS — NATURAL
      // ═══════════════════════════════════════════════════════

      case 'hair_twa_girl':
        // Very short natural — sits close to head
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.ellipse(cx, 44*s, 30*s, 14*s, 0, Math.PI, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        drawCurlTexture(ctx, cx, s, hc, 26, 38*s, 5);
        break;

      case 'hair_afro_small':
      case 'hair_afro_medium':
      case 'hair_afro_big':
      case 'hair_twistout_girl':
      case 'hair_washgo_girl':
        // Top curl texture (volume already behind)
        break;

      case 'hair_single_puff':
        // Hair tie
        ctx.fillStyle = '#e84393';
        ctx.beginPath(); ctx.arc(cx, 40*s, 4*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'hair_double_puffs':
        // Hair ties
        ctx.fillStyle = '#e84393';
        ctx.beginPath(); ctx.arc(cx - 22*s, 48*s, 4*s, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 22*s, 48*s, 4*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'hair_pineapple_puff':
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath(); ctx.arc(cx, 34*s, 4*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'hair_bantu_knots_girl':
        // Already fully drawn in volume layer
        break;

      // ═══════════════════════════════════════════════════════
      //  GIRLS — PROTECTIVE
      // ═══════════════════════════════════════════════════════

      case 'hair_box_braids_long':
      case 'hair_box_braids_bob':
      case 'hair_knotless_braids':
      case 'hair_bohemian_braids':
        // Part lines on top
        ctx.strokeStyle = darken(hc, 0.2);
        ctx.lineWidth = 1*s;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath(); ctx.moveTo(cx + i*8*s, 32*s); ctx.lineTo(cx + i*8*s, 46*s); ctx.stroke();
        }
        break;

      case 'hair_cornrows_girl':
        drawCornrowLines(ctx, cx, s, hc, 5, false);
        break;

      case 'hair_cornrows_ponytail':
        drawCornrowLines(ctx, cx, s, hc, 5, false);
        break;

      case 'hair_lemonade_braids':
        // Side-swept cornrow lines
        ctx.strokeStyle = darken(hc, 0.25);
        ctx.lineWidth = 1.5*s;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(cx - 24*s, 34*s + i*4*s);
          ctx.quadraticCurveTo(cx, 32*s + i*4*s, cx + 24*s, 38*s + i*3*s);
          ctx.stroke();
        }
        break;

      case 'hair_fulani_braids':
        // Central cornrow on top
        ctx.strokeStyle = hc; ctx.lineWidth = 4*s;
        ctx.beginPath(); ctx.moveTo(cx, 30*s); ctx.lineTo(cx, 46*s); ctx.stroke();
        // Side braids already in volume
        break;

      case 'hair_ghana_braids':
        drawCornrowLines(ctx, cx, s, hc, 4, false);
        break;

      case 'hair_goddess_braids':
        drawCornrowLines(ctx, cx, s, hc, 3, true);
        break;

      case 'hair_twists_girl':
        ctx.strokeStyle = darken(hc, 0.15);
        ctx.lineWidth = 2*s;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath(); ctx.moveTo(cx + i*8*s, 32*s); ctx.lineTo(cx + i*8*s, 44*s); ctx.stroke();
        }
        break;

      case 'hair_flat_twists':
        // Flat twist rows on top
        ctx.strokeStyle = darken(hc, 0.25);
        ctx.lineWidth = 2*s;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(cx - 24*s, 34*s + i*5*s);
          ctx.lineTo(cx + 24*s, 34*s + i*5*s);
          ctx.stroke();
        }
        break;

      case 'hair_flat_twists_puffs':
        // Flat twist lines leading to puffs
        ctx.strokeStyle = darken(hc, 0.25);
        ctx.lineWidth = 1.5*s;
        ctx.beginPath(); ctx.moveTo(cx, 34*s); ctx.lineTo(cx - 18*s, 38*s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 34*s); ctx.lineTo(cx + 18*s, 38*s); ctx.stroke();
        // Puff hair ties
        ctx.fillStyle = '#e84393';
        ctx.beginPath(); ctx.arc(cx - 18*s, 44*s, 3*s, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 18*s, 44*s, 3*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'hair_bantu_knots_prot':
        break; // fully drawn in volume

      case 'hair_faux_locs':
      case 'hair_passion_twists':
      case 'hair_starter_locs_girl':
        ctx.strokeStyle = darken(hc, 0.15);
        ctx.lineWidth = 2*s;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath(); ctx.moveTo(cx + i*8*s, 32*s); ctx.lineTo(cx + i*8*s, 44*s); ctx.stroke();
        }
        break;

      case 'hair_butterfly_locs':
        // Root parts
        ctx.strokeStyle = darken(hc, 0.15);
        ctx.lineWidth = 2*s;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath(); ctx.moveTo(cx + i*7*s, 32*s); ctx.lineTo(cx + i*7*s, 42*s); ctx.stroke();
        }
        break;

      case 'hair_crochet_braids':
        // Curl texture visible on top
        break;

      case 'hair_braids_beads':
        ctx.strokeStyle = darken(hc, 0.2);
        ctx.lineWidth = 1*s;
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath(); ctx.moveTo(cx + i*7*s, 32*s); ctx.lineTo(cx + i*7*s, 46*s); ctx.stroke();
        }
        break;

      // ═══════════════════════════════════════════════════════
      //  GIRLS — STYLED
      // ═══════════════════════════════════════════════════════

      case 'hair_silk_press':
        // Sleek top with shine
        ctx.fillStyle = lighten(hc, 0.08);
        ctx.beginPath(); ctx.ellipse(cx, 40*s, 26*s, 6*s, 0, Math.PI, Math.PI*2); ctx.fill();
        break;

      case 'hair_blowout':
        break; // volume layer handles it

      case 'hair_press_curl':
      case 'hair_flexi_rod':
        // Top curl detail
        break;

      case 'hair_space_buns':
        // Bun details — spiral
        ctx.fillStyle = darken(hc, 0.1);
        ctx.beginPath(); ctx.arc(cx - 22*s, 28*s, 8*s, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 22*s, 28*s, 8*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'hair_high_ponytail':
        // Hair tie
        ctx.fillStyle = '#e84393';
        ctx.beginPath(); ctx.arc(cx + 4*s, 36*s, 3*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'hair_two_ponytails':
        // Hair ties
        ctx.fillStyle = '#e84393';
        ctx.beginPath(); ctx.arc(cx - 20*s, 44*s, 3*s, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 20*s, 44*s, 3*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'hair_half_up':
        // Small bun detail
        ctx.fillStyle = darken(hc, 0.1);
        ctx.beginPath(); ctx.arc(cx, 28*s, 6*s, 0, Math.PI*2); ctx.fill();
        break;

      // ═══════════════════════════════════════════════════════
      //  UNISEX
      // ═══════════════════════════════════════════════════════

      case 'hair_tapered_afro':
        drawFade(ctx, cx, s, hc, 'low');
        break;

      case 'hair_short_afro':
        break; // volume handles it

      case 'hair_twa':
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.ellipse(cx, 44*s, 29*s, 12*s, 0, Math.PI, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        break;

      case 'hair_short_twists':
        break;

      case 'hair_finger_coils':
        break;

      case 'hair_freeform_locs':
        ctx.strokeStyle = darken(hc, 0.15);
        ctx.lineWidth = 2*s;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i*8*s, 32*s);
          ctx.quadraticCurveTo(cx + i*9*s + (i%2?4:-4)*s, 38*s, cx + i*8*s, 44*s);
          ctx.stroke();
        }
        break;

      case 'hair_cornrows':
        drawCornrowLines(ctx, cx, s, hc, 5, false);
        break;

      case 'hair_frohawk':
        drawFade(ctx, cx, s, hc, 'high');
        break;

      case 'hair_fade_natural':
        drawFade(ctx, cx, s, hc, 'mid');
        break;

      case 'hair_washgo':
        break;

      case 'hair_buzz_uni':
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.ellipse(cx, 44*s, 29*s, 12*s, 0, Math.PI, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        break;

      case 'hair_braids_fade':
        ctx.strokeStyle = darken(hc, 0.2);
        ctx.lineWidth = 1.5*s;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath(); ctx.moveTo(cx + i*10*s, 30*s); ctx.lineTo(cx + i*10*s, 44*s); ctx.stroke();
        }
        drawFade(ctx, cx, s, hc, 'mid');
        break;
    }

    ctx.restore();
  }

  // ── Dark hair outline helper (for visibility on dark backgrounds) ──
  function drawHairOutline(ctx, styleId, hc, cx, s) {
    // Only needed for very dark hair colors
    const r = parseInt(hc.slice(1,3),16);
    const g = parseInt(hc.slice(3,5),16);
    const b = parseInt(hc.slice(5,7),16);
    if (r + g + b > 120) return; // Not dark enough to need outline

    ctx.save();
    // Use a warm neutral outline, not lighten() which can go purple/blue
    ctx.strokeStyle = '#5a504a';
    ctx.lineWidth = 0.8*s;
    ctx.globalAlpha = 0.35;

    // Draw subtle outline for large volume styles
    const volumeStyles = [
      'hair_afro_small', 'hair_afro_medium', 'hair_afro_big',
      'hair_twistout_girl', 'hair_washgo_girl', 'hair_twistout_boy',
      'hair_tapered_afro', 'hair_short_afro', 'hair_finger_coils',
      'hair_washgo', 'hair_fade_natural', 'hair_blowout',
      'hair_crochet_braids', 'hair_frohawk', 'hair_frohawk_boy',
    ];

    if (volumeStyles.includes(styleId)) {
      // Subtle lighter edge
      const radii = {
        'hair_afro_small': 32, 'hair_afro_medium': 42, 'hair_afro_big': 55,
        'hair_twistout_girl': 44, 'hair_washgo_girl': 40, 'hair_twistout_boy': 38,
        'hair_tapered_afro': 36, 'hair_short_afro': 30, 'hair_finger_coils': 36,
        'hair_washgo': 38, 'hair_blowout': 48, 'hair_crochet_braids': 42,
      };
      const rad = (radii[styleId] || 36) * s;
      const cy = styleId.includes('big') ? 50*s : styleId.includes('blowout') ? 46*s : 52*s;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI*2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Does this hairstyle cover the hood area? If so, skip drawing the hood. */
  function coversHood(styleId) {
    const covering = [
      'hair_afro_small', 'hair_afro_medium', 'hair_afro_big',
      'hair_twistout_girl', 'hair_washgo_girl', 'hair_twistout_boy',
      'hair_tapered_afro', 'hair_short_afro', 'hair_finger_coils',
      'hair_washgo', 'hair_fade_natural', 'hair_blowout',
      'hair_crochet_braids', 'hair_frohawk', 'hair_frohawk_boy',
      'hair_locs_medium', 'hair_locs_long', 'hair_freeform_locs',
      'hair_locs_topknot', 'hair_locs_fade',
      'hair_box_braids_long', 'hair_box_braids_bob',
      'hair_knotless_braids', 'hair_boho_braids',
      'hair_twists_boy', 'hair_mini_twists', 'hair_twist_out_boy',
      'hair_cornrows', 'hair_cornrows_designs', 'hair_cornrows_fade',
      'hair_braids_short', 'hair_braids_fade',
      'hair_lemonade_braids', 'hair_fulani_braids',
      'hair_ghana_braids', 'hair_goddess_braids',
      'hair_flat_twists', 'hair_flat_twist_puffs',
      'hair_faux_locs', 'hair_butterfly_locs', 'hair_passion_twists',
      'hair_braids_beads', 'hair_starter_locs', 'hair_baby_locs',
      'hair_silk_press', 'hair_press_curl', 'hair_flexi_rod',
      'hair_high_ponytail', 'hair_two_ponytails', 'hair_half_up',
      'hair_space_buns', 'hair_twa_girl', 'hair_twa',
      'hair_afro_puff_single', 'hair_afro_puff_double',
      'hair_pineapple_puff', 'hair_bantu_knots',
      'hair_sponge_curls', 'hair_high_top', 'hair_flat_top', 'hair_sof',
      'hair_braided_bun', 'hair_mohawk_braids',
      'hair_cornrows_ponytail', 'hair_twists_girl',
    ];
    return covering.includes(styleId);
  }

  return {
    drawHairVolume,
    drawHairTop,
    drawHairOutline,
    coversHood,
  };
})();
