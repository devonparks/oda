/* ============================================================
   ODA World — Sprite Compositor (V4)
   Loads LPC-format PNG sprite sheets, composites layers on canvas,
   supports idle animation loops.

   LPC Format: 64×64 px frames, 13 columns × 21 rows
   Walk cycle: rows 8-11 (up/left/down/right), 9 frames each
   Front-facing (down) = row 10
   ============================================================ */

const ODA_SPRITE = (() => {

  // ── Constants ───────────────────────────────────────────────
  const FRAME_W = 64;
  const FRAME_H = 64;
  const COLS = 13;

  // Row indices for walk animation (standard LPC layout)
  const WALK_ROWS = { up: 8, left: 9, down: 10, right: 11 };
  const WALK_FRAMES = 9; // frames per direction in walk cycle

  // Idle uses walk frames in a bob pattern
  const IDLE_SEQUENCE = [0, 1, 2, 1]; // frame indices within walk row
  const IDLE_FPS = 4;

  // ── Image Cache ─────────────────────────────────────────────
  const imageCache = {};
  const loadingPromises = {};

  function loadImage(src) {
    if (imageCache[src]) return Promise.resolve(imageCache[src]);
    if (loadingPromises[src]) return loadingPromises[src];

    loadingPromises[src] = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache[src] = img;
        delete loadingPromises[src];
        resolve(img);
      };
      img.onerror = () => {
        delete loadingPromises[src];
        console.warn('Failed to load sprite:', src);
        resolve(null); // resolve with null instead of rejecting — don't break compositing
      };
      img.src = src;
    });
    return loadingPromises[src];
  }

  // ── Layer Resolution ────────────────────────────────────────
  // Given a config, returns ordered array of { src, tint? } for compositing
  function resolveLayersFromConfig(config) {
    if (!window.ODA_SPRITE_PARTS) return [];
    return ODA_SPRITE_PARTS.resolveLayers(config);
  }

  // ── Frame Extraction ────────────────────────────────────────
  // Extract a single 64×64 frame from a sprite sheet
  function getFrameRect(direction, frameIndex) {
    const row = WALK_ROWS[direction] || WALK_ROWS.down;
    return {
      sx: frameIndex * FRAME_W,
      sy: row * FRAME_H,
      sw: FRAME_W,
      sh: FRAME_H,
    };
  }

  // ── Color Tinting ───────────────────────────────────────────
  // Tint a sprite layer with a color using offscreen canvas
  function tintImage(img, color, frame) {
    const off = document.createElement('canvas');
    off.width = FRAME_W;
    off.height = FRAME_H;
    const ctx = off.getContext('2d');

    // Draw the original frame
    ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, FRAME_W, FRAME_H);

    // Apply color tint using multiply blend
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, FRAME_W, FRAME_H);

    // Restore normal blending
    ctx.globalCompositeOperation = 'source-over';
    return off;
  }

  // ── Draw Single Frame ───────────────────────────────────────
  // Composites all layers for a single frame onto the canvas
  async function drawFrame(canvas, config, direction, frameIndex, displaySize) {
    const size = displaySize || canvas.width || 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // Pixelated scaling for that crisp pixel art look
    ctx.imageSmoothingEnabled = false;

    const layers = resolveLayersFromConfig(config);
    const frame = getFrameRect(direction || 'down', frameIndex || 0);

    for (const layer of layers) {
      if (!layer.src) continue;
      const img = await loadImage(layer.src);
      if (!img) continue;

      if (layer.tint) {
        // Tinted layer (outfits, hair with custom color)
        const tinted = tintImage(img, layer.tint, frame);
        ctx.drawImage(tinted, 0, 0, FRAME_W, FRAME_H, 0, 0, size, size);
      } else {
        // Direct draw
        ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, size, size);
      }
    }
  }

  // ── Static Preview ──────────────────────────────────────────
  // Draw front-facing frame 0 — for thumbnails and mini previews
  async function drawPreview(canvas, config, opts) {
    opts = opts || {};
    const size = opts.size || 256;
    await drawFrame(canvas, config, 'down', 0, size);
  }

  // ── Head-Only Preview ───────────────────────────────────────
  // Renders full sprite then crops to head region for hair/face thumbnails
  async function drawHeadPreview(canvas, config, opts) {
    opts = opts || {};
    const size = opts.size || 64;
    canvas.width = size;
    canvas.height = size;

    // Render at 256px offscreen
    const off = document.createElement('canvas');
    off.width = 256;
    off.height = 256;
    await drawFrame(off, config, 'down', 0, 256);

    // Crop head region — LPC characters have head in upper portion
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    // Source: top ~40% of the sprite, centered
    const srcX = 40, srcY = 0, srcW = 176, srcH = 120;
    ctx.drawImage(off, srcX, srcY, srcW, srcH, 0, 0, size, size);
  }

  // ── Animation ───────────────────────────────────────────────
  const animations = {}; // canvasId → { rafId, frameIdx, lastTime }

  function startIdleAnimation(canvas, config, opts) {
    opts = opts || {};
    const size = opts.size || 256;
    const id = canvas.id || 'anim_' + Math.random().toString(36).slice(2);
    canvas.id = id;

    // Stop any existing animation on this canvas
    stopAnimation(id);

    let frameIdx = 0;
    let lastTime = 0;
    const interval = 1000 / IDLE_FPS;

    function tick(time) {
      if (!animations[id]) return;

      if (time - lastTime >= interval) {
        frameIdx = (frameIdx + 1) % IDLE_SEQUENCE.length;
        lastTime = time;
        drawFrame(canvas, config, 'down', IDLE_SEQUENCE[frameIdx], size);
      }

      animations[id].rafId = requestAnimationFrame(tick);
    }

    animations[id] = { rafId: null, config };

    // Draw first frame immediately
    drawFrame(canvas, config, 'down', IDLE_SEQUENCE[0], size).then(() => {
      if (animations[id]) {
        animations[id].rafId = requestAnimationFrame(tick);
      }
    });
  }

  function stopAnimation(canvasId) {
    if (animations[canvasId]) {
      if (animations[canvasId].rafId) {
        cancelAnimationFrame(animations[canvasId].rafId);
      }
      delete animations[canvasId];
    }
  }

  // Update an existing animation's config without restarting
  function updateAnimation(canvas, config, opts) {
    const id = canvas.id;
    if (animations[id]) {
      animations[id].config = config;
      // Restart with new config
      startIdleAnimation(canvas, config, opts);
    } else {
      startIdleAnimation(canvas, config, opts);
    }
  }

  // ── Preload ─────────────────────────────────────────────────
  // Preload all images for a config so rendering is instant
  async function preloadLayers(config) {
    const layers = resolveLayersFromConfig(config);
    const promises = layers.map(l => l.src ? loadImage(l.src) : Promise.resolve(null));
    return Promise.all(promises);
  }

  return {
    drawFrame,
    drawPreview,
    drawHeadPreview,
    startIdleAnimation,
    stopAnimation,
    updateAnimation,
    preloadLayers,
    loadImage,
    FRAME_W,
    FRAME_H,
  };
})();
