/* ============================================================
   ODA World — Shoe Renderer (V3)
   8 shoe types with color + accent customization.
   ============================================================ */

const ODA_SHOES = (() => {

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

  function drawShoes(ctx, shoeConfig, cx, s) {
    const type = shoeConfig.type || 'shoe_sneakers';
    const color = shoeConfig.color || '#2c3e50';
    const accent = shoeConfig.accentColor || '#e74c3c';
    const shoeY = 204*s;

    ctx.save();

    switch (type) {
      case 'shoe_sneakers':
        // Classic low-top sneaker shape
        ctx.fillStyle = color;
        roundRect(ctx, cx - 20*s, shoeY, 18*s, 10*s, 4*s); ctx.fill();
        roundRect(ctx, cx + 2*s, shoeY, 18*s, 10*s, 4*s); ctx.fill();
        // Sole
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(cx - 20*s, shoeY + 7*s, 18*s, 3*s);
        ctx.fillRect(cx + 2*s, shoeY + 7*s, 18*s, 3*s);
        // Accent swoosh
        ctx.strokeStyle = accent; ctx.lineWidth = 1.5*s;
        ctx.beginPath(); ctx.moveTo(cx - 17*s, shoeY + 5*s); ctx.quadraticCurveTo(cx - 11*s, shoeY + 2*s, cx - 4*s, shoeY + 4*s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 5*s, shoeY + 5*s); ctx.quadraticCurveTo(cx + 11*s, shoeY + 2*s, cx + 18*s, shoeY + 4*s); ctx.stroke();
        break;

      case 'shoe_jordans':
        // High-top Jordan silhouette — slightly taller
        ctx.fillStyle = color;
        roundRect(ctx, cx - 21*s, shoeY - 4*s, 19*s, 14*s, 4*s); ctx.fill();
        roundRect(ctx, cx + 2*s, shoeY - 4*s, 19*s, 14*s, 4*s); ctx.fill();
        // Ankle collar
        ctx.fillStyle = accent;
        roundRect(ctx, cx - 19*s, shoeY - 4*s, 15*s, 5*s, 3*s); ctx.fill();
        roundRect(ctx, cx + 4*s, shoeY - 4*s, 15*s, 5*s, 3*s); ctx.fill();
        // Sole
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(cx - 21*s, shoeY + 7*s, 19*s, 3*s);
        ctx.fillRect(cx + 2*s, shoeY + 7*s, 19*s, 3*s);
        // Jump man silhouette (simplified dot)
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(cx - 11*s, shoeY + 2*s, 2*s, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 11*s, shoeY + 2*s, 2*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'shoe_hightops':
        // High-top converse style
        ctx.fillStyle = color;
        roundRect(ctx, cx - 20*s, shoeY - 6*s, 18*s, 16*s, 4*s); ctx.fill();
        roundRect(ctx, cx + 2*s, shoeY - 6*s, 18*s, 16*s, 4*s); ctx.fill();
        // Toe cap
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, cx - 20*s, shoeY + 4*s, 7*s, 6*s, 3*s); ctx.fill();
        roundRect(ctx, cx + 13*s, shoeY + 4*s, 7*s, 6*s, 3*s); ctx.fill();
        // Sole
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(cx - 20*s, shoeY + 7*s, 18*s, 3*s);
        ctx.fillRect(cx + 2*s, shoeY + 7*s, 18*s, 3*s);
        // Circle logo
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(cx - 15*s, shoeY - 1*s, 2.5*s, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 7*s, shoeY - 1*s, 2.5*s, 0, Math.PI*2); ctx.fill();
        break;

      case 'shoe_slides':
        // Open-back slides / sandals
        ctx.fillStyle = color;
        // Foot base
        roundRect(ctx, cx - 19*s, shoeY + 2*s, 17*s, 8*s, 3*s); ctx.fill();
        roundRect(ctx, cx + 2*s, shoeY + 2*s, 17*s, 8*s, 3*s); ctx.fill();
        // Strap across top
        ctx.fillStyle = accent;
        ctx.fillRect(cx - 17*s, shoeY + 1*s, 14*s, 5*s);
        ctx.fillRect(cx + 3*s, shoeY + 1*s, 14*s, 5*s);
        // Sole line
        ctx.fillStyle = darken(color, 0.2);
        ctx.fillRect(cx - 19*s, shoeY + 8*s, 17*s, 2*s);
        ctx.fillRect(cx + 2*s, shoeY + 8*s, 17*s, 2*s);
        break;

      case 'shoe_boots':
        // Tall boots — taller than other shoes
        ctx.fillStyle = color;
        roundRect(ctx, cx - 20*s, shoeY - 10*s, 18*s, 20*s, 4*s); ctx.fill();
        roundRect(ctx, cx + 2*s, shoeY - 10*s, 18*s, 20*s, 4*s); ctx.fill();
        // Thick sole
        ctx.fillStyle = darken(color, 0.3);
        ctx.fillRect(cx - 21*s, shoeY + 7*s, 20*s, 4*s);
        ctx.fillRect(cx + 1*s, shoeY + 7*s, 20*s, 4*s);
        // Lace holes
        ctx.fillStyle = accent;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.arc(cx - 11*s, shoeY - 6*s + i*5*s, 1*s, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(cx + 11*s, shoeY - 6*s + i*5*s, 1*s, 0, Math.PI*2); ctx.fill();
        }
        break;

      case 'shoe_crocs':
        // Rounded chunky crocs
        ctx.fillStyle = color;
        // Rounded bulky shape
        ctx.beginPath(); ctx.ellipse(cx - 11*s, shoeY + 4*s, 11*s, 6*s, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + 11*s, shoeY + 4*s, 11*s, 6*s, 0, 0, Math.PI*2); ctx.fill();
        // Holes
        ctx.fillStyle = darken(color, 0.15);
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.arc(cx - 11*s + i*5*s, shoeY + 2*s, 1.5*s, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(cx + 11*s + i*5*s, shoeY + 2*s, 1.5*s, 0, Math.PI*2); ctx.fill();
        }
        // Strap
        ctx.fillStyle = accent;
        ctx.fillRect(cx - 19*s, shoeY - 1*s, 4*s, 3*s);
        ctx.fillRect(cx + 15*s, shoeY - 1*s, 4*s, 3*s);
        break;

      case 'shoe_running':
        // Sleek running shoe
        ctx.fillStyle = color;
        // Lower profile, elongated
        ctx.beginPath();
        ctx.moveTo(cx - 21*s, shoeY + 3*s);
        ctx.lineTo(cx - 18*s, shoeY - 1*s);
        ctx.lineTo(cx - 3*s, shoeY - 1*s);
        ctx.lineTo(cx - 2*s, shoeY + 3*s);
        ctx.quadraticCurveTo(cx - 11*s, shoeY + 10*s, cx - 21*s, shoeY + 8*s);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + 1*s, shoeY + 3*s);
        ctx.lineTo(cx + 4*s, shoeY - 1*s);
        ctx.lineTo(cx + 19*s, shoeY - 1*s);
        ctx.lineTo(cx + 20*s, shoeY + 3*s);
        ctx.quadraticCurveTo(cx + 11*s, shoeY + 10*s, cx + 1*s, shoeY + 8*s);
        ctx.closePath(); ctx.fill();
        // Accent stripe
        ctx.strokeStyle = accent; ctx.lineWidth = 2*s;
        ctx.beginPath(); ctx.moveTo(cx - 18*s, shoeY + 1*s); ctx.lineTo(cx - 6*s, shoeY + 4*s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 4*s, shoeY + 1*s); ctx.lineTo(cx + 16*s, shoeY + 4*s); ctx.stroke();
        // Sole
        ctx.fillStyle = lighten(color, 0.3);
        ctx.fillRect(cx - 21*s, shoeY + 7*s, 19*s, 2*s);
        ctx.fillRect(cx + 1*s, shoeY + 7*s, 19*s, 2*s);
        break;

      case 'shoe_platform':
        // Platform sneaker — thick sole
        ctx.fillStyle = color;
        roundRect(ctx, cx - 20*s, shoeY - 2*s, 18*s, 10*s, 4*s); ctx.fill();
        roundRect(ctx, cx + 2*s, shoeY - 2*s, 18*s, 10*s, 4*s); ctx.fill();
        // Thick platform sole
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(cx - 21*s, shoeY + 5*s, 20*s, 6*s);
        ctx.fillRect(cx + 1*s, shoeY + 5*s, 20*s, 6*s);
        // Accent line on sole
        ctx.fillStyle = accent;
        ctx.fillRect(cx - 21*s, shoeY + 7*s, 20*s, 2*s);
        ctx.fillRect(cx + 1*s, shoeY + 7*s, 20*s, 2*s);
        break;

      default:
        // Fallback to sneakers
        ctx.fillStyle = color;
        roundRect(ctx, cx - 20*s, shoeY, 18*s, 10*s, 4*s); ctx.fill();
        roundRect(ctx, cx + 2*s, shoeY, 18*s, 10*s, 4*s); ctx.fill();
        ctx.fillStyle = darken(color, 0.25);
        ctx.fillRect(cx - 20*s, shoeY + 7*s, 18*s, 3*s);
        ctx.fillRect(cx + 2*s, shoeY + 7*s, 18*s, 3*s);
    }

    ctx.restore();
  }

  return { drawShoes };
})();
