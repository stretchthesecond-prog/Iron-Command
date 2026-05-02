// ═══════════════════════════════════════════════════
//  IRON COMMAND — Storage (localStorage save/load)
// ═══════════════════════════════════════════════════

'use strict';

const STORAGE_KEY = 'ironcommand_missions';
const STORAGE_VERSION = 1;

const Storage = (() => {

  // ─── Internal helpers ───────────────────────────────────────────────────────

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return _fresh();
      const data = JSON.parse(raw);
      if (data.version !== STORAGE_VERSION) return _migrate(data);
      return data;
    } catch (e) {
      console.warn('Iron Command: failed to load save data.', e);
      return _fresh();
    }
  }

  function _fresh() {
    return { version: STORAGE_VERSION, missions: [] };
  }

  function _save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Iron Command: failed to save data.', e);
      return false;
    }
  }

  function _migrate(data) {
    // Future-proofing: handle old save versions here
    console.log('Iron Command: migrating save data from version', data.version);
    const fresh = _fresh();
    // Attempt to preserve missions if they exist
    if (Array.isArray(data.missions)) {
      fresh.missions = data.missions.map(m => _sanitizeMission(m));
    }
    _save(fresh);
    return fresh;
  }

  // Ensure a mission object has all required fields with safe defaults
  function _sanitizeMission(m) {
    return {
      id:           m.id           || mkId(),
      name:         m.name         || 'Unnamed Mission',
      winCondition: m.winCondition || 'destroy_enemy_hq',
      winParam:     m.winParam     || 5,
      cols:         m.cols         || DEFAULT_COLS,
      rows:         m.rows         || DEFAULT_ROWS,
      grid:         m.grid         || _defaultGrid(m.cols || DEFAULT_COLS, m.rows || DEFAULT_ROWS),
      units:        Array.isArray(m.units)     ? m.units     : [],
      enemies:      Array.isArray(m.enemies)   ? m.enemies   : [],
      buildings:    Array.isArray(m.buildings) ? m.buildings : [],
      createdAt:    m.createdAt    || Date.now(),
      updatedAt:    m.updatedAt    || Date.now(),
    };
  }

  function _defaultGrid(cols, rows) {
    return Array.from({ length: rows }, () => Array(cols).fill('grass'));
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Return all saved missions as an array, sorted by updatedAt desc.
   */
  function getAllMissions() {
    const data = _load();
    return data.missions
      .map(m => _sanitizeMission(m))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Return a single mission by id, or null if not found.
   */
  function getMission(id) {
    const data = _load();
    const m = data.missions.find(m => m.id === id);
    return m ? _sanitizeMission(m) : null;
  }

  /**
   * Save (insert or update) a mission.
   * Accepts a plain mission object; id is used to determine insert vs update.
   * Returns the saved mission.
   */
  function saveMission(mission) {
    const data = _load();
    const sanitized = _sanitizeMission({
      ...mission,
      updatedAt: Date.now(),
    });
    const idx = data.missions.findIndex(m => m.id === sanitized.id);
    if (idx >= 0) {
      data.missions[idx] = sanitized;
    } else {
      sanitized.createdAt = Date.now();
      data.missions.push(sanitized);
    }
    _save(data);
    return sanitized;
  }

  /**
   * Delete a mission by id.
   * Returns true if deleted, false if not found.
   */
  function deleteMission(id) {
    const data = _load();
    const before = data.missions.length;
    data.missions = data.missions.filter(m => m.id !== id);
    if (data.missions.length === before) return false;
    _save(data);
    return true;
  }

  /**
   * Create a brand-new empty mission object (not yet saved).
   * Call saveMission() to persist it.
   */
  function newMission(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    return {
      id:           mkId(),
      name:         'New Mission',
      winCondition: 'destroy_enemy_hq',
      winParam:     5,
      cols,
      rows,
      grid:         _defaultGrid(cols, rows),
      units:        [],
      enemies:      [],
      buildings:    [],
      createdAt:    Date.now(),
      updatedAt:    Date.now(),
    };
  }

  /**
   * Deep-clone a mission so edits don't affect the stored reference.
   */
  function cloneMission(mission) {
    return JSON.parse(JSON.stringify(mission));
  }

  /**
   * Export all missions as a JSON string (for manual backup).
   */
  function exportAll() {
    const data = _load();
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import missions from a JSON string.
   * mode: 'replace' wipes existing, 'merge' adds/updates by id.
   * Returns { imported, skipped }.
   */
  function importAll(jsonStr, mode = 'merge') {
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      return { imported: 0, skipped: 0, error: 'Invalid JSON' };
    }

    const incoming = Array.isArray(parsed.missions)
      ? parsed.missions
      : Array.isArray(parsed) ? parsed : [];

    const data = mode === 'replace' ? _fresh() : _load();
    let imported = 0, skipped = 0;

    incoming.forEach(m => {
      try {
        const sanitized = _sanitizeMission(m);
        const idx = data.missions.findIndex(ex => ex.id === sanitized.id);
        if (idx >= 0) {
          data.missions[idx] = sanitized;
        } else {
          data.missions.push(sanitized);
        }
        imported++;
      } catch (e) {
        skipped++;
      }
    });

    _save(data);
    return { imported, skipped };
  }

  /**
   * Wipe all saved data. Use with caution.
   */
  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Return storage usage info (approximate).
   */
  function storageInfo() {
    const raw = localStorage.getItem(STORAGE_KEY) || '';
    const bytes = new Blob([raw]).size;
    const data = _load();
    return {
      missionCount: data.missions.length,
      bytes,
      kb: (bytes / 1024).toFixed(1),
    };
  }

  return {
    getAllMissions,
    getMission,
    saveMission,
    deleteMission,
    newMission,
    cloneMission,
    exportAll,
    importAll,
    clearAll,
    storageInfo,
  };

})();
