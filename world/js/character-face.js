/* ============================================================
   ODA World — Face Renderer (V3)
   Individual feature renderers: eyes, brows, lashes, nose, mouth, ears.
   ============================================================ */

const ODA_FACE = (() => {

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
  function faceLineColor(skinHex) {
    const r = parseInt(skinHex.slice(1,3),16);
    const g = parseInt(skinHex.slice(3,5),16);
    const b = parseInt(skinHex.slice(5,7),16);
    const lum = r*0.299 + g*0.587 + b*0.114;
    // Use subtle skin-derived line color that's close to the skin tone
    if (lum < 60) return lighten(skinHex, 0.25);
    if (lum < 100) return darken(skinHex, 0.2);
    return darken(skinHex, 0.25);
  }

  // ── Shared drawing helpers ──────────────────────────────────
  function arc(ctx, x, y, w, curve) {
    ctx.beginPath();
    ctx.moveTo(x - w/2, y);
    ctx.quadraticCurveTo(x, y + w*curve, x + w/2, y);
    ctx.stroke();
  }

  /** Draw a natural eye shape (bezier almond, not a circle) */
  function drawNaturalEye(ctx, x, y, w, h, irisR, irisColor, skinHex, s) {
    // White — bezier curves for natural eye shape
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.bezierCurveTo(x - w, y - h, x + w, y - h, x + w, y);
    ctx.bezierCurveTo(x + w, y + h*0.8, x - w, y + h*0.8, x - w, y);
    ctx.fill();

    // Thin upper lid line
    ctx.strokeStyle = darken(skinHex || '#6B4226', 0.25);
    ctx.lineWidth = 1*s;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.bezierCurveTo(x - w, y - h, x + w, y - h, x + w, y);
    ctx.stroke();

    // Iris — sits slightly low in the eye
    ctx.fillStyle = irisColor || '#3D2B1A';
    ctx.beginPath();
    ctx.arc(x, y + 0.5*s, irisR, 0, Math.PI*2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(x, y + 0.5*s, irisR * 0.5, 0, Math.PI*2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x - 1*s, y - 0.5*s, s*0.8, 0, Math.PI*2);
    ctx.fill();
  }

  // ── Eyes ────────────────────────────────────────────────────
  function drawEyes(ctx, face, dims) {
    ctx.save();
    const { cx, s, eyeY, eyeSpacing } = dims;
    const ec = face.eyeColor || '#2D1B00';
    const shape = face.eyeShape || 'round';

    // Eye dimensions per shape — all use natural bezier eye shape
    let ew, eh, irisR;
    switch (shape) {
      case 'round':      ew = 6*s;   eh = 5*s;   irisR = 3.5*s; break;
      case 'almond':     ew = 7*s;   eh = 4*s;   irisR = 3*s;   break;
      case 'wide':       ew = 7.5*s; eh = 5.5*s; irisR = 4*s;   break;
      case 'narrow':     ew = 6.5*s; eh = 3*s;   irisR = 2.5*s; break;
      case 'upturned':   ew = 6.5*s; eh = 4.5*s; irisR = 3.2*s; break;
      case 'downturned': ew = 6.5*s; eh = 4.5*s; irisR = 3.2*s; break;
      case 'monolid':    ew = 6.5*s; eh = 3.2*s; irisR = 2.8*s; break;
      default:           ew = 6*s;   eh = 5*s;   irisR = 3.5*s;
    }

    const skinH = dims.skinHex || '#6B4226';

    for (const side of [-1, 1]) {
      const ex = cx + side * eyeSpacing;

      if (shape === 'upturned') {
        ctx.save();
        ctx.translate(ex, eyeY);
        ctx.rotate(side * -0.1);
        drawNaturalEye(ctx, 0, 0, ew, eh, irisR, ec, skinH, s);
        ctx.restore();
      } else if (shape === 'downturned') {
        ctx.save();
        ctx.translate(ex, eyeY);
        ctx.rotate(side * 0.1);
        drawNaturalEye(ctx, 0, 0, ew, eh, irisR, ec, skinH, s);
        ctx.restore();
      } else {
        drawNaturalEye(ctx, ex, eyeY, ew, eh, irisR, ec, skinH, s);
      }
    }
    ctx.restore();
  }

  // ── Eyebrows ────────────────────────────────────────────────
  function drawEyebrows(ctx, face, dims) {
    ctx.save();
    const { cx, s, browY, eyeSpacing } = dims;
    const style = face.eyebrowStyle || 'thick_straight';
    const color = face.eyebrowColor || '#1c1410';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';

    for (const side of [-1, 1]) {
      const bx = cx + side * eyeSpacing;

      switch (style) {
        case 'thick_straight':
          ctx.lineWidth = 3*s;
          ctx.beginPath();
          ctx.moveTo(bx - 7*s, browY);
          ctx.lineTo(bx + 7*s, browY);
          ctx.stroke();
          break;

        case 'thin_arched':
          ctx.lineWidth = 1.5*s;
          ctx.beginPath();
          ctx.moveTo(bx - 7*s, browY + 1*s);
          ctx.quadraticCurveTo(bx, browY - 4*s, bx + 7*s, browY + 1*s);
          ctx.stroke();
          break;

        case 'bushy':
          ctx.lineWidth = 4*s;
          ctx.beginPath();
          ctx.moveTo(bx - 8*s, browY);
          ctx.quadraticCurveTo(bx, browY - 2*s, bx + 8*s, browY + 1*s);
          ctx.stroke();
          // Extra texture strokes
          ctx.lineWidth = 1*s;
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(bx - 6*s, browY - 1.5*s);
          ctx.lineTo(bx + 5*s, browY - 2*s);
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;

        case 'flat':
          ctx.lineWidth = 2.5*s;
          ctx.beginPath();
          ctx.moveTo(bx - 7*s, browY);
          ctx.lineTo(bx + 7*s, browY);
          ctx.stroke();
          break;

        case 'high_arch':
          ctx.lineWidth = 2*s;
          ctx.beginPath();
          ctx.moveTo(bx - 7*s, browY + 2*s);
          ctx.quadraticCurveTo(bx - 1*s, browY - 5*s, bx + 7*s, browY);
          ctx.stroke();
          break;

        case 'rounded':
          ctx.lineWidth = 2.5*s;
          ctx.beginPath();
          ctx.moveTo(bx - 7*s, browY + 1*s);
          ctx.quadraticCurveTo(bx, browY - 3*s, bx + 7*s, browY + 1*s);
          ctx.stroke();
          break;

        case 'feathered':
          ctx.lineWidth = 1*s;
          // Multiple short strokes for feathered look
          for (let i = -6; i <= 6; i += 2) {
            ctx.beginPath();
            ctx.moveTo(bx + i*s, browY + 1*s);
            ctx.lineTo(bx + (i+1)*s, browY - 2*s);
            ctx.stroke();
          }
          break;
      }
    }
    ctx.restore();
  }

  // ── Eyelashes ───────────────────────────────────────────────
  function drawEyelashes(ctx, face, dims) {
    const style = face.eyelashStyle || 'none';
    if (style === 'none') return;
    ctx.save();
    const { cx, s, eyeY, eyeSpacing } = dims;
    const shape = face.eyeShape || 'round';
    const color = face.eyelashColor || '#1c1410';
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';

    // Get eye width for this shape to scale lashes correctly
    let ew;
    switch (shape) {
      case 'round':      ew = 5.5*s; break;
      case 'almond':     ew = 6.5*s; break;
      case 'wide':       ew = 7*s;   break;
      case 'narrow':     ew = 6*s;   break;
      case 'upturned':   ew = 6*s;   break;
      case 'downturned': ew = 6*s;   break;
      case 'monolid':    ew = 6*s;   break;
      default:           ew = 5.5*s;
    }

    // Style determines thickness and outer flick length
    let lw, flick;
    switch (style) {
      case 'short':    lw = 1.2*s; flick = 1.5*s; break;
      case 'medium':   lw = 1.5*s; flick = 2.5*s; break;
      case 'long':     lw = 1.8*s; flick = 3.5*s; break;
      case 'dramatic': lw = 2.2*s; flick = 4.5*s; break;
      default:         lw = 1.2*s; flick = 1.5*s;
    }
    ctx.lineWidth = lw;

    for (const side of [-1, 1]) {
      const ex = cx + side * eyeSpacing;
      // Draw a curved lash line along the upper eyelid — above the eye white
      var lashY = eyeY - eh - 1*s;
      ctx.beginPath();
      ctx.moveTo(ex - ew*0.9, lashY + 2*s);
      ctx.quadraticCurveTo(ex, lashY - 1*s, ex + ew*0.9, lashY + 2*s);
      ctx.stroke();
      // Outer corner flick — curls upward and outward
      ctx.beginPath();
      ctx.moveTo(ex + side * ew*0.8, lashY + 1.5*s);
      ctx.quadraticCurveTo(ex + side * (ew + flick*0.3), lashY, ex + side * (ew + flick*0.2), lashY - flick);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Nose ────────────────────────────────────────────────────
  function drawNose(ctx, face, dims) {
    ctx.save();
    const { cx, s, noseY } = dims;
    const style = face.noseStyle || 'wide';
    const lineC = faceLineColor(dims.skinHex || '#6B4226');
    ctx.strokeStyle = lineC;
    ctx.fillStyle = lineC;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (style) {
      case 'button':
        ctx.lineWidth = 1.5*s;
        ctx.beginPath();
        ctx.arc(cx, noseY, 3*s, 0, Math.PI*2);
        ctx.stroke();
        break;

      case 'wide':
        // Prominent wide nose — nostril wings + bridge
        ctx.lineWidth = 1.8*s;
        // Bridge hint
        ctx.beginPath();
        ctx.moveTo(cx, noseY - 5*s);
        ctx.lineTo(cx, noseY - 1*s);
        ctx.stroke();
        // Nostril wings
        ctx.beginPath();
        ctx.moveTo(cx - 5*s, noseY + 1*s);
        ctx.quadraticCurveTo(cx - 6*s, noseY - 2*s, cx, noseY - 1*s);
        ctx.quadraticCurveTo(cx + 6*s, noseY - 2*s, cx + 5*s, noseY + 1*s);
        ctx.stroke();
        // Nostril dots
        ctx.fillStyle = lineC;
        ctx.beginPath(); ctx.arc(cx - 3*s, noseY, 1.2*s, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 3*s, noseY, 1.2*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'narrow':
        ctx.lineWidth = 1.5*s;
        ctx.beginPath();
        ctx.moveTo(cx, noseY - 5*s);
        ctx.lineTo(cx - 2*s, noseY + 1*s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, noseY - 5*s);
        ctx.lineTo(cx + 2*s, noseY + 1*s);
        ctx.stroke();
        break;

      case 'rounded':
        ctx.lineWidth = 1.5*s;
        ctx.beginPath();
        ctx.arc(cx, noseY - 1*s, 4*s, 0.3*Math.PI, 0.7*Math.PI);
        ctx.stroke();
        // Nostrils
        ctx.beginPath(); ctx.arc(cx - 2.5*s, noseY + 0.5*s, 1*s, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 2.5*s, noseY + 0.5*s, 1*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'flat_bridge':
        // Flat bridge, wide base — African feature
        ctx.lineWidth = 2*s;
        // Wide flat bridge
        ctx.beginPath();
        ctx.moveTo(cx - 3*s, noseY - 6*s);
        ctx.lineTo(cx - 3*s, noseY - 1*s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 3*s, noseY - 6*s);
        ctx.lineTo(cx + 3*s, noseY - 1*s);
        ctx.stroke();
        // Wide nostrils
        ctx.beginPath();
        ctx.moveTo(cx - 5*s, noseY + 1*s);
        ctx.quadraticCurveTo(cx, noseY + 3*s, cx + 5*s, noseY + 1*s);
        ctx.stroke();
        break;

      case 'pointed':
        ctx.lineWidth = 1.5*s;
        ctx.beginPath();
        ctx.moveTo(cx - 3*s, noseY + 1*s);
        ctx.lineTo(cx, noseY - 4*s);
        ctx.lineTo(cx + 3*s, noseY + 1*s);
        ctx.stroke();
        break;

      case 'upturned':
        ctx.lineWidth = 1.5*s;
        ctx.beginPath();
        ctx.moveTo(cx - 3*s, noseY + 1*s);
        ctx.quadraticCurveTo(cx, noseY - 3*s, cx + 3*s, noseY + 1*s);
        ctx.stroke();
        // Nostrils visible from below
        ctx.beginPath(); ctx.arc(cx - 2*s, noseY + 1.5*s, 1*s, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 2*s, noseY + 1.5*s, 1*s, 0, Math.PI*2); ctx.fill();
        break;
    }
    ctx.restore();
  }

  // ── Mouth ───────────────────────────────────────────────────
  function drawMouth(ctx, face, dims) {
    ctx.save();
    const { cx, s, mouthY } = dims;
    const style = face.mouthStyle || 'smile';
    const lineC = faceLineColor(dims.skinHex || '#6B4226');
    // Natural lip color: slightly deeper and rosier than skin
    const skinH = dims.skinHex || '#6B4226';
    const lr = parseInt(skinH.slice(1,3),16), lg = parseInt(skinH.slice(3,5),16), lb = parseInt(skinH.slice(5,7),16);
    const lipColor = '#' + ((1<<24) + (Math.max(0, Math.round(lr*0.85 + 20))<<16) + (Math.max(0, Math.round(lg*0.72))<<8) + Math.max(0, Math.round(lb*0.7))).toString(16).slice(1);
    ctx.lineCap = 'round';

    switch (style) {
      case 'smile':
        // Full-lipped small smile
        // Upper lip
        ctx.fillStyle = lipColor;
        ctx.beginPath();
        ctx.moveTo(cx - 7*s, mouthY);
        ctx.quadraticCurveTo(cx - 3*s, mouthY - 2.5*s, cx, mouthY - 1*s);
        ctx.quadraticCurveTo(cx + 3*s, mouthY - 2.5*s, cx + 7*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 1.5*s, cx - 7*s, mouthY);
        ctx.fill();
        // Lower lip
        ctx.fillStyle = lighten(lipColor, 0.08);
        ctx.beginPath();
        ctx.moveTo(cx - 7*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 6*s, cx + 7*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 1.5*s, cx - 7*s, mouthY);
        ctx.fill();
        // Lip line
        ctx.strokeStyle = lineC;
        ctx.lineWidth = 1*s;
        ctx.beginPath();
        ctx.moveTo(cx - 7*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 3*s, cx + 7*s, mouthY);
        ctx.stroke();
        break;

      case 'big_smile':
        // Full lips, wide smile showing teeth
        ctx.fillStyle = lipColor;
        ctx.beginPath();
        ctx.moveTo(cx - 9*s, mouthY);
        ctx.quadraticCurveTo(cx - 4*s, mouthY - 3*s, cx, mouthY - 1.5*s);
        ctx.quadraticCurveTo(cx + 4*s, mouthY - 3*s, cx + 9*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 2*s, cx - 9*s, mouthY);
        ctx.fill();
        // Teeth area
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(cx - 7*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 2*s, cx + 7*s, mouthY);
        ctx.lineTo(cx + 7*s, mouthY + 1*s);
        ctx.quadraticCurveTo(cx, mouthY - 0.5*s, cx - 7*s, mouthY + 1*s);
        ctx.fill();
        // Lower lip
        ctx.fillStyle = lighten(lipColor, 0.08);
        ctx.beginPath();
        ctx.moveTo(cx - 9*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 8*s, cx + 9*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 2*s, cx - 9*s, mouthY);
        ctx.fill();
        break;

      case 'grin':
        // Wide open grin showing teeth
        ctx.fillStyle = '#4a1a1a';
        ctx.beginPath();
        ctx.moveTo(cx - 10*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 10*s, cx + 10*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY - 2*s, cx - 10*s, mouthY);
        ctx.fill();
        // Teeth
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(cx - 8*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 4*s, cx + 8*s, mouthY);
        ctx.lineTo(cx + 8*s, mouthY + 1.5*s);
        ctx.quadraticCurveTo(cx, mouthY, cx - 8*s, mouthY + 1.5*s);
        ctx.fill();
        // Lip outline
        ctx.strokeStyle = lipColor;
        ctx.lineWidth = 1.5*s;
        ctx.beginPath();
        ctx.moveTo(cx - 10*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 10*s, cx + 10*s, mouthY);
        ctx.stroke();
        break;

      case 'smirk':
        ctx.fillStyle = lipColor;
        // Asymmetric — one side up
        ctx.beginPath();
        ctx.moveTo(cx - 6*s, mouthY + 1*s);
        ctx.quadraticCurveTo(cx, mouthY + 2*s, cx + 8*s, mouthY - 3*s);
        ctx.quadraticCurveTo(cx, mouthY + 5*s, cx - 6*s, mouthY + 1*s);
        ctx.fill();
        ctx.strokeStyle = lineC;
        ctx.lineWidth = 1*s;
        ctx.beginPath();
        ctx.moveTo(cx - 6*s, mouthY + 1*s);
        ctx.quadraticCurveTo(cx + 2*s, mouthY + 3*s, cx + 8*s, mouthY - 3*s);
        ctx.stroke();
        break;

      case 'neutral':
        // Relaxed full lips
        ctx.fillStyle = lipColor;
        // Upper
        ctx.beginPath();
        ctx.moveTo(cx - 6*s, mouthY);
        ctx.quadraticCurveTo(cx - 2*s, mouthY - 2*s, cx, mouthY - 0.5*s);
        ctx.quadraticCurveTo(cx + 2*s, mouthY - 2*s, cx + 6*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 1*s, cx - 6*s, mouthY);
        ctx.fill();
        // Lower
        ctx.fillStyle = lighten(lipColor, 0.06);
        ctx.beginPath();
        ctx.moveTo(cx - 6*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 5*s, cx + 6*s, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + 1*s, cx - 6*s, mouthY);
        ctx.fill();
        break;

      case 'surprised':
        // Open O mouth
        ctx.fillStyle = '#4a1a1a';
        ctx.beginPath();
        ctx.ellipse(cx, mouthY + 1*s, 5*s, 5*s, 0, 0, Math.PI*2);
        ctx.fill();
        // Lip ring
        ctx.strokeStyle = lipColor;
        ctx.lineWidth = 2*s;
        ctx.beginPath();
        ctx.ellipse(cx, mouthY + 1*s, 6*s, 6*s, 0, 0, Math.PI*2);
        ctx.stroke();
        break;

      case 'pout':
        // Pouty full lips — pushed out
        ctx.fillStyle = lipColor;
        // Upper (with cupid's bow)
        ctx.beginPath();
        ctx.moveTo(cx - 7*s, mouthY + 1*s);
        ctx.quadraticCurveTo(cx - 3*s, mouthY - 3*s, cx, mouthY - 1*s);
        ctx.quadraticCurveTo(cx + 3*s, mouthY - 3*s, cx + 7*s, mouthY + 1*s);
        ctx.quadraticCurveTo(cx, mouthY + 2.5*s, cx - 7*s, mouthY + 1*s);
        ctx.fill();
        // Lower (bigger for pout)
        ctx.fillStyle = lighten(lipColor, 0.1);
        ctx.beginPath();
        ctx.moveTo(cx - 7*s, mouthY + 1*s);
        ctx.quadraticCurveTo(cx, mouthY + 8*s, cx + 7*s, mouthY + 1*s);
        ctx.quadraticCurveTo(cx, mouthY + 2.5*s, cx - 7*s, mouthY + 1*s);
        ctx.fill();
        // Center line
        ctx.strokeStyle = darken(lipColor, 0.15);
        ctx.lineWidth = 0.8*s;
        ctx.beginPath();
        ctx.moveTo(cx - 6*s, mouthY + 1*s);
        ctx.lineTo(cx + 6*s, mouthY + 1*s);
        ctx.stroke();
        break;
    }
    ctx.restore();
  }

  // ── Ears ────────────────────────────────────────────────────
  function drawEars(ctx, face, skinHex, dims) {
    ctx.save();
    const { cx, s } = dims;
    const style = face.earStyle || 'default';
    ctx.fillStyle = skinHex;

    let ew, eh;
    switch (style) {
      case 'small':   ew = 5*s;  eh = 6*s;  break;
      case 'large':   ew = 8*s;  eh = 11*s; break;
      case 'pointed': ew = 6*s;  eh = 10*s; break;
      default:        ew = 6*s;  eh = 8*s;
    }

    const earY = 68*s;

    if (style === 'pointed') {
      // Left pointed ear
      ctx.beginPath();
      ctx.moveTo(cx - 30*s, earY + eh/2);
      ctx.lineTo(cx - 30*s - ew, earY - eh*0.6);
      ctx.lineTo(cx - 30*s + 2*s, earY - eh/2);
      ctx.closePath();
      ctx.fill();
      // Right
      ctx.beginPath();
      ctx.moveTo(cx + 30*s, earY + eh/2);
      ctx.lineTo(cx + 30*s + ew, earY - eh*0.6);
      ctx.lineTo(cx + 30*s - 2*s, earY - eh/2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(cx - 30*s, earY, ew, eh, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 30*s, earY, ew, eh, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // Inner ear detail
    ctx.fillStyle = darken(skinHex, 0.1);
    const iw = ew*0.5, ih = eh*0.5;
    if (style !== 'pointed') {
      ctx.beginPath(); ctx.ellipse(cx - 30*s, earY, iw, ih, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 30*s, earY, iw, ih, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // ── Simple Face (≤32px) ─────────────────────────────────────
  function drawFaceSimple(ctx, dims) {
    ctx.save();
    const { cx, s } = dims;
    const lineC = faceLineColor(dims.skinHex || '#6B4226');
    // Two dots for eyes
    ctx.fillStyle = '#1c1410';
    ctx.beginPath(); ctx.arc(cx - 4*s, 64*s, 1.8*s, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 4*s, 64*s, 1.8*s, 0, Math.PI*2); ctx.fill();
    // Small arc for smile
    ctx.strokeStyle = lineC;
    ctx.lineWidth = 1.2*s;
    ctx.beginPath();
    ctx.moveTo(cx - 4*s, 76*s);
    ctx.quadraticCurveTo(cx, 80*s, cx + 4*s, 76*s);
    ctx.stroke();
    ctx.restore();
  }

  return {
    drawEyes,
    drawEyebrows,
    drawEyelashes,
    drawNose,
    drawMouth,
    drawEars,
    drawFaceSimple,
    faceLineColor,
    darken,
    lighten,
  };
})();
