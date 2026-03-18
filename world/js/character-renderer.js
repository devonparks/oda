/**
 * ODA World — Character Renderer v2
 * Drawn faces, gender-aware bodies, distinct outfit silhouettes.
 */

var ODA_RENDER = {};

/**
 * Draw a character on a canvas (front-facing preview).
 */
ODA_RENDER.drawPreview = function (canvas, config, opts) {
  opts = opts || {};
  var size = opts.size || 256;
  canvas.width = size;
  canvas.height = size;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  var skin = ODA_CHAR.find('skinTones', config.skinTone);
  var hair = ODA_CHAR.find('hairStyles', config.hairStyle);
  var hc = ODA_CHAR.find('hairColors', config.hairColor);
  var body = ODA_CHAR.find('bodyTypes', config.bodyType);
  var outfit = ODA_CHAR.find('outfits', config.outfit);
  var expr = ODA_CHAR.find('expressions', config.expression);
  var shoe = ODA_CHAR.find('shoes', config.shoes);
  var gender = config.gender || 'boy';

  var cx = size / 2;
  var s = size / 256;

  // Border glow
  if (opts.border && opts.border !== 'none') {
    ctx.save();
    ctx.shadowColor = opts.border;
    ctx.shadowBlur = 18 * s;
    ctx.beginPath();
    ctx.ellipse(cx, 135 * s, 52 * s, 80 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fill();
    ctx.restore();
  }

  // Shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(cx, 230 * s, 36 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Get body dimensions
  var bd = getBodyDims(body, gender, s);

  // Layer order: shoes, legs, skirt, body, hood, hair-volume, head, face, hair-top
  // Hair volume goes BEHIND the head — the head covers the face/neck naturally
  // Hair top goes AFTER the face — just the crown/top of hair above forehead
  drawShoes(ctx, cx, s, shoe);
  drawLegs(ctx, cx, s, skin, outfit, bd);
  if (outfit.type === 'dress' || outfit.type === 'skirtTop') drawSkirt(ctx, cx, s, outfit, bd);
  drawBody(ctx, cx, s, skin, body, outfit, gender, bd);
  if (outfit.type === 'hoodie') drawHoodBack(ctx, cx, s, outfit, bd);
  drawHairVolume(ctx, cx, s, hair, hc);  // Full hair shape behind head
  drawHead(ctx, cx, s, skin);             // Head covers face/neck area
  drawFace(ctx, cx, s, expr, skin);       // Face drawn on head
  drawHairTop(ctx, cx, s, hair, hc);      // Top of hair above forehead line

  // Name
  if (opts.showName) {
    ctx.save();
    ctx.font = 'bold ' + (13 * s) + 'px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = opts.nameColor || '#e2e8f0';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3 * s;
    ctx.strokeText(opts.showName, cx, 250 * s);
    ctx.fillText(opts.showName, cx, 250 * s);
    ctx.restore();
  }
};

/* ============================================
   Body Dimensions
   ============================================ */
function getBodyDims(body, gender, s) {
  var bw, bh, shoulderW, waistW, hipW;
  var id = body ? body.id : '';

  if (gender === 'girl') {
    bh = id.indexOf('tall') >= 0 ? 70 : 62;
    if (id.indexOf('slim') >= 0)      { shoulderW = 34; waistW = 28; hipW = 34; }
    else if (id.indexOf('curvy') >= 0) { shoulderW = 38; waistW = 30; hipW = 42; }
    else if (id.indexOf('tall') >= 0)  { shoulderW = 36; waistW = 30; hipW = 36; }
    else                               { shoulderW = 36; waistW = 30; hipW = 38; }
  } else {
    bh = id.indexOf('tall') >= 0 ? 72 : 64;
    if (id.indexOf('slim') >= 0)       { shoulderW = 38; waistW = 34; hipW = 34; }
    else if (id.indexOf('stocky') >= 0){ shoulderW = 50; waistW = 48; hipW = 46; }
    else if (id.indexOf('tall') >= 0)  { shoulderW = 44; waistW = 38; hipW = 38; }
    else                               { shoulderW = 44; waistW = 40; hipW = 40; }
  }
  bw = Math.max(shoulderW, hipW);
  return { bw: bw, bh: bh, shoulderW: shoulderW, waistW: waistW, hipW: hipW, s: s };
}

/* ============================================
   Head
   ============================================ */
function drawHead(ctx, cx, s, skin) {
  ctx.save();
  ctx.fillStyle = skin.value;
  roundRect(ctx, cx - 28 * s, 42 * s, 56 * s, 54 * s, 22 * s);
  ctx.fill();
  // Ears
  ctx.beginPath();
  ctx.ellipse(cx - 30 * s, 68 * s, 6 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 30 * s, 68 * s, 6 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ============================================
   Drawn Face — eyes, brows, mouth
   ============================================ */
function drawFace(ctx, cx, s, expr, skin) {
  if (!expr || !expr.features) return;
  var f = expr.features;
  var lineC = faceLineColor(skin.value);
  var eyeY = 64 * s;
  var eyeSpacing = 12 * s;

  ctx.save();

  // --- EYEBROWS ---
  ctx.strokeStyle = lineC;
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  var browY = 56 * s;
  var browW = 8 * s;

  if (f.brows === 'raised') {
    drawArc(ctx, cx - eyeSpacing, browY - 2 * s, browW, -0.3);
    drawArc(ctx, cx + eyeSpacing, browY - 2 * s, browW, -0.3);
  } else if (f.brows === 'furrowed') {
    ctx.beginPath(); ctx.moveTo(cx - eyeSpacing - browW / 2, browY - 1 * s); ctx.lineTo(cx - eyeSpacing + browW / 2, browY + 2 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + eyeSpacing + browW / 2, browY - 1 * s); ctx.lineTo(cx + eyeSpacing - browW / 2, browY + 2 * s); ctx.stroke();
  } else if (f.brows === 'raised_one') {
    drawArc(ctx, cx - eyeSpacing, browY, browW, -0.15);
    drawArc(ctx, cx + eyeSpacing, browY - 3 * s, browW, -0.4);
  } else {
    drawArc(ctx, cx - eyeSpacing, browY, browW, -0.15);
    drawArc(ctx, cx + eyeSpacing, browY, browW, -0.15);
  }

  // --- EYES ---
  if (f.eyes === 'normal' || f.eyes === 'wide') {
    var eyeH = f.eyes === 'wide' ? 6 * s : 5 * s;
    var eyeW = f.eyes === 'wide' ? 6 * s : 5 * s;
    var irisR = f.eyes === 'wide' ? 2 * s : 2.5 * s;
    drawEyeball(ctx, cx - eyeSpacing, eyeY, eyeW, eyeH, irisR, s, 0);
    drawEyeball(ctx, cx + eyeSpacing, eyeY, eyeW, eyeH, irisR, s, 0);
  } else if (f.eyes === 'happy') {
    ctx.strokeStyle = lineC; ctx.lineWidth = 2 * s;
    drawArc(ctx, cx - eyeSpacing, eyeY, 6 * s, -0.5);
    drawArc(ctx, cx + eyeSpacing, eyeY, 6 * s, -0.5);
  } else if (f.eyes === 'closed') {
    ctx.strokeStyle = lineC; ctx.lineWidth = 2 * s;
    drawArc(ctx, cx - eyeSpacing, eyeY + 1 * s, 6 * s, 0.3);
    drawArc(ctx, cx + eyeSpacing, eyeY + 1 * s, 6 * s, 0.3);
  } else if (f.eyes === 'wink') {
    drawEyeball(ctx, cx - eyeSpacing, eyeY, 5 * s, 5 * s, 2.5 * s, s, 0);
    ctx.strokeStyle = lineC; ctx.lineWidth = 2 * s;
    drawArc(ctx, cx + eyeSpacing, eyeY, 6 * s, -0.5);
  } else if (f.eyes === 'shades') {
    ctx.fillStyle = '#1a1a2e';
    roundRect(ctx, cx - eyeSpacing - 7 * s, eyeY - 4 * s, 14 * s, 9 * s, 3 * s);
    ctx.fill();
    roundRect(ctx, cx + eyeSpacing - 7 * s, eyeY - 4 * s, 14 * s, 9 * s, 3 * s);
    ctx.fill();
    // Bridge
    ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(cx - eyeSpacing + 7 * s, eyeY);
    ctx.lineTo(cx + eyeSpacing - 7 * s, eyeY);
    ctx.stroke();
    // Lens shine
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(cx - eyeSpacing - 4 * s, eyeY - 3 * s, 5 * s, 3 * s);
    ctx.fillRect(cx + eyeSpacing - 4 * s, eyeY - 3 * s, 5 * s, 3 * s);
  } else if (f.eyes === 'sideglance') {
    drawEyeball(ctx, cx - eyeSpacing, eyeY, 5 * s, 5 * s, 2.5 * s, s, 2 * s);
    drawEyeball(ctx, cx + eyeSpacing, eyeY, 5 * s, 5 * s, 2.5 * s, s, 2 * s);
  }

  // --- MOUTH ---
  var mouthY = 78 * s;
  ctx.strokeStyle = lineC;
  ctx.fillStyle = lineC;
  ctx.lineWidth = 1.5 * s;
  ctx.lineCap = 'round';

  if (f.mouth === 'smile') {
    ctx.beginPath();
    ctx.moveTo(cx - 7 * s, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 6 * s, cx + 7 * s, mouthY);
    ctx.stroke();
  } else if (f.mouth === 'grin') {
    ctx.beginPath();
    ctx.moveTo(cx - 9 * s, mouthY - 1 * s);
    ctx.quadraticCurveTo(cx, mouthY + 8 * s, cx + 9 * s, mouthY - 1 * s);
    ctx.stroke();
    // Teeth
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx - 7 * s, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 5 * s, cx + 7 * s, mouthY);
    ctx.lineTo(cx + 7 * s, mouthY + 1 * s);
    ctx.quadraticCurveTo(cx, mouthY - 1 * s, cx - 7 * s, mouthY + 1 * s);
    ctx.fill();
  } else if (f.mouth === 'smirk') {
    ctx.beginPath();
    ctx.moveTo(cx - 6 * s, mouthY + 1 * s);
    ctx.quadraticCurveTo(cx + 2 * s, mouthY + 4 * s, cx + 8 * s, mouthY - 2 * s);
    ctx.stroke();
  } else if (f.mouth === 'flat') {
    ctx.beginPath();
    ctx.moveTo(cx - 6 * s, mouthY + 1 * s);
    ctx.lineTo(cx + 6 * s, mouthY + 1 * s);
    ctx.stroke();
  } else if (f.mouth === 'open') {
    ctx.fillStyle = '#4a1a1a';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 2 * s, 6 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tongue
    ctx.fillStyle = '#e88b8b';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 5 * s, 4 * s, 3 * s, 0, 0, Math.PI);
    ctx.fill();
  } else if (f.mouth === 'ooh') {
    ctx.fillStyle = '#4a1a1a';
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 1 * s, 4 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEyeball(ctx, x, y, w, h, irisR, s, offsetX) {
  // White
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  // Iris
  ctx.fillStyle = '#2D1B00';
  ctx.beginPath();
  ctx.arc(x + (offsetX || 0), y, irisR, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x + (offsetX || 0) - 1 * s, y - 1 * s, 1 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawArc(ctx, x, y, w, curve) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y + w * curve, x + w / 2, y);
  ctx.stroke();
}

/* ============================================
   Body / Outfit Silhouettes
   ============================================ */
function drawBody(ctx, cx, s, skin, body, outfit, gender, bd) {
  var top = 96 * s;
  var sw = bd.shoulderW * s;
  var ww = bd.waistW * s;
  var hw = bd.hipW * s;
  var bh = bd.bh * s;

  ctx.save();

  // Neck
  ctx.fillStyle = skin.value;
  ctx.fillRect(cx - 8 * s, 88 * s, 16 * s, 14 * s);

  // Torso shape (gender-aware)
  ctx.fillStyle = outfit.color;
  ctx.beginPath();
  ctx.moveTo(cx - sw / 2, top);
  ctx.lineTo(cx + sw / 2, top);
  ctx.lineTo(cx + ww / 2, top + bh * 0.5);
  ctx.lineTo(cx + hw / 2, top + bh);
  ctx.lineTo(cx - hw / 2, top + bh);
  ctx.lineTo(cx - ww / 2, top + bh * 0.5);
  ctx.closePath();
  ctx.fill();

  // Outfit-specific details
  var t = outfit.type;
  if (t === 'tee' || t === 'polo') {
    // Sleeves
    drawSleeves(ctx, cx, top, sw, s, outfit.color, 'short');
    // Neckline
    ctx.strokeStyle = outfit.accent; ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 8 * s, top); ctx.quadraticCurveTo(cx, top + 6 * s, cx + 8 * s, top); ctx.stroke();
    // ODA text on tee
    if (t === 'tee') {
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = 'bold ' + (8 * s) + 'px Outfit,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('ODA', cx, top + bh * 0.4);
    }
    // Polo collar
    if (t === 'polo') {
      ctx.fillStyle = outfit.accent;
      ctx.beginPath(); ctx.moveTo(cx - 10 * s, top - 2 * s); ctx.lineTo(cx - 4 * s, top + 4 * s); ctx.lineTo(cx, top);
      ctx.lineTo(cx + 4 * s, top + 4 * s); ctx.lineTo(cx + 10 * s, top - 2 * s); ctx.fill();
    }
  } else if (t === 'hoodie') {
    drawSleeves(ctx, cx, top, sw, s, outfit.color, 'long');
    // Kangaroo pocket
    ctx.fillStyle = outfit.accent;
    roundRect(ctx, cx - 14 * s, top + bh * 0.55, 28 * s, 12 * s, 4 * s);
    ctx.fill();
    // Drawstrings
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.moveTo(cx - 3 * s, top + 2 * s); ctx.lineTo(cx - 4 * s, top + 16 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 3 * s, top + 2 * s); ctx.lineTo(cx + 4 * s, top + 16 * s); ctx.stroke();
  } else if (t === 'jersey') {
    // Sleeveless
    drawSleeves(ctx, cx, top, sw, s, skin.value, 'none');
    // Number
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold ' + (16 * s) + 'px Space Mono,monospace'; ctx.textAlign = 'center';
    ctx.fillText('1', cx, top + bh * 0.5);
    // Accent stripe
    ctx.fillStyle = outfit.accent;
    ctx.fillRect(cx - sw / 2, top + bh - 6 * s, sw, 4 * s);
  } else if (t === 'varsity') {
    // Different colored sleeves
    drawSleeves(ctx, cx, top, sw, s, outfit.accent, 'long');
    // Zipper line
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(cx, top + 4 * s); ctx.lineTo(cx, top + bh - 4 * s); ctx.stroke();
    // Collar
    ctx.fillStyle = outfit.accent;
    roundRect(ctx, cx - 12 * s, top - 2 * s, 24 * s, 6 * s, 3 * s);
    ctx.fill();
  } else if (t === 'overalls') {
    // Undershirt (white)
    ctx.fillStyle = '#e8e8e8';
    drawSleeves(ctx, cx, top, sw, s, '#e8e8e8', 'short');
    // Straps
    ctx.fillStyle = outfit.color;
    ctx.fillRect(cx - sw / 2 + 4 * s, top, 8 * s, bh * 0.4);
    ctx.fillRect(cx + sw / 2 - 12 * s, top, 8 * s, bh * 0.4);
    // Bib
    roundRect(ctx, cx - 12 * s, top + bh * 0.3, 24 * s, bh * 0.3, 4 * s);
    ctx.fill();
    // Bib pocket
    ctx.fillStyle = outfit.accent;
    roundRect(ctx, cx - 6 * s, top + bh * 0.38, 12 * s, 8 * s, 2 * s);
    ctx.fill();
  } else if (t === 'blazer') {
    drawSleeves(ctx, cx, top, sw, s, outfit.color, 'long');
    // Lapels
    ctx.fillStyle = outfit.accent;
    ctx.beginPath(); ctx.moveTo(cx - 2 * s, top); ctx.lineTo(cx - 14 * s, top + 18 * s); ctx.lineTo(cx - 6 * s, top + 22 * s); ctx.lineTo(cx - 2 * s, top + 8 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 2 * s, top); ctx.lineTo(cx + 14 * s, top + 18 * s); ctx.lineTo(cx + 6 * s, top + 22 * s); ctx.lineTo(cx + 2 * s, top + 8 * s); ctx.fill();
    // Shirt peek
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.moveTo(cx - 6 * s, top + 22 * s); ctx.lineTo(cx, top + 6 * s); ctx.lineTo(cx + 6 * s, top + 22 * s); ctx.fill();
  } else if (t === 'sweater') {
    drawSleeves(ctx, cx, top, sw + 6, s, outfit.color, 'long');
    // Ribbed hem lines
    ctx.strokeStyle = outfit.accent; ctx.lineWidth = 1 * s;
    for (var ri = 0; ri < 3; ri++) {
      ctx.beginPath();
      ctx.moveTo(cx - hw / 2 + 4 * s, top + bh - (ri * 3 + 2) * s);
      ctx.lineTo(cx + hw / 2 - 4 * s, top + bh - (ri * 3 + 2) * s);
      ctx.stroke();
    }
    // Crew neck
    ctx.strokeStyle = outfit.accent; ctx.lineWidth = 3 * s;
    drawArc(ctx, cx, top + 2 * s, 16 * s, 0.3);
  } else if (t === 'tank') {
    // No sleeves — show skin arms
    drawSleeves(ctx, cx, top, sw, s, skin.value, 'none');
    // Thin straps
    ctx.fillStyle = outfit.color;
    ctx.fillRect(cx - sw / 2 + 6 * s, top - 2 * s, 5 * s, 10 * s);
    ctx.fillRect(cx + sw / 2 - 11 * s, top - 2 * s, 5 * s, 10 * s);
  } else if (t === 'dress' || t === 'skirtTop') {
    drawSleeves(ctx, cx, top, sw, s, outfit.color, t === 'dress' ? 'short' : 'none');
    if (t === 'skirtTop') {
      // Visible waistband
      ctx.fillStyle = outfit.accent;
      ctx.fillRect(cx - ww / 2 - 2 * s, top + bh - 4 * s, ww + 4 * s, 4 * s);
    }
  } else if (t === 'jumpsuit') {
    drawSleeves(ctx, cx, top, sw, s, outfit.color, 'none');
    // Belt
    ctx.fillStyle = outfit.accent;
    ctx.fillRect(cx - ww / 2, top + bh * 0.5 - 2 * s, ww, 5 * s);
    // Belt buckle
    ctx.fillStyle = '#ffd166';
    roundRect(ctx, cx - 3 * s, top + bh * 0.5 - 2 * s, 6 * s, 5 * s, 1 * s);
    ctx.fill();
  } else {
    drawSleeves(ctx, cx, top, sw, s, outfit.color, 'short');
  }

  // Arms (skin)
  ctx.fillStyle = skin.value;
  var armTop = top + 4 * s;
  var armLen = 42 * s;
  // Left arm
  roundRect(ctx, cx - sw / 2 - 11 * s, armTop, 11 * s, armLen, 5 * s);
  ctx.fill();
  // Right arm
  roundRect(ctx, cx + sw / 2, armTop, 11 * s, armLen, 5 * s);
  ctx.fill();
  // Hands
  ctx.beginPath(); ctx.arc(cx - sw / 2 - 5.5 * s, armTop + armLen + 2 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + sw / 2 + 5.5 * s, armTop + armLen + 2 * s, 6 * s, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawSleeves(ctx, cx, top, sw, s, color, type) {
  if (type === 'none') return;
  ctx.save();
  ctx.fillStyle = color;
  var sleeveLen = type === 'long' ? 36 * s : 16 * s;
  // Left sleeve
  ctx.beginPath();
  ctx.moveTo(cx - sw / 2 * s, top);
  ctx.lineTo(cx - sw / 2 * s - 12 * s, top + 6 * s);
  ctx.lineTo(cx - sw / 2 * s - 12 * s, top + sleeveLen);
  ctx.lineTo(cx - sw / 2 * s, top + sleeveLen - 4 * s);
  ctx.fill();
  // Right sleeve
  ctx.beginPath();
  ctx.moveTo(cx + sw / 2 * s, top);
  ctx.lineTo(cx + sw / 2 * s + 12 * s, top + 6 * s);
  ctx.lineTo(cx + sw / 2 * s + 12 * s, top + sleeveLen);
  ctx.lineTo(cx + sw / 2 * s, top + sleeveLen - 4 * s);
  ctx.fill();
  ctx.restore();
}

function drawHoodBack(ctx, cx, s, outfit, bd) {
  ctx.save();
  ctx.fillStyle = darken(outfit.color, 0.08);
  ctx.beginPath();
  ctx.ellipse(cx, 50 * s, 34 * s, 26 * s, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - 34 * s, 50 * s, 68 * s, 20 * s);
  ctx.restore();
}

function drawSkirt(ctx, cx, s, outfit, bd) {
  ctx.save();
  ctx.fillStyle = outfit.type === 'skirtTop' ? outfit.accent : outfit.color;
  var skirtTop = 96 * s + bd.bh * s;
  var skirtLen = 36 * s;
  ctx.beginPath();
  ctx.moveTo(cx - bd.hipW / 2 * s - 4 * s, skirtTop);
  ctx.lineTo(cx + bd.hipW / 2 * s + 4 * s, skirtTop);
  ctx.lineTo(cx + bd.hipW / 2 * s + 12 * s, skirtTop + skirtLen);
  ctx.lineTo(cx - bd.hipW / 2 * s - 12 * s, skirtTop + skirtLen);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ============================================
   Legs
   ============================================ */
function drawLegs(ctx, cx, s, skin, outfit, bd) {
  var legTop = 160 * s;
  var legH = (outfit.type === 'dress' || outfit.type === 'skirtTop') ? 34 * s : 46 * s;
  var legY = (outfit.type === 'dress' || outfit.type === 'skirtTop') ? legTop + 12 * s : legTop;

  ctx.save();
  var pantColor = (outfit.type === 'jumpsuit') ? outfit.color :
                  (outfit.type === 'overalls') ? outfit.color :
                  darken(outfit.color, 0.15);
  ctx.fillStyle = pantColor;
  roundRect(ctx, cx - 16 * s, legY, 13 * s, legH, 5 * s);
  ctx.fill();
  roundRect(ctx, cx + 3 * s, legY, 13 * s, legH, 5 * s);
  ctx.fill();

  // Skin below shorts/skirts
  if (outfit.type === 'dress' || outfit.type === 'skirtTop') {
    ctx.fillStyle = skin.value;
    ctx.fillRect(cx - 14 * s, legY + legH - 6 * s, 10 * s, 12 * s);
    ctx.fillRect(cx + 4 * s, legY + legH - 6 * s, 10 * s, 12 * s);
  }
  ctx.restore();
}

/* ============================================
   Shoes
   ============================================ */
function drawShoes(ctx, cx, s, shoe) {
  ctx.save();
  ctx.fillStyle = shoe.color;
  roundRect(ctx, cx - 20 * s, 204 * s, 18 * s, 10 * s, 4 * s);
  ctx.fill();
  roundRect(ctx, cx + 2 * s, 204 * s, 18 * s, 10 * s, 4 * s);
  ctx.fill();
  ctx.fillStyle = darken(shoe.color, 0.25);
  ctx.fillRect(cx - 20 * s, 211 * s, 18 * s, 3 * s);
  ctx.fillRect(cx + 2 * s, 211 * s, 18 * s, 3 * s);
  ctx.restore();
}

/* ============================================
   Hair — Volume layer (draws BEHIND head)
   The head will cover the face/neck area naturally.
   This layer = the big shape: afro sphere, hanging locs/braids, ponytail tail, etc.
   ============================================ */
function drawHairVolume(ctx, cx, s, hair, hc) {
  if (!hair) return;
  ctx.save();
  ctx.fillStyle = hc.value;
  var id = hair.id;

  switch (id) {
    // --- AFROS: full circle behind head, head covers face ---
    case 'hair_afro_sm':
      ctx.beginPath(); ctx.arc(cx, 56 * s, 32 * s, 0, Math.PI * 2); ctx.fill();
      break;
    case 'hair_afro_md':
      ctx.beginPath(); ctx.arc(cx, 54 * s, 42 * s, 0, Math.PI * 2); ctx.fill();
      break;
    case 'hair_afro_lg':
      ctx.beginPath(); ctx.arc(cx, 50 * s, 55 * s, 0, Math.PI * 2); ctx.fill();
      break;
    case 'hair_afro_pick':
      ctx.beginPath(); ctx.arc(cx, 52 * s, 48 * s, 0, Math.PI * 2); ctx.fill();
      break;

    // --- LOCS: cap on top + strands hanging behind ---
    case 'hair_locs_short':
    case 'hair_locs_long':
    case 'hair_locs_freeform':
      ctx.beginPath(); ctx.ellipse(cx, 40 * s, 32 * s, 12 * s, 0, Math.PI, Math.PI * 2); ctx.fill();
      var locLen = id === 'hair_locs_long' ? 90 : id === 'hair_locs_freeform' ? 85 : 62;
      var locCount = id === 'hair_locs_long' ? 9 : id === 'hair_locs_freeform' ? 9 : 7;
      var locSpacing = id === 'hair_locs_long' ? 7 : 8;
      var half = Math.floor(locCount / 2);
      for (var li = -half; li <= half; li++) {
        var lx = cx + li * locSpacing * s;
        var curve = id === 'hair_locs_freeform' ? (li % 2 ? 8 : -6) : (li % 2 ? 4 : -3);
        var thick = id === 'hair_locs_freeform' ? (2 + (li % 3)) : 2.5;
        ctx.beginPath(); ctx.moveTo(lx - thick * s, 38 * s);
        ctx.quadraticCurveTo(lx + curve * s, (38 + locLen) / 2 * s, lx, locLen * s);
        ctx.quadraticCurveTo(lx + thick * s, (38 + locLen) / 2 * s, lx + thick * s, 38 * s);
        ctx.fill();
      }
      break;

    // --- BRAIDS: cap + hanging braids ---
    case 'hair_braids_box':
      roundRect(ctx, cx - 28 * s, 30 * s, 56 * s, 18 * s, 10 * s); ctx.fill();
      for (var bb = -4; bb <= 4; bb++) {
        ctx.fillRect(cx + bb * 7 * s - 2.5 * s, 46 * s, 5 * s, 38 * s);
        ctx.fillRect(cx + bb * 7 * s - 3 * s, 82 * s, 6 * s, 3 * s);
      }
      break;
    case 'hair_braids_french':
      roundRect(ctx, cx - 28 * s, 34 * s, 56 * s, 14 * s, 10 * s); ctx.fill();
      for (var fb = -1; fb <= 1; fb += 2) {
        var fbx = cx + fb * 12 * s;
        for (var fz = 0; fz < 5; fz++) {
          ctx.beginPath();
          ctx.moveTo(fbx - 4 * s, (36 + fz * 6) * s); ctx.lineTo(fbx, (39 + fz * 6) * s);
          ctx.lineTo(fbx + 4 * s, (36 + fz * 6) * s); ctx.lineTo(fbx, (33 + fz * 6) * s); ctx.fill();
        }
        ctx.fillRect(fbx - 3 * s, 62 * s, 6 * s, 20 * s);
      }
      break;
    case 'hair_braids_goddess':
      for (var gb = -2; gb <= 2; gb++) {
        ctx.beginPath();
        var gx1 = cx + gb * 12 * s;
        ctx.moveTo(gx1 - 5 * s, 34 * s);
        ctx.quadraticCurveTo(gx1 + 4 * s, 44 * s, gx1 + gb * 3 * s, 54 * s);
        ctx.lineTo(gx1 + gb * 3 * s + 5 * s, 54 * s);
        ctx.quadraticCurveTo(gx1 + 9 * s, 44 * s, gx1 + 5 * s, 34 * s); ctx.fill();
      }
      break;
    case 'hair_braids_fulani':
      roundRect(ctx, cx - 30 * s, 36 * s, 60 * s, 12 * s, 8 * s); ctx.fill();
      for (var fu = -3; fu <= 3; fu += 2) {
        var fux = cx + fu * 9 * s;
        ctx.fillRect(fux - 2 * s, 48 * s, 4 * s, 28 * s);
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(fux, 78 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hc.value;
      }
      break;

    // --- TWISTS: hang behind ---
    case 'hair_twists':
      for (var tw = -3; tw <= 3; tw++) {
        ctx.beginPath();
        ctx.ellipse(cx + tw * 8 * s, 38 * s, 5 * s, 20 * s, tw * 0.15, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'hair_cornrows':
      roundRect(ctx, cx - 30 * s, 34 * s, 60 * s, 16 * s, 10 * s); ctx.fill();
      break;
    case 'hair_bantuKnots':
      var knots = [[-18, 28], [0, 22], [18, 28], [-10, 40], [10, 40]];
      for (var bk = 0; bk < knots.length; bk++) {
        ctx.fillStyle = hc.value;
        ctx.beginPath(); ctx.arc(cx + knots[bk][0] * s, knots[bk][1] * s, 10 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = darken(hc.value, 0.15);
        ctx.beginPath(); ctx.arc(cx + knots[bk][0] * s, knots[bk][1] * s - 4 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'hair_puffs':
      ctx.beginPath(); ctx.arc(cx - 22 * s, 34 * s, 18 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 22 * s, 34 * s, 18 * s, 0, Math.PI * 2); ctx.fill();
      break;

    // --- PONYTAIL: tail hangs behind ---
    case 'hair_ponytail':
      roundRect(ctx, cx - 28 * s, 32 * s, 56 * s, 16 * s, 10 * s); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, 36 * s);
      ctx.quadraticCurveTo(cx + 40 * s, 28 * s, cx + 36 * s, 70 * s);
      ctx.quadraticCurveTo(cx + 30 * s, 76 * s, cx + 20 * s, 68 * s); ctx.fill();
      break;
    case 'hair_bun':
      roundRect(ctx, cx - 28 * s, 34 * s, 56 * s, 14 * s, 10 * s); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, 26 * s, 14 * s, 0, Math.PI * 2); ctx.fill();
      break;
    case 'hair_wavy':
      for (var wv = -3; wv <= 3; wv++) {
        var wx = cx + wv * 9 * s;
        ctx.beginPath(); ctx.moveTo(wx, 32 * s);
        ctx.quadraticCurveTo(wx + 5 * s, 52 * s, wx - 3 * s, 72 * s);
        ctx.quadraticCurveTo(wx + 3 * s, 52 * s, wx + 3 * s, 32 * s); ctx.fill();
      }
      break;
    case 'hair_spiky':
      var spikes = [[-20, 30], [-10, 18], [0, 14], [10, 18], [20, 30]];
      for (var sp = 0; sp < spikes.length; sp++) {
        ctx.beginPath();
        ctx.moveTo(cx + spikes[sp][0] * s - 8 * s, 46 * s);
        ctx.lineTo(cx + spikes[sp][0] * s, spikes[sp][1] * s);
        ctx.lineTo(cx + spikes[sp][0] * s + 8 * s, 46 * s); ctx.fill();
      }
      break;

    // --- FADES & SHORT: just top-of-head, no volume behind ---
    case 'hair_fade':
    case 'hair_highTop':
    case 'hair_buzz':
    case 'hair_short':
      break; // These are drawn entirely in drawHairTop since they sit ON the head
  }

  ctx.restore();
}

/* ============================================
   Hair — Top layer (draws AFTER face)
   Crown of hair above forehead, accessories, fade details.
   Only for hair that needs to appear above the forehead line.
   ============================================ */
function drawHairTop(ctx, cx, s, hair, hc) {
  if (!hair) return;
  ctx.save();
  ctx.fillStyle = hc.value;
  var id = hair.id;

  switch (id) {
    // Fades and short cuts sit on top of the head
    case 'hair_fade':
      ctx.beginPath(); ctx.ellipse(cx, 42 * s, 28 * s, 14 * s, 0, Math.PI, Math.PI * 2); ctx.fill();
      var fadeG = ctx.createLinearGradient(cx - 30 * s, 42 * s, cx - 30 * s, 62 * s);
      fadeG.addColorStop(0, hc.value); fadeG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fadeG;
      ctx.fillRect(cx - 32 * s, 46 * s, 8 * s, 16 * s);
      ctx.fillRect(cx + 24 * s, 46 * s, 8 * s, 16 * s);
      break;
    case 'hair_highTop':
      ctx.fillRect(cx - 22 * s, 18 * s, 44 * s, 28 * s);
      roundRect(ctx, cx - 24 * s, 14 * s, 48 * s, 8 * s, 4 * s); ctx.fill();
      break;
    case 'hair_buzz':
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.ellipse(cx, 44 * s, 29 * s, 12 * s, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case 'hair_short':
      ctx.beginPath(); ctx.ellipse(cx, 44 * s, 30 * s, 16 * s, 0, Math.PI, Math.PI * 2); ctx.fill();
      break;

    // Cornrow lines on top of head
    case 'hair_cornrows':
      ctx.strokeStyle = darken(hc.value, 0.3); ctx.lineWidth = 1.5 * s;
      for (var cr = -2; cr <= 2; cr++) {
        ctx.beginPath(); ctx.moveTo(cx + cr * 10 * s, 34 * s); ctx.lineTo(cx + cr * 12 * s, 50 * s); ctx.stroke();
      }
      break;

    // Fulani central cornrow on top
    case 'hair_braids_fulani':
      ctx.strokeStyle = hc.value; ctx.lineWidth = 4 * s;
      ctx.beginPath(); ctx.moveTo(cx, 30 * s); ctx.lineTo(cx, 46 * s); ctx.stroke();
      break;

    // Afro pick accessory
    case 'hair_afro_pick':
      ctx.fillStyle = '#888'; ctx.fillRect(cx + 34 * s, 16 * s, 3 * s, 22 * s);
      ctx.fillStyle = '#aaa'; ctx.fillRect(cx + 30 * s, 12 * s, 11 * s, 6 * s);
      break;

    // Puff ball hair ties
    case 'hair_puffs':
      ctx.fillStyle = '#ef476f';
      ctx.beginPath(); ctx.arc(cx - 22 * s, 48 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 22 * s, 48 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
      break;
  }

  ctx.restore();
}

/* ============================================
   Utility helpers
   ============================================ */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function darken(hex, amount) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.round(r * (1 - amount)));
  g = Math.max(0, Math.round(g * (1 - amount)));
  b = Math.max(0, Math.round(b * (1 - amount)));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function faceLineColor(skinHex) {
  var r = parseInt(skinHex.slice(1, 3), 16);
  var g = parseInt(skinHex.slice(3, 5), 16);
  var b = parseInt(skinHex.slice(5, 7), 16);
  var lum = (r * 0.299 + g * 0.587 + b * 0.114);
  // Dark skin → lighter lines, light skin → darker lines
  if (lum < 80) return darken(skinHex, -0.6); // lighten
  return darken(skinHex, 0.45);
}
