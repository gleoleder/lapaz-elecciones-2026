import maplibregl from "npm:maplibre-gl";

export function crearMapa(selector, mapaInicial) {
  const map = new maplibregl.Map({
    container: document.querySelector(selector),
    style:
      "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
    center: mapaInicial.center,
    zoom: mapaInicial.zoom,
    minZoom: 10,
    maxZoom: 18,
    scrollZoom: true,
    attributionControl: false,
  });

  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showUserHeading: true,
      showAccuracyCircle: false,
    }),
    "bottom-right"
  );
  map.addControl(new maplibregl.NavigationControl(), "bottom-right");
  return map;
}

export function circleColorExpr(metrica) {
  const { campo, dominio, colores } = metrica;
  const medio = (dominio[0] + dominio[1]) / 2;
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["to-number", ["get", campo]], dominio[0]],
    dominio[0], colores[0],
    medio,    colores[1],
    dominio[1], colores[2],
  ];
}

export function circleRadiusExpr() {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    10, ["min", 4,  ["max", 2, ["*", 0.004, ["to-number", ["get", "habilitados"]]]]],
    13, ["min", 10, ["max", 4, ["*", 0.010, ["to-number", ["get", "habilitados"]]]]],
    16, ["min", 22, ["max", 6, ["*", 0.030, ["to-number", ["get", "habilitados"]]]]],
  ];
}

export function circleHoverRadiusExpr() {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    10, ["min", 6,  ["max", 3,  ["*", 0.006, ["to-number", ["get", "habilitados"]]]]],
    13, ["min", 13, ["max", 6,  ["*", 0.013, ["to-number", ["get", "habilitados"]]]]],
    16, ["min", 28, ["max", 8,  ["*", 0.038, ["to-number", ["get", "habilitados"]]]]],
  ];
}

export function crearCapasBase(map, recintos, metrica) {
  if (!map.getSource("recintos")) {
    map.addSource("recintos", { type: "geojson", data: recintos });
  }

  if (!map.getLayer("recintos")) {
    map.addLayer({
      id: "recintos",
      type: "circle",
      source: "recintos",
      paint: {
        "circle-radius": circleRadiusExpr(),
        "circle-color": circleColorExpr(metrica),
        "circle-opacity": 0.75,
        "circle-stroke-width": 0.5,
        "circle-stroke-color": "rgba(0,0,0,0.15)",
      },
    });
  }

  // Capa de etiquetas de CartoDB encima
  if (!map.getSource("etiquetas")) {
    map.addSource("etiquetas", {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
    });
  }
  if (!map.getLayer("etiquetas")) {
    map.addLayer({
      id: "etiquetas",
      type: "raster",
      source: "etiquetas",
      paint: { "raster-opacity": 0.9 },
    });
  }

  // Capa invisible para hover/click
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

export function aplicarMetricaMapa(map, metrica) {
  if (!map.getLayer("recintos")) return;
  map.setPaintProperty("recintos", "circle-color", circleColorExpr(metrica));
  map.triggerRepaint();
}

export function persistirMapa(map, storage, key) {
  map.on("moveend", () => {
    if (!storage) return;
    const center = map.getCenter();
    storage.setItem(
      key,
      JSON.stringify({ center: [center.lng, center.lat], zoom: map.getZoom() })
    );
  });
}

export function leerMapaInicial(storage, key, fallback) {
  if (!storage) return fallback;
  try {
    const value = JSON.parse(storage.getItem(key));
    if (
      value &&
      Array.isArray(value.center) &&
      value.center.length === 2 &&
      Number.isFinite(value.center[0]) &&
      Number.isFinite(value.center[1]) &&
      Number.isFinite(value.zoom)
    ) {
      return value;
    }
  } catch {}
  return fallback;
}
