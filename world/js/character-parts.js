/**
 * ODA World — Character Parts Catalog v2
 * Gender-aware, expanded hair, drawn faces, distinct outfit silhouettes.
 * genderFilter: 'all' | 'boy' | 'girl'
 */

var ODA_CHAR = {};

/* ============================================
   Skin Tones
   ============================================ */
ODA_CHAR.skinTones = [
  { id: 'skin1', name: 'Espresso',    value: '#3B2219' },
  { id: 'skin2', name: 'Mahogany',    value: '#5C3425' },
  { id: 'skin3', name: 'Cinnamon',    value: '#8D5524' },
  { id: 'skin4', name: 'Honey',       value: '#C68642' },
  { id: 'skin5', name: 'Peach',       value: '#E8B88A' },
  { id: 'skin6', name: 'Ivory',       value: '#F5D6BA' },
  { id: 'skin7', name: 'Warm Beige',  value: '#D4A76A' },
  { id: 'skin8', name: 'Cool Brown',  value: '#A0724A' }
];

/* ============================================
   Hair Styles — expanded with subcategories
   ============================================ */
ODA_CHAR.hairStyles = [
  // Afros
  { id: 'hair_afro_sm',      name: 'Small Afro',      group: 'Afros',    genderFilter: 'all' },
  { id: 'hair_afro_md',      name: 'Medium Afro',     group: 'Afros',    genderFilter: 'all' },
  { id: 'hair_afro_lg',      name: 'Big Afro',        group: 'Afros',    genderFilter: 'all' },
  { id: 'hair_afro_pick',    name: 'Picked-Out Afro', group: 'Afros',    genderFilter: 'all' },

  // Locs
  { id: 'hair_locs_short',   name: 'Short Locs',      group: 'Locs',     genderFilter: 'all' },
  { id: 'hair_locs_long',    name: 'Long Locs',       group: 'Locs',     genderFilter: 'all' },
  { id: 'hair_locs_freeform',name: 'Freeform Locs',   group: 'Locs',     genderFilter: 'all' },

  // Braids
  { id: 'hair_braids_box',   name: 'Box Braids',      group: 'Braids',   genderFilter: 'all' },
  { id: 'hair_braids_french',name: 'French Braids',   group: 'Braids',   genderFilter: 'all' },
  { id: 'hair_braids_goddess',name:'Goddess Braids',  group: 'Braids',   genderFilter: 'all' },
  { id: 'hair_braids_fulani',name: 'Fulani Braids',   group: 'Braids',   genderFilter: 'all' },

  // Twists & More
  { id: 'hair_twists',       name: 'Twists',          group: 'Twists & More', genderFilter: 'all' },
  { id: 'hair_cornrows',     name: 'Cornrows',        group: 'Twists & More', genderFilter: 'all' },
  { id: 'hair_bantuKnots',   name: 'Bantu Knots',     group: 'Twists & More', genderFilter: 'all' },
  { id: 'hair_puffs',        name: 'Puff Balls',      group: 'Twists & More', genderFilter: 'girl' },

  // Fades & Short
  { id: 'hair_fade',         name: 'Fade',            group: 'Fades & Short', genderFilter: 'boy' },
  { id: 'hair_highTop',      name: 'High Top Fade',   group: 'Fades & Short', genderFilter: 'boy' },
  { id: 'hair_buzz',         name: 'Buzz Cut',        group: 'Fades & Short', genderFilter: 'all' },
  { id: 'hair_short',        name: 'Short Crop',      group: 'Fades & Short', genderFilter: 'all' },

  // Classic
  { id: 'hair_ponytail',     name: 'Ponytail',        group: 'Classic',  genderFilter: 'girl' },
  { id: 'hair_bun',          name: 'Bun',             group: 'Classic',  genderFilter: 'girl' },
  { id: 'hair_spiky',        name: 'Spiky',           group: 'Classic',  genderFilter: 'boy' },
  { id: 'hair_wavy',         name: 'Wavy',            group: 'Classic',  genderFilter: 'all' }
];

/* ============================================
   Hair Colors
   ============================================ */
ODA_CHAR.hairColors = [
  { id: 'hc_black',    name: 'Black',     value: '#1a1a2e' },
  { id: 'hc_dkBrown',  name: 'Dark Brown',value: '#3d2b1f' },
  { id: 'hc_brown',    name: 'Brown',     value: '#6b4423' },
  { id: 'hc_auburn',   name: 'Auburn',    value: '#8B4513' },
  { id: 'hc_red',      name: 'Red',       value: '#c0392b' },
  { id: 'hc_blonde',   name: 'Blonde',    value: '#d4a843' },
  { id: 'hc_purple',   name: 'Purple',    value: '#7c3aed' },
  { id: 'hc_blue',     name: 'Blue',      value: '#118ab2' },
  { id: 'hc_pink',     name: 'Pink',      value: '#ef476f' },
  { id: 'hc_teal',     name: 'Teal',      value: '#06d6a0' }
];

/* ============================================
   Body Types — gender-specific
   ============================================ */
ODA_CHAR.bodyTypes = [
  { id: 'body_boy_avg',    name: 'Average',  genderFilter: 'boy' },
  { id: 'body_boy_slim',   name: 'Slim',     genderFilter: 'boy' },
  { id: 'body_boy_stocky', name: 'Stocky',   genderFilter: 'boy' },
  { id: 'body_boy_tall',   name: 'Tall',     genderFilter: 'boy' },
  { id: 'body_girl_avg',   name: 'Average',  genderFilter: 'girl' },
  { id: 'body_girl_slim',  name: 'Slim',     genderFilter: 'girl' },
  { id: 'body_girl_curvy', name: 'Curvy',    genderFilter: 'girl' },
  { id: 'body_girl_tall',  name: 'Tall',     genderFilter: 'girl' }
];

/* ============================================
   Outfits — distinct silhouettes per outfit
   ============================================ */
ODA_CHAR.outfits = [
  { id: 'out_odaTee',    name: 'ODA Tee',       color: '#06d6a0', accent: '#05b88a', genderFilter: 'all',  type: 'tee' },
  { id: 'out_hoodie',    name: 'Hoodie',         color: '#7c3aed', accent: '#6929c4', genderFilter: 'all',  type: 'hoodie' },
  { id: 'out_jersey',    name: 'Jersey',         color: '#ef476f', accent: '#d63b5e', genderFilter: 'boy',  type: 'jersey' },
  { id: 'out_jacket',    name: 'Varsity Jacket', color: '#118ab2', accent: '#0e6f8e', genderFilter: 'boy',  type: 'varsity' },
  { id: 'out_dress',     name: 'Dress',          color: '#ffd166', accent: '#e6b84d', genderFilter: 'girl', type: 'dress' },
  { id: 'out_overalls',  name: 'Overalls',       color: '#4a90d9', accent: '#3a7bc8', genderFilter: 'all',  type: 'overalls' },
  { id: 'out_blazer',    name: 'Blazer',         color: '#2d3436', accent: '#1e2324', genderFilter: 'all',  type: 'blazer' },
  { id: 'out_sweater',   name: 'Cozy Sweater',   color: '#e17055', accent: '#c85d47', genderFilter: 'all',  type: 'sweater' },
  { id: 'out_tank',      name: 'Tank Top',       color: '#00b894', accent: '#009d7e', genderFilter: 'all',  type: 'tank' },
  { id: 'out_polo',      name: 'Polo Shirt',     color: '#fdcb6e', accent: '#e5b65c', genderFilter: 'boy',  type: 'polo' },
  { id: 'out_skirtTop',  name: 'Skirt & Top',    color: '#a29bfe', accent: '#8c84e8', genderFilter: 'girl', type: 'skirtTop' },
  { id: 'out_jumpsuit',  name: 'Jumpsuit',       color: '#fd79a8', accent: '#e66b96', genderFilter: 'girl', type: 'jumpsuit' }
];

/* ============================================
   Expressions — drawn faces (no emoji)
   ============================================ */
ODA_CHAR.expressions = [
  { id: 'expr_smile',     name: 'Smile',     features: { eyes: 'normal',    brows: 'neutral',    mouth: 'smile' } },
  { id: 'expr_grin',      name: 'Big Grin',   features: { eyes: 'happy',     brows: 'raised',     mouth: 'grin' } },
  { id: 'expr_cool',      name: 'Cool',       features: { eyes: 'shades',    brows: 'neutral',    mouth: 'smirk' } },
  { id: 'expr_wink',      name: 'Wink',       features: { eyes: 'wink',      brows: 'raised',     mouth: 'smile' } },
  { id: 'expr_thinking',  name: 'Thinking',   features: { eyes: 'sideglance',brows: 'furrowed',   mouth: 'flat' } },
  { id: 'expr_laugh',     name: 'Laughing',   features: { eyes: 'closed',    brows: 'raised',     mouth: 'open' } },
  { id: 'expr_confident', name: 'Confident',  features: { eyes: 'normal',    brows: 'raised_one', mouth: 'smirk' } },
  { id: 'expr_surprised', name: 'Surprised',  features: { eyes: 'wide',      brows: 'raised',     mouth: 'ooh' } }
];

/* ============================================
   Shoes
   ============================================ */
ODA_CHAR.shoes = [
  { id: 'shoe_sneakers', name: 'Sneakers',  color: '#e74c3c' },
  { id: 'shoe_jordans',  name: 'Jordans',   color: '#2c3e50' },
  { id: 'shoe_slides',   name: 'Slides',    color: '#27ae60' },
  { id: 'shoe_boots',    name: 'Boots',     color: '#8B4513' },
  { id: 'shoe_hightops', name: 'High Tops', color: '#3498db' },
  { id: 'shoe_crocs',    name: 'Crocs',     color: '#f39c12' }
];

/* ============================================
   Default character config
   ============================================ */
ODA_CHAR.defaultConfig = function (gender) {
  gender = gender || 'boy';
  return {
    gender: gender,
    skinTone: 'skin1',
    hairStyle: gender === 'girl' ? 'hair_puffs' : 'hair_afro_md',
    hairColor: 'hc_black',
    bodyType: gender === 'girl' ? 'body_girl_avg' : 'body_boy_avg',
    outfit: gender === 'girl' ? 'out_dress' : 'out_odaTee',
    expression: 'expr_smile',
    shoes: 'shoe_sneakers'
  };
};

/** Look up a part by id from its category array */
ODA_CHAR.find = function (category, id) {
  var arr = ODA_CHAR[category];
  if (!arr) return null;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].id === id) return arr[i];
  }
  return arr[0];
};

/** Filter parts by gender */
ODA_CHAR.filterByGender = function (category, gender) {
  var arr = ODA_CHAR[category];
  if (!arr) return [];
  return arr.filter(function (item) {
    return !item.genderFilter || item.genderFilter === 'all' || item.genderFilter === gender;
  });
};

/** Get unique groups for a category */
ODA_CHAR.getGroups = function (category) {
  var arr = ODA_CHAR[category];
  if (!arr) return [];
  var groups = []; var seen = {};
  arr.forEach(function (item) {
    if (item.group && !seen[item.group]) { groups.push(item.group); seen[item.group] = true; }
  });
  return groups;
};

/** Migrate old config IDs to v2 */
ODA_CHAR.migrateConfig = function (cfg) {
  if (!cfg.gender) cfg.gender = 'boy';
  // Old hair IDs → new
  var hairMap = { 'hair_afro': 'hair_afro_md', 'hair_fro_pick': 'hair_afro_pick', 'hair_locs': 'hair_locs_short', 'hair_braids': 'hair_braids_box' };
  if (hairMap[cfg.hairStyle]) cfg.hairStyle = hairMap[cfg.hairStyle];
  // Old body IDs → new
  var bodyMap = { 'body_avg': 'body_boy_avg', 'body_slim': 'body_boy_slim', 'body_stocky': 'body_boy_stocky', 'body_tall': 'body_boy_tall' };
  if (bodyMap[cfg.bodyType]) cfg.bodyType = bodyMap[cfg.bodyType];
  return cfg;
};
