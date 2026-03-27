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
  DATA_BASE,
  MAPA_FALLBACK,
  STORAGE_KEY,
  STORAGE_MAP_KEY,
  metricaGanador,
  metricaInvalidos,
  getStorage,
} from "./components/definiciones.js";
import { cargarDatos, crearRecintos } from "./components/datos.js";
import {
  crearMapa,
  crearCapasBase,
  aplicarMetricaMapa,
  persistirMapa,
  leerMapaInicial,
  circleColorExpr,
} from "./components/mapa.js";
import { popupHTML, renderizarLeyenda } from "./components/ui.js";
```

```js
const storage = getStorage();

// Cargar datos al inicio
const { resultadosRaw, candidatos, timestamp } = await cargarDatos(DATA_BASE);

// Lista de nombres de candidatos para el selector
const nombresCandidatos = candidatos.map((c) => c.nombre);

// Inputs de control
const modoInput = Inputs.radio(
  ["ganador", "candidato", "invalido"],
  {
    value: "ganador",
    format: (d) =>
      d === "ganador"
        ? "Candidato ganador por recinto"
        : d === "candidato"
        ? "Ver un candidato específico"
        : "Votos blancos o nulos",
    label: null,
  }
);

const candidatoInput = Inputs.select(nombresCandidatos, {
  label: null,
  value: nombresCandidatos[0],
});

const modo = Generators.input(modoInput);
const candidatoSeleccionado = Generators.input(candidatoInput);
```

```js
// Calcular la métrica activa según el modo
function obtenerMetrica(modo, candidato) {
  if (modo === "invalido") return metricaInvalidos;
  if (modo === "candidato") {
    const pctTotal = candidatos.find((c) => c.nombre === candidato)?.porcentaje_total ?? 0.3;
    const domMax = Math.min(Math.max(pctTotal * 2, 0.3), 0.9);
    return {
      nombre: `% de votos para ${candidato}`,
      campo: "valor_candidato",
      dominio: [0, domMax],
      ticks: [0, domMax * 0.33, domMax * 0.66, domMax].map((v) => +v.toFixed(2)),
      colores: ["#f0f4ff", "#4a90d9", "#1a237e"],
      format: (d) => `${(d * 100).toFixed(0)}%`,
    };
  }
  return metricaGanador;
}
```

<div class="app">
  <header class="header">
    <div class="header__eyebrow">Municipio de La Paz &mdash; Elecciones 2026</div>
    <div class="header__title">Resultados por recinto electoral</div>
    <div class="header__timestamp" id="timestamp-container"></div>
    <div class="header__controls">
      <div class="control">
        <div class="control__label">Visualizar</div>
        <div class="control__input">${modoInput}</div>
      </div>
      <div class="control control--candidato" id="control-candidato">
        <div class="control__label">Candidato</div>
        <div class="control__input">${candidatoInput}</div>
      </div>
      <div class="control control--legend">
        <div class="control__label" id="legend-description"></div>
        <div id="legend-container"></div>
      </div>
    </div>
  </header>

  <div id="mapa"></div>
</div>

```js
// Mostrar/ocultar selector de candidato según el modo
{
  const ctrl = document.querySelector("#control-candidato");
  const actualizar = () => {
    if (ctrl) ctrl.style.display = modoInput.value === "candidato" ? "" : "none";
  };
  actualizar();
  modoInput.addEventListener("input", actualizar);
}
```

```js
// Mostrar timestamp
{
  const el = document.querySelector("#timestamp-container");
  if (el && timestamp) {
    el.textContent = `actualizado el ${timestamp.fecha} a las ${timestamp.hora}`;
  }
}
```

```js
// Crear mapa
const mapaInicial = leerMapaInicial(storage, STORAGE_MAP_KEY, MAPA_FALLBACK);
const map = crearMapa("#mapa", mapaInicial);
const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

persistirMapa(map, storage, STORAGE_MAP_KEY);

invalidation.then(() => {
  popup.remove();
  map.remove();
});
```

```js
// Inicializar capas cuando el mapa cargue
const ready = new Promise((resolve) => {
  map.on("load", () => {
    const metricaInicial = obtenerMetrica(modoInput.value, candidatoInput.value);
    const recintos = crearRecintos(resultadosRaw, modoInput.value, candidatoInput.value);
    crearCapasBase(map, recintos, metricaInicial);
    renderizarLeyenda(metricaInicial);
    resolve();
  });
});
```

```js
// Actualizar mapa cuando cambia el modo o el candidato seleccionado
{
  await ready;

  const actualizar = () => {
    const m = obtenerMetrica(modoInput.value, candidatoInput.value);
    const recintos = crearRecintos(resultadosRaw, modoInput.value, candidatoInput.value);
    map.getSource("recintos")?.setData(recintos);
    aplicarMetricaMapa(map, m);
    renderizarLeyenda(m);
  };

  modoInput.addEventListener("input", actualizar);
  candidatoInput.addEventListener("input", actualizar);

  invalidation.then(() => {
    modoInput.removeEventListener("input", actualizar);
    candidatoInput.removeEventListener("input", actualizar);
  });
}
```

```js
// Interacción hover / click con popup
{
  await ready;
  let locked = false;

  const mouseenter = (e) => {
    map.getCanvas().style.cursor = "pointer";
    const feature = e.features?.[0];
    if (!feature) return;
    const m = obtenerMetrica(modoInput.value, candidatoInput.value);
    popup
      .setLngLat(feature.geometry.coordinates)
      .setHTML(popupHTML(feature, m, candidatoInput.value))
      .addTo(map);
  };

  const mouseleave = () => {
    map.getCanvas().style.cursor = "";
    if (!locked) popup.remove();
  };

  const clickIn = () => { locked = true; };

  const clickAny = (e) => {
    const hit = map.queryRenderedFeatures(e.point, { layers: ["recintos_hover"] }).length;
    if (!hit) { locked = false; popup.remove(); }
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
