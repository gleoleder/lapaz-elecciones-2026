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
import * as d3 from "npm:d3";
import {
  DATA_BASE, MAPA_FALLBACK, STORAGE_MAP_KEY,
  metricaInvalidos, metricaCandidato,
  colorPartido, getStorage,
} from "./components/definiciones.js";
import { cargarDatos, crearRecintos } from "./components/datos.js";
import {
  crearMapa, crearCapasBase, aplicarColorMapa,
  persistirMapa, leerMapaInicial,
} from "./components/mapa.js";
import {
  popupHTML, renderizarLeyendaPartidos, renderizarLeyendaGradiente,
} from "./components/ui.js";
```

```js
const storage  = getStorage();
const { resultadosRaw, candidatos, timestamp } = await cargarDatos(DATA_BASE);
const nombres  = candidatos.map(c => c.nombre);
const totalHab = Object.values(resultadosRaw).reduce((s,v) => s + (v.habilitados||0), 0);
const maxHab   = Math.max(...Object.values(resultadosRaw).map(v => v.habilitados||0));
const minHab   = Math.min(...Object.values(resultadosRaw).filter(v=>v.habilitados>0).map(v=>v.habilitados));
```

<div class="app">
  <header class="header">
    <div class="header__brand">
      <div class="header__texts">
        <span class="header__eyebrow">Municipio de La Paz · Subnacionales 2026</span>
        <span class="header__title">Mapa Electoral por Recinto</span>
      </div>
    </div>
    <div class="header__stats">
      <div class="stat-chip green"><span class="num">${Object.keys(resultadosRaw).length}</span><span class="lbl">recintos</span></div>
      <div class="stat-chip amber"><span class="num">${d3.format(".3s")(totalHab)}</span><span class="lbl">habilitados</span></div>
      <div class="stat-chip purple"><span class="num">${candidatos.length}</span><span class="lbl">candidatos</span></div>
    </div>
    <div class="header__timestamp">${timestamp ? `${timestamp.fecha} · ${timestamp.hora}` : ""}</div>
  </header>

  <div class="layout">
    <button class="panel-toggle-fab" id="panelFab" title="Panel">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
    </button>

    <aside class="panel" id="panel">
      <div class="panel-section">
        <label class="filter-label">Visualizar</label>
        <div class="mode-toggles">
          <button class="mode-btn active" data-modo="ganador"><span class="mode-btn__dot"></span>Ganador por recinto</button>
          <button class="mode-btn" data-modo="candidato"><span class="mode-btn__dot"></span>Candidato específico</button>
          <button class="mode-btn" data-modo="invalido"><span class="mode-btn__dot"></span>Votos blancos / nulos</button>
        </div>
      </div>
      <div class="panel-section" id="sect-candidato" style="display:none">
        <label class="filter-label">Candidato</label>
        <select class="filter-select" id="sel-candidato">
          ${nombres.map(n => `<option value="${n}">${n}</option>`).join("")}
        </select>
      </div>
      <div class="panel-section">
        <label class="filter-label" id="leyenda-titulo">Partido ganador por recinto</label>
        <div id="legend-panel-content"></div>
      </div>
      <div class="panel-section">
        <label class="filter-label">Estadísticas</label>
        <div class="stat-row"><span class="stat-lbl">Recintos totales</span><span class="stat-val accent">${d3.format(",")(Object.keys(resultadosRaw).length)}</span></div>
        <div class="stat-row"><span class="stat-lbl">Total habilitados</span><span class="stat-val accent">${d3.format(",")(totalHab)}</span></div>
        <div class="stat-row"><span class="stat-lbl">Mayor recinto</span><span class="stat-val">${d3.format(",")(maxHab)}</span></div>
        <div class="stat-row"><span class="stat-lbl">Menor recinto</span><span class="stat-val">${d3.format(",")(minHab)}</span></div>
        <div class="stat-row"><span class="stat-lbl">Candidatos</span><span class="stat-val">${candidatos.length}</span></div>
      </div>
    </aside>

    <div class="map-area">
      <div id="mapa"></div>
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
        <button class="map-legend-btn" id="legendBtn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.5" fill="currentColor" stroke="none"/></svg>
        </button>
      </div>
      <div class="map-credit">Elaborado por: <strong>John Leonardo Cabrera Espíndola</strong> — Innovación Humana</div>
    </div>
  </div>
</div>

```js
{
  // ── Estado ──────────────────────────────────────────────────────────────
  let modoActual      = "ganador";
  let candidatoActual = nombres[0] ?? "";

  function getMetrica(modo, nom) {
    if (modo === "invalido") return metricaInvalidos;
    if (modo === "candidato") {
      const pct = candidatos.find(c => c.nombre === nom)?.porcentaje_total ?? 0.3;
      return metricaCandidato(nom, pct);
    }
    return null;
  }

  function actualizarLeyenda(modo, nom) {
    const t1 = document.querySelector("#leyenda-titulo");
    const t2 = document.querySelector("#legend-float-title");
    if (modo === "ganador") {
      if (t1) t1.textContent = "Partido ganador por recinto";
      if (t2) t2.textContent = "Partido ganador";
      renderizarLeyendaPartidos(candidatos, "legend-panel-content");
      renderizarLeyendaPartidos(candidatos, "legend-container-float");
    } else {
      const m   = getMetrica(modo, nom);
      const txt = modo === "invalido" ? "Votos blancos / nulos" : `% votos — ${nom}`;
      if (t1) t1.textContent = txt;
      if (t2) t2.textContent = txt;
      renderizarLeyendaGradiente(m, "legend-panel-content");
      renderizarLeyendaGradiente(m, "legend-container-float");
    }
  }

  // ── Panel toggle ─────────────────────────────────────────────────────────
  const panelEl = document.querySelector("#panel");
  const fabEl   = document.querySelector("#panelFab");
  fabEl?.addEventListener("click", () => {
    panelEl.classList.toggle("collapsed");
    fabEl.classList.toggle("collapsed");
  });

  // ── Leyenda toggle ───────────────────────────────────────────────────────
  document.querySelector("#legendBtn")?.addEventListener("click", () => {
    document.querySelector("#legendPanel").classList.toggle("open");
    document.querySelector("#legendBtn").classList.toggle("active");
  });

  // ── Mapa ─────────────────────────────────────────────────────────────────
  const mapaInicial = leerMapaInicial(storage, STORAGE_MAP_KEY, MAPA_FALLBACK);
  const map  = crearMapa("#mapa", mapaInicial);
  const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, maxWidth: "none" });
  persistirMapa(map, storage, STORAGE_MAP_KEY);

  function actualizar() {
    const metrica  = getMetrica(modoActual, candidatoActual);
    const recintos = crearRecintos(resultadosRaw, modoActual, candidatoActual);
    map.getSource("recintos")?.setData(recintos);
    aplicarColorMapa(map, modoActual, metrica);
    actualizarLeyenda(modoActual, candidatoActual);
  }

  map.on("load", () => {
    const metrica  = getMetrica(modoActual, candidatoActual);
    const recintos = crearRecintos(resultadosRaw, modoActual, candidatoActual);
    crearCapasBase(map, recintos, modoActual, metrica);
    actualizarLeyenda(modoActual, candidatoActual);
  });

  // ── Botones de modo ──────────────────────────────────────────────────────
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

  // ── Selector candidato ───────────────────────────────────────────────────
  document.querySelector("#sel-candidato")?.addEventListener("change", e => {
    candidatoActual = e.target.value;
    actualizar();
  });

  // ── Hover / click popup ──────────────────────────────────────────────────
  let locked = false;
  map.on("mouseenter", "recintos_hover", e => {
    map.getCanvas().style.cursor = "pointer";
    const f = e.features?.[0];
    if (!f) return;
    popup.setLngLat(f.geometry.coordinates)
         .setHTML(popupHTML(f, candidatoActual))
         .addTo(map);
  });
  map.on("mouseleave", "recintos_hover", () => {
    map.getCanvas().style.cursor = "";
    if (!locked) popup.remove();
  });
  map.on("click", "recintos_hover", () => { locked = true; });
  map.on("click", e => {
    if (!map.queryRenderedFeatures(e.point, { layers: ["recintos_hover"] }).length) {
      locked = false;
      popup.remove();
    }
  });

  invalidation.then(() => { popup.remove(); map.remove(); });
}
```
