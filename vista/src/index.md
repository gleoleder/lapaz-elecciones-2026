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
  metricaInvalidos, metricaCandidato, colorPartido, getStorage,
} from "./components/definiciones.js";
import { cargarDatos, crearRecintos } from "./components/datos.js";
import {
  crearMapa, crearCapasBase, aplicarColorMapa,
  persistirMapa, leerMapaInicial,
} from "./components/mapa.js";
import {
  popupHTML, renderizarLeyendaPartidos, renderizarLeyendaGradiente,
} from "./components/ui.js";

const storage = getStorage();
const { resultadosRaw, candidatos, timestamp } = await cargarDatos(DATA_BASE);
const nombres = candidatos.map(c => c.nombre);
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
      <div class="stat-chip green"><span class="num" id="s-rec">—</span><span class="lbl">recintos</span></div>
      <div class="stat-chip amber"><span class="num" id="s-hab">—</span><span class="lbl">habilitados</span></div>
      <div class="stat-chip purple"><span class="num" id="s-can">—</span><span class="lbl">candidatos</span></div>
    </div>
    <div class="header__timestamp" id="s-ts"></div>
  </header>

  <div class="layout">
    <button class="panel-toggle-fab" id="panelFab">
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
      <div class="panel-section" id="sect-cand" style="display:none">
        <label class="filter-label">Candidato</label>
        <select class="filter-select" id="sel-cand"></select>
      </div>
      <div class="panel-section">
        <label class="filter-label" id="leg-titulo">Partido ganador por recinto</label>
        <div id="leg-panel"></div>
      </div>
      <div class="panel-section">
        <label class="filter-label">Estadísticas</label>
        <div class="stat-row"><span class="stat-lbl">Recintos</span><span class="stat-val accent" id="p-rec">—</span></div>
        <div class="stat-row"><span class="stat-lbl">Total habilitados</span><span class="stat-val accent" id="p-hab">—</span></div>
        <div class="stat-row"><span class="stat-lbl">Mayor recinto</span><span class="stat-val" id="p-max">—</span></div>
        <div class="stat-row"><span class="stat-lbl">Menor recinto</span><span class="stat-val" id="p-min">—</span></div>
        <div class="stat-row"><span class="stat-lbl">Candidatos</span><span class="stat-val" id="p-can">—</span></div>
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
            <div class="ml-block-title" id="leg-float-titulo">Partido ganador</div>
            <div id="leg-float"></div>
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
  // Estadísticas
  const fmt  = d3.format(",");
  const vals = Object.values(resultadosRaw);
  const totalHab = vals.reduce((s,v) => s + (v.habilitados||0), 0);
  const maxHab   = Math.max(...vals.map(v => v.habilitados||0));
  const minHab   = Math.min(...vals.filter(v=>v.habilitados>0).map(v=>v.habilitados));

  document.querySelector("#s-rec").textContent = fmt(vals.length);
  document.querySelector("#s-hab").textContent = d3.format(".3s")(totalHab);
  document.querySelector("#s-can").textContent = candidatos.length;
  document.querySelector("#s-ts").textContent  = timestamp ? `${timestamp.fecha} · ${timestamp.hora}` : "";
  document.querySelector("#p-rec").textContent = fmt(vals.length);
  document.querySelector("#p-hab").textContent = fmt(totalHab);
  document.querySelector("#p-max").textContent = fmt(maxHab);
  document.querySelector("#p-min").textContent = fmt(minHab);
  document.querySelector("#p-can").textContent = candidatos.length;

  // Poblar select candidatos
  const sel = document.querySelector("#sel-cand");
  nombres.forEach(n => {
    const o = document.createElement("option");
    o.value = o.textContent = n;
    sel.appendChild(o);
  });

  // Estado
  let modo  = "ganador";
  let cand  = nombres[0] ?? "";

  function getMetrica() {
    if (modo === "invalido") return metricaInvalidos;
    if (modo === "candidato") {
      const pct = candidatos.find(c=>c.nombre===cand)?.porcentaje_total ?? 0.3;
      return metricaCandidato(cand, pct);
    }
    return null;
  }

  function actualizarLeyenda() {
    const t1 = document.querySelector("#leg-titulo");
    const t2 = document.querySelector("#leg-float-titulo");
    if (modo === "ganador") {
      const txt = "Partido ganador por recinto";
      if (t1) t1.textContent = txt;
      if (t2) t2.textContent = "Partido ganador";
      renderizarLeyendaPartidos(candidatos, "leg-panel");
      renderizarLeyendaPartidos(candidatos, "leg-float");
    } else {
      const m   = getMetrica();
      const txt = modo === "invalido" ? "Votos blancos / nulos" : `% votos · ${cand}`;
      if (t1) t1.textContent = txt;
      if (t2) t2.textContent = txt;
      renderizarLeyendaGradiente(m, "leg-panel");
      renderizarLeyendaGradiente(m, "leg-float");
    }
  }

  // Panel toggle
  const panel = document.querySelector("#panel");
  const fab   = document.querySelector("#panelFab");
  fab?.addEventListener("click", () => {
    panel.classList.toggle("collapsed");
    fab.classList.toggle("collapsed");
  });

  // Leyenda toggle
  document.querySelector("#legendBtn")?.addEventListener("click", () => {
    document.querySelector("#legendPanel").classList.toggle("open");
    document.querySelector("#legendBtn").classList.toggle("active");
  });

  // Mapa
  const mapaInicial = leerMapaInicial(storage, STORAGE_MAP_KEY, MAPA_FALLBACK);
  const map  = crearMapa("#mapa", mapaInicial);
  const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, maxWidth: "none" });
  persistirMapa(map, storage, STORAGE_MAP_KEY);

  function actualizar() {
    const recintos = crearRecintos(resultadosRaw, modo, cand);
    map.getSource("recintos")?.setData(recintos);
    aplicarColorMapa(map, modo, getMetrica());
    actualizarLeyenda();
  }

  map.on("load", () => {
    crearCapasBase(map, crearRecintos(resultadosRaw, modo, cand), modo, getMetrica());
    actualizarLeyenda();
  });

  // Botones modo
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      modo = btn.dataset.modo;
      const s = document.querySelector("#sect-cand");
      if (s) s.style.display = modo === "candidato" ? "" : "none";
      actualizar();
    });
  });

  // Selector candidato
  sel?.addEventListener("change", e => { cand = e.target.value; actualizar(); });

  // Popup
  let locked = false;
  map.on("mouseenter", "recintos_hover", e => {
    map.getCanvas().style.cursor = "pointer";
    const f = e.features?.[0];
    if (f) popup.setLngLat(f.geometry.coordinates).setHTML(popupHTML(f, cand)).addTo(map);
  });
  map.on("mouseleave", "recintos_hover", () => {
    map.getCanvas().style.cursor = "";
    if (!locked) popup.remove();
  });
  map.on("click", "recintos_hover", () => { locked = true; });
  map.on("click", e => {
    if (!map.queryRenderedFeatures(e.point, {layers:["recintos_hover"]}).length) {
      locked = false; popup.remove();
    }
  });

  invalidation.then(() => { popup.remove(); map.remove(); });
}
```
