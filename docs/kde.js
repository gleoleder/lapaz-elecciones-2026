// ═══════════════════════════════════════════════════════════════════════════
//  kde.js  ·  Kernel Density Estimation — Kernel Cuártico (Biweight)
//  Electoral La Paz 2026 · Canvas overlay sobre MapLibre GL
//
//  K(d) = (3/π) × (1 − d²)²   d = dist/radio ∈ [0,1]
//  Peso por recinto = porcentaje_partido × habilitados
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

// ── Paletas RGBA stops [R,G,B,A] ─────────────────────────────────────────
const KDE_PALETTES = {
  'Fuego':   [[0,0,0,0],[30,0,10,80],[80,0,50,180],[180,20,80,220],[230,80,20,240],[255,160,0,255],[255,235,59,255],[255,255,255,255]],
  'Plasma':  [[0,0,0,0],[13,8,135,80],[84,2,163,180],[139,10,165,220],[185,50,137,240],[219,92,104,255],[244,136,73,255],[252,253,191,255]],
  'Viridis': [[0,0,0,0],[68,1,84,80],[72,40,120,180],[62,83,160,220],[49,104,142,240],[38,130,142,255],[31,158,137,255],[105,190,40,255],[253,231,37,255]],
  'Inferno': [[0,0,0,0],[0,0,4,80],[40,11,84,180],[101,21,110,220],[159,42,99,240],[212,72,66,255],[245,125,21,255],[252,255,164,255]],
  'Magma':   [[0,0,0,0],[0,0,4,80],[28,16,68,160],[79,18,123,200],[136,34,106,230],[185,55,84,245],[229,80,100,255],[252,253,191,255]],
  'Cool':    [[0,0,0,0],[0,255,255,80],[0,200,255,160],[50,150,255,200],[100,100,255,230],[180,50,255,245],[255,0,255,255]],
  'Neon':    [[0,0,0,0],[30,0,60,80],[80,0,180,160],[20,100,255,200],[0,220,200,230],[100,255,100,245],[255,230,0,255]],
  'Ocean':   [[0,0,0,0],[0,10,40,80],[0,30,80,150],[0,70,130,200],[0,120,180,230],[20,170,200,245],[100,210,220,255],[220,250,255,255]],
  'RdYlGn':  [[0,0,0,0],[165,0,38,80],[215,48,39,160],[244,109,67,200],[253,174,97,230],[255,255,191,245],[166,217,106,255],[26,152,80,255]],
};

function kpColor(t, paleta) {
  const stops = KDE_PALETTES[paleta] || KDE_PALETTES['Fuego'];
  const n = stops.length - 1;
  const idx = Math.min(t * n, n);
  const lo = Math.floor(idx), hi = Math.min(lo + 1, n);
  const f = idx - lo;
  const a = stops[lo], b = stops[hi];
  return [
    Math.round(a[0] + (b[0]-a[0])*f),
    Math.round(a[1] + (b[1]-a[1])*f),
    Math.round(a[2] + (b[2]-a[2])*f),
    Math.round(a[3] + (b[3]-a[3])*f),
  ];
}

// ── Estado interno ────────────────────────────────────────────────────────
let _map       = null;
let _canvas    = null;
let _ctx       = null;
let _activo    = false;
let _radio     = 900;       // metros
let _opacidad  = 0.82;
let _paleta    = 'Fuego';
let _puntos    = [];        // [{lng, lat, w}]
let _timer     = null;

// ── API pública ───────────────────────────────────────────────────────────

function kdeInit(mapInstance) {
  _map = mapInstance;

  _canvas = document.createElement('canvas');
  _canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:5;';
  _canvas.style.display = 'none';
  _ctx = _canvas.getContext('2d');

  // Insertar canvas dentro del contenedor del mapa
  const container = mapInstance.getCanvasContainer();
  container.appendChild(_canvas);

  // Re-dibujar cuando el mapa se mueve/zoom
  mapInstance.on('move',    _debounceDraw);
  mapInstance.on('zoom',    _debounceDraw);
  mapInstance.on('resize',  _debounceDraw);
}

/**
 * Actualiza los puntos KDE según modo y candidato actuales.
 * resultados: objeto {codigo: {x, y, habilitados, candidatos:{partido:pct}, invalido}}
 * modo: 'ganador' | 'candidato' | 'invalido'
 * candidato: string nombre del partido/candidato (para modo 'candidato')
 */
function kdeSetDatos(resultados, modo, candidato) {
  _puntos = [];
  Object.values(resultados).forEach(v => {
    const lng = +v.x, lat = +v.y;
    if (!isFinite(lng) || !isFinite(lat)) return;
    const hab = v.habilitados || 0;
    if (hab <= 0) return;

    let pct = 0;
    if (modo === 'candidato' && candidato) {
      pct = v.candidatos?.[candidato] ?? 0;
    } else if (modo === 'invalido') {
      pct = v.invalido ?? 0;
    } else {
      // ganador: peso = porcentaje del ganador × habilitados
      pct = v.ganador ?? 0;
    }

    const w = pct * hab;
    if (w > 0) _puntos.push({ lng, lat, w });
  });

  if (_activo) _draw();
}

function kdeSetRadio(metros)   { _radio    = metros;   if (_activo) _draw(); }
function kdeSetOpacidad(v)     { _opacidad = v;        if (_activo) _draw(); }
function kdeSetPaleta(nombre)  { _paleta   = nombre;   if (_activo) _draw(); }

function kdeToggle(on) {
  _activo = on;
  if (_canvas) _canvas.style.display = on ? 'block' : 'none';
  if (on) _draw();
}

// ── Internos ──────────────────────────────────────────────────────────────

function _debounceDraw() {
  if (!_activo) return;
  if (_timer) cancelAnimationFrame(_timer);
  _timer = requestAnimationFrame(_draw);
}

function _draw() {
  if (!_map || !_canvas || !_ctx) return;

  const container = _map.getCanvasContainer();
  const W = container.offsetWidth;
  const H = container.offsetHeight;

  _canvas.width  = W;
  _canvas.height = H;

  if (!_puntos.length) { _ctx.clearRect(0, 0, W, H); return; }

  // Metros → píxeles (corrección por latitud de La Paz ~-16.5°)
  const zoom  = _map.getZoom();
  const mPx   = 156543.03 * Math.cos(-16.5 * Math.PI / 180) / Math.pow(2, zoom);
  const radioPx = Math.max(_radio / mPx, 6);

  // Proyectar puntos a coordenadas de pantalla
  const pts = _puntos.map(p => {
    const px = _map.project([p.lng, p.lat]);
    return { x: px.x, y: px.y, w: p.w };
  }).filter(p => p.x > -radioPx && p.x < W + radioPx &&
                 p.y > -radioPx && p.y < H + radioPx);

  if (!pts.length) { _ctx.clearRect(0, 0, W, H); return; }

  // Peso máximo para normalizar
  const maxW = Math.max(...pts.map(p => p.w));
  const ptsN = pts.map(p => ({ ...p, w: p.w / maxW }));

  // ── Grid KDE (factor 2 para rendimiento) ──────────────────────────────
  const factor = 2;
  const gw = Math.ceil(W / factor);
  const gh = Math.ceil(H / factor);
  const grid = new Float32Array(gw * gh);
  const rG   = radioPx / factor;
  const rG2  = rG * rG;
  const K    = 3 / Math.PI; // constante kernel cuártico

  for (const p of ptsN) {
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
        // K(d) = (3/π)(1−d²)²
        grid[iy * gw + ix] += K * (1 - d2) * (1 - d2) * p.w;
      }
    }
  }

  // Normalizar grid
  let maxVal = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] > maxVal) maxVal = grid[i];
  if (maxVal === 0) { _ctx.clearRect(0, 0, W, H); return; }

  // Construir ImageData en resolución reducida
  const off = document.createElement('canvas');
  off.width  = gw;
  off.height = gh;
  const offCtx = off.getContext('2d');
  const img  = offCtx.createImageData(gw, gh);
  const d    = img.data;

  for (let i = 0; i < grid.length; i++) {
    const t = grid[i] / maxVal;
    if (t < 0.004) { d[i*4+3] = 0; continue; }
    const [R, G, B, A] = kpColor(t, _paleta);
    d[i*4]   = R;
    d[i*4+1] = G;
    d[i*4+2] = B;
    d[i*4+3] = Math.round(A * _opacidad);
  }

  offCtx.putImageData(img, 0, 0);

  // Escalar al canvas real con interpolación suave
  _ctx.clearRect(0, 0, W, H);
  _ctx.imageSmoothingEnabled = true;
  _ctx.imageSmoothingQuality = 'high';
  _ctx.drawImage(off, 0, 0, W, H);
}
