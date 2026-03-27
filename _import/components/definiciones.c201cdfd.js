import * as d3 from "../../_npm/d3@7.9.0/66d82917.js";

// ⚠️ Cambia esto por la URL raw de tu repositorio GitHub
// Ejemplo: https://raw.githubusercontent.com/TU_USUARIO/lapaz-elecciones-2026/refs/heads/main/resultados/
const esLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export const DATA_BASE = esLocal
  ? "/data/"
  : "https://raw.githubusercontent.com/gleoleder/lapaz-elecciones-2026/refs/heads/main/resultados/";

export const STORAGE_KEY = "lapaz2026_candidato";
export const STORAGE_MAP_KEY = "lapaz2026_mapa";

// Vista inicial centrada en La Paz ciudad
export const MAPA_FALLBACK = {
  center: [-68.15, -16.5],
  zoom: 12,
};

// Colores para el modo "ganador por recinto" (gradiente de intensidad del ganador)
export const metricaGanador = {
  nombre: "% del candidato ganador en el recinto",
  campo: "ganador",
  dominio: [0.2, 0.75],
  ticks: [0.2, 0.35, 0.5, 0.65, 0.75],
  colores: ["#f7f0c8", "#f0a830", "#c0392b"],
  format: d3.format(".0%"),
};

// Colores para el modo "votos blancos/nulos"
export const metricaInvalidos = {
  nombre: "% de votos blancos o nulos",
  campo: "invalido",
  dominio: [0.05, 0.4],
  ticks: [0.05, 0.15, 0.25, 0.4],
  colores: ["#d4edda", "#6796b5", "#19149f"],
  format: d3.format(".0%"),
};

export function getStorage() {
  return typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : null;
}
