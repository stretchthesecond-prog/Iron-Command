// ═══════════════════════════════════════════════════
//  IRON COMMAND — Combat System
// ═══════════════════════════════════════════════════

'use strict';

const Combat = (() => {

  // ─── Damage calculation ───────────────────────────────────────────────────────
  // atk      : base attack value
  // dmgType  : 'bullet' | 'armor'
  // targetDef: the BLDG_DEF or UNIT_DEF of the target
  // Returns the final damage after armour reduction.
  // Minimum damage is always 1 (even rifle vs heavy tank).
  function calcDamage(atk, dmgType, targetDef) {
    if (!targetDef) return atk;
    const resistance = dmgType === 'bullet'
      ? (targetDef.bulletArmor || 0)
      : (targetDef.armorArmor  || 0);
    return Math.max(1, atk * (1 - resistance));
  }

  // ─── Garrison damage reduction ────────────────────────────────────────────────
  // Apply damage reduction to a garrisoned infantry unit.
  // Returns the reduced damage value.
  function garrisonDamage(rawDmg, bunkerDef) {
    const reduction = bunkerDef?.garrisonDmgReduction || 0.5;
    return rawDmg * (1 - reduction);
  }

  // ─── Target selection ─────────────────────────────────────────────────────────
  // Find the best target for a unit or building within range.
  //
  // attacker   : { px, py, type } or { col, row, type } for buildings
  // candidates : array of potential targets (units or buildings)
  // rangeTiles : attack range in tiles
  // preferType : 'any' | 'air' | 'ground' — filter by target category
  //
  // Returns the nearest valid target object, or null.

  function findTarget(attackerPos, candidates, rangeTiles, preferType) {
    const rangeWorld = rangeTiles * CELL;
    let best = null;
    let bestDist = Infinity;

    for (const t of candidates) {
      if (t.dead) continue;

      // Position of candidate
      const tx = t.px !== undefined ? t.px : t.col * CELL + CELL / 2;
      const ty = t.py !== undefined ? t.py : t.row * CELL + CELL / 2;

      const dx = attackerPos.x - tx;
      const dy = attackerPos.y - ty;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d > rangeWorld) continue;

      // Type filter
      if (preferType === 'air') {
        const def = getUnitDef(t.type);
        if (!def || !def.isAir) continue;
      } else if (preferType === 'ground') {
        const def = getUnitDef(t.type) || getBldgDef(t.type);
        // Buildings are always "ground"
        if (def && def.isAir) continue;
      }

      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }

    return best;
  }

  // ─── Apply damage to a target ─────────────────────────────────────────────────
  // Returns true if the target was killed.
  function applyDamage(target, amount) {
    target.hp -= amount;
    if (target.hp <= 0) {
      target.hp = 0;
      target.dead = true;
      return true;
    }
    return false;
  }

  // ─── Splash damage ────────────────────────────────────────────────────────────
  // Apply splash damage around an impact point.
  // epicenter : { x, y } in world pixels
  // radius    : splash radius in tiles
  // atk       : base attack of the weapon
  // dmgType   : 'bullet' | 'armor'
  // targets   : array of units/buildings to check
  // exclude   : object to exclude (the primary target, already hit)
  //
  // Damage falls off linearly from full at centre to 25% at edge.

  function applySplash(epicenter, radiusTiles, atk, dmgType, targets, exclude) {
    const radiusWorld = radiusTiles * CELL;
    const killed = [];

    for (const t of targets) {
      if (t.dead) continue;
      if (t === exclude) continue;

      const tx = t.px !== undefined ? t.px : t.col * CELL + CELL / 2;
      const ty = t.py !== undefined ? t.py : t.row * CELL + CELL / 2;
      const dx = epicenter.x - tx;
      const dy = epicenter.y - ty;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d > radiusWorld) continue;

      const falloff = 1 - (d / radiusWorld) * 0.75; // 1.0 at centre, 0.25 at edge
      const def = getUnitDef(t.type) || getBldgDef(t.type);
      const dmg = calcDamage(atk * falloff, dmgType, def);

      if (applyDamage(t, dmg)) {
        killed.push(t);
      }
    }

    return killed;
  }

  // ─── Building auto-attack tick ────────────────────────────────────────────────
  // Process one frame of auto-attack for all defensive buildings on one side.
  //
  // buildings  : array of buildings belonging to the firing side
  // targets    : array of enemy units (and optionally enemy buildings)
  // dt         : delta time in seconds
  // isEnemy    : true if these are enemy buildings firing at player
  //
  // Mutates target hp/dead. Returns array of { explosion } events.

  function tickBuildingAttacks(buildings, enemyUnits, enemyBuildings, dt, explosions) {
    for (const b of buildings) {
      if (b.dead) continue;
      const bd = getBldgDef(b.type);
      if (!bd || !bd.atk) continue;

      // Cooldown
      b.atkCd = (b.atkCd || 0) - dt;
      if (b.atkCd > 0) continue;

      const bx = b.col * CELL + CELL / 2;
      const by = b.row * CELL + CELL / 2;
      const pos = { x: bx, y: by };

      let target = null;

      if (bd.antiAir) {
        // SAM — only targets aircraft
        target = findTarget(pos, enemyUnits, bd.range, 'air');
      } else if (bd.antiGround) {
        // Pillbox / turret — only targets ground units and buildings
        const groundUnits = enemyUnits.filter(u => {
          const def = getUnitDef(u.type);
          return def && !def.isAir;
        });
        target = findTarget(pos, groundUnits, bd.range, 'ground')
               || findTarget(pos, enemyBuildings, bd.range, 'ground');
      } else {
        // Generic — targets anything
        target = findTarget(pos, enemyUnits, bd.range, 'any')
               || findTarget(pos, enemyBuildings, bd.range, 'any');
      }

      if (!target) continue;

      const targetDef = getUnitDef(target.type) || getBldgDef(target.type);
      const dmg = calcDamage(bd.atk, bd.dmgType, targetDef);
      const killed = applyDamage(target, dmg);

      // Fire rate: default 1 shot/sec, SAM uses bd.fireRate
      const fireRate = bd.fireRate || 1.0;
      b.atkCd = fireRate;

      // Spawn explosion effect at target
      const tx = target.px !== undefined ? target.px : target.col * CELL + CELL / 2;
      const ty = target.py !== undefined ? target.py : target.row * CELL + CELL / 2;
      if (explosions) {
        explosions.push({ x: tx, y: ty, r: killed ? CELL * 0.9 : CELL * 0.5, t: 0, maxT: 0.4 });
      }
    }
  }

  // ─── Unit attack tick ─────────────────────────────────────────────────────────
  // Process one frame of attack for a single unit.
  // Finds the best target, applies damage, handles aircraft ammo.
  //
  // unit          : the attacking unit
  // enemyUnits    : array of enemy units
  // enemyBuildings: array of enemy buildings
  // dt            : delta time in seconds
  // explosions    : array to push visual events into
  // allEnemies    : used for splash (pass same as enemyUnits + enemyBuildings merged)
  //
  // Returns: 'attacked' | 'outofammo' | 'nontarget' | null

  function tickUnitAttack(unit, enemyUnits, enemyBuildings, dt, explosions, allEnemies) {
    const ud = getUnitDef(unit.type);
    if (!ud) return null;

    // Cooldown
    unit.atkCd = (unit.atkCd || 0) - dt;
    if (unit.atkCd > 0) return null;

    const pos = { x: unit.px, y: unit.py };

    // Aircraft: only attack if they have ammo and are not reloading
    if (ud.isAir) {
      if (unit.reloading || unit.ammo === 0) return 'outofammo';
    }

    // Find target — prefer units, then buildings
    let target = null;
    let targetIsBuilding = false;

    if (ud.isAir) {
      // Aircraft attack ground units and buildings (not other aircraft for now)
      const groundUnits = enemyUnits.filter(u => {
        const def = getUnitDef(u.type);
        return def && !def.isAir;
      });
      target = findTarget(pos, groundUnits, ud.range, 'ground')
             || findTarget(pos, enemyBuildings, ud.range, 'ground');
      if (!target) {
        target = findTarget(pos, enemyUnits, ud.range, 'any');
      }
    } else {
      // Ground units attack anything in range
      target = findTarget(pos, enemyUnits, ud.range, 'any')
             || findTarget(pos, enemyBuildings, ud.range, 'any');
    }

    if (!target) return 'notarget';
    targetIsBuilding = (target.px === undefined);

    const targetDef = getUnitDef(target.type) || getBldgDef(target.type);
    const dmg = calcDamage(ud.atk, ud.dmgType, targetDef);
    const killed = applyDamage(target, dmg);

    // Splash damage (bombers)
    if (ud.splash && ud.splash > 0) {
      const epicenter = {
        x: target.px !== undefined ? target.px : target.col * CELL + CELL / 2,
        y: target.py !== undefined ? target.py : target.row * CELL + CELL / 2,
      };
      const splashTargets = [...enemyUnits, ...enemyBuildings];
      applySplash(epicenter, ud.splash, ud.atk, ud.dmgType, splashTargets, target);

      if (explosions) {
        explosions.push({ x: epicenter.x, y: epicenter.y, r: ud.splash * CELL, t: 0, maxT: 0.6 });
      }
    } else if (explosions) {
      const tx = target.px !== undefined ? target.px : target.col * CELL + CELL / 2;
      const ty = target.py !== undefined ? target.py : target.row * CELL + CELL / 2;
      explosions.push({ x: tx, y: ty, r: killed ? CELL * 0.8 : CELL * 0.4, t: 0, maxT: 0.35 });
    }

    // Attack cooldown: 1 shot per second for most units
    unit.atkCd = 1.0;

    // Aircraft ammo
    if (ud.isAir && ud.ammo !== null) {
      unit.ammo = Math.max(0, (unit.ammo || 0) - 1);
      if (unit.ammo === 0) {
        unit.reloading = true;
        unit.reloadCd = ud.reloadTime || 10;
        return 'outofammo';
      }
    }

    return 'attacked';
  }

  // ─── Garrison fire ────────────────────────────────────────────────────────────
  // Garrisoned infantry fire out of a captured bunker.
  //
  // bunker     : the bunker building object
  // enemyUnits : array of enemy units
  // dt         : delta time in seconds
  // explosions : explosion events array

  function tickGarrisonFire(bunker, enemyUnits, dt, explosions) {
    if (!bunker.garrison || bunker.garrison.length === 0) return;
    const bd = getBldgDef(bunker.type);
    if (!bd || !bd.garrisonable) return;

    bunker.atkCd = (bunker.atkCd || 0) - dt;
    if (bunker.atkCd > 0) return;

    const pos = { x: bunker.col * CELL + CELL / 2, y: bunker.row * CELL + CELL / 2 };
    const target = findTarget(pos, enemyUnits, bd.garrisonRange || 3, 'ground');
    if (!target) return;

    // Each garrisoned soldier fires
    const shots = bunker.garrison.length;
    const baseDmg = bd.garrisonAtk || 14;
    const totalDmg = baseDmg * shots;
    const targetDef = getUnitDef(target.type);
    const dmg = calcDamage(totalDmg, 'bullet', targetDef);
    applyDamage(target, dmg);

    bunker.atkCd = 0.8; // garrison fires every 0.8s

    if (explosions) {
      explosions.push({ x: target.px, y: target.py, r: CELL * 0.3, t: 0, maxT: 0.25 });
    }
  }

  // ─── Medic heal tick ──────────────────────────────────────────────────────────
  function tickMedicHeal(medic, friendlyUnits, dt) {
    const bd = getBldgDef(medic.type);
    if (!bd || !bd.healRate) return;

    const mx = medic.col * CELL + CELL / 2;
    const my = medic.row * CELL + CELL / 2;
    const healRadius = (bd.healRadius || 2.5) * CELL;

    for (const u of friendlyUnits) {
      if (u.dead) continue;
      if (u.hp >= u.maxHp) continue;
      const dx = u.px - mx, dy = u.py - my;
      if (dx * dx + dy * dy <= healRadius * healRadius) {
        u.hp = Math.min(u.maxHp, u.hp + bd.healRate * dt);
      }
    }
  }

  // ─── Update explosion particles ───────────────────────────────────────────────
  // Advances all explosion timers. Removes finished ones.
  // Returns the updated (filtered) array.
  function tickExplosions(explosions, dt) {
    for (const e of explosions) {
      e.t += dt;
    }
    return explosions.filter(e => e.t < e.maxT);
  }

  // ─── Check win / lose conditions ──────────────────────────────────────────────
  // Returns 'victory' | 'defeat' | null
  function checkEndCondition(state) {
    const { level, units, enemies, buildings } = state;
    const wc = level.winCondition;

    // Defeat: player HQ destroyed
    const playerHQ = buildings.find(b => b.type === 'hq' && !b.dead);
    if (!playerHQ) return 'defeat';

    // Defeat: all player units dead and no production buildings left
    const aliveUnits = units.filter(u => !u.dead);
    const aliveProd  = buildings.filter(b => !b.dead && !isEnemyType(b.type) && getBldgDef(b.type)?.produces);
    if (aliveUnits.length === 0 && aliveProd.length === 0) return 'defeat';

    switch (wc) {
      case 'destroy_enemy_hq': {
        const eHQ = buildings.find(b => b.type === 'e_hq');
        if (eHQ && eHQ.dead) return 'victory';
        break;
      }
      case 'destroy_all': {
        const aliveEnemies = enemies.filter(e => !e.dead);
        const aliveEBldgs  = buildings.filter(b => isEnemyType(b.type) && !b.dead);
        if (aliveEnemies.length === 0 && aliveEBldgs.length === 0) return 'victory';
        break;
      }
      case 'capture_zone': {
        const zone = buildings.find(b => b.type === 'neutral_bunk' || b.type === 'neutral_oil' || b.type === 'neutral_comm');
        // Use first capturable building as the zone target
        const capZone = buildings.find(b => isNeutralType(b.type) && b.captureTeam === 'player' && b.captureProgress >= 100);
        if (capZone) return 'victory';
        break;
      }
      case 'survive_waves': {
        if ((state.wavesSurvived || 0) >= (level.winParam || 5)) return 'victory';
        break;
      }
      case 'escort': {
        const escort = units.find(u => u.type === 'light_jeep' && !u.dead);
        if (escort && Math.floor(escort.px / CELL) >= level.cols - 2) return 'victory';
        break;
      }
    }

    return null;
  }

  // ─── Capture tick ─────────────────────────────────────────────────────────────
  // Handle infantry capturing neutral buildings.
  // nearbyPlayerInf : player infantry units adjacent to the building
  // nearbyEnemyInf  : enemy infantry units adjacent to the building
  // building        : the neutral building object
  // dt              : delta time
  //
  // Mutates building.captureProgress and building.captureTeam.

  function tickCapture(building, nearbyPlayerInf, nearbyEnemyInf, dt) {
    const bd = getBldgDef(building.type);
    if (!bd || !bd.capturable) return;

    const captureTime = bd.captureTime || 10;
    const rate = (100 / captureTime) * dt;

    if (nearbyPlayerInf.length > 0 && nearbyEnemyInf.length === 0) {
      if (building.captureTeam !== 'player') {
        building.captureProgress = Math.min(100, (building.captureProgress || 0) + rate);
        if (building.captureProgress >= 100) {
          building.captureTeam = 'player';
        }
      }
    } else if (nearbyEnemyInf.length > 0 && nearbyPlayerInf.length === 0) {
      if (building.captureTeam !== 'enemy') {
        building.captureProgress = Math.min(100, (building.captureProgress || 0) + rate);
        if (building.captureProgress >= 100) {
          building.captureTeam = 'enemy';
        }
      }
    } else if (nearbyPlayerInf.length === 0 && nearbyEnemyInf.length === 0) {
      // Nobody contesting — progress decays slowly if not fully captured
      if (building.captureTeam === null) {
        building.captureProgress = Math.max(0, (building.captureProgress || 0) - rate * 0.5);
      }
    }
    // Contested (both sides present) — progress freezes
  }

  // ─── Wave spawner ─────────────────────────────────────────────────────────────
  // For survive_waves missions: spawn a new wave of enemies.
  // waveNumber : 1-based wave index
  // cols, rows : map size
  // Returns array of new enemy unit objects (not yet pushed to state).

  function spawnWave(waveNumber, cols, rows) {
    const types = Object.keys(ENEMY_UNIT_DEF);
    const count  = 4 + waveNumber * 2;
    const newEnemies = [];

    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const def  = ENEMY_UNIT_DEF[type];
      const side = Math.floor(Math.random() * 4);
      let col, row;

      if (side === 0) { col = Math.floor(Math.random() * cols); row = 0; }
      else if (side === 1) { col = Math.floor(Math.random() * cols); row = rows - 1; }
      else if (side === 2) { col = 0; row = Math.floor(Math.random() * rows); }
      else { col = cols - 1; row = Math.floor(Math.random() * rows); }

      newEnemies.push({
        id:       mkId(),
        type,
        col, row,
        px: col * CELL + CELL / 2,
        py: row * CELL + CELL / 2,
        hp: def.hp, maxHp: def.hp,
        dead: false,
        atkCd: 0,
        ammo: def.ammo ?? null,
        reloading: false,
        reloadCd: 0,
        tx: null, ty: null,
        path: [],
      });
    }

    return newEnemies;
  }

  return {
    calcDamage,
    garrisonDamage,
    findTarget,
    applyDamage,
    applySplash,
    tickBuildingAttacks,
    tickUnitAttack,
    tickGarrisonFire,
    tickMedicHeal,
    tickExplosions,
    checkEndCondition,
    tickCapture,
    spawnWave,
  };

})();
