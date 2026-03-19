/* ============================================================
   ODA World — Color Picker Widget (V3)
   Preset swatches + HSL custom picker, reusable for outfits/shoes.
   Usage: ODA_COLOR.open(targetEl, currentColor, presets, onPick)
   ============================================================ */

const ODA_COLOR = (() => {

  let overlay = null;
  let currentCallback = null;

  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  function hexToHsl(hex) {
    let r = parseInt(hex.slice(1,3),16)/255;
    let g = parseInt(hex.slice(3,5),16)/255;
    let b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h = 0, s = 0, l = (max+min)/2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      if (max === r) h = ((g-b)/d + (g<b?6:0))*60;
      else if (max === g) h = ((b-r)/d+2)*60;
      else h = ((r-g)/d+4)*60;
    }
    return [Math.round(h), Math.round(s*100), Math.round(l*100)];
  }

  function close() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    currentCallback = null;
  }

  function open(anchorEl, currentHex, presets, onPick) {
    close();
    currentCallback = onPick;

    const [ch, cs, cl] = hexToHsl(currentHex || '#7c3aed');

    overlay = document.createElement('div');
    overlay.className = 'color-picker-overlay';
    overlay.innerHTML = `
      <div class="color-picker-panel">
        <div class="cp-header">
          <span>Pick a Color</span>
          <button class="cp-close" onclick="ODA_COLOR.close()">&times;</button>
        </div>
        <div class="cp-preview-row">
          <div class="cp-current" style="background:${currentHex}"></div>
          <span class="cp-hex-label">${currentHex}</span>
        </div>
        <div class="cp-presets">${presets.map(c =>
          `<button class="cp-swatch${c === currentHex ? ' active' : ''}" style="background:${c}" data-color="${c}"></button>`
        ).join('')}</div>
        <div class="cp-custom-toggle">
          <button class="cp-custom-btn">Custom Color</button>
        </div>
        <div class="cp-sliders" style="display:none">
          <label>Hue <input type="range" class="cp-hue" min="0" max="360" value="${ch}"></label>
          <label>Saturation <input type="range" class="cp-sat" min="0" max="100" value="${cs}"></label>
          <label>Lightness <input type="range" class="cp-lit" min="0" max="100" value="${cl}"></label>
          <div class="cp-gradient-bar"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Position near anchor
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const panel = overlay.querySelector('.color-picker-panel');
      panel.style.position = 'fixed';
      panel.style.top = Math.min(rect.bottom + 8, window.innerHeight - 400) + 'px';
      panel.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 320)) + 'px';
    }

    // Swatch clicks
    overlay.querySelectorAll('.cp-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        const color = sw.dataset.color;
        if (currentCallback) currentCallback(color);
        close();
      });
    });

    // Custom toggle
    overlay.querySelector('.cp-custom-btn').addEventListener('click', () => {
      const sliders = overlay.querySelector('.cp-sliders');
      sliders.style.display = sliders.style.display === 'none' ? 'block' : 'none';
    });

    // HSL sliders
    const hueSlider = overlay.querySelector('.cp-hue');
    const satSlider = overlay.querySelector('.cp-sat');
    const litSlider = overlay.querySelector('.cp-lit');
    const preview = overlay.querySelector('.cp-current');
    const hexLabel = overlay.querySelector('.cp-hex-label');
    const gradBar = overlay.querySelector('.cp-gradient-bar');

    function updateFromSliders() {
      const hex = hslToHex(+hueSlider.value, +satSlider.value, +litSlider.value);
      preview.style.background = hex;
      hexLabel.textContent = hex;
      // Update gradient bar
      const stops = [];
      for (let i = 0; i <= 360; i += 30) {
        stops.push(hslToHex(i, +satSlider.value, +litSlider.value));
      }
      gradBar.style.background = `linear-gradient(to right, ${stops.join(',')})`;
      if (currentCallback) currentCallback(hex);
    }

    [hueSlider, satSlider, litSlider].forEach(sl => {
      sl.addEventListener('input', updateFromSliders);
    });
    updateFromSliders();

    // Close on overlay click (outside panel)
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });
  }

  return { open, close, hslToHex, hexToHsl };
})();
