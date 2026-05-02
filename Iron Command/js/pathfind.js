// ═══════════════════════════════════════════════════
//  IRON COMMAND — A* Pathfinding
// ═══════════════════════════════════════════════════

'use strict';

const Pathfind = (() => {

  // ─── Binary min-heap (priority queue) ────────────────────────────────────────
  class MinHeap {
    constructor() { this.data = []; }

    push(item) {
      this.data.push(item);
      this._bubbleUp(this.data.length - 1);
    }

    pop() {
      const top = this.data[0];
      const last = this.data.pop();
      if (this.data.length > 0) {
        this.data[0] = last;
        this._sinkDown(0);
      }
      return top;
    }

    get size() { return this.data.length; }

    _bubbleUp(i) {
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (this.data[p].f <= this.data[i].f) break;
        [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
        i = p;
      }
    }

    _sinkDown(i) {
      const n = this.data.length;
      while (true) {
        let smallest = i;
        const l = 2 * i + 1, r = 2 * i + 2;
        if (l < n && this.data[l].f < this.data[smallest].f) smallest = l;
        if (r < n && this.data[r].f < this.data[smallest].f) smallest = r;
        if (smallest === i) break;
        [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
        i = smallest;
      }
    }
  }

  // ─── Heuristic (octile distance for 8-directional movement) ──────────────────
  function heuristic(ac, ar, bc, br) {
    const dx = Math.abs(ac - bc);
    const dy = Math.abs(ar - br);
    return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
  }

  // ─── Build a passability grid ─────────────────────────────────────────────────
  // isAir    : aircraft ignore terrain and structures
  // grid     : terrain type grid [row][col]
  // buildings: array of building objects (block ground movement)
  // unitGrid : optional Set of "col,row" strings for unit positions (soft block)
  //
  // Returns a Float32Array of cost multipliers, length = cols*rows.
  // 0 = impassable, >0 = movement cost (1.0 = normal).

  function buildCostGrid(grid, cols, rows, buildings, isAir) {
    const costs = new Float32Array(cols * rows).fill(1.0);

    if (isAir) return costs; // aircraft ignore everything

    // Terrain costs
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = TERRAIN[grid[r]?.[c]] || TERRAIN.grass;
        if (!t.groundOk) {
          costs[r * cols + c] = 0; // impassable
        } else {
          // speedMult > 1 means faster = lower cost; < 1 means slower = higher cost
          costs[r * cols + c] = 1.0 / (t.speedMult || 1.0);
        }
      }
    }

    // Buildings block ground movement
    for (const b of buildings) {
      if (b.dead) continue;
      const idx = b.row * cols + b.col;
      if (idx >= 0 && idx < costs.length) {
        costs[idx] = 0; // impassable
      }
    }

    return costs;
  }

  // ─── A* search ───────────────────────────────────────────────────────────────
  // Returns an array of { col, row } waypoints from start (exclusive) to goal
  // (inclusive), or [] if no path found.
  //
  // opts.maxNodes : limit search to avoid freezing on huge maps (default 4000)
  // opts.allowDiag: allow diagonal movement (default true)

  function findPath(startCol, startRow, goalCol, goalRow, costs, cols, rows, opts) {
    opts = opts || {};
    const maxNodes  = opts.maxNodes  ?? 4000;
    const allowDiag = opts.allowDiag ?? true;

    // Trivial case
    if (startCol === goalCol && startRow === goalRow) return [];

    // Goal impassable — try to get as close as possible
    // (handled implicitly: A* will still run, may find adjacent cell)

    const open   = new MinHeap();
    const gScore = new Float32Array(cols * rows).fill(Infinity);
    const parent = new Int32Array(cols * rows).fill(-1);
    const closed = new Uint8Array(cols * rows);

    const startIdx = startRow * cols + startCol;
    const goalIdx  = goalRow  * cols + goalCol;

    gScore[startIdx] = 0;
    open.push({ f: heuristic(startCol, startRow, goalCol, goalRow), idx: startIdx });

    const dirs = allowDiag
      ? [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]
      : [[-1,0],[1,0],[0,-1],[0,1]];

    let nodesExpanded = 0;
    let bestIdx = startIdx;
    let bestH = Infinity;

    while (open.size > 0 && nodesExpanded < maxNodes) {
      const { idx } = open.pop();
      if (closed[idx]) continue;
      closed[idx] = 1;
      nodesExpanded++;

      if (idx === goalIdx) {
        return _reconstructPath(parent, goalIdx, cols);
      }

      const col = idx % cols;
      const row = (idx / cols) | 0;

      for (const [dc, dr] of dirs) {
        const nc = col + dc, nr = row + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;

        const nIdx = nr * cols + nc;
        if (closed[nIdx]) continue;

        const tileCost = costs[nIdx];
        if (tileCost === 0) continue; // impassable

        // Diagonal movement cost ≈ √2 × tile cost
        const moveCost = (dc !== 0 && dr !== 0) ? tileCost * 1.414 : tileCost;
        const ng = gScore[idx] + moveCost;

        if (ng < gScore[nIdx]) {
          gScore[nIdx] = ng;
          parent[nIdx] = idx;
          const h = heuristic(nc, nr, goalCol, goalRow);
          open.push({ f: ng + h, idx: nIdx });

          // Track best node reached (for partial paths)
          if (h < bestH) { bestH = h; bestIdx = nIdx; }
        }
      }
    }

    // No complete path — return partial path to closest reachable cell
    if (bestIdx !== startIdx) {
      return _reconstructPath(parent, bestIdx, cols);
    }
    return [];
  }

  function _reconstructPath(parent, endIdx, cols) {
    const path = [];
    let idx = endIdx;
    while (idx !== -1 && parent[idx] !== -1) {
      path.push({ col: idx % cols, row: (idx / cols) | 0 });
      idx = parent[idx];
    }
    path.reverse();
    return path;
  }

  // ─── Smooth path (remove redundant waypoints) ─────────────────────────────────
  // Simple string-pulling: remove collinear waypoints.
  function smoothPath(path) {
    if (path.length <= 2) return path;
    const result = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
      const prev = result[result.length - 1];
      const curr = path[i];
      const next = path[i + 1];
      const dx1 = curr.col - prev.col, dy1 = curr.row - prev.row;
      const dx2 = next.col - curr.col, dy2 = next.row - curr.row;
      // Keep if direction changes
      if (dx1 !== dx2 || dy1 !== dy2) result.push(curr);
    }
    result.push(path[path.length - 1]);
    return result;
  }

  // ─── High-level: request a path for a unit ────────────────────────────────────
  // Handles air units (no pathfinding needed), goal clamping, and
  // returns a smoothed waypoint list.
  //
  // unit     : unit object with px, py, type
  // goalCol  : destination column
  // goalRow  : destination row
  // grid     : terrain grid
  // buildings: all buildings (for blocking)
  // cols, rows

  function requestPath(unit, goalCol, goalRow, grid, buildings, cols, rows) {
    const def = getUnitDef(unit.type);
    if (!def) return [];

    // Air units fly directly — no pathfinding
    if (def.isAir) return [];

    const startCol = clamp(Math.floor(unit.px / CELL), 0, cols - 1);
    const startRow = clamp(Math.floor(unit.py / CELL), 0, rows - 1);
    const gc = clamp(goalCol, 0, cols - 1);
    const gr = clamp(goalRow, 0, rows - 1);

    // Don't pass allied units as blockers — they move out of the way
    const costs = buildCostGrid(grid, cols, rows, buildings, false);

    const raw = findPath(startCol, startRow, gc, gr, costs, cols, rows, { maxNodes: 6000 });
    return smoothPath(raw);
  }

  // ─── Unit movement along path ─────────────────────────────────────────────────
  // Advances a ground unit one frame along its path.
  // unit  : unit object (mutates px, py, path)
  // grid  : terrain grid (for speed multiplier)
  // dt    : delta time in seconds
  // cols, rows

  function stepAlongPath(unit, grid, dt, cols, rows) {
    const def = getUnitDef(unit.type);
    if (!def || def.isAir) return;

    // Air units use direct movement (handled in game.js)
    if (!unit.path || unit.path.length === 0) return;

    const wp = unit.path[0];
    const tx = wp.col * CELL + CELL / 2;
    const ty = wp.row * CELL + CELL / 2;
    const dx = tx - unit.px;
    const dy = ty - unit.py;
    const d  = Math.sqrt(dx * dx + dy * dy);

    if (d < 2) {
      // Reached waypoint
      unit.path.shift();
      return;
    }

    // Terrain speed multiplier at current tile
    const col = clamp(Math.floor(unit.px / CELL), 0, cols - 1);
    const row = clamp(Math.floor(unit.py / CELL), 0, rows - 1);
    const terrainType = grid[row]?.[col] || 'grass';
    const mult = TERRAIN[terrainType]?.speedMult ?? 1.0;

    const speed = def.speed * CELL * mult * dt;
    unit.px += (dx / d) * speed;
    unit.py += (dy / d) * speed;
  }

  // ─── Air unit direct movement ─────────────────────────────────────────────────
  // Moves an aircraft directly toward its target position (tx, ty).
  // Returns true when arrived.
  function stepAirUnit(unit, targetX, targetY, dt) {
    const def = getUnitDef(unit.type);
    if (!def) return true;

    const dx = targetX - unit.px;
    const dy = targetY - unit.py;
    const d  = Math.sqrt(dx * dx + dy * dy);

    if (d < 3) return true; // arrived

    const speed = def.speed * CELL * dt;
    unit.px += (dx / d) * speed;
    unit.py += (dy / d) * speed;
    return false;
  }

  // ─── Find nearest open adjacent cell ─────────────────────────────────────────
  // Used when spawning units from a building.
  // Returns { col, row } or null if no open cell found within radius.

  function findOpenAdjacent(col, row, grid, buildings, units, cols, rows, maxRadius) {
    maxRadius = maxRadius || 4;

    // Build a quick lookup of occupied cells
    const occupied = new Set();
    for (const b of buildings) {
      if (!b.dead) occupied.add(`${b.col},${b.row}`);
    }
    for (const u of units) {
      if (!u.dead) {
        const uc = Math.floor(u.px / CELL);
        const ur = Math.floor(u.py / CELL);
        occupied.add(`${uc},${ur}`);
      }
    }

    // BFS outward from building cell
    const visited = new Set([`${col},${row}`]);
    const queue = [];

    const dirs = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]];
    for (const [dc, dr] of dirs) {
      const nc = col + dc, nr = row + dr;
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
        queue.push({ col: nc, row: nr, dist: 1 });
        visited.add(`${nc},${nr}`);
      }
    }

    while (queue.length > 0) {
      const { col: nc, row: nr, dist } = queue.shift();
      if (dist > maxRadius) break;

      const t = TERRAIN[grid[nr]?.[nc]] || TERRAIN.grass;
      if (t.groundOk && !occupied.has(`${nc},${nr}`)) {
        return { col: nc, row: nr };
      }

      for (const [dc, dr] of dirs) {
        const nc2 = nc + dc, nr2 = nr + dr;
        const key = `${nc2},${nr2}`;
        if (!visited.has(key) && nc2 >= 0 && nc2 < cols && nr2 >= 0 && nr2 < rows) {
          visited.add(key);
          queue.push({ col: nc2, row: nr2, dist: dist + 1 });
        }
      }
    }

    return null; // no open cell found
  }

  // ─── Collision: is a cell occupied by a ground unit? ─────────────────────────
  function buildUnitOccupancy(units) {
    const set = new Set();
    for (const u of units) {
      if (u.dead) continue;
      const def = getUnitDef(u.type);
      if (def && def.isAir) continue; // air units don't block ground
      const col = Math.floor(u.px / CELL);
      const row = Math.floor(u.py / CELL);
      set.add(`${col},${row}`);
    }
    return set;
  }

  return {
    findPath,
    smoothPath,
    requestPath,
    stepAlongPath,
    stepAirUnit,
    findOpenAdjacent,
    buildUnitOccupancy,
    buildCostGrid,
  };

})();
