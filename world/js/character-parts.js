/* ============================================================
   ODA World — Character Parts Data Catalog (V3)
   All options, colors, configs for the character creator.
   ============================================================ */

const ODA_PARTS = (() => {

  // ── Skin Tones ──────────────────────────────────────────────
  const SKIN_TONES = [
    { id: 'skin1', label: 'Espresso',    hex: '#3A2318' },
    { id: 'skin2', label: 'Deep Brown',  hex: '#4E3226' },
    { id: 'skin3', label: 'Mahogany',    hex: '#6B4226' },
    { id: 'skin4', label: 'Chestnut',    hex: '#8B5E3C' },
    { id: 'skin5', label: 'Caramel',     hex: '#A67B5B' },
    { id: 'skin6', label: 'Honey',       hex: '#C49A6C' },
    { id: 'skin7', label: 'Peach',       hex: '#D4A57B' },
    { id: 'skin8', label: 'Cool Brown',  hex: '#5C4033' },
  ];

  // ── Hair Colors ─────────────────────────────────────────────
  const HAIR_COLORS = [
    { id: 'hc_black',      label: 'Black',        hex: '#1c1410' },
    { id: 'hc_offblack',   label: 'Off-Black',    hex: '#2a1f1a' },
    { id: 'hc_dkbrown',    label: 'Dark Brown',   hex: '#3b2716' },
    { id: 'hc_brown',      label: 'Brown',        hex: '#5c3a1e' },
    { id: 'hc_auburn',     label: 'Auburn',       hex: '#8b3a2a' },
    { id: 'hc_red',        label: 'Red',          hex: '#c0392b' },
    { id: 'hc_blonde',     label: 'Blonde',       hex: '#d4a843' },
    { id: 'hc_platinum',   label: 'Platinum',     hex: '#e8dcc8' },
    { id: 'hc_blue',       label: 'Blue',         hex: '#2e86c1' },
    { id: 'hc_teal',       label: 'Teal',         hex: '#1abc9c' },
    { id: 'hc_purple',     label: 'Purple',       hex: '#8e44ad' },
    { id: 'hc_pink',       label: 'Pink',         hex: '#e84393' },
  ];

  // ── Eye Colors ──────────────────────────────────────────────
  const EYE_COLORS = [
    { id: 'ec_dkbrown',  label: 'Dark Brown',  hex: '#2D1B00' },
    { id: 'ec_ltbrown',  label: 'Light Brown', hex: '#6B4226' },
    { id: 'ec_hazel',    label: 'Hazel',       hex: '#8B7D3C' },
    { id: 'ec_green',    label: 'Green',       hex: '#4A7C59' },
    { id: 'ec_blue',     label: 'Blue',        hex: '#4A7CB5' },
    { id: 'ec_gray',     label: 'Gray',        hex: '#7B8794' },
    { id: 'ec_amber',    label: 'Amber',       hex: '#B8860B' },
  ];

  // ── Face Feature Options ────────────────────────────────────
  const EYE_SHAPES = [
    { id: 'round',      label: 'Round' },
    { id: 'almond',     label: 'Almond' },
    { id: 'wide',       label: 'Wide' },
    { id: 'narrow',     label: 'Narrow' },
    { id: 'upturned',   label: 'Upturned' },
    { id: 'downturned', label: 'Downturned' },
    { id: 'monolid',    label: 'Monolid' },
  ];

  const EYEBROW_STYLES = [
    { id: 'thick_straight', label: 'Thick Straight' },
    { id: 'thin_arched',    label: 'Thin Arched' },
    { id: 'bushy',          label: 'Bushy' },
    { id: 'flat',           label: 'Flat' },
    { id: 'high_arch',      label: 'High Arch' },
    { id: 'rounded',        label: 'Rounded' },
    { id: 'feathered',      label: 'Feathered' },
  ];

  const EYELASH_STYLES = [
    { id: 'none',     label: 'None' },
    { id: 'short',    label: 'Short' },
    { id: 'medium',   label: 'Medium' },
    { id: 'long',     label: 'Long' },
    { id: 'dramatic', label: 'Dramatic' },
  ];

  const NOSE_STYLES = [
    { id: 'button',      label: 'Button' },
    { id: 'wide',        label: 'Wide' },
    { id: 'narrow',      label: 'Narrow' },
    { id: 'rounded',     label: 'Rounded' },
    { id: 'flat_bridge', label: 'Flat Bridge' },
    { id: 'pointed',     label: 'Pointed' },
    { id: 'upturned',    label: 'Upturned' },
  ];

  const MOUTH_STYLES = [
    { id: 'smile',     label: 'Small Smile' },
    { id: 'big_smile', label: 'Big Smile' },
    { id: 'grin',      label: 'Grin' },
    { id: 'smirk',     label: 'Smirk' },
    { id: 'neutral',   label: 'Neutral' },
    { id: 'surprised', label: 'Surprised' },
    { id: 'pout',      label: 'Pout' },
  ];

  const EAR_STYLES = [
    { id: 'default', label: 'Default' },
    { id: 'small',   label: 'Small' },
    { id: 'large',   label: 'Large' },
    { id: 'pointed', label: 'Pointed' },
  ];

  // ── Hair Styles (79 total) ──────────────────────────────────
  const HAIR_STYLES = [
    // === Boys — Short (Barbershop) [14] ===
    { id: 'hair_low_fade',       label: 'Low Fade',               gender: 'boy',  category: 'boys_short',  group: 'Fades' },
    { id: 'hair_mid_fade',       label: 'Mid Fade',               gender: 'boy',  category: 'boys_short',  group: 'Fades' },
    { id: 'hair_high_fade',      label: 'High Fade',              gender: 'boy',  category: 'boys_short',  group: 'Fades' },
    { id: 'hair_burst_fade',     label: 'Burst Fade',             gender: 'boy',  category: 'boys_short',  group: 'Fades' },
    { id: 'hair_taper',          label: 'Taper',                  gender: 'boy',  category: 'boys_short',  group: 'Classic' },
    { id: 'hair_buzz',           label: 'Buzz Cut',               gender: 'boy',  category: 'boys_short',  group: 'Classic' },
    { id: 'hair_high_top',       label: 'High Top Fade',          gender: 'boy',  category: 'boys_short',  group: 'Statement' },
    { id: 'hair_flat_top',       label: 'Flat Top',               gender: 'boy',  category: 'boys_short',  group: 'Statement' },
    { id: 'hair_sponge_curls',   label: 'Sponge Curls + Fade',   gender: 'boy',  category: 'boys_short',  group: 'Textured' },
    { id: 'hair_360_waves',      label: '360 Waves',              gender: 'boy',  category: 'boys_short',  group: 'Textured' },
    { id: 'hair_south_france',   label: 'South of France',        gender: 'boy',  category: 'boys_short',  group: 'Statement' },
    { id: 'hair_frohawk_boy',    label: 'Frohawk',                gender: 'boy',  category: 'boys_short',  group: 'Statement' },
    { id: 'hair_lineup',         label: 'Line Up / Edge Up',      gender: 'boy',  category: 'boys_short',  group: 'Classic' },
    { id: 'hair_caesar',         label: 'Caesar Cut',             gender: 'boy',  category: 'boys_short',  group: 'Classic' },

    // === Boys — Medium/Long [16] ===
    { id: 'hair_twists_boy',        label: 'Two-Strand Twists',       gender: 'boy', category: 'boys_long', group: 'Twists' },
    { id: 'hair_mini_twists',       label: 'Mini Twists',             gender: 'boy', category: 'boys_long', group: 'Twists' },
    { id: 'hair_twistout_boy',      label: 'Twist-Out',               gender: 'boy', category: 'boys_long', group: 'Twists' },
    { id: 'hair_cornrows_boy',      label: 'Cornrows Straight Back',  gender: 'boy', category: 'boys_long', group: 'Braids' },
    { id: 'hair_cornrows_designs',  label: 'Cornrows with Designs',   gender: 'boy', category: 'boys_long', group: 'Braids' },
    { id: 'hair_cornrows_fade',     label: 'Cornrows with Fade',      gender: 'boy', category: 'boys_long', group: 'Braids' },
    { id: 'hair_box_braids_short',  label: 'Box Braids (short)',      gender: 'boy', category: 'boys_long', group: 'Braids' },
    { id: 'hair_starter_locs_boy',  label: 'Starter Locs',            gender: 'boy', category: 'boys_long', group: 'Locs' },
    { id: 'hair_short_locs',        label: 'Short Locs',              gender: 'boy', category: 'boys_long', group: 'Locs' },
    { id: 'hair_medium_locs',       label: 'Medium Locs',             gender: 'boy', category: 'boys_long', group: 'Locs' },
    { id: 'hair_long_locs',         label: 'Long Locs',               gender: 'boy', category: 'boys_long', group: 'Locs' },
    { id: 'hair_freeform_locs_boy', label: 'Freeform Locs',           gender: 'boy', category: 'boys_long', group: 'Locs' },
    { id: 'hair_locs_fade',         label: 'Locs with Fade',          gender: 'boy', category: 'boys_long', group: 'Locs' },
    { id: 'hair_locs_topknot',      label: 'Locs Top Knot',           gender: 'boy', category: 'boys_long', group: 'Locs' },
    { id: 'hair_braided_manbun',    label: 'Braided Man Bun',         gender: 'boy', category: 'boys_long', group: 'Braids' },
    { id: 'hair_mohawk_braids',     label: 'Mohawk Braids',           gender: 'boy', category: 'boys_long', group: 'Braids' },

    // === Girls — Natural [10] ===
    { id: 'hair_twa_girl',        label: 'TWA',                   gender: 'girl', category: 'girls_natural', group: 'Natural' },
    { id: 'hair_afro_small',      label: 'Small Afro',            gender: 'girl', category: 'girls_natural', group: 'Afros' },
    { id: 'hair_afro_medium',     label: 'Medium Afro',           gender: 'girl', category: 'girls_natural', group: 'Afros' },
    { id: 'hair_afro_big',        label: 'Big Afro',              gender: 'girl', category: 'girls_natural', group: 'Afros' },
    { id: 'hair_single_puff',     label: 'Single Puff',           gender: 'girl', category: 'girls_natural', group: 'Puffs' },
    { id: 'hair_double_puffs',    label: 'Double Puffs',          gender: 'girl', category: 'girls_natural', group: 'Puffs' },
    { id: 'hair_pineapple_puff',  label: 'Pineapple Puff',        gender: 'girl', category: 'girls_natural', group: 'Puffs' },
    { id: 'hair_twistout_girl',   label: 'Twist-Out',             gender: 'girl', category: 'girls_natural', group: 'Natural' },
    { id: 'hair_washgo_girl',     label: 'Wash-and-Go',           gender: 'girl', category: 'girls_natural', group: 'Natural' },
    { id: 'hair_bantu_knots_girl',label: 'Bantu Knots',           gender: 'girl', category: 'girls_natural', group: 'Natural' },

    // === Girls — Protective [20] ===
    { id: 'hair_box_braids_long',    label: 'Box Braids (long)',       gender: 'girl', category: 'girls_protective', group: 'Braids' },
    { id: 'hair_box_braids_bob',     label: 'Box Braids (bob)',        gender: 'girl', category: 'girls_protective', group: 'Braids' },
    { id: 'hair_knotless_braids',    label: 'Knotless Braids',         gender: 'girl', category: 'girls_protective', group: 'Braids' },
    { id: 'hair_bohemian_braids',    label: 'Bohemian Box Braids',     gender: 'girl', category: 'girls_protective', group: 'Braids' },
    { id: 'hair_cornrows_girl',      label: 'Cornrows Straight Back',  gender: 'girl', category: 'girls_protective', group: 'Cornrows' },
    { id: 'hair_cornrows_ponytail',  label: 'Cornrows into Ponytail',  gender: 'girl', category: 'girls_protective', group: 'Cornrows' },
    { id: 'hair_lemonade_braids',    label: 'Lemonade Braids',         gender: 'girl', category: 'girls_protective', group: 'Cornrows' },
    { id: 'hair_fulani_braids',      label: 'Fulani Braids',           gender: 'girl', category: 'girls_protective', group: 'Cornrows' },
    { id: 'hair_ghana_braids',       label: 'Ghana Braids',            gender: 'girl', category: 'girls_protective', group: 'Cornrows' },
    { id: 'hair_goddess_braids',     label: 'Goddess Braids',          gender: 'girl', category: 'girls_protective', group: 'Cornrows' },
    { id: 'hair_twists_girl',        label: 'Two-Strand Twists',       gender: 'girl', category: 'girls_protective', group: 'Twists' },
    { id: 'hair_flat_twists',        label: 'Flat Twists',             gender: 'girl', category: 'girls_protective', group: 'Twists' },
    { id: 'hair_flat_twists_puffs',  label: 'Flat Twists into Puffs',  gender: 'girl', category: 'girls_protective', group: 'Twists' },
    { id: 'hair_bantu_knots_prot',   label: 'Bantu Knots',             gender: 'girl', category: 'girls_protective', group: 'Twists' },
    { id: 'hair_faux_locs',          label: 'Faux Locs',               gender: 'girl', category: 'girls_protective', group: 'Locs' },
    { id: 'hair_butterfly_locs',     label: 'Butterfly Locs',          gender: 'girl', category: 'girls_protective', group: 'Locs' },
    { id: 'hair_passion_twists',     label: 'Passion Twists',          gender: 'girl', category: 'girls_protective', group: 'Twists' },
    { id: 'hair_crochet_braids',     label: 'Crochet Braids',          gender: 'girl', category: 'girls_protective', group: 'Braids' },
    { id: 'hair_braids_beads',       label: 'Braids with Beads',       gender: 'girl', category: 'girls_protective', group: 'Braids' },
    { id: 'hair_starter_locs_girl',  label: 'Starter Locs',            gender: 'girl', category: 'girls_protective', group: 'Locs' },

    // === Girls — Styled [8] ===
    { id: 'hair_silk_press',      label: 'Silk Press',              gender: 'girl', category: 'girls_styled', group: 'Straight' },
    { id: 'hair_blowout',         label: 'Blowout',                 gender: 'girl', category: 'girls_styled', group: 'Straight' },
    { id: 'hair_press_curl',      label: 'Press and Curl',          gender: 'girl', category: 'girls_styled', group: 'Curled' },
    { id: 'hair_flexi_rod',       label: 'Flexi Rod Set',           gender: 'girl', category: 'girls_styled', group: 'Curled' },
    { id: 'hair_space_buns',      label: 'Space Buns',              gender: 'girl', category: 'girls_styled', group: 'Up' },
    { id: 'hair_high_ponytail',   label: 'High Ponytail',           gender: 'girl', category: 'girls_styled', group: 'Up' },
    { id: 'hair_two_ponytails',   label: 'Two Ponytails',           gender: 'girl', category: 'girls_styled', group: 'Up' },
    { id: 'hair_half_up',         label: 'Half Up Half Down',       gender: 'girl', category: 'girls_styled', group: 'Up' },

    // === Unisex [12] ===
    { id: 'hair_tapered_afro',      label: 'Tapered Afro',          gender: 'both', category: 'unisex', group: 'Afros' },
    { id: 'hair_short_afro',        label: 'Short Afro',            gender: 'both', category: 'unisex', group: 'Afros' },
    { id: 'hair_twa',               label: 'TWA',                   gender: 'both', category: 'unisex', group: 'Afros' },
    { id: 'hair_short_twists',      label: 'Short Twists',          gender: 'both', category: 'unisex', group: 'Twists' },
    { id: 'hair_finger_coils',      label: 'Finger Coils',          gender: 'both', category: 'unisex', group: 'Natural' },
    { id: 'hair_freeform_locs',     label: 'Freeform Locs',         gender: 'both', category: 'unisex', group: 'Locs' },
    { id: 'hair_cornrows',          label: 'Cornrows',              gender: 'both', category: 'unisex', group: 'Braids' },
    { id: 'hair_frohawk',           label: 'Frohawk',               gender: 'both', category: 'unisex', group: 'Statement' },
    { id: 'hair_fade_natural',      label: 'Fade + Natural Top',    gender: 'both', category: 'unisex', group: 'Fades' },
    { id: 'hair_washgo',            label: 'Wash-and-Go',           gender: 'both', category: 'unisex', group: 'Natural' },
    { id: 'hair_buzz_uni',          label: 'Buzz Cut',              gender: 'both', category: 'unisex', group: 'Classic' },
    { id: 'hair_braids_fade',       label: 'Braids with Fade',      gender: 'both', category: 'unisex', group: 'Braids' },
  ];

  const HAIR_CATEGORIES = {
    boys_short:       'Short (Barbershop)',
    boys_long:        'Medium / Long',
    girls_natural:    'Natural',
    girls_protective: 'Protective',
    girls_styled:     'Styled',
    unisex:           'Unisex',
  };

  // ── Body Types ──────────────────────────────────────────────
  const BODY_TYPES = [
    { id: 'body_boy_avg',   label: 'Average',  gender: 'boy' },
    { id: 'body_boy_slim',  label: 'Slim',     gender: 'boy' },
    { id: 'body_boy_stocky',label: 'Stocky',   gender: 'boy' },
    { id: 'body_boy_tall',  label: 'Tall',     gender: 'boy' },
    { id: 'body_girl_avg',  label: 'Average',  gender: 'girl' },
    { id: 'body_girl_slim', label: 'Slim',     gender: 'girl' },
    { id: 'body_girl_curvy',label: 'Curvy',    gender: 'girl' },
    { id: 'body_girl_tall', label: 'Tall',     gender: 'girl' },
  ];

  // ── Garments ────────────────────────────────────────────────
  const GARMENTS = [
    { id: 'gar_tee',            label: 'T-Shirt',           gender: 'boy',  sleeve: 'short' },
    { id: 'gar_hoodie_boy',     label: 'Hoodie',            gender: 'boy',  sleeve: 'long', hood: true },
    { id: 'gar_jersey',         label: 'Jersey',            gender: 'boy',  sleeve: 'none' },
    { id: 'gar_varsity',        label: 'Varsity Jacket',    gender: 'boy',  sleeve: 'long', twoTone: true },
    { id: 'gar_polo',           label: 'Polo',              gender: 'boy',  sleeve: 'short', collar: true },
    { id: 'gar_tank_boy',       label: 'Tank Top',          gender: 'boy',  sleeve: 'none' },
    { id: 'gar_crewneck',       label: 'Crewneck Sweater',  gender: 'boy',  sleeve: 'long' },
    { id: 'gar_denim_jacket',   label: 'Denim Jacket',      gender: 'boy',  sleeve: 'long', collar: true },
    { id: 'gar_longsleeve',     label: 'Long Sleeve Tee',   gender: 'boy',  sleeve: 'long' },
    { id: 'gar_tee_girl',       label: 'T-Shirt',           gender: 'girl', sleeve: 'short' },
    { id: 'gar_hoodie_girl',    label: 'Hoodie',            gender: 'girl', sleeve: 'long', hood: true },
    { id: 'gar_dress',          label: 'Dress',             gender: 'girl', sleeve: 'short', skirt: true },
    { id: 'gar_skirt_top',      label: 'Skirt + Top',       gender: 'girl', sleeve: 'short', skirt: true },
    { id: 'gar_crop_highwaist', label: 'Crop Top',          gender: 'girl', sleeve: 'none', crop: true },
    { id: 'gar_jumpsuit',       label: 'Jumpsuit',          gender: 'girl', sleeve: 'none' },
    { id: 'gar_tank_girl',      label: 'Tank Top',          gender: 'girl', sleeve: 'none' },
    { id: 'gar_off_shoulder',   label: 'Off-Shoulder Top',  gender: 'girl', sleeve: 'none' },
    { id: 'gar_cardigan',       label: 'Cardigan',          gender: 'girl', sleeve: 'long' },
    { id: 'gar_overalls',       label: 'Overalls',          gender: 'both', sleeve: 'none' },
    { id: 'gar_blazer',         label: 'Blazer',            gender: 'both', sleeve: 'long', collar: true },
    { id: 'gar_zipup',          label: 'Zip-Up Hoodie',     gender: 'both', sleeve: 'long', hood: true },
  ];

  const PATTERNS = [
    { id: 'solid',    label: 'Solid' },
    { id: 'striped',  label: 'Striped' },
    { id: 'camo',     label: 'Camo' },
    { id: 'plaid',    label: 'Plaid' },
    { id: 'polka',    label: 'Polka Dot' },
    { id: 'tiedye',   label: 'Tie-Dye' },
    { id: 'oda_logo', label: 'ODA Logo' },
  ];

  // ── Shoe Types ──────────────────────────────────────────────
  const SHOE_TYPES = [
    { id: 'shoe_sneakers',   label: 'Sneakers' },
    { id: 'shoe_jordans',    label: 'Jordans' },
    { id: 'shoe_hightops',   label: 'High Tops' },
    { id: 'shoe_slides',     label: 'Slides' },
    { id: 'shoe_boots',      label: 'Boots' },
    { id: 'shoe_crocs',      label: 'Crocs' },
    { id: 'shoe_running',    label: 'Running Shoes' },
    { id: 'shoe_platform',   label: 'Platform Sneakers' },
  ];

  // ── Preset Color Swatches ──────────────────────────────────
  const COLOR_PRESETS = [
    '#1c1410', '#2c3e50', '#34495e', '#7f8c8d',
    '#ecf0f1', '#ffffff', '#f5f5dc', '#d4a57b',
    '#c0392b', '#e74c3c', '#e84393', '#fd79a8',
    '#e67e22', '#f39c12', '#f1c40f', '#d4a843',
    '#27ae60', '#2ecc71', '#1abc9c', '#00b894',
    '#2980b9', '#3498db', '#0984e3', '#74b9ff',
    '#8e44ad', '#9b59b6', '#6c5ce7', '#a29bfe',
    '#2d3436', '#636e72',
  ];

  // ── Default Config ──────────────────────────────────────────
  function defaultConfig(gender) {
    const g = gender || 'boy';
    return {
      gender: g,
      skinTone: 'skin3',
      face: {
        eyeShape: 'round',
        eyeColor: '#2D1B00',
        eyebrowStyle: 'thick_straight',
        eyebrowColor: '#1c1410',
        eyelashStyle: 'short',
        eyelashColor: '#1c1410',
        noseStyle: 'wide',
        mouthStyle: 'smile',
        earStyle: 'default',
      },
      hairStyle: g === 'boy' ? 'hair_low_fade' : 'hair_afro_medium',
      hairColor: '#1c1410',
      bodyType: g === 'boy' ? 'body_boy_avg' : 'body_girl_avg',
      outfit: {
        garment: g === 'boy' ? 'gar_hoodie_boy' : 'gar_hoodie_girl',
        primaryColor: '#7c3aed',
        secondaryColor: '#6929c4',
        pattern: 'solid',
      },
      shoes: {
        type: 'shoe_jordans',
        color: '#2c3e50',
        accentColor: '#e74c3c',
      },
    };
  }

  function migrateConfig(cfg) {
    if (!cfg) return defaultConfig();
    if (cfg.face && typeof cfg.face === 'object' && cfg.face.eyeShape) return cfg;
    const g = cfg.gender || 'boy';
    return defaultConfig(g);
  }

  function find(list, id) {
    return list.find(item => item.id === id);
  }

  function filterByGender(list, gender) {
    return list.filter(item => item.gender === gender || item.gender === 'both');
  }

  function getGroups(list) {
    const groups = {};
    for (const item of list) {
      const g = item.group || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }
    return groups;
  }

  function getHairByCategory(gender) {
    const styles = filterByGender(HAIR_STYLES, gender);
    const byCategory = {};
    for (const s of styles) {
      if (!byCategory[s.category]) byCategory[s.category] = [];
      byCategory[s.category].push(s);
    }
    return byCategory;
  }

  function randomConfig() {
    const gender = Math.random() < 0.5 ? 'boy' : 'girl';
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const hairs = filterByGender(HAIR_STYLES, gender);
    const garments = filterByGender(GARMENTS, gender);
    const bodies = filterByGender(BODY_TYPES, gender);

    return {
      gender,
      skinTone: pick(SKIN_TONES).id,
      face: {
        eyeShape: pick(EYE_SHAPES).id,
        eyeColor: pick(EYE_COLORS).hex,
        eyebrowStyle: pick(EYEBROW_STYLES).id,
        eyebrowColor: pick(HAIR_COLORS).hex,
        eyelashStyle: pick(EYELASH_STYLES).id,
        eyelashColor: '#1c1410',
        noseStyle: pick(NOSE_STYLES).id,
        mouthStyle: pick(MOUTH_STYLES).id,
        earStyle: pick(EAR_STYLES).id,
      },
      hairStyle: pick(hairs).id,
      hairColor: pick(HAIR_COLORS).hex,
      bodyType: pick(bodies).id,
      outfit: {
        garment: pick(garments).id,
        primaryColor: pick(COLOR_PRESETS),
        secondaryColor: pick(COLOR_PRESETS),
        pattern: pick(PATTERNS).id,
      },
      shoes: {
        type: pick(SHOE_TYPES).id,
        color: pick(COLOR_PRESETS),
        accentColor: pick(COLOR_PRESETS),
      },
    };
  }

  return {
    SKIN_TONES, HAIR_COLORS, EYE_COLORS,
    EYE_SHAPES, EYEBROW_STYLES, EYELASH_STYLES,
    NOSE_STYLES, MOUTH_STYLES, EAR_STYLES,
    HAIR_STYLES, HAIR_CATEGORIES, BODY_TYPES,
    GARMENTS, PATTERNS, SHOE_TYPES, COLOR_PRESETS,
    defaultConfig, migrateConfig, randomConfig,
    find, filterByGender, getGroups, getHairByCategory,
  };
})();
