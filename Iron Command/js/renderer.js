// ═══════════════════════════════════════════════════
//  IRON COMMAND — Renderer
//  All canvas draw calls for the game viewport,
//  minimap, and HUD updates.
// ═══════════════════════════════════════════════════

'use strict';

const Renderer = (() => {

  // ─── Internal state ───────────────────────────────────────────────────────────
  let _canvas    = null;
  let _ctx       = null;
  let _miniCanvas= null;
  let _miniCtx   = null;

  // Terrain tile detail cache — pre-rendered offscreen per terrain type+position
  // Key: "type_col_row", Value: ImageData or null
  const _tileCache = new Map();

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init(gameCanvas, minimapCanvas) {
    _canvas     = gameCanvas;
    _ctx        = gameCanvas.getContext('2d');
    _miniCanvas = minimapCanvas;
    _miniCtx    = minimapCanvas.getContext('2d');
    _miniCanvas.width  = MINIMAP_W;
    _miniCanvas.height = MINIMAP_H;
    _tileCache.clear();
  }

  // Resize the game canvas to fill its container
  function resize(viewW, viewH) {
    _canvas.width  = viewW;
    _canvas.height = viewH;
  }

  // ─── Main frame ───────────────────────────────────────────────────────────────
  // state   : full game state object
  // scroll  : { x, y } world-pixel scroll offset
  // viewW, viewH : viewport size
  // selBox  : null | { x0,y0,x1,y1 } screen coords for drag-select rect
  // primaryBldgId : id of the primary production building (for highlight)
  // placingType   : building type being placed, or null
  // explosions    : array of { x, y, r, t, maxT }

  function drawFrame(state, scroll, viewW, viewH, selBox, primaryBldgId, placingType, explosions) {
    const ctx = _ctx;
    const { level, units, enemies, buildings, fog } = state;
    const cols = level.cols, rows = level.rows;
    const sx = scroll.x, sy = scroll.y;

    ctx.clearRect(0, 0, viewW, viewH);

    // ── 1. Terrain ──────────────────────────────────────────────────────────────
    _drawTerrain(ctx, level.grid, fog, sx, sy, viewW, viewH, cols, rows);

    // ── 2. Build-radius highlight (when placing a building) ────────────────────
    if (placingType) {
      _drawBuildRadius(ctx, buildings, sx, sy, cols, rows, viewW, viewH);
    }

    // ── 3. Ground buildings ────────────────────────────────────────────────────
    _drawBuildings(ctx, buildings, fog, sx, sy, viewW, viewH, primaryBldgId);

    // ── 4. Ground units (non-air) ──────────────────────────────────────────────
    _drawGroundUnits(ctx, units, enemies, fog, sx, sy, viewW, viewH);

    // ── 5. Explosions (below air layer) ───────────────────────────────────────
    _drawExplosions(ctx, explosions, sx, sy);

    // ── 6. Air units (drawn above everything) ─────────────────────────────────
    _drawAirUnits(ctx, units, enemies, fog, sx, sy, viewW, viewH);

    // ── 7. Fog of war overlay ─────────────────────────────────────────────────
    Fog.render(ctx, fog, sx, sy, viewW, viewH, cols, rows);

    // ── 8. Selection box ──────────────────────────────────────────────────────
    if (selBox) {
      _drawSelBox(ctx, selBox);
    }
  }

  // ─── Terrain ──────────────────────────────────────────────────────────────────
  function _drawTerrain(ctx, grid, fog, sx, sy, viewW, viewH, cols, rows) {
    const startC = Math.max(0, Math.floor(sx / CELL));
    const endC   = Math.min(cols - 1, Math.ceil((sx + viewW) / CELL));
    const startR = Math.max(0, Math.floor(sy / CELL));
    const endR   = Math.min(rows - 1, Math.ceil((sy + viewH) / CELL));

    for (let r = startR; r <= endR; r++) {
      for (let c = startC; c <= endC; c++) {
        const fogState = fog[r]?.[c] ?? FOG.BLACK;
        if (fogState === FOG.BLACK) continue; // fog.render handles black tiles

        const type = grid[r]?.[c] || 'grass';
        const td   = TERRAIN[type] || TERRAIN.grass;
        const px   = c * CELL - sx;
        const py   = r * CELL - sy;

        ctx.fillStyle = td.color;
        ctx.fillRect(px, py, CELL, CELL);

        // Tile detail (trees, waves, etc.) — deterministic seed per tile
        if (fogState === FOG.VISIBLE) {
          Sprites.drawTerrainDetail(ctx, type, px, py, CELL, c * 1000 + r);
        }

        // Grid line (very subtle)
        ctx.strokeStyle = 'rgba(0,0,0,0.10)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, CELL, CELL);
      }
    }
  }

  // ─── Build radius highlight ───────────────────────────────────────────────────
  function _drawBuildRadius(ctx, buildings, sx, sy, cols, rows, viewW, viewH) {
    const highlighted = new Set();

    for (const b of buildings) {
      if (b.dead) continue;
      if (isEnemyType(b.type)) continue;
      if (isNeutralType(b.type) && b.captureTeam !== 'player') continue;

      const bd = getBldgDef(b.type);
      const radius = bd?.buildRadius || 3;

      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.abs(dr) + Math.abs(dc) > radius) continue;
          const nc = b.col + dc, nr = b.row + dr;
          if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
            highlighted.add(`${nc},${nr}`);
          }
        }
      }
    }

    ctx.fillStyle = 'rgba(80,160,255,0.12)';
    for (const key of highlighted) {
      const [c, r] = key.split(',').map(Number);
      ctx.fillRect(c * CELL - sx, r * CELL - sy, CELL, CELL);
    }
  }

  // ─── Buildings ────────────────────────────────────────────────────────────────
  function _drawBuildings(ctx, buildings, fog, sx, sy, viewW, viewH, primaryBldgId) {
    for (const b of buildings) {
      if (b.dead) continue;

      const fogState = fog[b.row]?.[b.col] ?? FOG.BLACK;
      if (fogState === FOG.BLACK) continue;
      if (isEnemyType(b.type) && fogState !== FOG.VISIBLE) continue;
      if (isNeutralType(b.type) && fogState === FOG.BLACK) continue;

      const bx = b.col * CELL - sx;
      const by = b.row * CELL - sy;
      if (bx < -CELL || bx > viewW || by < -CELL || by > viewH) continue;

      // Grey-out explored-but-not-visible friendly buildings
      if (fogState === FOG.GREY) {
        ctx.save();
        ctx.globalAlpha = 0.45;
      }

      Sprites.drawBuilding(ctx, b.type, bx, by, CELL, CELL);

      if (fogState === FOG.GREY) ctx.restore();

      // HP bar
      const bd = getBldgDef(b.type);
      if (bd && bd.hp > 0) {
        Sprites.drawHpBar(ctx, bx + CELL / 2, by, CELL - 4, b.hp, b.maxHp || bd.hp);
      }

      // Primary building ring
      if (b.id === primaryBldgId) {
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 1, by + 1, CELL - 2, CELL - 2);
      }

      // Build timer
      if (b.buildTimer > 0 && b.buildQueue && b.buildQueue.length > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(bx, by + CELL - 11, CELL, 11);
        ctx.fillStyle = '#ffcc44';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.ceil(b.buildTimer) + 's', bx + CELL / 2, by + CELL - 5);
      }

      // Capture progress bar
      if (isNeutralType(b.type) && b.captureProgress > 0 && b.captureProgress < 100) {
        Sprites.drawCaptureBar(ctx, bx + 1, by + CELL - 6, CELL - 2, b.captureProgress, b.captureTeam || 'player');
      }

      // Garrison count badge
      if (b.garrison && b.garrison.length > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(bx + CELL - 12, by, 12, 11);
        ctx.fillStyle = '#aaffaa';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.garrison.length, bx + CELL - 6, by + 5);
      }
    }
  }

  // ─── Ground units ─────────────────────────────────────────────────────────────
  function _drawGroundUnits(ctx, units, enemies, fog, sx, sy, viewW, viewH) {
    // Player ground units
    for (const u of units) {
      if (u.dead) continue;
      const def = getUnitDef(u.type);
      if (!def || def.isAir) continue;

      const col = Math.floor(u.px / CELL);
      const row = Math.floor(u.py / CELL);
      const fogState = fog[row]?.[col] ?? FOG.BLACK;
      if (fogState === FOG.BLACK) continue;

      const ux = u.px - sx, uy = u.py - sy;
      if (ux < -CELL || ux > viewW + CELL || uy < -CELL || uy > viewH + CELL) continue;

      const alpha = u.reloading ? 0.45 : 1.0;
      Sprites.drawUnit(ctx, u.type, ux, uy, CELL, true, u.selected, alpha);
      Sprites.drawHpBar(ctx, ux, uy - CELL / 2 + 1, CELL - 6, u.hp, u.maxHp);

      // Ammo indicator
      if (def.ammo !== null) {
        _drawAmmoBar(ctx, ux, uy, u.ammo, def.ammo, u.reloading);
      }
    }

    // Enemy ground units — only draw if VISIBLE
    for (const e of enemies) {
      if (e.dead) continue;
      const def = getUnitDef(e.type);
      if (!def || def.isAir) continue;

      const col = Math.floor(e.px / CELL);
      const row = Math.floor(e.py / CELL);
      if ((fog[row]?.[col] ?? FOG.BLACK) !== FOG.VISIBLE) continue;

      // Forest stealth: enemy infantry in forest only visible if player unit adjacent
      if (TERRAIN[_getTerrainAt(col, row)]?.stealth && !def.isAir) {
        if (!_hasPlayerUnitAdjacent(col, row, units)) continue;
      }

      const ex = e.px - sx, ey = e.py - sy;
      if (ex < -CELL || ex > viewW + CELL || ey < -CELL || ey > viewH + CELL) continue;

      Sprites.drawUnit(ctx, e.type, ex, ey, CELL, false, false, e.reloading ? 0.45 : 1.0);
      Sprites.drawHpBar(ctx, ex, ey - CELL / 2 + 1, CELL - 6, e.hp, e.maxHp);
    }
  }

  // ─── Air units ────────────────────────────────────────────────────────────────
  function _drawAirUnits(ctx, units, enemies, fog, sx, sy, viewW, viewH) {
    // Friendly air
    for (const u of units) {
      if (u.dead) continue;
      const def = getUnitDef(u.type);
      if (!def || !def.isAir) continue;

      const ux = u.px - sx, uy = u.py - sy;
      if (ux < -CELL || ux > viewW + CELL || uy < -CELL || uy > viewH + CELL) continue;

      // Shadow on ground
      Sprites.drawAirShadow(ctx, ux, uy, CELL);
      // Unit drawn higher (simulates altitude)
      const alpha = u.reloading ? 0.45 : 1.0;
      Sprites.drawUnit(ctx, u.type, ux, uy - CELL * 0.4, CELL, true, u.selected, alpha);
      Sprites.drawHpBar(ctx, ux, uy - CELL * 0.4 - CELL / 2 + 1, CELL - 6, u.hp, u.maxHp);
      if (def.ammo !== null) {
        _drawAmmoBar(ctx, ux, uy - CELL * 0.4, u.ammo, def.ammo, u.reloading);
      }
    }

    // Enemy air — only if tile is visible
    for (const e of enemies) {
      if (e.dead) continue;
      const def = getUnitDef(e.type);
      if (!def || !def.isAir) continue;

      const col = Math.floor(e.px / CELL);
      const row = Math.floor(e.py / CELL);
      if ((fog[row]?.[col] ?? FOG.BLACK) !== FOG.VISIBLE) continue;

      const ex = e.px - sx, ey = e.py - sy;
      if (ex < -CELL || ex > viewW + CELL || ey < -CELL || ey > viewH + CELL) continue;

      Sprites.drawAirShadow(ctx, ex, ey, CELL);
      Sprites.drawUnit(ctx, e.type, ex, ey - CELL * 0.4, CELL, false, false, e.reloading ? 0.45 : 1.0);
      Sprites.drawHpBar(ctx, ex, ey - CELL * 0.4 - CELL / 2 + 1, CELL - 6, e.hp, e.maxHp);
    }
  }

  // ─── Explosions ───────────────────────────────────────────────────────────────
  function _drawExplosions(ctx, explosions, sx, sy) {
    if (!explosions) return;
    for (const exp of explosions) {
      const progress = exp.t / exp.maxT;
      Sprites.drawExplosion(ctx, exp.x - sx, exp.y - sy, exp.r, progress);
    }
  }

  // ─── Selection box ────────────────────────────────────────────────────────────
  function _drawSelBox(ctx, box) {
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    ctx.fillStyle = 'rgba(0,255,136,0.06)';
    ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    ctx.setLineDash([]);
  }

  // ─── Ammo indicator ───────────────────────────────────────────────────────────
  function _drawAmmoBar(ctx, ux, uy, ammo, maxAmmo, reloading) {
    if (maxAmmo === null) return;
    const w = CELL - 8;
    const x = ux - w / 2;
    const y = uy + CELL / 2 - 6;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, 3);

    if (reloading) {
      ctx.fillStyle = '#ff8800';
      ctx.fillRect(x, y, w, 3); // full orange bar while reloading
    } else {
      ctx.fillStyle = '#44aaff';
      const ratio = maxAmmo > 0 ? ammo / maxAmmo : 0;
      ctx.fillRect(x, y, Math.round(w * ratio), 3);
    }
  }

  // ─── Minimap ──────────────────────────────────────────────────────────────────
  function drawMinimap(state, scroll, viewW, viewH) {
    const ctx  = _miniCtx;
    const mw   = MINIMAP_W;
    const mh   = MINIMAP_H;
    const { level, units, enemies, buildings, fog } = state;
    const cols = level.cols, rows = level.rows;
    const scaleX = mw / cols, scaleY = mh / rows;

    ctx.clearRect(0, 0, mw, mh);

    // Terrain + fog
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const fogState = fog[r]?.[c] ?? FOG.BLACK;
        const type = level.grid[r]?.[c] || 'grass';
        const td   = TERRAIN[type] || TERRAIN.grass;
        ctx.fillStyle = Fog.minimapColor(fogState, td.color);
        ctx.fillRect(Math.floor(c * scaleX), Math.floor(r * scaleY),
                     Math.ceil(scaleX), Math.ceil(scaleY));
      }
    }

    // Buildings
    for (const b of buildings) {
      if (b.dead) continue;
      const fogState = fog[b.row]?.[b.col] ?? FOG.BLACK;
      if (fogState === FOG.BLACK) continue;
      if (isEnemyType(b.type) && fogState !== FOG.VISIBLE) continue;
      const bd = getBldgDef(b.type);
      ctx.fillStyle = fogState === FOG.VISIBLE ? (bd?.color || '#888') : '#554444';
      ctx.fillRect(Math.floor(b.col * scaleX), Math.floor(b.row * scaleY),
                   Math.max(2, Math.ceil(scaleX)), Math.max(2, Math.ceil(scaleY)));
    }

    // Player units — blue dots
    for (const u of units) {
      if (u.dead) continue;
      ctx.fillStyle = '#55aaff';
      const mc = (u.px / CELL) * scaleX;
      const mr = (u.py / CELL) * scaleY;
      ctx.fillRect(Math.floor(mc) - 1, Math.floor(mr) - 1, 3, 3);
    }

    // Enemy units — red dots (only if visible)
    for (const e of enemies) {
      if (e.dead) continue;
      const col = Math.floor(e.px / CELL);
      const row = Math.floor(e.py / CELL);
      if ((fog[row]?.[col] ?? FOG.BLACK) !== FOG.VISIBLE) continue;
      ctx.fillStyle = '#ff4422';
      const mc = (e.px / CELL) * scaleX;
      const mr = (e.py / CELL) * scaleY;
      ctx.fillRect(Math.floor(mc) - 1, Math.floor(mr) - 1, 3, 3);
    }

    // Viewport rectangle
    const mapW = cols * CELL, mapH = rows * CELL;
    const vx = (scroll.x / mapW) * mw;
    const vy = (scroll.y / mapH) * mh;
    const vw = (viewW   / mapW) * mw;
    const vh = (viewH   / mapH) * mh;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vx, vy, vw, vh);
  }

  // ─── HUD updates ──────────────────────────────────────────────────────────────
  function updateHUD(state, selUnits) {
    const { level, units, enemies, buildings } = state;

    // Mission name
    const missionEl = document.getElementById('hud-mission');
    if (missionEl) missionEl.textContent = level.name || 'MISSION';

    // HQ health
    const hq = buildings.find(b => b.type === 'hq' && !b.dead);
    const hqEl = document.getElementById('hud-hq');
    if (hqEl) {
      if (hq) {
        const pct = hq.hp / (hq.maxHp || BLDG_DEF.hq.hp);
        hqEl.textContent = `HQ ${Math.ceil(hq.hp)}/${hq.maxHp || BLDG_DEF.hq.hp}`;
        hqEl.style.color = pct > 0.5 ? '#44cc44' : pct > 0.25 ? '#ffaa00' : '#cc3322';
      } else {
        hqEl.textContent = 'HQ DESTROYED';
        hqEl.style.color = '#cc3322';
      }
    }

    // Gold
    const goldEl = document.getElementById('hud-gold');
    if (goldEl) goldEl.textContent = `$ ${Math.floor(state.gold || 0)}`;

    // Unit counts
    const unitsEl = document.getElementById('hud-units');
    if (unitsEl) {
      const alive  = units.filter(u => !u.dead).length;
      const ealive = enemies.filter(e => !e.dead).length;
      unitsEl.textContent = `Units: ${alive}  |  ENY: ${ealive}`;
    }

    // Win condition reminder
    const winEl = document.getElementById('hud-win');
    if (winEl) winEl.textContent = WIN_CONDITIONS[level.winCondition] || '';

    // Selected units panel
    _updateSelectedPanel(selUnits);
  }

  function _updateSelectedPanel(selUnits) {
    const panel = document.getElementById('selected-panel');
    if (!panel) return;

    if (!selUnits || selUnits.length === 0) {
      panel.innerHTML = '';
      return;
    }

    let html = `<div class="sel-header">SELECTED (${selUnits.length})</div>`;
    const show = selUnits.slice(0, 5);
    for (const u of show) {
      const def = getUnitDef(u.type);
      const pct = u.hp / u.maxHp;
      const fillClass = pct > 0.5 ? '' : pct > 0.25 ? ' warn' : ' crit';
      const ammoStr = def?.ammo !== null && def?.ammo !== undefined
        ? (u.reloading ? ' [RLD]' : ` [${u.ammo}/${def.ammo}]`)
        : '';
      html += `
        <div class="sel-unit-row">
          <span style="min-width:72px;font-size:9px">${def?.label || u.type}${ammoStr}</span>
          <div class="sel-hp-bar">
            <div class="sel-hp-fill${fillClass}" style="width:${Math.round(pct*100)}%"></div>
          </div>
          <span style="font-size:9px;min-width:28px;text-align:right">${Math.ceil(u.hp)}</span>
        </div>`;
    }
    if (selUnits.length > 5) {
      html += `<div style="font-size:9px;color:#555;margin-top:3px">+${selUnits.length - 5} more</div>`;
    }
    panel.innerHTML = html;
  }

  // ─── Sidebar: build list and train list ───────────────────────────────────────
  function updateSidebar(gold, onBuild, onTrain) {
    _updateBuildList(gold, onBuild);
    _updateTrainList(gold, onTrain);
  }

  function _updateBuildList(gold, onBuild) {
    const el = document.getElementById('build-list');
    if (!el) return;
    el.innerHTML = '';
    for (const type of PLAYER_BUILD_BLDGS) {
      const bd   = getBldgDef(type);
      const cost = BUILD_COSTS[type] || 0;
      const btn  = document.createElement('button');
      btn.className = 'sidebar-item-btn';
      btn.innerHTML = `<span class="item-name">${bd.label}</span><span class="item-cost">$${cost}</span>`;
      btn.disabled = gold < cost;
      btn.addEventListener('click', () => onBuild(type));
      el.appendChild(btn);
    }
  }

  function _updateTrainList(gold, onTrain) {
    const el = document.getElementById('train-list');
    if (!el) return;
    el.innerHTML = '';
    for (const type of Object.keys(UNIT_DEF)) {
      const ud  = UNIT_DEF[type];
      const btn = document.createElement('button');
      btn.className = 'sidebar-item-btn';
      btn.innerHTML = `<span class="item-name">${ud.label}</span><span class="item-cost">$${ud.cost} <span class="item-time">${ud.buildTime}s</span></span>`;
      btn.disabled = gold < ud.cost;
      btn.addEventListener('click', () => onTrain(type));
      el.appendChild(btn);
    }
  }

  // ─── Log message ──────────────────────────────────────────────────────────────
  let _logTimeout = null;
  function log(msg) {
    const el = document.getElementById('game-log');
    if (!el) return;
    el.textContent = msg;
    clearTimeout(_logTimeout);
    _logTimeout = setTimeout(() => { if (el) el.textContent = ''; }, 5000);
  }

  // ─── Editor draw ──────────────────────────────────────────────────────────────
  function drawEditor(canvas, level, scroll, activeTool, hovCol, hovRow) {
    const ctx  = canvas.getContext('2d');
    const cols = level.cols, rows = level.rows;
    const sx   = scroll.x,  sy   = scroll.y;
    const vw   = canvas.width, vh = canvas.height;

    ctx.clearRect(0, 0, vw, vh);

    const startC = Math.max(0, Math.floor(sx / CELL));
    const endC   = Math.min(cols - 1, Math.ceil((sx + vw) / CELL));
    const startR = Math.max(0, Math.floor(sy / CELL));
    const endR   = Math.min(rows - 1, Math.ceil((sy + vh) / CELL));

    // Terrain
    for (let r = startR; r <= endR; r++) {
      for (let c = startC; c <= endC; c++) {
        const type = level.grid[r]?.[c] || 'grass';
        const td   = TERRAIN[type] || TERRAIN.grass;
        const px   = c * CELL - sx, py = r * CELL - sy;
        ctx.fillStyle = td.color;
        ctx.fillRect(px, py, CELL, CELL);
        Sprites.drawTerrainDetail(ctx, type, px, py, CELL, c * 1000 + r);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, CELL, CELL);
      }
    }

    // Buildings
    for (const b of level.buildings) {
      const bx = b.col * CELL - sx, by = b.row * CELL - sy;
      if (bx < -CELL || bx > vw || by < -CELL || by > vh) continue;
      Sprites.drawBuilding(ctx, b.type, bx, by, CELL, CELL);
    }

    // Player units
    for (const u of level.units) {
      const ux = u.col * CELL + CELL / 2 - sx;
      const uy = u.row * CELL + CELL / 2 - sy;
      if (ux < -CELL || ux > vw + CELL || uy < -CELL || uy > vh + CELL) continue;
      Sprites.drawUnit(ctx, u.type, ux, uy, CELL, true, false);
    }

    // Enemy units
    for (const e of level.enemies) {
      const ex = e.col * CELL + CELL / 2 - sx;
      const ey = e.row * CELL + CELL / 2 - sy;
      if (ex < -CELL || ex > vw + CELL || ey < -CELL || ey > vh + CELL) continue;
      Sprites.drawUnit(ctx, e.type, ex, ey, CELL, false, false);
    }

    // Hover highlight
    if (hovCol >= 0 && hovCol < cols && hovRow >= 0 && hovRow < rows) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(hovCol * CELL - sx, hovRow * CELL - sy, CELL, CELL);
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────
  // Stored reference to terrain grid (set by game.js each frame)
  let _currentGrid = null;
  function setGrid(grid) { _currentGrid = grid; }

  function _getTerrainAt(col, row) {
    return _currentGrid?.[row]?.[col] || 'grass';
  }

  function _hasPlayerUnitAdjacent(col, row, units) {
    for (const u of units) {
      if (u.dead) continue;
      const uc = Math.floor(u.px / CELL);
      const ur = Math.floor(u.py / CELL);
      if (Math.abs(uc - col) <= 1 && Math.abs(ur - row) <= 1) return true;
    }
    return false;
  }

  return {
    init,
    resize,
    drawFrame,
    drawMinimap,
    updateHUD,
    updateSidebar,
    drawEditor,
    setGrid,
    log,
  };

})();
