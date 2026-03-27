---
theme: dashboard
title: Elecciones La Paz 2026
toc: false
sidebar: false
---

<link rel="stylesheet" type="text/css" href="https://unpkg.com/maplibre-gl@4.0.2/dist/maplibre-gl.css">
<link rel="stylesheet" type="text/css" href="index.css">

```js
import maplibregl from "npm:maplibre-gl";
import {
  DATA_BASE, MAPA_FALLBACK, STORAGE_MAP_KEY,
  metricaInvalidos, metricaCandidato, getStorage,
} from "./components/definiciones.js";
import { cargarDatos, crearRecintos } from "./components/datos.js";
import {
  crearMapa, crearCapasBase, aplicarColorMapa,
  persistirMapa, leerMapaInicial,
} from "./components/mapa.js";
import {
  popupHTML,
  renderizarLeyendaPartidos,
  renderizarLeyendaGradiente,
} from "./components/ui.js";
```

```js
const storage = getStorage();
const { resultadosRaw, candidatos, timestamp } = await cargarDatos(DATA_BASE);
const nombresCandidatos = candidatos.map(c => c.nombre);

let modoActual      = "ganador";
let candidatoActual = nombresCandidatos[0];

function getMetrica(modo, nom) {
  if (modo === "invalido") return metricaInvalidos;
  if (modo === "candidato") {
    const pct = candidatos.find(c => c.nombre === nom)?.porcentaje_total ?? 0.3;
    return metricaCandidato(nom, pct);
  }
  return null;
}
```

<div class="app">

  <!-- Header -->
  <header class="header">
    <div class="header__brand">
      <div class="header__texts">
        <span class="header__eyebrow">Municipio de La Paz · Subnacionales 2026</span>
        <span class="header__title">Mapa Electoral por Recinto</span>
      </div>
    </div>
    <div class="header__stats">
      <div class="stat-chip green"><span class="num" id="stat-recintos">—</span><span class="lbl">recintos</span></div>
      <div class="stat-chip amber"><span class="num" id="stat-hab">—</span><span class="lbl">habilitados</span></div>
      <div class="stat-chip purple"><span class="num" id="stat-cands">—</span><span class="lbl">candidatos</span></div>
    </div>
    <div class="header__timestamp" id="ts"></div>
  </header>

  <!-- Layout mapa + panel -->
  <div class="layout">

    <!-- Botón abrir/cerrar panel -->
    <button class="panel-toggle-fab" id="panelFab" title="Mostrar/ocultar panel">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
    </button>

    <!-- Panel lateral -->
    <aside class="panel" id="panel">

      <div class="panel-section">
        <label class="filter-label">Visualizar</label>
        <div class="mode-toggles">
          <button class="mode-btn active" data-modo="ganador">
            <span class="mode-btn__dot"></span>Ganador por recinto
          </button>
          <button class="mode-btn" data-modo="candidato">
            <span class="mode-btn__dot"></span>Candidato específico
          </button>
          <button class="mode-btn" data-modo="invalido">
            <span class="mode-btn__dot"></span>Votos blancos / nulos
          </button>
        </div>
      </div>

      <div class="panel-section" id="sect-candidato">
        <label class="filter-label">Candidato</label>
        <select class="filter-select" id="sel-candidato"></select>
      </div>

      <div class="panel-section">
        <label class="filter-label" id="leyenda-titulo">Partido ganador por recinto</label>
        <div id="legend-panel-content"></div>
      </div>

      <div class="panel-section">
        <label class="filter-label">Estadísticas generales</label>
        <div class="stat-row"><span class="stat-lbl">Recintos totales</span><span class="stat-val accent" id="st-recintos">—</span></div>
        <div class="stat-row"><span class="stat-lbl">Total habilitados</span><span class="stat-val accent" id="st-hab">—</span></div>
        <div class="stat-row"><span class="stat-lbl">Mayor recinto</span><span class="stat-val" id="st-max">—</span></div>
        <div class="stat-row"><span class="stat-lbl">Menor recinto</span><span class="stat-val" id="st-min">—</span></div>
        <div class="stat-row"><span class="stat-lbl">Candidatos</span><span class="stat-val" id="st-cands">—</span></div>
      </div>

    </aside>

    <!-- Mapa -->
    <div class="map-area">
      <div id="mapa"></div>

      <!-- Leyenda flotante -->
      <div class="map-legend-fab">
        <div class="map-legend-panel" id="legendPanel">
          <div class="ml-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" stroke-width="2.2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            <span class="ml-header-title">Leyenda</span>
          </div>
          <div class="ml-block">
            <div class="ml-block-title" id="legend-float-title">Partido ganador</div>
            <div id="legend-container-float"></div>
          </div>
        </div>
        <button class="map-legend-btn" id="legendBtn" title="Mostrar/ocultar leyenda">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.5" fill="currentColor" stroke="none"/><rect x="2.5" y="10.5" width="2" height="3" rx=".5" fill="currentColor" stroke="none"/><path d="M2 17.5 l1.5 2 2.5-3" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>
        </button>
      </div>

      <div class="map-credit">
        Elaborado por: <strong>John Leonardo Cabrera Espíndola</strong> — Innovación Humana
      </div>
    </div>

  </div>
</div>

```js
// Poblar selector de candidatos
{
  const sel = document.querySelector("#sel-candidato");
  nombresCandidatos.forEach(n => {
    const o = document.createElement("option");
    o.value = o.textContent = n;
    sel.appendChild(o);
  });
  candidatoActual = sel.value;
  sel.addEventListener("change", () => {
    candidatoActual = sel.value;
    actualizar();
  });
}
```

```js
// Botones de modo
{
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      modoActual = btn.dataset.modo;
      const sect = document.querySelector("#sect-candidato");
      if (sect) sect.style.display = modoActual === "candidato" ? "" : "none";
      actualizar();
    });
  });
  // Ocultar selector candidato por defecto
  const sect = document.querySelector("#sect-candidato");
  if (sect) sect.style.display = "none";
}
```

```js
// Panel toggle
{
  const panel = document.querySelector("#panel");
  const fab   = document.querySelector("#panelFab");
  fab?.addEventListener("click", () => {
    panel.classList.toggle("collapsed");
    fab.classList.toggle("collapsed");
  });
}
```

```js
// Leyenda flotante toggle
{
  const btn   = document.querySelector("#legendBtn");
  const panel = document.querySelector("#legendPanel");
  btn?.addEventListener("click", () => {
    panel.classList.toggle("open");
    btn.classList.toggle("active");
  });
}
```

```js
// Timestamp y estadísticas
{
  const el = document.querySelector("#ts");
  if (el && timestamp) el.textContent = `${timestamp.fecha} · ${timestamp.hora}`;

  const total   = Object.keys(resultadosRaw).length;
  const habs    = Object.values(resultadosRaw).reduce((s, v) => s + (v.habilitados || 0), 0);
  const maxH    = Math.max(...Object.values(resultadosRaw).map(v => v.habilitados || 0));
  const minH    = Math.min(...Object.values(resultadosRaw).filter(v => v.habilitados > 0).map(v => v.habilitados));
  const fmt     = d3.format(",");

  document.querySelector("#stat-recintos").textContent = fmt(total);
  document.querySelector("#stat-hab").textContent      = d3.format(".2s")(habs);
  document.querySelector("#stat-cands").textContent    = candidatos.length;
  document.querySelector("#st-recintos").textContent   = fmt(total);
  document.querySelector("#st-hab").textContent        = fmt(habs);
  document.querySelector("#st-max").textContent        = fmt(maxH);
  document.querySelector("#st-min").textContent        = fmt(minH);
  document.querySelector("#st-cands").textContent      = candidatos.length;
}
```

```js
import * as d3 from "npm:d3";
const mapaInicial = leerMapaInicial(storage, STORAGE_MAP_KEY, MAPA_FALLBACK);
const map = crearMapa("#mapa", mapaInicial);
const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, maxWidth: "none" });
persistirMapa(map, storage, STORAGE_MAP_KEY);
invalidation.then(() => { popup.remove(); map.remove(); });

function actualizarLeyenda(modo, candidatoNom) {
  const titulo1 = document.querySelector("#leyenda-titulo");
  const titulo2 = document.querySelector("#legend-float-title");
  if (modo === "ganador") {
    if (titulo1) titulo1.textContent = "Partido ganador por recinto";
    if (titulo2) titulo2.textContent = "Partido ganador";
    renderizarLeyendaPartidos(candidatos, "legend-panel-content");
    renderizarLeyendaPartidos(candidatos, "legend-container-float");
  } else {
    const m = getMetrica(modo, candidatoNom);
    const txt = modo === "invalido" ? "Votos blancos / nulos" : `% votos — ${candidatoNom}`;
    if (titulo1) titulo1.textContent = txt;
    if (titulo2) titulo2.textContent = txt;
    renderizarLeyendaGradiente(m, "legend-panel-content");
    renderizarLeyendaGradiente(m, "legend-container-float");
  }
}

function actualizar() {
  const metrica = getMetrica(modoActual, candidatoActual);
  const recintos = crearRecintos(resultadosRaw, modoActual, candidatoActual);
  map.getSource("recintos")?.setData(recintos);
  aplicarColorMapa(map, modoActual, metrica);
  actualizarLeyenda(modoActual, candidatoActual);
}

const ready = new Promise(resolve => {
  map.on("load", () => {
    const metrica  = getMetrica(modoActual, candidatoActual);
    const recintos = crearRecintos(resultadosRaw, modoActual, candidatoActual);
    crearCapasBase(map, recintos, modoActual, metrica);
    actualizarLeyenda(modoActual, candidatoActual);
    resolve();
  });
});
```

```js
// Hover / click
{
  await ready;
  let locked = false;

  const mouseenter = e => {
    map.getCanvas().style.cursor = "pointer";
    const f = e.features?.[0];
    if (!f) return;
    popup.setLngLat(f.geometry.coordinates)
         .setHTML(popupHTML(f, candidatoActual))
         .addTo(map);
  };
  const mouseleave = () => {
    map.getCanvas().style.cursor = "";
    if (!locked) popup.remove();
  };
  const clickIn  = ()  => { locked = true; };
  const clickAny = e => {
    if (!map.queryRenderedFeatures(e.point, { layers: ["recintos_hover"] }).length) {
      locked = false; popup.remove();
    }
  };

  map.on("mouseenter", "recintos_hover", mouseenter);
  map.on("mouseleave", "recintos_hover", mouseleave);
  map.on("click",      "recintos_hover", clickIn);
  map.on("click",      clickAny);
  invalidation.then(() => {
    map.off("mouseenter", "recintos_hover", mouseenter);
    map.off("mouseleave", "recintos_hover", mouseleave);
    map.off("click",      "recintos_hover", clickIn);
    map.off("click",      clickAny);
  });
}
```
