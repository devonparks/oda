/* ============================================================
   ODA World — Outfit Renderer (V3)
   Garment drawing, sleeve rendering, pattern overlays.
   ============================================================ */

const ODA_OUTFIT = (() => {

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

  // ── Pattern Overlay ─────────────────────────────────────────
  function drawPattern(ctx, pattern, primary, secondary, x, y, w, h, s) {
    if (!pattern || pattern === 'solid') return;
    ctx.save();
    ctx.globalAlpha = 0.35;

    switch (pattern) {
      case 'striped':
        ctx.strokeStyle = secondary;
        ctx.lineWidth = 2*s;
        for (let i = y; i < y+h; i += 6*s) {
          ctx.beginPath(); ctx.moveTo(x, i); ctx.lineTo(x+w, i); ctx.stroke();
        }
        break;

      case 'camo':
        ctx.fillStyle = darken(primary, 0.15);
        for (let i = 0; i < 8; i++) {
          const cx2 = x + (i%3)*w/3 + 4*s;
          const cy2 = y + Math.floor(i/3)*h/3 + 4*s;
          ctx.beginPath(); ctx.ellipse(cx2, cy2, 6*s, 4*s, i*0.5, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = lighten(primary, 0.1);
        for (let i = 0; i < 5; i++) {
          const cx2 = x + (i%2)*w/2 + w/4;
          const cy2 = y + Math.floor(i/2)*h/3 + h/6;
          ctx.beginPath(); ctx.ellipse(cx2, cy2, 5*s, 3*s, i*0.8, 0, Math.PI*2); ctx.fill();
        }
        break;

      case 'plaid':
        ctx.strokeStyle = secondary;
        ctx.lineWidth = 1.5*s;
        for (let i = x; i < x+w; i += 8*s) {
          ctx.beginPath(); ctx.moveTo(i, y); ctx.lineTo(i, y+h); ctx.stroke();
        }
        for (let i = y; i < y+h; i += 8*s) {
          ctx.beginPath(); ctx.moveTo(x, i); ctx.lineTo(x+w, i); ctx.stroke();
        }
        ctx.strokeStyle = lighten(secondary, 0.3);
        ctx.lineWidth = 0.8*s;
        for (let i = x+4*s; i < x+w; i += 8*s) {
          ctx.beginPath(); ctx.moveTo(i, y); ctx.lineTo(i, y+h); ctx.stroke();
        }
        break;

      case 'polka':
        ctx.fillStyle = secondary;
        for (let row = 0; row < Math.ceil(h/(8*s)); row++) {
          for (let col = 0; col < Math.ceil(w/(8*s)); col++) {
            const dx = x + col*8*s + (row%2 ? 4*s : 0) + 4*s;
            const dy = y + row*8*s + 4*s;
            if (dx < x+w && dy < y+h) {
              ctx.beginPath(); ctx.arc(dx, dy, 1.5*s, 0, Math.PI*2); ctx.fill();
            }
          }
        }
        break;

      case 'tiedye':
        for (let i = 0; i < 6; i++) {
          const colors = [primary, secondary, lighten(primary, 0.2), darken(secondary, 0.2)];
          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath();
          ctx.ellipse(x + w*Math.random(), y + h*Math.random(), 12*s, 8*s, Math.random()*Math.PI, 0, Math.PI*2);
          ctx.fill();
        }
        break;

      case 'oda_logo':
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = secondary;
        ctx.font = 'bold ' + (8*s) + 'px Outfit,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ODA', x + w/2, y + h*0.45);
        break;
    }
    ctx.restore();
  }

  // ── Sleeves ─────────────────────────────────────────────────
  function drawSleeves(ctx, cx, top, sw, s, color, type) {
    if (type === 'none') return;
    ctx.save();
    ctx.fillStyle = color;
    const sleeveLen = type === 'long' ? 36*s : 16*s;
    // Left sleeve
    ctx.beginPath();
    ctx.moveTo(cx - sw/2, top);
    ctx.lineTo(cx - sw/2 - 12*s, top + 6*s);
    ctx.lineTo(cx - sw/2 - 12*s, top + sleeveLen);
    ctx.lineTo(cx - sw/2, top + sleeveLen - 4*s);
    ctx.fill();
    // Right sleeve
    ctx.beginPath();
    ctx.moveTo(cx + sw/2, top);
    ctx.lineTo(cx + sw/2 + 12*s, top + 6*s);
    ctx.lineTo(cx + sw/2 + 12*s, top + sleeveLen);
    ctx.lineTo(cx + sw/2, top + sleeveLen - 4*s);
    ctx.fill();
    ctx.restore();
  }

  // ── Hood (behind head) ──────────────────────────────────────
  function drawHoodBack(ctx, cx, s, color) {
    ctx.save();
    ctx.fillStyle = darken(color, 0.08);
    ctx.beginPath();
    ctx.ellipse(cx, 50*s, 34*s, 26*s, 0, Math.PI, Math.PI*2);
    ctx.fill();
    ctx.fillRect(cx - 34*s, 50*s, 68*s, 20*s);
    ctx.restore();
  }

  // ── Skirt (below torso) ─────────────────────────────────────
  function drawSkirt(ctx, cx, s, color, bd) {
    ctx.save();
    ctx.fillStyle = color;
    const skirtTop = 96*s + bd.bh*s;
    const skirtLen = 36*s;
    ctx.beginPath();
    ctx.moveTo(cx - bd.hipW/2*s - 4*s, skirtTop);
    ctx.lineTo(cx + bd.hipW/2*s + 4*s, skirtTop);
    ctx.lineTo(cx + bd.hipW/2*s + 12*s, skirtTop + skirtLen);
    ctx.lineTo(cx - bd.hipW/2*s - 12*s, skirtTop + skirtLen);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── Main Outfit Draw ────────────────────────────────────────
  function drawOutfit(ctx, config, gender, skinHex, bd, cx, s) {
    const garmentId = config.garment;
    const garment = ODA_PARTS.find(ODA_PARTS.GARMENTS, garmentId);
    if (!garment) return;

    const pc = config.primaryColor || '#7c3aed';
    const sc = config.secondaryColor || '#6929c4';
    const pattern = config.pattern || 'solid';
    const top = 96*s;
    const sw = bd.shoulderW*s;
    const ww = bd.waistW*s;
    const hw = bd.hipW*s;
    const bh = bd.bh*s;

    ctx.save();

    // Neck
    ctx.fillStyle = skinHex;
    ctx.fillRect(cx - 8*s, 88*s, 16*s, 14*s);

    // Torso shape
    ctx.fillStyle = pc;
    ctx.beginPath();
    ctx.moveTo(cx - sw/2, top);
    ctx.lineTo(cx + sw/2, top);
    ctx.lineTo(cx + ww/2, top + bh*0.5);
    ctx.lineTo(cx + hw/2, top + bh);
    ctx.lineTo(cx - hw/2, top + bh);
    ctx.lineTo(cx - ww/2, top + bh*0.5);
    ctx.closePath();
    ctx.fill();

    // Pattern overlay on torso
    drawPattern(ctx, pattern, pc, sc, cx - sw/2, top, sw, bh, s);

    // Garment-specific details
    const gid = garmentId;
    const sleeveType = garment.sleeve || 'short';

    if (garment.hood) {
      // Hoodie / Zip-Up
      drawSleeves(ctx, cx, top, sw, s, pc, 'long');
      // Kangaroo pocket
      ctx.fillStyle = darken(pc, 0.08);
      roundRect(ctx, cx - 14*s, top + bh*0.55, 28*s, 12*s, 4*s);
      ctx.fill();
      // Drawstrings
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1*s;
      ctx.beginPath(); ctx.moveTo(cx - 3*s, top + 2*s); ctx.lineTo(cx - 4*s, top + 16*s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 3*s, top + 2*s); ctx.lineTo(cx + 4*s, top + 16*s); ctx.stroke();
      // Zip-up zipper
      if (gid === 'gar_zipup') {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5*s;
        ctx.beginPath(); ctx.moveTo(cx, top + 4*s); ctx.lineTo(cx, top + bh - 4*s); ctx.stroke();
      }
    } else if (gid === 'gar_jersey') {
      drawSleeves(ctx, cx, top, sw, s, skinHex, 'none');
      // Number
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = 'bold ' + (16*s) + 'px Space Mono,monospace';
      ctx.textAlign = 'center';
      ctx.fillText('1', cx, top + bh*0.5);
      // Accent stripe
      ctx.fillStyle = sc;
      ctx.fillRect(cx - sw/2, top + bh - 6*s, sw, 4*s);
    } else if (gid === 'gar_varsity') {
      drawSleeves(ctx, cx, top, sw, s, sc, 'long');
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5*s;
      ctx.beginPath(); ctx.moveTo(cx, top + 4*s); ctx.lineTo(cx, top + bh - 4*s); ctx.stroke();
      ctx.fillStyle = sc;
      roundRect(ctx, cx - 12*s, top - 2*s, 24*s, 6*s, 3*s);
      ctx.fill();
    } else if (gid === 'gar_polo' || gid === 'gar_tee' || gid === 'gar_tee_girl') {
      drawSleeves(ctx, cx, top, sw, s, pc, 'short');
      // Neckline
      ctx.strokeStyle = sc; ctx.lineWidth = 2*s;
      ctx.beginPath();
      ctx.moveTo(cx - 8*s, top);
      ctx.quadraticCurveTo(cx, top + 6*s, cx + 8*s, top);
      ctx.stroke();
      if (gid === 'gar_polo') {
        ctx.fillStyle = sc;
        ctx.beginPath();
        ctx.moveTo(cx - 10*s, top - 2*s);
        ctx.lineTo(cx - 4*s, top + 4*s);
        ctx.lineTo(cx, top);
        ctx.lineTo(cx + 4*s, top + 4*s);
        ctx.lineTo(cx + 10*s, top - 2*s);
        ctx.fill();
      }
    } else if (gid === 'gar_tank_boy' || gid === 'gar_tank_girl') {
      // No sleeves, show straps
      ctx.fillStyle = pc;
      ctx.fillRect(cx - sw/2 + 6*s, top - 2*s, 5*s, 10*s);
      ctx.fillRect(cx + sw/2 - 11*s, top - 2*s, 5*s, 10*s);
    } else if (gid === 'gar_crewneck') {
      drawSleeves(ctx, cx, top, sw + 6, s, pc, 'long');
      ctx.strokeStyle = sc; ctx.lineWidth = 1*s;
      for (let ri = 0; ri < 3; ri++) {
        ctx.beginPath();
        ctx.moveTo(cx - hw/2 + 4*s, top + bh - (ri*3 + 2)*s);
        ctx.lineTo(cx + hw/2 - 4*s, top + bh - (ri*3 + 2)*s);
        ctx.stroke();
      }
      // Crew neck
      ctx.strokeStyle = sc; ctx.lineWidth = 3*s;
      ctx.beginPath();
      ctx.moveTo(cx - 8*s, top + 2*s);
      ctx.quadraticCurveTo(cx, top + 5*s, cx + 8*s, top + 2*s);
      ctx.stroke();
    } else if (gid === 'gar_denim_jacket') {
      drawSleeves(ctx, cx, top, sw, s, pc, 'long');
      // Collar
      ctx.fillStyle = sc;
      ctx.beginPath();
      ctx.moveTo(cx - 2*s, top); ctx.lineTo(cx - 14*s, top + 12*s); ctx.lineTo(cx - 8*s, top + 14*s); ctx.lineTo(cx - 2*s, top + 6*s);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 2*s, top); ctx.lineTo(cx + 14*s, top + 12*s); ctx.lineTo(cx + 8*s, top + 14*s); ctx.lineTo(cx + 2*s, top + 6*s);
      ctx.fill();
      // Center seam
      ctx.strokeStyle = darken(pc, 0.15); ctx.lineWidth = 1*s;
      ctx.beginPath(); ctx.moveTo(cx, top + 14*s); ctx.lineTo(cx, top + bh); ctx.stroke();
    } else if (gid === 'gar_longsleeve') {
      drawSleeves(ctx, cx, top, sw, s, pc, 'long');
      ctx.strokeStyle = sc; ctx.lineWidth = 2*s;
      ctx.beginPath();
      ctx.moveTo(cx - 8*s, top);
      ctx.quadraticCurveTo(cx, top + 6*s, cx + 8*s, top);
      ctx.stroke();
    } else if (gid === 'gar_dress') {
      drawSleeves(ctx, cx, top, sw, s, pc, 'short');
    } else if (gid === 'gar_skirt_top') {
      drawSleeves(ctx, cx, top, sw, s, pc, 'short');
      ctx.fillStyle = sc;
      ctx.fillRect(cx - ww/2 - 2*s, top + bh - 4*s, ww + 4*s, 4*s);
    } else if (gid === 'gar_crop_highwaist') {
      // Shorter torso
      ctx.fillStyle = darken(pc, 0.1);
      ctx.fillRect(cx - ww/2 - 2*s, top + bh*0.6, ww + 4*s, 4*s);
    } else if (gid === 'gar_jumpsuit') {
      drawSleeves(ctx, cx, top, sw, s, pc, 'none');
      ctx.fillStyle = sc;
      ctx.fillRect(cx - ww/2, top + bh*0.5 - 2*s, ww, 5*s);
      ctx.fillStyle = '#ffd166';
      roundRect(ctx, cx - 3*s, top + bh*0.5 - 2*s, 6*s, 5*s, 1*s);
      ctx.fill();
    } else if (gid === 'gar_off_shoulder') {
      // Wide neckline, no straps on shoulders
      ctx.fillStyle = skinHex;
      ctx.fillRect(cx - sw/2, top - 2*s, sw, 8*s);
      ctx.fillStyle = pc;
      ctx.beginPath();
      ctx.moveTo(cx - sw/2 + 8*s, top + 6*s);
      ctx.lineTo(cx + sw/2 - 8*s, top + 6*s);
      ctx.lineTo(cx + ww/2, top + bh*0.5);
      ctx.lineTo(cx + hw/2, top + bh);
      ctx.lineTo(cx - hw/2, top + bh);
      ctx.lineTo(cx - ww/2, top + bh*0.5);
      ctx.closePath();
      ctx.fill();
    } else if (gid === 'gar_cardigan') {
      drawSleeves(ctx, cx, top, sw, s, pc, 'long');
      // Open front
      ctx.strokeStyle = darken(pc, 0.15); ctx.lineWidth = 1.5*s;
      ctx.beginPath(); ctx.moveTo(cx - 2*s, top + 4*s); ctx.lineTo(cx - 2*s, top + bh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 2*s, top + 4*s); ctx.lineTo(cx + 2*s, top + bh); ctx.stroke();
      // Undershirt peek
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(cx - 2*s, top + 4*s, 4*s, bh*0.6);
    } else if (gid === 'gar_overalls') {
      ctx.fillStyle = '#e8e8e8';
      drawSleeves(ctx, cx, top, sw, s, '#e8e8e8', 'short');
      ctx.fillStyle = pc;
      ctx.fillRect(cx - sw/2 + 4*s, top, 8*s, bh*0.4);
      ctx.fillRect(cx + sw/2 - 12*s, top, 8*s, bh*0.4);
      roundRect(ctx, cx - 12*s, top + bh*0.3, 24*s, bh*0.3, 4*s);
      ctx.fill();
      ctx.fillStyle = sc;
      roundRect(ctx, cx - 6*s, top + bh*0.38, 12*s, 8*s, 2*s);
      ctx.fill();
    } else if (gid === 'gar_blazer') {
      drawSleeves(ctx, cx, top, sw, s, pc, 'long');
      ctx.fillStyle = sc;
      ctx.beginPath(); ctx.moveTo(cx - 2*s, top); ctx.lineTo(cx - 14*s, top + 18*s); ctx.lineTo(cx - 6*s, top + 22*s); ctx.lineTo(cx - 2*s, top + 8*s); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 2*s, top); ctx.lineTo(cx + 14*s, top + 18*s); ctx.lineTo(cx + 6*s, top + 22*s); ctx.lineTo(cx + 2*s, top + 8*s); ctx.fill();
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath(); ctx.moveTo(cx - 6*s, top + 22*s); ctx.lineTo(cx, top + 6*s); ctx.lineTo(cx + 6*s, top + 22*s); ctx.fill();
    } else {
      // Default: short sleeve
      drawSleeves(ctx, cx, top, sw, s, pc, sleeveType);
    }

    ctx.restore();
  }

  // ── Arms (skin, drawn AFTER sleeves for correct layering) ──
  function drawArms(ctx, cx, s, skinHex, bd, sleeveType, sleeveColor) {
    const top = 96*s;
    const sw = bd.shoulderW*s;
    const armTop = top + 4*s;
    const armLen = 42*s;

    ctx.save();

    // Draw sleeve OVER arm
    if (sleeveType && sleeveType !== 'none') {
      drawSleeves(ctx, cx, top, sw, s, sleeveColor, sleeveType);
    }

    // Skin arms below sleeves
    ctx.fillStyle = skinHex;
    const sleeveLen = sleeveType === 'long' ? 36*s : sleeveType === 'short' ? 16*s : 0;
    const skinStart = armTop + sleeveLen;
    const skinLen = armLen - sleeveLen;

    if (skinLen > 0) {
      roundRect(ctx, cx - sw/2 - 11*s, skinStart, 11*s, skinLen, 5*s);
      ctx.fill();
      roundRect(ctx, cx + sw/2, skinStart, 11*s, skinLen, 5*s);
      ctx.fill();
    }

    // Hands
    ctx.fillStyle = skinHex;
    ctx.beginPath(); ctx.arc(cx - sw/2 - 5.5*s, armTop + armLen + 2*s, 6*s, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + sw/2 + 5.5*s, armTop + armLen + 2*s, 6*s, 0, Math.PI*2); ctx.fill();

    ctx.restore();
  }

  return {
    drawOutfit,
    drawHoodBack,
    drawSkirt,
    drawArms,
    drawSleeves,
    drawPattern,
    darken,
    roundRect,
  };
})();
