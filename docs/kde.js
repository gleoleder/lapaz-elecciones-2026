// ═══════════════════════════════════════════════════════════════════════════
//  kde.js  ·  Kernel Density Estimation — Kernel Cuártico Biweight
//  K(d) = (3/π)(1−d²)²  para d = dist/radio ∈ [0,1]
//  Peso por recinto = porcentaje_partido × habilitados
//  Canvas overlay sobre MapLibre GL
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

// ── Paletas RGBA [R,G,B,A] ───────────────────────────────────────────────
const KDE_PALETTES = {
  'Fuego':   [[0,0,0,0],[30,0,10,70],[90,0,50,160],[180,20,80,210],[230,80,20,235],[255,160,0,255],[255,235,59,255],[255,255,255,255]],
  'Plasma':  [[0,0,0,0],[13,8,135,70],[84,2,163,160],[139,10,165,210],[185,50,137,235],[219,92,104,255],[244,136,73,255],[252,253,191,255]],
  'Viridis': [[0,0,0,0],[68,1,84,70],[72,40,120,160],[49,104,142,210],[38,130,142,235],[31,158,137,255],[105,190,40,255],[253,231,37,255]],
  'Inferno': [[0,0,0,0],[0,0,4,70],[40,11,84,160],[101,21,110,210],[159,42,99,235],[212,72,66,255],[245,125,21,255],[252,255,164,255]],
  'Magma':   [[0,0,0,0],[0,0,4,70],[28,16,68,140],[79,18,123,200],[136,34,106,230],[185,55,84,245],[229,80,100,255],[252,253,191,255]],
  'Cool':    [[0,0,0,0],[0,200,255,70],[0,160,255,150],[50,100,255,210],[130,50,255,235],[220,0,255,255],[255,100,255,255]],
  'Neon':    [[0,0,0,0],[30,0,60,70],[80,0,180,150],[20,100,255,200],[0,220,200,230],[100,255,100,245],[255,230,0,255]],
  'Ocean':   [[0,0,0,0],[0,10,40,70],[0,30,80,140],[0,70,130,200],[0,120,180,230],[20,170,200,245],[100,210,220,255],[220,250,255,255]],
  'RdYlGn':  [[0,0,0,0],[165,0,38,70],[215,48,39,150],[244,109,67,200],[253,174,97,230],[166,217,106,245],[26,152,80,255]],
};

const KDE_PALETTE_NAMES = Object.keys(KDE_PALETTES);

function kpColor(t, paleta) {
  const stops = KDE_PALETTES[paleta] || KDE_PALETTES['Fuego'];
  const n  = stops.length - 1;
  const idx = Math.min(t * n, n);
  const lo  = Math.floor(idx), hi = Math.min(lo + 1, n);
  const f   = idx - lo;
  const a   = stops[lo], b = stops[hi];
  return [
    Math.round(a[0] + (b[0]-a[0])*f),
    Math.round(a[1] + (b[1]-a[1])*f),
    Math.round(a[2] + (b[2]-a[2])*f),
    Math.round(a[3] + (b[3]-a[3])*f),
  ];
}

// ── Estado ────────────────────────────────────────────────────────────────
let _map      = null;
let _canvas   = null;
let _ctx      = null;
let _activo   = false;
let _radio    = 900;      // metros
let _opacidad = 0.82;
let _paleta   = 'Fuego';
let _puntos   = [];       // [{lng, lat, w}]
let _raf      = null;

// ── API pública ───────────────────────────────────────────────────────────

function kdeInit(mapInstance) {
  _map = mapInstance;

  // El canvas va directamente dentro del contenedor del mapa (position:relative)
  const container = mapInstance.getContainer();

  _canvas = document.createElement('canvas');
  Object.assign(_canvas.style, {
    position:      'absolute',
    top:           '0',
    left:          '0',
    pointerEvents: 'none',
    zIndex:        '4',
    display:       'none',
  });
  container.appendChild(_canvas);
  _ctx = _canvas.getContext('2d');

  mapInstance.on('move',   _schedDraw);
  mapInstance.on('zoom',   _schedDraw);
  mapInstance.on('resize', _schedDraw);
}

/**
 * Carga puntos para el partido dado.
 * resultados: {codigo: {x, y, habilitados, candidatos:{partido:pct}, invalido, ganador}}
 * partido: nombre del candidato/partido (string)
 * modoKde: 'partido' | 'invalido' | 'ganador'
 */
function kdeSetDatos(resultados, partido, modoKde) {
  _puntos = [];
  let maxW = 0;
  const tmp = [];

  Object.values(resultados).forEach(v => {
    const lng = +v.x, lat = +v.y;
    if (!isFinite(lng) || !isFinite(lat)) return;
    const hab = v.habilitados || 0;
    if (hab <= 0) return;

    let pct = 0;
    if (modoKde === 'invalido') {
      pct = v.invalido ?? 0;
    } else if (modoKde === 'ganador') {
      pct = v.ganador ?? 0;
    } else {
      pct = v.candidatos?.[partido] ?? 0;
    }

    const w = pct * hab;
    if (w > 0) { tmp.push({ lng, lat, w }); if (w > maxW) maxW = w; }
  });

  // Normalizar pesos
  if (maxW > 0) _puntos = tmp.map(p => ({ lng: p.lng, lat: p.lat, w: p.w / maxW }));
  if (_activo) _schedDraw();
}

function kdeSetRadio(metros)  { _radio    = metros;   if (_activo) _schedDraw(); }
function kdeSetOpacidad(v)    { _opacidad = v;        if (_activo) _schedDraw(); }
function kdeSetPaleta(nombre) { _paleta   = nombre;   if (_activo) _schedDraw(); }

function kdeToggle(on) {
  _activo = !!on;
  if (_canvas) _canvas.style.display = _activo ? 'block' : 'none';
  if (_activo) _schedDraw();
  else if (_ctx && _canvas) _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
}

// ── Internos ──────────────────────────────────────────────────────────────

function _schedDraw() {
  if (_raf) cancelAnimationFrame(_raf);
  _raf = requestAnimationFrame(_draw);
}

function _draw() {
  if (!_map || !_canvas || !_ctx || !_activo) return;

  // Usar las dimensiones reales del contenedor del mapa
  const container = _map.getContainer();
  const W = container.clientWidth  || container.offsetWidth;
  const H = container.clientHeight || container.offsetHeight;
  if (!W || !H) return;

  // Ajustar tamaño del canvas al contenedor
  _canvas.width  = W;
  _canvas.height = H;

  if (!_puntos.length) { _ctx.clearRect(0, 0, W, H); return; }

  // Metros → píxeles (latitud La Paz ≈ −16.5°)
  const zoom    = _map.getZoom();
  const mPx     = 156543.03 * Math.cos(-16.5 * Math.PI / 180) / Math.pow(2, zoom);
  const radioPx = Math.max(_radio / mPx, 8);

  // Proyectar puntos a coordenadas de pantalla
  const R  = radioPx;
  const pts = [];
  for (const p of _puntos) {
    const px = _map.project([p.lng, p.lat]);
    // Solo puntos que afectan el área visible
    if (px.x < -R || px.x > W + R || px.y < -R || px.y > H + R) continue;
    pts.push({ x: px.x, y: px.y, w: p.w });
  }

  if (!pts.length) { _ctx.clearRect(0, 0, W, H); return; }

  // ── Grid KDE a resolución reducida (factor 2) ──────────────────────────
  const factor = 2;
  const gw     = Math.ceil(W / factor);
  const gh     = Math.ceil(H / factor);
  const grid   = new Float32Array(gw * gh);
  const rG     = R / factor;
  const rG2    = rG * rG;
  const K      = 3 / Math.PI;  // constante kernel cuártico

  for (const p of pts) {
    const gx = p.x / factor;
    const gy = p.y / factor;
    const x0 = Math.max(0,  Math.floor(gx - rG));
    const x1 = Math.min(gw, Math.ceil (gx + rG));
    const y0 = Math.max(0,  Math.floor(gy - rG));
    const y1 = Math.min(gh, Math.ceil (gy + rG));

    for (let iy = y0; iy < y1; iy++) {
      const dy2 = (iy - gy) * (iy - gy);
      for (let ix = x0; ix < x1; ix++) {
        const d2 = ((ix - gx) * (ix - gx) + dy2) / rG2;
        if (d2 >= 1) continue;
        grid[iy * gw + ix] += K * (1 - d2) * (1 - d2) * p.w;
      }
    }
  }

  // Normalizar
  let maxVal = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] > maxVal) maxVal = grid[i];
  if (maxVal === 0) { _ctx.clearRect(0, 0, W, H); return; }

  // Pintar en canvas auxiliar a resolución reducida
  const off    = document.createElement('canvas');
  off.width    = gw;
  off.height   = gh;
  const offCtx = off.getContext('2d');
  const img    = offCtx.createImageData(gw, gh);
  const d      = img.data;

  for (let i = 0; i < grid.length; i++) {
    const t = grid[i] / maxVal;
    if (t < 0.005) { d[i*4+3] = 0; continue; }
    const [R2, G, B, A] = kpColor(t, _paleta);
    d[i*4]   = R2;
    d[i*4+1] = G;
    d[i*4+2] = B;
    d[i*4+3] = Math.round(A * _opacidad);
  }

  offCtx.putImageData(img, 0, 0);

  // Escalar al canvas principal con interpolación suave
  _ctx.clearRect(0, 0, W, H);
  _ctx.imageSmoothingEnabled = true;
  _ctx.imageSmoothingQuality = 'high';
  _ctx.drawImage(off, 0, 0, W, H);
}
