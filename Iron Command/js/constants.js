// ═══════════════════════════════════════════════════
//  IRON COMMAND — Constants & Game Data
// ═══════════════════════════════════════════════════

'use strict';

// ─── Map / Rendering ─────────────────────────────────────────────────────────
const CELL        = 32;          // tile size in pixels
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 50;
const MINIMAP_W   = 200;
const MINIMAP_H   = 125;
const EDGE_PAN_MARGIN = 24;      // px from edge that triggers pan
const EDGE_PAN_SPEED  = 10;      // tiles/sec
const SCROLL_SPEED    = 10;      // tiles/sec (keyboard)
const TICK_MS         = 16;      // ~60fps

// ─── Terrain ─────────────────────────────────────────────────────────────────
const TERRAIN = {
  grass:    { label:'Grass',    color:'#3a7a2a', groundOk:true,  airOk:true,  speedMult:1.00, stealth:false },
  road:     { label:'Road',     color:'#888880', groundOk:true,  airOk:true,  speedMult:1.10, stealth:false },
  mud:      { label:'Mud',      color:'#7a5a30', groundOk:true,  airOk:true,  speedMult:0.80, stealth:false },
  sand:     { label:'Sand',     color:'#d4b96a', groundOk:true,  airOk:true,  speedMult:1.00, stealth:false },
  snow:     { label:'Snow',     color:'#ddeeff', groundOk:true,  airOk:true,  speedMult:1.00, stealth:false },
  water:    { label:'Water',    color:'#2060b0', groundOk:false, airOk:true,  speedMult:1.00, stealth:false },
  mountain: { label:'Mountain', color:'#6a5a48', groundOk:false, airOk:true,  speedMult:1.00, stealth:false },
  forest:   { label:'Forest',   color:'#1a5a1a', groundOk:true,  airOk:true,  speedMult:0.85, stealth:true  },
  ore:      { label:'Ore',      color:'#c8a820', groundOk:true,  airOk:true,  speedMult:0.90, stealth:false, incomePerSec:2 },
};

// ─── Win Conditions ───────────────────────────────────────────────────────────
const WIN_CONDITIONS = {
  destroy_enemy_hq: 'Destroy Enemy HQ',
  destroy_all:      'Destroy All Enemies',
  capture_zone:     'Capture Zone',
  survive_waves:    'Survive N Waves',
  escort:           'Escort Jeep to Right Edge',
};

// ─── Unit Definitions ─────────────────────────────────────────────────────────
// dmgType   : 'bullet' | 'armor'
// bulletArmor: resistance to bullet damage (0–1)
// armorArmor : resistance to armor-piercing damage (0–1)
// los        : line-of-sight radius in tiles
// isAir      : true = aircraft rules (ignore terrain, no ground collision)
// canGarrison: can enter neutral bunkers
// produces   : which building produces this unit
// ammo       : shots before RTB (aircraft only), null = unlimited
// reloadTime : seconds to reload at airfield (aircraft only)
// splash     : splash radius in tiles (bombers only)

const UNIT_DEF = {
  rifleman: {
    label:'Rifleman',     icon:'RF',
    color:'#3366dd',
    hp:55, atk:18,   dmgType:'bullet',
    bulletArmor:0.00, armorArmor:0.00,
    range:1.8,  los:4, speed:1.2,
    cost:50,  buildTime:4,
    isAir:false, canGarrison:true,
    produces:'barracks',
    ammo:null,
  },
  missile: {
    label:'Msle Trooper', icon:'MT',
    color:'#2255bb',
    hp:45, atk:35,   dmgType:'armor',
    bulletArmor:0.00, armorArmor:0.00,
    range:2.5,  los:3, speed:1.0,
    cost:90,  buildTime:6,
    isAir:false, canGarrison:true,
    produces:'barracks',
    ammo:null,
  },
  light_jeep: {
    label:'Light Jeep',   icon:'LJ',
    color:'#2288aa',
    hp:70,  atk:22,  dmgType:'bullet',
    bulletArmor:0.30, armorArmor:0.10,
    range:2.2,  los:5, speed:2.2,
    cost:80,  buildTime:5,
    isAir:false, canGarrison:false,
    produces:'factory',
    ammo:null,
  },
  light_tank: {
    label:'Light Tank',   icon:'LT',
    color:'#1a6688',
    hp:130, atk:38,  dmgType:'armor',
    bulletArmor:0.60, armorArmor:0.25,
    range:2.0,  los:3, speed:1.4,
    cost:140, buildTime:9,
    isAir:false, canGarrison:false,
    produces:'factory',
    ammo:null,
  },
  heavy_tank: {
    label:'Heavy Tank',   icon:'HT',
    color:'#114466',
    hp:220, atk:60,  dmgType:'armor',
    bulletArmor:0.85, armorArmor:0.45,
    range:2.0,  los:3, speed:0.85,
    cost:220, buildTime:13,
    isAir:false, canGarrison:false,
    produces:'factory',
    ammo:null,
  },
  fighter: {
    label:'Fighter',      icon:'FT',
    color:'#7744cc',
    hp:80,  atk:45,  dmgType:'bullet',
    bulletArmor:0.10, armorArmor:0.00,
    range:3.0,  los:7, speed:3.5,
    cost:160, buildTime:11,
    isAir:true, canGarrison:false,
    produces:'airport',
    ammo:3, reloadTime:10, splash:0,
  },
  bomber: {
    label:'Bomber',       icon:'BM',
    color:'#553399',
    hp:110, atk:120, dmgType:'armor',
    bulletArmor:0.20, armorArmor:0.10,
    range:2.5,  los:5, speed:2.5,
    cost:240, buildTime:15,
    isAir:true, canGarrison:false,
    produces:'airport',
    ammo:1, reloadTime:14, splash:1,
  },
};

// Enemy mirrors — same stats, different colors
const ENEMY_UNIT_DEF = {
  e_rifleman:   { ...UNIT_DEF.rifleman,   label:'E.Rifleman',   color:'#cc3322', produces:null },
  e_missile:    { ...UNIT_DEF.missile,    label:'E.Missile',    color:'#aa2211', produces:null },
  e_jeep:       { ...UNIT_DEF.light_jeep, label:'E.Jeep',       color:'#cc4411', produces:null, speed:2.0 },
  e_light_tank: { ...UNIT_DEF.light_tank, label:'E.Lt Tank',    color:'#aa3311', produces:null, speed:1.3 },
  e_heavy_tank: { ...UNIT_DEF.heavy_tank, label:'E.Hv Tank',    color:'#881100', produces:null, speed:0.8 },
  e_fighter:    { ...UNIT_DEF.fighter,    label:'E.Fighter',    color:'#993388', produces:null, speed:3.2 },
  e_bomber:     { ...UNIT_DEF.bomber,     label:'E.Bomber',     color:'#772277', produces:null, speed:2.3 },
};

// ─── Building Definitions ─────────────────────────────────────────────────────
// atk        : auto-attack damage per hit (defensive structures)
// dmgType    : damage type for auto-attack
// range      : auto-attack range in tiles
// antiAir    : if true, only targets aircraft
// antiGround : if true, only targets ground units (default for non-SAM)
// produces   : array of unit keys this building can produce
// buildRadius: max tile distance from existing friendly building for placement
// capturable : neutral building that infantry can capture (10 sec)
// garrisonable: infantry can garrison inside
// maxGarrison: max infantry that can garrison
// income     : gold/sec bonus when captured (neutral buildings)
// losBonus   : adds to all friendly unit LoS when captured

const BLDG_DEF = {
  // ── Player ──────────────────────────────────────────────
  hq: {
    label:'HQ', color:'#ddaa00',
    hp:400, bulletArmor:0.40, armorArmor:0.20,
    los:4, isPlayerHQ:true,
    buildRadius:null,
  },
  barracks: {
    label:'Barracks', color:'#2255cc',
    hp:120, bulletArmor:0.20, armorArmor:0.00,
    los:3, buildRadius:3,
    produces:['rifleman','missile'],
  },
  factory: {
    label:'Factory', color:'#335577',
    hp:150, bulletArmor:0.30, armorArmor:0.10,
    los:3, buildRadius:3,
    produces:['light_jeep','light_tank','heavy_tank'],
  },
  airport: {
    label:'Airport', color:'#553399',
    hp:130, bulletArmor:0.10, armorArmor:0.00,
    los:3, buildRadius:3,
    produces:['fighter','bomber'],
  },
  pillbox: {
    label:'Pillbox', color:'#557755',
    hp:100, bulletArmor:0.50, armorArmor:0.10,
    los:4, buildRadius:3,
    atk:22, dmgType:'bullet', range:3.0,
    antiAir:false, antiGround:true,
  },
  turret: {
    label:'Turret', color:'#446655',
    hp:130, bulletArmor:0.60, armorArmor:0.30,
    los:4, buildRadius:3,
    atk:45, dmgType:'armor', range:3.5,
    antiAir:false, antiGround:true,
  },
  sam: {
    label:'SAM Site', color:'#336655',
    hp:110, bulletArmor:0.30, armorArmor:0.15,
    los:5, buildRadius:3,
    atk:55, dmgType:'armor', range:5.5,
    antiAir:true, antiGround:false,
    fireRate:2.5,   // seconds between shots
  },
  medic: {
    label:'Medic Tent', color:'#44bb44',
    hp:70, bulletArmor:0.00, armorArmor:0.00,
    los:2, buildRadius:3,
    healRate:6,     // hp/sec to nearby friendly units
    healRadius:2.5, // tiles
  },
  wall: {
    label:'Wall', color:'#998877',
    hp:200, bulletArmor:0.60, armorArmor:0.30,
    los:0, buildRadius:3,
  },

  // ── Enemy mirrors ────────────────────────────────────────
  e_hq: {
    label:'Enemy HQ', color:'#cc3322',
    hp:400, bulletArmor:0.40, armorArmor:0.20,
    los:4, isEnemyHQ:true,
  },
  e_barracks: {
    label:'E.Barracks', color:'#aa2211',
    hp:120, bulletArmor:0.20, armorArmor:0.00,
    los:3, produces:['e_rifleman','e_missile'],
  },
  e_factory: {
    label:'E.Factory', color:'#882200',
    hp:150, bulletArmor:0.30, armorArmor:0.10,
    los:3, produces:['e_jeep','e_light_tank','e_heavy_tank'],
  },
  e_airport: {
    label:'E.Airport', color:'#661188',
    hp:130, bulletArmor:0.10, armorArmor:0.00,
    los:3, produces:['e_fighter','e_bomber'],
  },
  e_pillbox: {
    label:'E.Pillbox', color:'#994422',
    hp:100, bulletArmor:0.50, armorArmor:0.10,
    los:4,
    atk:22, dmgType:'bullet', range:3.0,
    antiAir:false, antiGround:true,
  },
  e_turret: {
    label:'E.Turret', color:'#883311',
    hp:130, bulletArmor:0.60, armorArmor:0.30,
    los:4,
    atk:45, dmgType:'armor', range:3.5,
    antiAir:false, antiGround:true,
  },
  e_sam: {
    label:'E.SAM Site', color:'#224433',
    hp:110, bulletArmor:0.30, armorArmor:0.15,
    los:5,
    atk:55, dmgType:'armor', range:5.5,
    antiAir:true, antiGround:false,
    fireRate:2.5,
  },

  // ── Neutral (capturable) ─────────────────────────────────
  neutral_oil: {
    label:'Oil Derrick', color:'#888844',
    hp:80, bulletArmor:0.10, armorArmor:0.00,
    los:2, capturable:true, captureTime:10,
    income:10,   // gold/sec when held
  },
  neutral_comm: {
    label:'Comm Tower', color:'#558888',
    hp:80, bulletArmor:0.10, armorArmor:0.00,
    los:8, capturable:true, captureTime:10,
    losBonus:1,  // added to all friendly unit LoS
  },
  neutral_bunk: {
    label:'Bunker', color:'#777766',
    hp:150, bulletArmor:0.60, armorArmor:0.20,
    los:4, capturable:true, captureTime:10,
    garrisonable:true, maxGarrison:3,
    garrisonDmgReduction:0.50,  // 50% damage reduction to garrisoned units
    garrisonAtk:14,             // garrison fires out at this base damage
    garrisonRange:3,
  },
};

// ─── Build costs for player-placeable buildings ───────────────────────────────
const BUILD_COSTS = {
  barracks: 120,
  factory:  180,
  airport:  220,
  pillbox:   80,
  turret:   140,
  sam:      160,
  medic:    100,
  wall:      50,
};

// ─── Which buildings the player can place in-game ────────────────────────────
const PLAYER_BUILD_BLDGS = ['barracks','factory','airport','pillbox','turret','sam','medic','wall'];

// ─── Editor tool groups ───────────────────────────────────────────────────────
const EDITOR_TOOL_GROUPS = [
  {
    label: 'Terrain',
    tools: Object.entries(TERRAIN).map(([k, v]) => ({ key:'terrain_'+k, label:v.label })),
  },
  {
    label: 'Your Units',
    tools: Object.entries(UNIT_DEF).map(([k, v]) => ({ key:'punit_'+k, label:v.label })),
  },
  {
    label: 'Enemy Units',
    tools: Object.entries(ENEMY_UNIT_DEF).map(([k, v]) => ({ key:'eunit_'+k, label:v.label })),
  },
  {
    label: 'Your Buildings',
    tools: ['hq','barracks','factory','airport','pillbox','turret','sam','medic','wall']
      .map(k => ({ key:'pbld_'+k, label:BLDG_DEF[k].label })),
  },
  {
    label: 'Enemy Buildings',
    tools: ['e_hq','e_barracks','e_factory','e_airport','e_pillbox','e_turret','e_sam']
      .map(k => ({ key:'ebld_'+k, label:BLDG_DEF[k].label })),
  },
  {
    label: 'Neutral',
    tools: ['neutral_oil','neutral_comm','neutral_bunk']
      .map(k => ({ key:'nbld_'+k, label:BLDG_DEF[k].label })),
  },
  {
    label: 'Tools',
    tools: [{ key:'erase', label:'Erase' }],
  },
];

// ─── Enemy production schedule ────────────────────────────────────────────────
// Each enemy production building picks a random unit from its produces list
// every ENEMY_PROD_INTERVAL ticks
const ENEMY_PROD_INTERVAL = 480; // ~8 seconds at 60fps

// ─── Fog of War states ────────────────────────────────────────────────────────
const FOG = { BLACK:0, GREY:1, VISIBLE:2 };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function mkId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function cellCenter(col, row) {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

function worldToCell(wx, wy) {
  return { col: Math.floor(wx / CELL), row: Math.floor(wy / CELL) };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function isEnemyType(type) {
  return type.startsWith('e_');
}

function isNeutralType(type) {
  return type.startsWith('neutral_');
}

function getUnitDef(type) {
  return UNIT_DEF[type] || ENEMY_UNIT_DEF[type] || null;
}

function getBldgDef(type) {
  return BLDG_DEF[type] || null;
}
