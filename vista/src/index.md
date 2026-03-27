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
  DATA_BASE, MAPA_FALLBACK, STORAGE_KEY, STORAGE_MAP_KEY,
  metricaInvalidos, metricaCandidato, getStorage,
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
const storage = getStorage();
const { resultadosRaw, candidatos, timestamp } = await cargarDatos(DATA_BASE);
const nombresCandidatos = candidatos.map(c => c.nombre);

const modoInput = Inputs.radio(["ganador", "candidato", "invalido"], {
  value: "ganador",
  format: d =>
    d === "ganador"   ? "Ganador por recinto" :
    d === "candidato" ? "Candidato específico" :
                        "Votos blancos / nulos",
  label: null,
});

const candidatoInput = Inputs.select(nombresCandidatos, {
  label: null,
  value: nombresCandidatos[0],
});

const modo       = Generators.input(modoInput);
const candidato  = Generators.input(candidatoInput);
```

```js
function getMetrica(modo, candidatoNombre) {
  if (modo === "invalido") return metricaInvalidos;
  if (modo === "candidato") {
    const pctTotal = candidatos.find(c => c.nombre === candidatoNombre)?.porcentaje_total ?? 0.3;
    return metricaCandidato(candidatoNombre, pctTotal);
  }
  return null; // modo ganador usa colores por partido, no gradiente
}
```

<div class="app">
  <header class="header">
    <div class="header__brand">
      <div class="header__eyebrow">Municipio de La Paz · 2026</div>
      <div class="header__title">Mapa Electoral por Recinto</div>
    </div>
    <div class="header__controls">
      <div class="ctrl">
        <span class="ctrl__label">Visualizar</span>
        <div>${modoInput}</div>
      </div>
      <div class="ctrl" id="ctrl-candidato">
        <span class="ctrl__label">Candidato</span>
        <div>${candidatoInput}</div>
      </div>
    </div>
    <div class="header__timestamp" id="ts"></div>
  </header>

  <div style="position:relative">
    <div id="mapa"></div>
    <div id="legend-panel">
      <div class="panel-title" id="legend-description">Partido ganador por recinto</div>
      <div id="legend-container"></div>
    </div>
  </div>
</div>

```js
// Mostrar / ocultar selector candidato
{
  const ctrl = document.querySelector("#ctrl-candidato");
  const sync = () => { ctrl.style.display = modoInput.value === "candidato" ? "" : "none"; };
  sync();
  modoInput.addEventListener("input", sync);
}
```

```js
// Timestamp
{
  const el = document.querySelector("#ts");
  if (el && timestamp) el.textContent = `actualizado el ${timestamp.fecha} a las ${timestamp.hora}`;
}
```

```js
const mapaInicial = leerMapaInicial(storage, STORAGE_MAP_KEY, MAPA_FALLBACK);
const map = crearMapa("#mapa", mapaInicial);
const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
persistirMapa(map, storage, STORAGE_MAP_KEY);
invalidation.then(() => { popup.remove(); map.remove(); });
```

```js
// Inicializar capas
const ready = new Promise(resolve => {
  map.on("load", () => {
    const metrica = getMetrica(modoInput.value, candidatoInput.value);
    const recintos = crearRecintos(resultadosRaw, modoInput.value, candidatoInput.value);
    crearCapasBase(map, recintos, modoInput.value, metrica);

    // Leyenda inicial
    if (modoInput.value === "ganador") {
      renderizarLeyendaPartidos(candidatos);
    } else {
      renderizarLeyendaGradiente(metrica);
    }
    resolve();
  });
});
```

```js
// Actualizar al cambiar modo o candidato
{
  await ready;
  const actualizar = () => {
    const m = getMetrica(modoInput.value, candidatoInput.value);
    const recintos = crearRecintos(resultadosRaw, modoInput.value, candidatoInput.value);
    map.getSource("recintos")?.setData(recintos);
    aplicarColorMapa(map, modoInput.value, m);

    const desc = document.querySelector("#legend-description");
    if (modoInput.value === "ganador") {
      if (desc) desc.textContent = "Partido ganador por recinto";
      renderizarLeyendaPartidos(candidatos);
    } else {
      if (desc) desc.textContent = "";
      renderizarLeyendaGradiente(m);
    }
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
// Interacción hover / click
{
  await ready;
  let locked = false;

  const mouseenter = e => {
    map.getCanvas().style.cursor = "pointer";
    const f = e.features?.[0];
    if (!f) return;
    popup.setLngLat(f.geometry.coordinates)
         .setHTML(popupHTML(f, candidatoInput.value))
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
