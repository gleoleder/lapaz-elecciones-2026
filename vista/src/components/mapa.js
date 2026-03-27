import maplibregl from "npm:maplibre-gl";
import { COLORES_PARTIDOS, COLOR_DEFAULT } from "./definiciones.js";

export function crearMapa(selector, mapaInicial) {
  const map = new maplibregl.Map({
    container: document.querySelector(selector),
    style: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
    center: mapaInicial.center,
    zoom:   mapaInicial.zoom,
    minZoom: 10,
    maxZoom: 18,
    scrollZoom: true,
    attributionControl: false,
  });
  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
    }),
    "bottom-right"
  );
  map.addControl(new maplibregl.NavigationControl(), "bottom-right");
  return map;
}

// Expresión de color por partido ganador (match)
export function circleColorGanadorExpr() {
  const cases = [];
  for (const [partido, color] of Object.entries(COLORES_PARTIDOS)) {
    cases.push(partido, color);
  }
  return ["match", ["get", "partido_ganador"], ...cases, COLOR_DEFAULT];
}

// Expresión de color por gradiente (candidato / invalidos)
export function circleColorGradienteExpr(metrica) {
  const { campo, dominio, colores } = metrica;
  const medio = (dominio[0] + dominio[1]) / 2;
  return [
    "interpolate", ["linear"],
    ["coalesce", ["to-number", ["get", campo]], dominio[0]],
    dominio[0], colores[0],
    medio,      colores[1],
    dominio[1], colores[2],
  ];
}

// Opacidad: más opaco si el partido ganó con más margen
export function circleOpacityExpr() {
  return [
    "interpolate", ["linear"],
    ["coalesce", ["to-number", ["get", "ganador"]], 0.3],
    0.2, 0.5,
    0.5, 0.8,
    0.9, 1.0,
  ];
}

export function circleRadiusExpr() {
  return [
    "interpolate", ["linear"], ["zoom"],
    10, ["min", 5,  ["max", 2, ["*", 0.005, ["to-number", ["get", "habilitados"]]]]],
    13, ["min", 11, ["max", 4, ["*", 0.011, ["to-number", ["get", "habilitados"]]]]],
    16, ["min", 24, ["max", 6, ["*", 0.032, ["to-number", ["get", "habilitados"]]]]],
  ];
}

export function circleHoverRadiusExpr() {
  return [
    "interpolate", ["linear"], ["zoom"],
    10, ["min", 7,  ["max", 3,  ["*", 0.007, ["to-number", ["get", "habilitados"]]]]],
    13, ["min", 14, ["max", 6,  ["*", 0.014, ["to-number", ["get", "habilitados"]]]]],
    16, ["min", 30, ["max", 8,  ["*", 0.040, ["to-number", ["get", "habilitados"]]]]],
  ];
}

export function crearCapasBase(map, recintos, modo, metrica) {
  if (!map.getSource("recintos")) {
    map.addSource("recintos", { type: "geojson", data: recintos });
  }

  const color = modo === "ganador"
    ? circleColorGanadorExpr()
    : circleColorGradienteExpr(metrica);

  if (!map.getLayer("recintos")) {
    map.addLayer({
      id: "recintos",
      type: "circle",
      source: "recintos",
      paint: {
        "circle-radius": circleRadiusExpr(),
        "circle-color": color,
        "circle-opacity": modo === "ganador" ? circleOpacityExpr() : 0.78,
        "circle-stroke-width": 0.8,
        "circle-stroke-color": "rgba(255,255,255,0.4)",
      },
    });
  }

  if (!map.getSource("etiquetas")) {
    map.addSource("etiquetas", {
      type: "raster",
      tiles: ["https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png"],
      tileSize: 256,
    });
  }
  if (!map.getLayer("etiquetas")) {
    map.addLayer({
      id: "etiquetas",
      type: "raster",
      source: "etiquetas",
      paint: { "raster-opacity": 0.85 },
    });
  }

  if (!map.getLayer("recintos_hover")) {
    map.addLayer({
      id: "recintos_hover",
      type: "circle",
      source: "recintos",
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": circleHoverRadiusExpr(),
      },
    });
  }
}

export function aplicarColorMapa(map, modo, metrica) {
  if (!map.getLayer("recintos")) return;
  if (modo === "ganador") {
    map.setPaintProperty("recintos", "circle-color", circleColorGanadorExpr());
    map.setPaintProperty("recintos", "circle-opacity", circleOpacityExpr());
  } else {
    map.setPaintProperty("recintos", "circle-color", circleColorGradienteExpr(metrica));
    map.setPaintProperty("recintos", "circle-opacity", 0.78);
  }
  map.triggerRepaint();
}

export function persistirMapa(map, storage, key) {
  map.on("moveend", () => {
    if (!storage) return;
    const c = map.getCenter();
    storage.setItem(key, JSON.stringify({ center: [c.lng, c.lat], zoom: map.getZoom() }));
  });
}

export function leerMapaInicial(storage, key, fallback) {
  if (!storage) return fallback;
  try {
    const v = JSON.parse(storage.getItem(key));
    if (v && Array.isArray(v.center) && v.center.length === 2 &&
        Number.isFinite(v.center[0]) && Number.isFinite(v.center[1]) &&
        Number.isFinite(v.zoom)) return v;
  } catch {}
  return fallback;
}
