// ═══════════════════════════════════════════════════
//  IRON COMMAND — Sprite Drawers (pixel art on canvas)
// ═══════════════════════════════════════════════════

'use strict';

const Sprites = (() => {

  // ─── Shared helpers ──────────────────────────────────────────────────────────

  function px(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // Draw a pixel-art unit centered at (cx, cy), scaled to cellSize
  // friendly: true = blue team, false = red team
  // selected: draw selection ring
  // alpha: 0-1 (for reloading/grey-out)
  function drawUnit(ctx, type, cx, cy, cellSize, friendly, selected, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(cx), Math.round(cy));

    const s = cellSize * 0.46; // scale factor

    // Selection ring
    if (selected) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    const fc = friendly; // shorthand

    switch (type) {
      case 'rifleman':
      case 'e_rifleman':
        _drawRifleman(ctx, s, fc); break;
      case 'missile':
      case 'e_missile':
        _drawMissile(ctx, s, fc); break;
      case 'light_jeep':
      case 'e_jeep':
        _drawJeep(ctx, s, fc); break;
      case 'light_tank':
      case 'e_light_tank':
        _drawLightTank(ctx, s, fc); break;
      case 'heavy_tank':
      case 'e_heavy_tank':
        _drawHeavyTank(ctx, s, fc); break;
      case 'fighter':
      case 'e_fighter':
        _drawFighter(ctx, s, fc); break;
      case 'bomber':
      case 'e_bomber':
        _drawBomber(ctx, s, fc); break;
      default:
        _drawFallback(ctx, s, fc, type); break;
    }

    ctx.restore();
  }

  // Draw a building sprite inside rect (x, y, w, h)
  function drawBuilding(ctx, type, x, y, w, h) {
    ctx.save();
    ctx.translate(Math.round(x + w / 2), Math.round(y + h / 2));
    const s = Math.min(w, h) * 0.46;

    switch (type) {
      case 'hq':            _bldgHQ(ctx, s, true);   break;
      case 'e_hq':          _bldgHQ(ctx, s, false);  break;
      case 'barracks':      _bldgBarracks(ctx, s, true);  break;
      case 'e_barracks':    _bldgBarracks(ctx, s, false); break;
      case 'factory':       _bldgFactory(ctx, s, true);   break;
      case 'e_factory':     _bldgFactory(ctx, s, false);  break;
      case 'airport':       _bldgAirport(ctx, s, true);   break;
      case 'e_airport':     _bldgAirport(ctx, s, false);  break;
      case 'pillbox':       _bldgPillbox(ctx, s, true);   break;
      case 'e_pillbox':     _bldgPillbox(ctx, s, false);  break;
      case 'turret':        _bldgTurret(ctx, s, true);    break;
      case 'e_turret':      _bldgTurret(ctx, s, false);   break;
      case 'sam':           _bldgSAM(ctx, s, true);       break;
      case 'e_sam':         _bldgSAM(ctx, s, false);      break;
      case 'medic':         _bldgMedic(ctx, s);            break;
      case 'wall':          _bldgWall(ctx, s);             break;
      case 'neutral_oil':   _bldgOil(ctx, s);              break;
      case 'neutral_comm':  _bldgComm(ctx, s);             break;
      case 'neutral_bunk':  _bldgBunker(ctx, s);           break;
      default:              _bldgFallback(ctx, s, type);   break;
    }

    ctx.restore();
  }

  // ─── Unit sprites ─────────────────────────────────────────────────────────────

  function _drawRifleman(ctx, s, fc) {
    // Legs
    ctx.fillStyle = fc ? '#2a3d7a' : '#7a2a1a';
    ctx.fillRect(-s*0.28, s*0.52, s*0.22, s*0.32);
    ctx.fillRect( s*0.06, s*0.52, s*0.22, s*0.32);
    // Body
    ctx.fillStyle = fc ? '#4477ee' : '#dd3311';
    ctx.fillRect(-s*0.34, -s*0.08, s*0.68, s*0.62);
    // Helmet
    ctx.fillStyle = fc ? '#223388' : '#881100';
    ctx.beginPath();
    ctx.ellipse(0, -s*0.18, s*0.30, s*0.26, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-s*0.30, -s*0.10, s*0.60, s*0.08);
    // Rifle
    ctx.fillStyle = '#222';
    ctx.fillRect( s*0.28, -s*0.04, s*0.55, s*0.10);
    ctx.fillRect( s*0.76, -s*0.10, s*0.06, s*0.16); // muzzle
  }

  function _drawMissile(ctx, s, fc) {
    // Legs
    ctx.fillStyle = fc ? '#2a3d7a' : '#7a2a1a';
    ctx.fillRect(-s*0.28, s*0.52, s*0.22, s*0.32);
    ctx.fillRect( s*0.06, s*0.52, s*0.22, s*0.32);
    // Body
    ctx.fillStyle = fc ? '#4477ee' : '#dd3311';
    ctx.fillRect(-s*0.34, -s*0.08, s*0.68, s*0.62);
    // Helmet
    ctx.fillStyle = fc ? '#223388' : '#881100';
    ctx.beginPath();
    ctx.ellipse(0, -s*0.18, s*0.30, s*0.26, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-s*0.30, -s*0.10, s*0.60, s*0.08);
    // Launcher tube
    ctx.fillStyle = '#555';
    ctx.fillRect(-s*0.75, -s*0.14, s*0.80, s*0.18);
    ctx.fillRect(-s*0.82, -s*0.18, s*0.12, s*0.26); // back cap
    // Missile tip
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.moveTo(-s*0.82, -s*0.10);
    ctx.lineTo(-s*1.02, -s*0.05);
    ctx.lineTo(-s*0.82,  s*0.00);
    ctx.closePath();
    ctx.fill();
  }

  function _drawJeep(ctx, s, fc) {
    // Wheels
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-s*0.52, s*0.62, s*0.22, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( s*0.52, s*0.62, s*0.22, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#444';
    ctx.beginPath(); ctx.arc(-s*0.52, s*0.62, s*0.12, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( s*0.52, s*0.62, s*0.12, 0, Math.PI*2); ctx.fill();
    // Body
    ctx.fillStyle = fc ? '#336688' : '#bb4400';
    ctx.fillRect(-s*0.78, -s*0.28, s*1.56, s*0.82);
    // Cabin
    ctx.fillStyle = fc ? '#224466' : '#882200';
    ctx.fillRect(-s*0.48, -s*0.60, s*0.96, s*0.38);
    // Windshield
    ctx.fillStyle = '#88ccee';
    ctx.fillRect(-s*0.36, -s*0.54, s*0.72, s*0.24);
    // MG on top
    ctx.fillStyle = '#333';
    ctx.fillRect( s*0.28, -s*0.52, s*0.10, s*0.20);
    ctx.fillRect( s*0.32, -s*0.60, s*0.40, s*0.08);
  }

  function _drawLightTank(ctx, s, fc) {
    // Tracks
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-s*0.90, -s*0.30, s*1.80, s*1.00);
    ctx.fillStyle = '#333';
    ctx.fillRect(-s*0.90, -s*0.24, s*1.80, s*0.12);
    ctx.fillRect(-s*0.90,  s*0.52, s*1.80, s*0.12);
    // Road wheels
    ctx.fillStyle = '#222';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * s*0.54, s*0.54, s*0.18, 0, Math.PI*2);
      ctx.fill();
    }
    // Hull
    ctx.fillStyle = fc ? '#1a5577' : '#993311';
    ctx.fillRect(-s*0.80, -s*0.20, s*1.60, s*0.80);
    // Turret
    ctx.fillStyle = fc ? '#114466' : '#771100';
    ctx.beginPath();
    ctx.ellipse(0, s*0.08, s*0.58, s*0.44, 0, 0, Math.PI*2);
    ctx.fill();
    // Barrel
    ctx.fillStyle = '#222';
    ctx.fillRect( s*0.52, s*0.00, s*0.88, s*0.16);
    ctx.fillRect( s*1.32, -s*0.04, s*0.08, s*0.24); // muzzle brake
  }

  function _drawHeavyTank(ctx, s, fc) {
    // Tracks (wider)
    ctx.fillStyle = '#111';
    ctx.fillRect(-s*1.00, -s*0.36, s*2.00, s*1.10);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-s*1.00, -s*0.30, s*2.00, s*0.10);
    ctx.fillRect(-s*1.00,  s*0.58, s*2.00, s*0.10);
    // Wheels
    ctx.fillStyle = '#1a1a1a';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * s*0.60, s*0.58, s*0.20, 0, Math.PI*2);
      ctx.fill();
    }
    // Hull (wider, more armored look)
    ctx.fillStyle = fc ? '#0f3d55' : '#771100';
    ctx.fillRect(-s*0.92, -s*0.26, s*1.84, s*0.90);
    // Sloped front
    ctx.fillStyle = fc ? '#0c3248' : '#661000';
    ctx.beginPath();
    ctx.moveTo(-s*0.92, -s*0.26);
    ctx.lineTo(-s*0.78, -s*0.44);
    ctx.lineTo( s*0.78, -s*0.44);
    ctx.lineTo( s*0.92, -s*0.26);
    ctx.closePath();
    ctx.fill();
    // Turret
    ctx.fillStyle = fc ? '#0a2a3a' : '#550d00';
    ctx.beginPath();
    ctx.ellipse(0, s*0.10, s*0.68, s*0.52, 0, 0, Math.PI*2);
    ctx.fill();
    // Long barrel
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect( s*0.62, s*0.02, s*1.05, s*0.18);
    ctx.fillRect( s*1.58, -s*0.06, s*0.10, s*0.30);
    // Co-ax MG
    ctx.fillStyle = '#333';
    ctx.fillRect( s*0.62, s*0.22, s*0.50, s*0.10);
  }

  function _drawFighter(ctx, s, fc) {
    // Fuselage
    ctx.fillStyle = fc ? '#8855dd' : '#aa33aa';
    ctx.beginPath();
    ctx.moveTo( s*1.10,  s*0.00);
    ctx.lineTo(-s*0.30,  s*0.22);
    ctx.lineTo(-s*0.55,  s*0.00);
    ctx.lineTo(-s*0.30, -s*0.22);
    ctx.closePath();
    ctx.fill();
    // Wings
    ctx.fillStyle = fc ? '#6633bb' : '#882288';
    ctx.beginPath();
    ctx.moveTo( s*0.10, -s*0.14);
    ctx.lineTo(-s*0.35, -s*0.90);
    ctx.lineTo(-s*0.52, -s*0.68);
    ctx.lineTo( s*0.18, -s*0.10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo( s*0.10,  s*0.14);
    ctx.lineTo(-s*0.35,  s*0.90);
    ctx.lineTo(-s*0.52,  s*0.68);
    ctx.lineTo( s*0.18,  s*0.10);
    ctx.closePath();
    ctx.fill();
    // Tail fins
    ctx.fillStyle = fc ? '#5522aa' : '#661166';
    ctx.beginPath();
    ctx.moveTo(-s*0.38, -s*0.06);
    ctx.lineTo(-s*0.62, -s*0.36);
    ctx.lineTo(-s*0.55,  s*0.00);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s*0.38,  s*0.06);
    ctx.lineTo(-s*0.62,  s*0.36);
    ctx.lineTo(-s*0.55,  s*0.00);
    ctx.closePath();
    ctx.fill();
    // Canopy
    ctx.fillStyle = '#aaddff';
    ctx.beginPath();
    ctx.ellipse(s*0.48, 0, s*0.28, s*0.12, 0, 0, Math.PI*2);
    ctx.fill();
    // Engines / guns
    ctx.fillStyle = '#333';
    ctx.fillRect( s*0.05, -s*0.24, s*0.30, s*0.08);
    ctx.fillRect( s*0.05,  s*0.16, s*0.30, s*0.08);
  }

  function _drawBomber(ctx, s, fc) {
    // Wide fuselage
    ctx.fillStyle = fc ? '#442288' : '#772288';
    ctx.beginPath();
    ctx.moveTo( s*0.90,  s*0.00);
    ctx.lineTo(-s*0.40,  s*0.32);
    ctx.lineTo(-s*0.68,  s*0.00);
    ctx.lineTo(-s*0.40, -s*0.32);
    ctx.closePath();
    ctx.fill();
    // Wide wings
    ctx.fillStyle = fc ? '#331166' : '#551166';
    ctx.beginPath();
    ctx.moveTo( s*0.10, -s*0.20);
    ctx.lineTo(-s*0.55, -s*1.10);
    ctx.lineTo(-s*0.80, -s*0.88);
    ctx.lineTo( s*0.15, -s*0.15);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo( s*0.10,  s*0.20);
    ctx.lineTo(-s*0.55,  s*1.10);
    ctx.lineTo(-s*0.80,  s*0.88);
    ctx.lineTo( s*0.15,  s*0.15);
    ctx.closePath();
    ctx.fill();
    // Tail
    ctx.fillStyle = fc ? '#280f55' : '#441155';
    ctx.beginPath();
    ctx.moveTo(-s*0.50, -s*0.08);
    ctx.lineTo(-s*0.82, -s*0.42);
    ctx.lineTo(-s*0.70,  s*0.00);
    ctx.lineTo(-s*0.82,  s*0.42);
    ctx.lineTo(-s*0.50,  s*0.08);
    ctx.closePath();
    ctx.fill();
    // Canopy
    ctx.fillStyle = '#aaddff';
    ctx.beginPath();
    ctx.ellipse(s*0.42, 0, s*0.24, s*0.14, 0, 0, Math.PI*2);
    ctx.fill();
    // Bomb bay
    ctx.fillStyle = '#111';
    ctx.fillRect(-s*0.18,  s*0.22, s*0.36, s*0.18);
    // Engines on wings
    ctx.fillStyle = '#222';
    ctx.fillRect(-s*0.30, -s*0.55, s*0.22, s*0.12);
    ctx.fillRect(-s*0.30,  s*0.43, s*0.22, s*0.12);
  }

  function _drawFallback(ctx, s, fc, type) {
    ctx.fillStyle = fc ? '#3366cc' : '#cc3322';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(s * 0.7)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((type || '?')[0].toUpperCase(), 0, 1);
  }

  // ─── Building sprites ─────────────────────────────────────────────────────────

  function _bldgHQ(ctx, s, friendly) {
    const c1 = friendly ? '#bb8800' : '#aa2200';
    const c2 = friendly ? '#ddaa00' : '#cc3322';
    const c3 = friendly ? '#ffcc00' : '#ff4422';
    // Base building
    ctx.fillStyle = c1;
    ctx.fillRect(-s*0.88, -s*0.42, s*1.76, s*1.30);
    // Upper floor
    ctx.fillStyle = c2;
    ctx.fillRect(-s*0.68, -s*0.88, s*1.36, s*0.52);
    // Flag pole
    ctx.fillStyle = '#aaa';
    ctx.fillRect(-s*0.08, -s*1.38, s*0.06, s*0.56);
    // Flag
    ctx.fillStyle = c3;
    ctx.fillRect(-s*0.02, -s*1.36, s*0.30, s*0.20);
    // Windows
    ctx.fillStyle = '#aaddff';
    ctx.fillRect(-s*0.55, -s*0.26, s*0.34, s*0.40);
    ctx.fillRect( s*0.20, -s*0.26, s*0.34, s*0.40);
    ctx.fillRect(-s*0.52, -s*0.78, s*0.28, s*0.26);
    ctx.fillRect( s*0.22, -s*0.78, s*0.28, s*0.26);
    // Door
    ctx.fillStyle = '#333';
    ctx.fillRect(-s*0.12,  s*0.24, s*0.24, s*0.44);
  }

  function _bldgBarracks(ctx, s, friendly) {
    const c1 = friendly ? '#224499' : '#882200';
    const c2 = friendly ? '#334488' : '#771100';
    // Main building
    ctx.fillStyle = c1;
    ctx.fillRect(-s*0.88, -s*0.28, s*1.76, s*1.06);
    // Roof
    ctx.fillStyle = c2;
    ctx.fillRect(-s*0.88, -s*0.66, s*1.76, s*0.44);
    // Ventilation stripes
    ctx.fillStyle = friendly ? '#1a3377' : '#661100';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-s*0.70 + i*s*0.52, -s*0.60, s*0.14, s*0.36);
    }
    // Windows
    ctx.fillStyle = '#aabbcc';
    ctx.fillRect(-s*0.60, -s*0.16, s*0.30, s*0.38);
    ctx.fillRect( s*0.12, -s*0.16, s*0.30, s*0.38);
    // Door
    ctx.fillStyle = '#222';
    ctx.fillRect(-s*0.10,  s*0.20, s*0.20, s*0.50);
    // Sign
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(-s*0.30,  s*0.20, s*0.24, s*0.12);
  }

  function _bldgFactory(ctx, s, friendly) {
    const c1 = friendly ? '#335566' : '#882200';
    const c2 = friendly ? '#224455' : '#661100';
    // Main hall
    ctx.fillStyle = c1;
    ctx.fillRect(-s*0.88, -s*0.10, s*1.76, s*0.88);
    // Office block
    ctx.fillStyle = c2;
    ctx.fillRect(-s*0.88, -s*0.68, s*0.70, s*0.64);
    // Smokestacks
    ctx.fillStyle = '#666';
    ctx.fillRect(-s*0.48, -s*0.96, s*0.18, s*0.30);
    ctx.fillRect(-s*0.10, -s*1.06, s*0.18, s*0.40);
    ctx.fillRect( s*0.28, -s*0.90, s*0.18, s*0.24);
    // Smoke puffs
    ctx.fillStyle = 'rgba(180,180,180,0.5)';
    ctx.beginPath(); ctx.arc(-s*0.39, -s*1.02, s*0.14, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-s*0.01, -s*1.14, s*0.14, 0, Math.PI*2); ctx.fill();
    // Bay door
    ctx.fillStyle = '#444';
    ctx.fillRect( s*0.08,  s*0.04, s*0.68, s*0.64);
    ctx.fillStyle = '#555';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(s*0.10 + i*s*0.22, s*0.06, s*0.18, s*0.60);
    }
    // Office windows
    ctx.fillStyle = '#aabbcc';
    ctx.fillRect(-s*0.72, -s*0.52, s*0.22, s*0.20);
    ctx.fillRect(-s*0.40, -s*0.52, s*0.22, s*0.20);
  }

  function _bldgAirport(ctx, s, friendly) {
    const c1 = friendly ? '#553388' : '#661188';
    const c2 = friendly ? '#442277' : '#551177';
    // Runway
    ctx.fillStyle = '#555';
    ctx.fillRect(-s*0.88,  s*0.22, s*1.76, s*0.52);
    // Runway markings
    ctx.fillStyle = '#888';
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(i*s*0.30 - s*0.05,  s*0.42, s*0.10, s*0.12);
    }
    // Control tower
    ctx.fillStyle = c1;
    ctx.fillRect(-s*0.68, -s*0.50, s*0.76, s*0.76);
    // Tower top
    ctx.fillStyle = c2;
    ctx.fillRect(-s*0.72, -s*0.88, s*0.84, s*0.44);
    // Tower windows (panoramic)
    ctx.fillStyle = '#aaddff';
    ctx.fillRect(-s*0.60, -s*0.80, s*0.60, s*0.28);
    // Radar dish
    ctx.fillStyle = '#888';
    ctx.fillRect( s*0.30, -s*0.72, s*0.08, s*0.24);
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.arc(s*0.34, -s*0.74, s*0.20, Math.PI, 0);
    ctx.fill();
    // Hangar
    ctx.fillStyle = c1;
    ctx.fillRect( s*0.18,  s*0.22, s*0.62, s*0.52);
  }

  function _bldgPillbox(ctx, s, friendly) {
    const c1 = friendly ? '#445533' : '#663322';
    const c2 = friendly ? '#556644' : '#774433';
    // Base slab
    ctx.fillStyle = c1;
    ctx.beginPath();
    ctx.arc(0, s*0.12, s*0.84, 0, Math.PI*2);
    ctx.fill();
    // Dome
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.arc(0, -s*0.04, s*0.56, 0, Math.PI*2);
    ctx.fill();
    // Gun slit
    ctx.fillStyle = '#111';
    ctx.fillRect( s*0.44, -s*0.10, s*0.56, s*0.14);
    ctx.fillRect( s*0.42, -s*0.04, s*0.10, s*0.08); // MG barrel
    // Sandbags
    ctx.fillStyle = '#7a6a44';
    ctx.fillRect(-s*0.84,  s*0.60, s*1.68, s*0.20);
  }

  function _bldgTurret(ctx, s, friendly) {
    const c1 = friendly ? '#334455' : '#663311';
    const c2 = friendly ? '#445566' : '#774422';
    // Base
    ctx.fillStyle = c1;
    ctx.fillRect(-s*0.52,  s*0.08, s*1.04, s*0.68);
    // Rotating head
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.arc(0, s*0.04, s*0.56, 0, Math.PI*2);
    ctx.fill();
    // Main barrel (long)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect( s*0.48, -s*0.08, s*0.88, s*0.22);
    ctx.fillRect( s*1.28, -s*0.14, s*0.10, s*0.34); // muzzle brake
    // Co-ax barrel
    ctx.fillStyle = '#333';
    ctx.fillRect( s*0.48,  s*0.16, s*0.50, s*0.10);
    // Armor plates
    ctx.fillStyle = c1;
    ctx.fillRect(-s*0.42, -s*0.20, s*0.22, s*0.28);
    ctx.fillRect( s*0.20, -s*0.20, s*0.22, s*0.28);
  }

  function _bldgSAM(ctx, s, friendly) {
    const c1 = friendly ? '#336655' : '#224433';
    const c2 = friendly ? '#448866' : '#336644';
    // Base platform
    ctx.fillStyle = c1;
    ctx.fillRect(-s*0.70,  s*0.20, s*1.40, s*0.56);
    // Central pivot
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.arc(0, s*0.10, s*0.30, 0, Math.PI*2);
    ctx.fill();
    // Radar dish arm
    ctx.fillStyle = '#555';
    ctx.fillRect(-s*0.62, -s*0.16, s*0.50, s*0.12);
    // Radar dish
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(-s*0.52, -s*0.26, s*0.26, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#aaa';
    ctx.fillRect(-s*0.56, -s*0.28, s*0.08, s*0.14); // dish pole
    // Missile launcher arm (angled up-right)
    ctx.fillStyle = '#444';
    ctx.save();
    ctx.translate(s*0.18, -s*0.08);
    ctx.rotate(-0.55);
    ctx.fillRect(0, -s*0.08, s*0.80, s*0.16); // arm
    // Missiles on rail
    ctx.fillStyle = friendly ? '#44aa66' : '#aa4444';
    ctx.fillRect(s*0.10, -s*0.16, s*0.18, s*0.12);
    ctx.fillRect(s*0.34, -s*0.16, s*0.18, s*0.12);
    ctx.fillRect(s*0.58, -s*0.16, s*0.18, s*0.12);
    // Missile tips
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.moveTo(s*0.10,-s*0.16); ctx.lineTo(s*0.04,-s*0.10); ctx.lineTo(s*0.10,-s*0.04); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s*0.34,-s*0.16); ctx.lineTo(s*0.28,-s*0.10); ctx.lineTo(s*0.34,-s*0.04); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s*0.58,-s*0.16); ctx.lineTo(s*0.52,-s*0.10); ctx.lineTo(s*0.58,-s*0.04); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Warning stripes on base
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(-s*0.68,  s*0.68, s*0.28, s*0.06);
    ctx.fillRect( s*0.40,  s*0.68, s*0.28, s*0.06);
  }

  function _bldgMedic(ctx, s) {
    // Building
    ctx.fillStyle = '#eef8ee';
    ctx.fillRect(-s*0.78, -s*0.56, s*1.56, s*1.24);
    // Red cross (vertical)
    ctx.fillStyle = '#cc2222';
    ctx.fillRect(-s*0.12, -s*0.44, s*0.24, s*1.00);
    // Red cross (horizontal)
    ctx.fillRect(-s*0.52, -s*0.10, s*1.04, s*0.24);
    // Windows
    ctx.fillStyle = '#99ccee';
    ctx.fillRect(-s*0.62, -s*0.44, s*0.28, s*0.24);
    ctx.fillRect( s*0.34, -s*0.44, s*0.28, s*0.24);
    // Door
    ctx.fillStyle = '#bbeebb';
    ctx.fillRect(-s*0.10,  s*0.32, s*0.20, s*0.36);
  }

  function _bldgWall(ctx, s) {
    // Main wall block
    ctx.fillStyle = '#887766';
    ctx.fillRect(-s*0.90, -s*0.38, s*1.80, s*0.96);
    // Battlements
    ctx.fillStyle = '#998877';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-s*0.82 + i*s*0.44, -s*0.56, s*0.28, s*0.24);
    }
    // Mortar lines (horizontal)
    ctx.fillStyle = '#665544';
    ctx.fillRect(-s*0.90,  s*0.00, s*1.80, s*0.06);
    ctx.fillRect(-s*0.90, -s*0.18, s*1.80, s*0.06);
    // Mortar lines (vertical - offset)
    ctx.fillStyle = '#665544';
    ctx.fillRect(-s*0.44, -s*0.38, s*0.06, s*0.44);
    ctx.fillRect( s*0.14, -s*0.14, s*0.06, s*0.44);
    ctx.fillRect(-s*0.72, -s*0.14, s*0.06, s*0.44);
  }

  function _bldgOil(ctx, s) {
    // Derrick legs
    ctx.fillStyle = '#555533';
    ctx.beginPath();
    ctx.moveTo(-s*0.50,  s*0.68); ctx.lineTo(-s*0.10, -s*0.40);
    ctx.lineTo( s*0.10, -s*0.40); ctx.lineTo(-s*0.10,  s*0.68);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo( s*0.50,  s*0.68); ctx.lineTo( s*0.10, -s*0.40);
    ctx.lineTo(-s*0.10, -s*0.40); ctx.lineTo( s*0.10,  s*0.68);
    ctx.closePath(); ctx.fill();
    // Cross-braces
    ctx.fillStyle = '#444422';
    ctx.fillRect(-s*0.36,  s*0.10, s*0.72, s*0.08);
    ctx.fillRect(-s*0.24, -s*0.16, s*0.48, s*0.08);
    // Base
    ctx.fillStyle = '#666633';
    ctx.fillRect(-s*0.54,  s*0.62, s*1.08, s*0.22);
    // Top pulley housing
    ctx.fillStyle = '#777744';
    ctx.fillRect(-s*0.14, -s*0.56, s*0.28, s*0.22);
    // Pump arm
    ctx.fillStyle = '#888855';
    ctx.fillRect(-s*0.50,  s*0.22, s*0.60, s*0.12);
    ctx.beginPath();
    ctx.arc(-s*0.50,  s*0.28, s*0.10, 0, Math.PI*2); ctx.fill();
    // Pipe going down
    ctx.fillStyle = '#555533';
    ctx.fillRect(-s*0.06,  s*0.30, s*0.12, s*0.36);
  }

  function _bldgComm(ctx, s) {
    // Base
    ctx.fillStyle = '#446677';
    ctx.fillRect(-s*0.32,  s*0.44, s*0.64, s*0.34);
    // Tower mast
    ctx.fillStyle = '#558899';
    ctx.fillRect(-s*0.08, -s*0.80, s*0.16, s*1.28);
    // Crossbars
    ctx.fillStyle = '#446677';
    ctx.fillRect(-s*0.54, -s*0.64, s*1.08, s*0.08);
    ctx.fillRect(-s*0.38, -s*0.30, s*0.76, s*0.08);
    ctx.fillRect(-s*0.20,  s*0.04, s*0.40, s*0.08);
    // Dish
    ctx.fillStyle = '#88aacc';
    ctx.beginPath();
    ctx.arc(0, -s*0.92, s*0.28, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#668899';
    ctx.fillRect(-s*0.04, -s*0.90, s*0.08, s*0.14);
    // Signal light
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.arc(0, -s*0.90, s*0.07, 0, Math.PI*2);
    ctx.fill();
    // Guy wires
    ctx.strokeStyle = '#445566';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(0, -s*0.60); ctx.lineTo(-s*0.52, s*0.44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s*0.60); ctx.lineTo( s*0.52, s*0.44); ctx.stroke();
  }

  function _bldgBunker(ctx, s) {
    // Earth mound behind
    ctx.fillStyle = '#5a4a2a';
    ctx.beginPath();
    ctx.ellipse(0, s*0.40, s*0.92, s*0.44, 0, 0, Math.PI*2);
    ctx.fill();
    // Main concrete block
    ctx.fillStyle = '#666655';
    ctx.fillRect(-s*0.82, -s*0.28, s*1.64, s*0.96);
    // Sloped front
    ctx.fillStyle = '#777766';
    ctx.beginPath();
    ctx.moveTo(-s*0.82, -s*0.28);
    ctx.lineTo(-s*0.66, -s*0.56);
    ctx.lineTo( s*0.66, -s*0.56);
    ctx.lineTo( s*0.82, -s*0.28);
    ctx.closePath();
    ctx.fill();
    // Gun slits
    ctx.fillStyle = '#111';
    ctx.fillRect(-s*0.60, -s*0.08, s*0.36, s*0.12);
    ctx.fillRect( s*0.24, -s*0.08, s*0.36, s*0.12);
    // Door (rear)
    ctx.fillStyle = '#444';
    ctx.fillRect(-s*0.12,  s*0.42, s*0.24, s*0.26);
    // Reinforcement lines
    ctx.fillStyle = '#555544';
    ctx.fillRect(-s*0.82,  s*0.10, s*1.64, s*0.06);
  }

  function _bldgFallback(ctx, s, type) {
    ctx.fillStyle = '#555';
    ctx.fillRect(-s*0.80, -s*0.80, s*1.60, s*1.60);
    ctx.fillStyle = '#aaa';
    ctx.font = `bold ${Math.round(s * 0.7)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((type || '?')[0].toUpperCase(), 0, 1);
  }

  // ─── Terrain tile decorations ─────────────────────────────────────────────────
  // Called after the base tile fill to add visual detail
  function drawTerrainDetail(ctx, type, x, y, size, seed) {
    const rng = _seededRand(seed);
    ctx.save();
    switch (type) {
      case 'forest': {
        // 2-3 pixel trees
        const count = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < count; i++) {
          const tx = x + 4 + rng() * (size - 8);
          const ty = y + 4 + rng() * (size - 8);
          const ts = 4 + rng() * 4;
          ctx.fillStyle = '#0e4010';
          ctx.beginPath();
          ctx.moveTo(tx, ty - ts);
          ctx.lineTo(tx + ts, ty + ts * 0.6);
          ctx.lineTo(tx - ts, ty + ts * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#1a5a1a';
          ctx.beginPath();
          ctx.moveTo(tx, ty - ts * 1.2);
          ctx.lineTo(tx + ts * 0.7, ty + ts * 0.3);
          ctx.lineTo(tx - ts * 0.7, ty + ts * 0.3);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'mountain': {
        const tx = x + size / 2, ty = y + size / 2;
        ctx.fillStyle = '#5a4a38';
        ctx.beginPath();
        ctx.moveTo(tx, ty - size * 0.44);
        ctx.lineTo(tx + size * 0.44, ty + size * 0.36);
        ctx.lineTo(tx - size * 0.44, ty + size * 0.36);
        ctx.closePath();
        ctx.fill();
        // Snow cap
        ctx.fillStyle = '#e8e8ee';
        ctx.beginPath();
        ctx.moveTo(tx, ty - size * 0.44);
        ctx.lineTo(tx + size * 0.14, ty - size * 0.18);
        ctx.lineTo(tx - size * 0.14, ty - size * 0.18);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'water': {
        // Subtle wave lines
        ctx.strokeStyle = 'rgba(100,160,220,0.35)';
        ctx.lineWidth = 1;
        const wy = y + 6 + rng() * (size - 12);
        ctx.beginPath();
        ctx.moveTo(x + 3, wy);
        ctx.quadraticCurveTo(x + size * 0.3, wy - 3, x + size * 0.5, wy);
        ctx.quadraticCurveTo(x + size * 0.7, wy + 3, x + size - 3, wy);
        ctx.stroke();
        break;
      }
      case 'ore': {
        // Gold nugget dots
        const count = 3 + Math.floor(rng() * 3);
        for (let i = 0; i < count; i++) {
          ctx.fillStyle = '#e8c020';
          ctx.beginPath();
          ctx.arc(x + 4 + rng() * (size - 8), y + 4 + rng() * (size - 8), 2 + rng() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'road': {
        // Centre dashes
        ctx.fillStyle = 'rgba(220,210,180,0.5)';
        ctx.fillRect(x + size * 0.45, y + 2, size * 0.10, size - 4);
        break;
      }
      case 'snow': {
        // Subtle sparkle dots
        const count = 3 + Math.floor(rng() * 4);
        for (let i = 0; i < count; i++) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.beginPath();
          ctx.arc(x + 3 + rng() * (size - 6), y + 3 + rng() * (size - 6), 1, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'sand': {
        // Small ripple lines
        ctx.strokeStyle = 'rgba(180,150,80,0.3)';
        ctx.lineWidth = 1;
        const sy = y + 6 + rng() * (size - 12);
        ctx.beginPath();
        ctx.moveTo(x + 3, sy);
        ctx.lineTo(x + size - 3, sy + 2);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  // Simple seeded pseudo-random (for deterministic tile details)
  function _seededRand(seed) {
    let s = seed;
    return function () {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  // ─── Air unit shadow ──────────────────────────────────────────────────────────
  function drawAirShadow(ctx, cx, cy, size) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.35, size * 0.32, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── HP bar ───────────────────────────────────────────────────────────────────
  function drawHpBar(ctx, cx, cy, width, hp, maxHp) {
    if (!maxHp || maxHp <= 0) return;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const x = cx - width / 2;
    const y = cy;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, width, 3);
    ctx.fillStyle = ratio > 0.5 ? '#44cc44' : ratio > 0.25 ? '#ffaa00' : '#cc3322';
    ctx.fillRect(x, y, Math.round(width * ratio), 3);
  }

  // ─── Explosion flash ──────────────────────────────────────────────────────────
  function drawExplosion(ctx, cx, cy, radius, progress) {
    // progress: 0 (start) → 1 (end)
    const alpha = 1 - progress;
    const r = radius * progress;
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = '#ff8800';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ─── Capture progress bar ─────────────────────────────────────────────────────
  function drawCaptureBar(ctx, x, y, width, progress, team) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, width, 5);
    ctx.fillStyle = team === 'player' ? '#44aaff' : '#ff4422';
    ctx.fillRect(x, y, Math.round(width * progress / 100), 5);
  }

  return {
    drawUnit,
    drawBuilding,
    drawTerrainDetail,
    drawAirShadow,
    drawHpBar,
    drawExplosion,
    drawCaptureBar,
  };

})();
