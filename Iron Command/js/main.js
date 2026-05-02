// ═══════════════════════════════════════════════════
//  IRON COMMAND — Main Entry Point & Screen Router
// ═══════════════════════════════════════════════════

'use strict';

// ─── Screen management ────────────────────────────────────────────────────────
const Screens = (() => {
  const all = document.querySelectorAll('.screen');

  function show(id) {
    all.forEach(s => {
      s.classList.toggle('active', s.id === id);
    });
  }

  return { show };
})();

// ─── Current mission being played (for retry) ─────────────────────────────────
let _activeMission = null;

// ─── Main Menu ────────────────────────────────────────────────────────────────
function initMenu() {
  document.getElementById('btn-new-campaign').onclick  = () => showCampaign();
  document.getElementById('btn-load-campaign').onclick = () => showCampaign();
  document.getElementById('btn-editor').onclick        = () => openEditorNew();
  document.getElementById('btn-about').onclick         = () => Screens.show('screen-about');
}

// ─── About ────────────────────────────────────────────────────────────────────
function initAbout() {
  document.getElementById('btn-about-back').onclick = () => Screens.show('screen-menu');
}

// ─── Campaign / Mission Select ────────────────────────────────────────────────
function showCampaign() {
  Screens.show('screen-campaign');
  renderCampaignList();
}

function renderCampaignList() {
  const list = document.getElementById('campaign-list');
  list.innerHTML = '';

  const missions = Storage.getAllMissions();

  if (missions.length === 0) {
    list.innerHTML = '<div style="color:#555;font-size:12px;padding:12px 0">No missions saved yet.<br>Use the Map Editor to create one.</div>';
  } else {
    missions.forEach(m => {
      const item = document.createElement('div');
      item.className = 'campaign-item';

      const info = document.createElement('div');
      info.innerHTML = `
        <div class="campaign-item-name">${m.name}</div>
        <div class="campaign-item-meta">
          ${WIN_CONDITIONS[m.winCondition] || m.winCondition}
          &nbsp;·&nbsp;${m.cols}×${m.rows} map
          &nbsp;·&nbsp;${m.units.length} units
          &nbsp;·&nbsp;${m.enemies.length} enemies
        </div>`;

      const actions = document.createElement('div');
      actions.className = 'campaign-item-actions';

      const playBtn = document.createElement('button');
      playBtn.className = 'item-btn play';
      playBtn.textContent = 'PLAY';
      playBtn.onclick = () => startMission(m);

      const editBtn = document.createElement('button');
      editBtn.className = 'item-btn';
      editBtn.textContent = 'EDIT';
      editBtn.onclick = () => openEditorExisting(m);

      const delBtn = document.createElement('button');
      delBtn.className = 'item-btn del';
      delBtn.textContent = 'DEL';
      delBtn.onclick = () => {
        if (confirm(`Delete "${m.name}"? This cannot be undone.`)) {
          Storage.deleteMission(m.id);
          renderCampaignList();
        }
      };

      actions.appendChild(playBtn);
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      item.appendChild(info);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  // Back button
  document.getElementById('btn-campaign-back').onclick = () => Screens.show('screen-menu');

  // New mission button
  document.getElementById('btn-campaign-new-mission').onclick = () => openEditorNew();
}

// ─── Editor ───────────────────────────────────────────────────────────────────
function openEditorNew() {
  const mission = Storage.newMission(DEFAULT_COLS, DEFAULT_ROWS);
  Screens.show('screen-editor');
  Editor.open(mission, onEditorDone);
}

function openEditorExisting(mission) {
  Screens.show('screen-editor');
  Editor.open(Storage.cloneMission(mission), onEditorDone);
}

function onEditorDone(savedLevel) {
  // savedLevel is the saved mission, or null if user hit Back without saving
  Screens.show('screen-campaign');
  renderCampaignList();
}

// ─── Start mission ────────────────────────────────────────────────────────────
function startMission(mission) {
  _activeMission = Storage.cloneMission(mission);
  Screens.show('screen-game');
  Game.start(_activeMission, onGameEnd);
}

function onGameEnd(result) {
  // result: 'victory' | 'defeat' | 'menu'
  if (result === 'menu') {
    Screens.show('screen-menu');
    return;
  }
  showEndScreen(result === 'victory');
}

// ─── End screen ───────────────────────────────────────────────────────────────
function showEndScreen(win) {
  Screens.show('screen-end');

  document.getElementById('end-icon').textContent    = win ? '★' : '✕';
  document.getElementById('end-icon').style.color    = win ? '#ffcc44' : '#cc3322';
  document.getElementById('end-title').textContent   = win ? 'MISSION COMPLETE' : 'MISSION FAILED';
  document.getElementById('end-subtitle').textContent = win
    ? 'Outstanding command, soldier.'
    : 'Your forces were overwhelmed. Regroup and try again.';

  document.getElementById('btn-retry').onclick    = () => {
    if (_activeMission) startMission(_activeMission);
    else Screens.show('screen-menu');
  };
  document.getElementById('btn-end-menu').onclick = () => Screens.show('screen-menu');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  initMenu();
  initAbout();
  Screens.show('screen-menu');

  // Handle window resize — notify renderer
  window.addEventListener('resize', () => {
    const wrap   = document.getElementById('game-canvas-wrap');
    const canvas = document.getElementById('game-canvas');
    if (wrap && canvas && document.getElementById('screen-game').classList.contains('active')) {
      Renderer.resize(wrap.clientWidth, wrap.clientHeight);
    }
    const editorCanvas = document.getElementById('editor-canvas');
    const editorWrap   = document.getElementById('editor-canvas-wrap');
    if (editorCanvas && editorWrap && document.getElementById('screen-editor').classList.contains('active')) {
      editorCanvas.width  = editorWrap.clientWidth;
      editorCanvas.height = editorWrap.clientHeight;
    }
  });

  // Keyboard shortcut: Escape on end screen → menu
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const endScreen = document.getElementById('screen-end');
      if (endScreen && endScreen.classList.contains('active')) {
        Screens.show('screen-menu');
      }
    }
  });

  console.log('%c IRON COMMAND %c v1.0 ready ', 
    'background:#3a7a2a;color:#ffcc44;font-weight:bold;padding:2px 6px',
    'background:#111;color:#888;padding:2px 6px'
  );
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
