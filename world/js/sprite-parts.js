/* ============================================================
   ODA World — Sprite Parts Mapping (V4)
   Maps character config options → LPC sprite sheet URLs.
   Returns ordered layers for the compositor to stack.
   ============================================================ */

const ODA_SPRITE_PARTS = (() => {

  // LPC sprite sheets from GitHub CDN
  const G = 'https://raw.githubusercontent.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets/';

  // ── Body Bases ──────────────────────────────────────────────
  const BODIES = {
    skin1: { boy: G+'body/bodies/male/black.png',   girl: G+'body/bodies/female/black.png' },
    skin2: { boy: G+'body/bodies/male/black.png',   girl: G+'body/bodies/female/black.png' },
    skin3: { boy: G+'body/bodies/male/brown.png',   girl: G+'body/bodies/female/brown.png' },
    skin4: { boy: G+'body/bodies/male/bronze.png',  girl: G+'body/bodies/female/bronze.png' },
    skin5: { boy: G+'body/bodies/male/taupe.png',   girl: G+'body/bodies/female/taupe.png' },
    skin6: { boy: G+'body/bodies/male/olive.png',   girl: G+'body/bodies/female/olive.png' },
    skin7: { boy: G+'body/bodies/male/light.png',   girl: G+'body/bodies/female/light.png' },
    skin8: { boy: G+'body/bodies/male/brown.png',   girl: G+'body/bodies/female/brown.png' },
  };

  // ── Hair Sprites ────────────────────────────────────────────
  // h(folder, file?) returns { boy: url, girl: url }
  // Most LPC hair has male.png / female.png inside the folder.
  // Some use adult.png or a single file.
  function h(folder, file) {
    if (file) return { boy: G+'hair/'+folder+'/'+file, girl: G+'hair/'+folder+'/'+file };
    return { boy: G+'hair/'+folder+'/male.png', girl: G+'hair/'+folder+'/female.png' };
  }
  // For folders with adult.png instead of male/female
  function ha(folder) {
    return { boy: G+'hair/'+folder+'/adult.png', girl: G+'hair/'+folder+'/adult.png' };
  }

  const HAIR = {
    // Afros & Natural
    hair_afro_small:      h('afro'),
    hair_afro_medium:     h('jewfro'),      // jewfro = medium round afro
    hair_afro_big:        h('afro'),
    hair_short_afro:      h('afro'),
    hair_tapered_afro:    h('afro'),
    hair_twa:             h('buzzcut'),
    hair_twa_girl:        h('buzzcut'),
    hair_finger_coils:    h('curly_short'),
    hair_washgo:          h('curly_short'),
    hair_washgo_girl:     h('curly_short'),
    hair_twistout_boy:    h('natural'),
    hair_twistout_girl:   h('natural'),
    hair_blowout:         h('afro'),

    // Locs
    hair_short_locs:        h('dreadlocks_short'),
    hair_medium_locs:       h('dreadlocks_long'),
    hair_long_locs:         h('dreadlocks_long'),
    hair_freeform_locs:     h('dreadlocks_long'),
    hair_freeform_locs_boy: h('dreadlocks_long'),
    hair_starter_locs_boy:  h('dreadlocks_short'),
    hair_starter_locs_girl: h('dreadlocks_short'),
    hair_locs_fade:         h('dreadlocks_short'),
    hair_locs_topknot:      h('bangs_bun'),
    hair_faux_locs:         h('dreadlocks_long'),
    hair_butterfly_locs:    h('dreadlocks_long'),

    // Braids
    hair_box_braids_long:   h('braid'),
    hair_box_braids_bob:    h('braid'),
    hair_box_braids_short:  h('braid'),
    hair_knotless_braids:   h('braid'),
    hair_bohemian_braids:   h('braid'),
    hair_braids_beads:      h('braid'),
    hair_crochet_braids:    h('curly_long'),
    hair_braided_manbun:    h('bangs_bun'),
    hair_braids_fade:       h('braid'),

    // Cornrows
    hair_cornrows:          ha('cornrows'),
    hair_cornrows_boy:      ha('cornrows'),
    hair_cornrows_girl:     ha('cornrows'),
    hair_cornrows_designs:  ha('cornrows'),
    hair_cornrows_fade:     ha('cornrows'),
    hair_cornrows_ponytail: ha('cornrows'),
    hair_lemonade_braids:   ha('cornrows'),
    hair_fulani_braids:     ha('cornrows'),
    hair_ghana_braids:      ha('cornrows'),
    hair_goddess_braids:    h('braid'),

    // Twists
    hair_twists_boy:        h('twists_straight'),
    hair_twists_girl:       h('twists_straight'),
    hair_mini_twists:       h('twists_straight'),
    hair_short_twists:      h('twists_fade'),
    hair_flat_twists:       ha('cornrows'),
    hair_flat_twists_puffs: h('bunches'),
    hair_passion_twists:    h('twists_straight'),
    hair_bantu_knots_girl:  h('bunches'),
    hair_bantu_knots_prot:  h('bunches'),

    // Puffs
    hair_single_puff:       h('high_ponytail'),
    hair_double_puffs:      h('bunches'),
    hair_pineapple_puff:    h('high_ponytail'),

    // Fades & Short
    hair_low_fade:          h('high_and_tight'),
    hair_mid_fade:          h('high_and_tight'),
    hair_high_fade:         h('high_and_tight'),
    hair_burst_fade:        h('high_and_tight'),
    hair_taper:             h('high_and_tight'),
    hair_buzz:              h('buzzcut'),
    hair_buzz_uni:          h('buzzcut'),
    hair_high_top:          h('flat_top_fade'),
    hair_flat_top:          h('flat_top_straight'),
    hair_sponge_curls:      h('curly_short'),
    hair_360_waves:         h('buzzcut'),
    hair_south_france:      h('high_and_tight'),
    hair_lineup:            h('high_and_tight'),
    hair_caesar:            h('buzzcut'),
    hair_fade_natural:      h('high_and_tight'),

    // Statement
    hair_frohawk:           h('longhawk'),
    hair_frohawk_boy:       h('longhawk'),
    hair_mohawk_braids:     h('longhawk'),

    // Styled
    hair_silk_press:        h('long_straight'),
    hair_press_curl:        h('curly_long'),
    hair_flexi_rod:         h('curly_long'),
    hair_space_buns:        h('bunches'),
    hair_high_ponytail:     h('high_ponytail'),
    hair_two_ponytails:     h('pigtails'),
    hair_half_up:           h('half_up'),
  };

  // ── Outfit Sprites ──────────────────────────────────────────
  // Uses white/gray base colors — tinted with user's chosen color
  function o(category, style, color) {
    return { boy: G+'torso/clothes/'+category+'/'+style+'/male/'+color+'.png',
             girl: G+'torso/clothes/'+category+'/'+style+'/female/'+color+'.png' };
  }

  const OUTFITS = {
    gar_tee:            o('shortsleeve','shortsleeve','white'),
    gar_tee_girl:       o('shortsleeve','shortsleeve','white'),
    gar_hoodie_boy:     o('longsleeve','longsleeve','white'),
    gar_hoodie_girl:    o('longsleeve','longsleeve','white'),
    gar_jersey:         o('sleeveless','sleeveless','white'),
    gar_varsity:        o('longsleeve','longsleeve','white'),
    gar_polo:           o('shortsleeve','shortsleeve','white'),
    gar_tank_boy:       o('sleeveless','sleeveless','white'),
    gar_tank_girl:      o('sleeveless','sleeveless','white'),
    gar_crewneck:       o('longsleeve','longsleeve','white'),
    gar_denim_jacket:   o('longsleeve','longsleeve','blue'),
    gar_longsleeve:     o('longsleeve','longsleeve','white'),
    gar_dress:          o('longsleeve','longsleeve','white'), // placeholder
    gar_skirt_top:      o('shortsleeve','shortsleeve','white'),
    gar_crop_highwaist: o('sleeveless','sleeveless','white'),
    gar_jumpsuit:       o('longsleeve','longsleeve','white'),
    gar_off_shoulder:   o('sleeveless','sleeveless','white'),
    gar_cardigan:       o('longsleeve','longsleeve','white'),
    gar_overalls:       o('longsleeve','longsleeve','blue'),
    gar_blazer:         o('longsleeve','longsleeve','charcoal'),
    gar_zipup:          o('longsleeve','longsleeve','gray'),
  };

  // ── Shoe Sprites ────────────────────────────────────────────
  function sh(style, color) {
    return { boy: G+'feet/'+style+'/male/'+color+'.png',
             girl: G+'feet/'+style+'/female/'+color+'.png' };
  }

  const SHOES = {
    shoe_sneakers:  sh('shoes','brown'),
    shoe_jordans:   sh('shoes','brown'),
    shoe_hightops:  sh('shoes','brown'),
    shoe_slides:    sh('sandals','brown'),
    shoe_boots:     sh('boots','brown'),
    shoe_crocs:     sh('sandals','brown'),
    shoe_running:   sh('shoes','brown'),
    shoe_platform:  sh('shoes','brown'),
  };

  // ── Layer Z-Order ───────────────────────────────────────────
  const Z_ORDER = ['body', 'shoes', 'outfit', 'hair'];

  // ── Resolve Layers ──────────────────────────────────────────
  function resolveLayers(config) {
    const gender = config.gender || 'boy';
    const layers = [];

    for (const layerType of Z_ORDER) {
      switch (layerType) {
        case 'body': {
          const skinId = config.skinTone || 'skin3';
          const bodyMap = BODIES[skinId] || BODIES.skin3;
          layers.push({ src: bodyMap[gender] || bodyMap.boy, tint: null });
          break;
        }
        case 'shoes': {
          const shoeType = config.shoes ? config.shoes.type : 'shoe_sneakers';
          const shoeMap = SHOES[shoeType] || SHOES.shoe_sneakers;
          const shoeSrc = shoeMap[gender] || shoeMap.boy;
          const shoeColor = config.shoes ? config.shoes.color : null;
          layers.push({ src: shoeSrc, tint: shoeColor });
          break;
        }
        case 'outfit': {
          const garmentId = config.outfit ? config.outfit.garment : 'gar_tee';
          const outfitMap = OUTFITS[garmentId] || OUTFITS.gar_tee;
          const outfitSrc = outfitMap[gender] || outfitMap.boy;
          const outfitColor = config.outfit ? config.outfit.primaryColor : null;
          layers.push({ src: outfitSrc, tint: outfitColor });
          break;
        }
        case 'hair': {
          const hairId = config.hairStyle || 'hair_afro_medium';
          const hairMap = HAIR[hairId] || HAIR.hair_afro_medium;
          const hairSrc = hairMap[gender] || hairMap.boy;
          const hairColor = config.hairColor || null;
          layers.push({ src: hairSrc, tint: hairColor });
          break;
        }
      }
    }
    return layers;
  }

  function hasSpriteFor(type, id) {
    switch (type) {
      case 'hair': return !!HAIR[id];
      case 'outfit': return !!OUTFITS[id];
      case 'shoes': return !!SHOES[id];
      case 'body': return !!BODIES[id];
      default: return false;
    }
  }

  return { resolveLayers, hasSpriteFor, BODIES, HAIR, OUTFITS, SHOES, Z_ORDER };
})();
