import * as d3 from "npm:d3";

const esLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export const DATA_BASE = esLocal
  ? "/data/"
  : "https://raw.githubusercontent.com/gleoleder/lapaz-elecciones-2026/refs/heads/main/resultados/";

export const STORAGE_KEY      = "lapaz2026_candidato";
export const STORAGE_MAP_KEY  = "lapaz2026_mapa";

export const MAPA_FALLBACK = { center: [-68.15, -16.5], zoom: 12 };

// ── Colores por partido ────────────────────────────────────────────────────
export const COLORES_PARTIDOS = {
  "IH":            "#c0392b",
  "SPBC":          "#1a6eb5",
  "VENCEREMOS":    "#d35400",
  "ASLP":          "#7d3c98",
  "APB-SUMATE":    "#148f77",
  "JALLALLA LP":   "#d4ac0d",
  "ASP":           "#1e8449",
  "M.P.S.":        "#c2185b",
  "PATRIA-LA-PAZ": "#0277bd",
  "LIBRE":         "#e64a19",
  "VIDA":          "#2e7d32",
  "A-UPP":         "#6d4c41",
  "FRI":           "#455a64",
  "MTS":           "#e65100",
  "UPC":           "#6a1b9a",
  "NGP":           "#b71c1c",
  "PDC":           "#1565c0",
};
export const COLOR_DEFAULT = "#9e9e9e";

export function colorPartido(nombre) {
  return COLORES_PARTIDOS[nombre] ?? COLOR_DEFAULT;
}

// ── Métrica: blancos/nulos ────────────────────────────────────────────────
export const metricaInvalidos = {
  nombre: "Votos blancos o nulos",
  campo: "invalido",
  dominio: [0.03, 0.4],
  ticks: [0.05, 0.15, 0.25, 0.4],
  colores: ["#e8f5e9", "#66bb6a", "#1b5e20"],
  format: d3.format(".0%"),
};

// ── Métrica candidato específico ──────────────────────────────────────────
export function metricaCandidato(nombre, pctTotal) {
  const domMax = Math.min(Math.max(pctTotal * 2.2, 0.25), 0.95);
  const color  = colorPartido(nombre);
  return {
    nombre: `Votos para ${nombre}`,
    campo: "valor_candidato",
    dominio: [0, domMax],
    ticks: [0, +(domMax * 0.33).toFixed(2), +(domMax * 0.66).toFixed(2), +domMax.toFixed(2)],
    colores: ["#f5f5f5", color + "99", color],
    format: d3.format(".0%"),
  };
}

export function getStorage() {
  return typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : null;
}
