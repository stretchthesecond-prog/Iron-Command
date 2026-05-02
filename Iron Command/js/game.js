// ═══════════════════════════════════════════════════
//  IRON COMMAND — Game Logic & Loop
// ═══════════════════════════════════════════════════

'use strict';

const Game = (() => {

  // ─── State ────────────────────────────────────────────────────────────────────
  let _state      = null;   // full game state
  let _scroll     = { x: 0, y: 0 };
  let _paused     = false;
  let _rafId      = null;
  let _lastT      = 0;
  let _onEnd      = null;   // callback('victory'|'defeat')
  let _viewW      = 0;
  let _viewH      = 0;

  // UI state
  let _primaryBldgId  = null;  // id of primary production building
  let _placingType    = null;  // building type being placed, or null
  let _selBox         = null;  // current drag-select box { x0,y0,x1,y1 }
  let _explosions     = [];    // active explosion particles

  // ─── Start a mission ──────────────────────────────────────────────────────────
  function start(level, onEnd) {
    _onEnd   = onEnd;
    _scroll  = { x: 0, y: 0 };
    _paused  = false;
    _primaryBldgId = null;
    _placingType   = null;
    _selBox        = null;
    _explosions    = [];

    _state = _buildState(level);
    _setupCanvas();
    _setupInput();
    _setupSidebar();
    _setupTopbar();
    _startLoop();
  }

  // ─── Build initial state from level definition ────────────────────────────────
  function _buildState(level) {
    const cols = level.cols || DEFAULT_COLS;
    const rows = level.rows || DEFAULT_ROWS;

    const units = level.units.map(u => {
      const def = UNIT_DEF[u.type];
      if (!def) return null;
      return {
        id: mkId(), type: u.type,
        px: u.col * CELL + CELL / 2,
        py: u.row * CELL + CELL / 2,
        hp: def.hp, maxHp: def.hp,
        selected: false, dead: false,
        atkCd: 0, path: [],
        tx: null, ty: null,
        ammo: def.ammo ?? null,
        reloading: false, reloadCd: 0,
      };
    }).filter(Boolean);

    const enemies = level.enemies.map(e => {
      const def = ENEMY_UNIT_DEF[e.type];
      if (!def) return null;
      return {
        id: mkId(), type: e.type,
        px: e.col * CELL + CELL / 2,
        py: e.row * CELL + CELL / 2,
        hp: def.hp, maxHp: def.hp,
        dead: false, atkCd: 0, path: [],
        tx: null, ty: null,
        ammo: def.ammo ?? null,
        reloading: false, reloadCd: 0,
      };
    }).filter(Boolean);

    const buildings = level.buildings.map(b => {
      const def = getBldgDef(b.type);
      if (!def) return null;
      return {
        id: mkId(), type: b.type,
        col: b.col, row: b.row,
        hp: def.hp || 200,
        maxHp: def.hp || 200,
        dead: false,
        atkCd: 0,
        buildQueue: [],
        buildTimer: 0,
        captureProgress: 0,
        captureTeam: isNeutralType(b.type) ? null : undefined,
        garrison: [],
      };
    }).filter(Boolean);

    return {
      level: { ...level, cols, rows },
      units,
      enemies,
      buildings,
      fog: Fog.create(cols, rows),
      gold: 300,
      wavesSurvived: 0,
      tick: 0,
      losBonus: 0,
    };
  }

  // ─── Canvas setup ─────────────────────────────────────────────────────────────
  function _setupCanvas() {
    const wrap = document.getElementById('game-canvas-wrap');
    const canvas = document.getElementById('game-canvas');
    _viewW = wrap.clientWidth  - 180; // subtract sidebar width
    _viewH = wrap.clientHeight - 36;  // subtract topbar
    // Use the full wrap minus sidebar
    _viewW = wrap.clientWidth;
    _viewH = wrap.clientHeight;
    Renderer.init(canvas, document.getElementById('minimap-canvas'));
    Renderer.resize(_viewW, _viewH);

    // Minimap click-to-jump
    const mapW = _state.level.cols * CELL;
    const mapH = _state.level.rows * CELL;
    Input.initMinimap(
      document.getElementById('minimap-canvas'),
      _viewW, _viewH, mapW, mapH
    );
  }

  // ─── Input setup ─────────────────────────────────────────────────────────────
  function _setupInput() {
    const canvas = document.getElementById('game-canvas');
    Input.init(canvas, _scroll, _state.level.cols, _state.level.rows, {
      onLeftClick:  _onLeftClick,
      onRightClick: _onRightClick,
      onBoxSelect:  _onBoxSelect,
      onDragUpdate: _onDragUpdate,
      onDragEnd:    () => { _selBox = null; _updateSelBoxEl(null); },
      onEscape:     _onEscape,
    });
  }

  // ─── Sidebar ─────────────────────────────────────────────────────────────────
  function _setupSidebar() {
    Renderer.updateSidebar(_state.gold, _onClickBuild, _onClickTrain);
  }

  // ─── Topbar buttons ───────────────────────────────────────────────────────────
  function _setupTopbar() {
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) {
      pauseBtn.onclick = () => {
        _paused = !_paused;
        pauseBtn.textContent = _paused ? '▶' : '⏸';
      };
    }
    const menuBtn = document.getElementById('btn-game-menu');
    if (menuBtn) {
      menuBtn.onclick = () => {
        _stop();
        _onEnd('menu');
      };
    }
  }

  // ─── Left click ──────────────────────────────────────────────────────────────
  function _onLeftClick({ wx, wy }) {
    // Placing a building
    if (_placingType) {
      _tryPlaceBuilding(wx, wy);
      return;
    }

    // Hit-test units first
    const hit = _state.units.find(u =>
      !u.dead && Math.hypot(u.px - wx, u.py - wy) < CELL / 2
    );

    if (hit) {
      // Select only this unit
      _state.units.forEach(u => u.selected = false);
      hit.selected = true;
      const def = getUnitDef(hit.type);
      Renderer.log(`Selected ${def?.label || hit.type}  HP:${Math.ceil(hit.hp)}/${hit.maxHp}`);
      return;
    }

    // Hit-test buildings
    const col = Math.floor(wx / CELL);
    const row = Math.floor(wy / CELL);
    const bHit = _state.buildings.find(b =>
      !b.dead && b.col === col && b.row === row
    );

    if (bHit) {
      const bd = getBldgDef(bHit.type);
      // Ungarrison: click bunker to release one infantry
      if (bHit.type === 'neutral_bunk' && bHit.captureTeam === 'player' && bHit.garrison.length > 0) {
        _ungarrison(bHit);
        return;
      }
      Renderer.log(`${bd?.label || bHit.type}  HP:${Math.ceil(bHit.hp)}/${bHit.maxHp}${bd?.produces ? '  Right-click = set primary' : ''}`);
      return;
    }

    // Click on empty space — deselect all
    _state.units.forEach(u => u.selected = false);
  }

  // ─── Right click ─────────────────────────────────────────────────────────────
  function _onRightClick({ wx, wy }) {
    // Cancel placement
    if (_placingType) {
      _placingType = null;
      Renderer.log('Placement cancelled.');
      return;
    }

    const col = Math.floor(wx / CELL);
    const row = Math.floor(wy / CELL);

    // Right-click on a building — set primary or garrison
    const bHit = _state.buildings.find(b =>
      !b.dead && b.col === col && b.row === row
    );

    if (bHit) {
      const bd = getBldgDef(bHit.type);

      // Set primary production building
      if (bd?.produces && !isEnemyType(bHit.type)) {
        _primaryBldgId = bHit.id;
        Renderer.log(`Primary set: ${bd.label}`);
        return;
      }

      // Garrison: right-click a captured bunker with infantry selected
      if (bHit.type === 'neutral_bunk' && bHit.captureTeam === 'player') {
        const sel = _state.units.filter(u => u.selected && !u.dead && getUnitDef(u.type)?.canGarrison);
        const slots = (BLDG_DEF.neutral_bunk.maxGarrison || 3) - bHit.garrison.length;
        const entering = sel.slice(0, slots);
        entering.forEach(u => {
          u.dead = true;
          bHit.garrison.push(u.type);
        });
        if (entering.length > 0) Renderer.log(`${entering.length} infantry garrisoned.`);
        return;
      }
    }

    // Move/attack-move selected units
    const sel = _state.units.filter(u => u.selected && !u.dead);
    if (sel.length === 0) return;

    // Issue move orders — spread units into a formation around the target cell
    const formation = _formationCells(col, row, sel.length, _state.level.cols, _state.level.rows);
    sel.forEach((u, i) => {
      const dest = formation[i] || { col, row };
      const def = getUnitDef(u.type);
      if (def?.isAir) {
        u.tx = dest.col * CELL + CELL / 2;
        u.ty = dest.row * CELL + CELL / 2;
        u.path = [];
      } else {
        u.path = Pathfind.requestPath(
          u, dest.col, dest.row,
          _state.level.grid, _state.buildings,
          _state.level.cols, _state.level.rows
        );
        u.tx = dest.col * CELL + CELL / 2;
        u.ty = dest.row * CELL + CELL / 2;
      }
    });
    Renderer.log(`Moving ${sel.length} unit${sel.length > 1 ? 's' : ''}.`);
  }

  // ─── Box select ──────────────────────────────────────────────────────────────
  function _onBoxSelect({ wx0, wy0, wx1, wy1 }) {
    _state.units.forEach(u => {
      if (u.dead) return;
      u.selected = u.px >= wx0 && u.px <= wx1 && u.py >= wy0 && u.py <= wy1;
    });
    const count = _state.units.filter(u => u.selected).length;
    Renderer.log(count > 0 ? `Selected ${count} unit${count > 1 ? 's' : ''}.` : 'No units in selection.');
  }

  function _onDragUpdate(box) {
    _selBox = box;
    _updateSelBoxEl(box);
  }

  function _updateSelBoxEl(box) {
    const el = document.getElementById('sel-box');
    if (!el) return;
    if (!box) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left   = box.x0 + 'px';
    el.style.top    = box.y0 + 'px';
    el.style.width  = (box.x1 - box.x0) + 'px';
    el.style.height = (box.y1 - box.y0) + 'px';
  }

  // ─── Escape ──────────────────────────────────────────────────────────────────
  function _onEscape() {
    if (_placingType) { _placingType = null; Renderer.log('Placement cancelled.'); return; }
    _state.units.forEach(u => u.selected = false);
  }

  // ─── Build / Train buttons ───────────────────────────────────────────────────
  function _onClickBuild(type) {
    const cost = BUILD_COSTS[type];
    if (_state.gold < cost) { Renderer.log(`Not enough gold. Need $${cost}.`); return; }
    _placingType = type;
    Renderer.log(`Placing ${BLDG_DEF[type].label} ($${cost}) — click map within 3 tiles of your buildings. Right-click to cancel.`);
  }

  function _onClickTrain(type) {
    const ud   = UNIT_DEF[type];
    const cost = ud.cost;
    if (_state.gold < cost) { Renderer.log(`Not enough gold. Need $${cost}.`); return; }

    // Find primary or any compatible building
    let prod = _primaryBldgId
      ? _state.buildings.find(b => b.id === _primaryBldgId && !b.dead && getBldgDef(b.type)?.produces?.includes(type))
      : null;
    if (!prod) {
      prod = _state.buildings.find(b => !b.dead && !isEnemyType(b.type) && getBldgDef(b.type)?.produces?.includes(type));
    }
    if (!prod) { Renderer.log(`No ${BLDG_DEF[ud.produces]?.label || 'production building'} available.`); return; }

    _state.gold -= cost;
    prod.buildQueue.push(type);
    if (prod.buildQueue.length === 1) prod.buildTimer = ud.buildTime;
    Renderer.log(`Training ${ud.label} (${ud.buildTime}s)…`);
  }

  // ─── Place building on map ────────────────────────────────────────────────────
  function _tryPlaceBuilding(wx, wy) {
    const type = _placingType;
    const cost = BUILD_COSTS[type];
    const col  = Math.floor(wx / CELL);
    const row  = Math.floor(wy / CELL);
    const { cols, rows } = _state.level;

    if (col < 0 || col >= cols || row < 0 || row >= rows) return;

    // Must be within buildRadius of an existing friendly building
    const valid = _state.buildings.some(b => {
      if (b.dead || isEnemyType(b.type)) return false;
      if (isNeutralType(b.type) && b.captureTeam !== 'player') return false;
      const bd = getBldgDef(b.type);
      const radius = bd?.buildRadius ?? 3;
      return Math.abs(b.col - col) + Math.abs(b.row - row) <= radius;
    });

    if (!valid) { Renderer.log('Must place within 3 tiles of your buildings.'); return; }
    if (_state.buildings.find(b => b.col === col && b.row === row && !b.dead)) {
      Renderer.log('Cell already occupied.'); return;
    }
    // Check terrain passability
    const terr = TERRAIN[_state.level.grid[row]?.[col]];
    if (!terr || !terr.groundOk) { Renderer.log('Cannot build on that terrain.'); return; }
    if (_state.gold < cost) { Renderer.log(`Not enough gold. Need $${cost}.`); return; }

    const bd = getBldgDef(type);
    _state.gold -= cost;
    _state.buildings.push({
      id: mkId(), type, col, row,
      hp: bd.hp, maxHp: bd.hp,
      dead: false, atkCd: 0,
      buildQueue: [], buildTimer: 0,
      captureProgress: 0, captureTeam: undefined,
      garrison: [],
    });
    _placingType = null;
    Renderer.log(`${bd.label} placed.`);
  }

  // ─── Ungarrison ───────────────────────────────────────────────────────────────
  function _ungarrison(bunker) {
    if (!bunker.garrison || bunker.garrison.length === 0) return;
    const type = bunker.garrison.pop();
    const def  = UNIT_DEF[type];
    if (!def) return;
    const cell = Pathfind.findOpenAdjacent(
      bunker.col, bunker.row,
      _state.level.grid, _state.buildings, _state.units,
      _state.level.cols, _state.level.rows
    ) || { col: bunker.col, row: bunker.row + 1 };

    _state.units.push({
      id: mkId(), type,
      px: cell.col * CELL + CELL / 2,
      py: cell.row * CELL + CELL / 2,
      hp: def.hp, maxHp: def.hp,
      selected: false, dead: false,
      atkCd: 0, path: [],
      tx: null, ty: null,
      ammo: def.ammo ?? null,
      reloading: false, reloadCd: 0,
    });
    Renderer.log('Infantry ungarrisoned.');
  }

  // ─── Formation helper ─────────────────────────────────────────────────────────
  // Returns an array of { col, row } spread around a centre cell
  function _formationCells(centreCol, centreRow, count, cols, rows) {
    const cells = [];
    const offsets = [
      [0,0],[1,0],[-1,0],[0,1],[0,-1],
      [1,1],[-1,1],[1,-1],[-1,-1],
      [2,0],[-2,0],[0,2],[0,-2],
    ];
    for (let i = 0; i < count && i < offsets.length; i++) {
      const c = clamp(centreCol + offsets[i][0], 0, cols - 1);
      const r = clamp(centreRow + offsets[i][1], 0, rows - 1);
      cells.push({ col: c, row: r });
    }
    // If more units than offsets, just pile on centre
    while (cells.length < count) cells.push({ col: centreCol, row: centreRow });
    return cells;
  }

  // ─── Main game loop ───────────────────────────────────────────────────────────
  function _startLoop() {
    _lastT = performance.now();

    function loop(t) {
      const dt = Math.min((t - _lastT) / 1000, 0.05); // cap at 50ms
      _lastT = t;

      if (!_paused) {
        _tick(dt);
      }

      _draw();
      _rafId = requestAnimationFrame(loop);
    }

    _rafId = requestAnimationFrame(loop);
  }

  function _stop() {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    Input.destroy();
  }

  // ─── Tick (game logic) ────────────────────────────────────────────────────────
  function _tick(dt) {
    const s = _state;
    s.tick++;

    // ── Gold income ──────────────────────────────────────────────────────────────
    s.gold += 3 * dt; // base trickle
    // Ore tiles
    const { cols, rows, grid } = s.level;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === 'ore') s.gold += (TERRAIN.ore.incomePerSec || 2) * dt * 0.1;
      }
    }
    // Captured oil derricks
    for (const b of s.buildings) {
      if (!b.dead && b.type === 'neutral_oil' && b.captureTeam === 'player') {
        s.gold += (BLDG_DEF.neutral_oil.income || 10) * dt;
      }
    }

    // ── LoS bonus from comm towers ────────────────────────────────────────────
    s.losBonus = s.buildings.filter(b =>
      !b.dead && b.type === 'neutral_comm' && b.captureTeam === 'player'
    ).length;

    // ── Production queues ────────────────────────────────────────────────────────
    _tickProduction(dt);

    // ── Building attacks ─────────────────────────────────────────────────────────
    const playerDefBldgs = s.buildings.filter(b => !b.dead && !isEnemyType(b.type) && !isNeutralType(b.type) && getBldgDef(b.type)?.atk);
    const enemyDefBldgs  = s.buildings.filter(b => !b.dead &&  isEnemyType(b.type) && getBldgDef(b.type)?.atk);

    Combat.tickBuildingAttacks(playerDefBldgs, s.enemies, [], dt, _explosions);
    Combat.tickBuildingAttacks(enemyDefBldgs,  s.units,   [], dt, _explosions);

    // ── Garrison fire ────────────────────────────────────────────────────────────
    for (const b of s.buildings) {
      if (!b.dead && b.type === 'neutral_bunk' && b.captureTeam === 'player') {
        Combat.tickGarrisonFire(b, s.enemies, dt, _explosions);
      }
    }

    // ── Medic heal ───────────────────────────────────────────────────────────────
    for (const b of s.buildings) {
      if (!b.dead && b.type === 'medic') {
        Combat.tickMedicHeal(b, s.units, dt);
      }
    }

    // ── Capture logic ────────────────────────────────────────────────────────────
    for (const b of s.buildings) {
      if (!b.dead && isNeutralType(b.type) && getBldgDef(b.type)?.capturable) {
        const bx = b.col * CELL + CELL / 2;
        const by = b.row * CELL + CELL / 2;
        const nearPl = s.units.filter(u =>
          !u.dead && getUnitDef(u.type)?.canGarrison &&
          Math.hypot(u.px - bx, u.py - by) < CELL * 1.4
        );
        const nearEn = s.enemies.filter(e =>
          !e.dead && getUnitDef(e.type)?.canGarrison &&
          Math.hypot(e.px - bx, e.py - by) < CELL * 1.4
        );
        Combat.tickCapture(b, nearPl, nearEn, dt);
      }
    }

    // ── Player unit movement & combat ────────────────────────────────────────────
    for (const u of s.units) {
      if (u.dead) continue;
      const def = getUnitDef(u.type);
      if (!def) continue;

      // Aircraft reload
      if (u.reloading) {
        u.reloadCd -= dt;
        if (def.isAir) {
          // Fly to nearest friendly airport
          const airport = _nearestFriendlyAirport(u);
          if (airport) {
            const tx = airport.col * CELL + CELL / 2;
            const ty = airport.row * CELL + CELL / 2;
            const arrived = Pathfind.stepAirUnit(u, tx, ty, dt);
            if (arrived) {
              // Reloading in place — count down
            }
          }
        }
        if (u.reloadCd <= 0) {
          u.ammo = def.ammo;
          u.reloading = false;
          u.reloadCd  = 0;
        }
        continue;
      }

      // Try to attack first
      const enemyBldgs = s.buildings.filter(b => !b.dead && isEnemyType(b.type));
      const result = Combat.tickUnitAttack(u, s.enemies, enemyBldgs, dt, _explosions, null);

      if (result === 'attacked') {
        // Don't move while actively attacking
      } else {
        // Move along path (ground) or directly (air)
        if (def.isAir) {
          if (u.tx !== null) {
            const arrived = Pathfind.stepAirUnit(u, u.tx, u.ty, dt);
            if (arrived) { u.tx = null; u.ty = null; }
          }
        } else {
          Pathfind.stepAlongPath(u, s.level.grid, dt, cols, rows);
        }
      }
    }

    // ── Enemy AI ──────────────────────────────────────────────────────────────────
    _tickEnemyAI(dt);

    // ── Enemy production ──────────────────────────────────────────────────────────
    _tickEnemyProduction(dt);

    // ── Prune dead units ──────────────────────────────────────────────────────────
    s.units   = s.units.filter(u => !u.dead);
    s.enemies = s.enemies.filter(e => !e.dead);

    // ── Explosions ────────────────────────────────────────────────────────────────
    _explosions = Combat.tickExplosions(_explosions, dt);

    // ── Fog of war ────────────────────────────────────────────────────────────────
    Fog.update(s.fog, s.units, s.buildings, s.losBonus, s.level.grid, cols, rows);

    // ── Survive-waves: spawn next wave if all enemies dead ────────────────────────
    if (s.level.winCondition === 'survive_waves' && s.enemies.length === 0) {
      s.wavesSurvived++;
      if (s.wavesSurvived < (s.level.winParam || 5)) {
        const wave = Combat.spawnWave(s.wavesSurvived, cols, rows);
        s.enemies.push(...wave);
        Renderer.log(`Wave ${s.wavesSurvived + 1} incoming!`);
      }
    }

    // ── Win/lose check ────────────────────────────────────────────────────────────
    const result = Combat.checkEndCondition(s);
    if (result) {
      _stop();
      setTimeout(() => _onEnd(result), 600);
    }

    // ── Scroll ────────────────────────────────────────────────────────────────────
    const mapW = cols * CELL, mapH = rows * CELL;
    Input.updateScroll(dt, _viewW, _viewH, mapW, mapH);
  }

  // ─── Production queues ────────────────────────────────────────────────────────
  function _tickProduction(dt) {
    const s = _state;
    for (const b of s.buildings) {
      if (b.dead || isEnemyType(b.type)) continue;
      if (!b.buildQueue || b.buildQueue.length === 0) continue;

      b.buildTimer -= dt;
      if (b.buildTimer > 0) continue;

      const type = b.buildQueue.shift();
      const def  = UNIT_DEF[type];
      if (!def) continue;

      // Next unit in queue starts immediately
      if (b.buildQueue.length > 0) {
        b.buildTimer = UNIT_DEF[b.buildQueue[0]]?.buildTime || 5;
      }

      const cell = Pathfind.findOpenAdjacent(
        b.col, b.row,
        s.level.grid, s.buildings, s.units,
        s.level.cols, s.level.rows
      ) || { col: b.col, row: b.row + 1 };

      s.units.push({
        id: mkId(), type,
        px: cell.col * CELL + CELL / 2,
        py: cell.row * CELL + CELL / 2,
        hp: def.hp, maxHp: def.hp,
        selected: false, dead: false,
        atkCd: 0, path: [],
        tx: null, ty: null,
        ammo: def.ammo ?? null,
        reloading: false, reloadCd: 0,
      });
      Renderer.log(`${def.label} ready!`);
    }
  }

  // ─── Enemy production ─────────────────────────────────────────────────────────
  function _tickEnemyProduction(dt) {
    const s = _state;
    for (const b of s.buildings) {
      if (b.dead || !isEnemyType(b.type)) continue;
      const bd = getBldgDef(b.type);
      if (!bd?.produces) continue;

      if (!b.buildQueue) b.buildQueue = [];

      // Auto-queue a random unit periodically
      if (b.buildQueue.length === 0 && s.tick % ENEMY_PROD_INTERVAL === 0) {
        const type = bd.produces[Math.floor(Math.random() * bd.produces.length)];
        b.buildQueue.push(type);
        b.buildTimer = ENEMY_UNIT_DEF[type] ? 8 : 8;
      }

      if (b.buildQueue.length === 0) continue;
      b.buildTimer -= dt;
      if (b.buildTimer > 0) continue;

      const type = b.buildQueue.shift();
      const def  = ENEMY_UNIT_DEF[type];
      if (!def) continue;

      const cell = Pathfind.findOpenAdjacent(
        b.col, b.row,
        s.level.grid, s.buildings, s.enemies,
        s.level.cols, s.level.rows
      ) || { col: b.col, row: b.row + 1 };

      s.enemies.push({
        id: mkId(), type,
        px: cell.col * CELL + CELL / 2,
        py: cell.row * CELL + CELL / 2,
        hp: def.hp, maxHp: def.hp,
        dead: false, atkCd: 0, path: [],
        tx: null, ty: null,
        ammo: def.ammo ?? null,
        reloading: false, reloadCd: 0,
      });
    }
  }

  // ─── Enemy AI ─────────────────────────────────────────────────────────────────
  function _tickEnemyAI(dt) {
    const s = _state;
    const { cols, rows } = s.level;

    const playerHQ    = s.buildings.find(b => b.type === 'hq' && !b.dead);
    const playerBldgs = s.buildings.filter(b => !b.dead && !isEnemyType(b.type));
    const playerUnits = s.units;

    for (const e of s.enemies) {
      if (e.dead) continue;
      const def = ENEMY_UNIT_DEF[e.type];
      if (!def) continue;

      // ── Aircraft reload RTB ──
      if (e.reloading) {
        e.reloadCd -= dt;
        if (def.isAir) {
          const airport = _nearestEnemyAirport(e);
          if (airport) Pathfind.stepAirUnit(e, airport.col * CELL + CELL / 2, airport.row * CELL + CELL / 2, dt);
        }
        if (e.reloadCd <= 0) { e.ammo = def.ammo; e.reloading = false; }
        continue;
      }

      // ── Try to attack ──
      const result = Combat.tickUnitAttack(e, playerUnits, playerBldgs, dt, _explosions, null);
      if (result === 'attacked') continue;

      // ── Move toward nearest target ──
      let target = null;
      let minD   = Infinity;

      // Prioritise player units nearby
      for (const u of playerUnits) {
        if (u.dead) continue;
        const d = Math.hypot(e.px - u.px, e.py - u.py);
        if (d < minD) { minD = d; target = { px: u.px, py: u.py }; }
      }

      // Then HQ, then any player building
      if (playerHQ) {
        const hqPx = playerHQ.col * CELL + CELL / 2;
        const hqPy = playerHQ.row * CELL + CELL / 2;
        const d = Math.hypot(e.px - hqPx, e.py - hqPy);
        if (!target || d < minD * 0.7) { minD = d; target = { px: hqPx, py: hqPy }; }
      }
      for (const b of playerBldgs) {
        if (b === playerHQ) continue;
        const bx = b.col * CELL + CELL / 2, by = b.row * CELL + CELL / 2;
        const d = Math.hypot(e.px - bx, e.py - by);
        if (d < minD * 0.8) { minD = d; target = { px: bx, py: by }; }
      }

      if (!target) continue;

      if (def.isAir) {
        Pathfind.stepAirUnit(e, target.px, target.py, dt);
      } else {
        // Repath periodically or when path empty
        if (!e.path || e.path.length === 0) {
          const gc = Math.floor(target.px / CELL);
          const gr = Math.floor(target.py / CELL);
          e.path = Pathfind.requestPath(
            e, gc, gr,
            s.level.grid, s.buildings,
            cols, rows
          );
        }
        Pathfind.stepAlongPath(e, s.level.grid, dt, cols, rows);
      }
    }
  }

  // ─── Nearest friendly / enemy airport ────────────────────────────────────────
  function _nearestFriendlyAirport(unit) {
    let best = null, bestD = Infinity;
    for (const b of _state.buildings) {
      if (b.dead || b.type !== 'airport') continue;
      const d = Math.hypot(unit.px - (b.col * CELL + CELL / 2), unit.py - (b.row * CELL + CELL / 2));
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  function _nearestEnemyAirport(unit) {
    let best = null, bestD = Infinity;
    for (const b of _state.buildings) {
      if (b.dead || b.type !== 'e_airport') continue;
      const d = Math.hypot(unit.px - (b.col * CELL + CELL / 2), unit.py - (b.row * CELL + CELL / 2));
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────────
  function _draw() {
    const s = _state;
    Renderer.setGrid(s.level.grid);

    Renderer.drawFrame(
      s, _scroll, _viewW, _viewH,
      _selBox, _primaryBldgId, _placingType, _explosions
    );

    Renderer.drawMinimap(s, _scroll, _viewW, _viewH);

    const selUnits = s.units.filter(u => u.selected && !u.dead);
    Renderer.updateHUD(s, selUnits);
    Renderer.updateSidebar(s.gold, _onClickBuild, _onClickTrain);
  }

  // ─── Public ───────────────────────────────────────────────────────────────────
  return { start };

})();
