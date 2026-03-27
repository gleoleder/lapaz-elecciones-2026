import * as d3 from "../../_npm/d3@7.9.0/66d82917.js";
import * as Plot from "../../_npm/@observablehq/plot@0.6.17/a96a6bbb.js";
import { colorPartido, COLORES_PARTIDOS, COLOR_DEFAULT } from "./definiciones.52907672.js";

const fmt  = d3.format(".1%");
const fmtN = d3.format(",");

// ── Análisis político del recinto ─────────────────────────────────────────
function analizar(lista, invalido) {
  if (!lista.length) return "";
  const [g0, p0] = lista[0];
  const [, p1]   = lista[1] ?? ["", 0];
  const margen   = p0 - p1;
  const nCandidatos = lista.filter(([, v]) => v > 0.02).length;

  let competencia, icono;
  if (margen < 0.04) {
    competencia = "Resultado muy reñido";       icono = "⚡";
  } else if (margen < 0.12) {
    competencia = "Resultado competitivo";       icono = "📊";
  } else if (margen < 0.25) {
    competencia = "Victoria clara";             icono = "📌";
  } else {
    competencia = `Bastión de ${g0}`;           icono = "🏛";
  }

  const participacionTexto = invalido != null
    ? invalido > 0.25
      ? `Alto rechazo: ${fmt(invalido)} de votos nulos/blancos`
      : invalido > 0.12
      ? `Rechazo moderado: ${fmt(invalido)} nulos/blancos`
      : `Voto válido alto (${fmt(1 - invalido)} votos válidos)`
    : "";

  return `
    <div class="analisis">
      <div class="analisis__item"><span class="analisis__icono">${icono}</span>${competencia} (margen ${fmt(margen)})</div>
      <div class="analisis__item"><span class="analisis__icono">👥</span>${nCandidatos} candidatos con más del 2%</div>
      ${participacionTexto ? `<div class="analisis__item"><span class="analisis__icono">📋</span>${participacionTexto}</div>` : ""}
    </div>`;
}

// ── HTML del popup ────────────────────────────────────────────────────────
export function popupHTML(feature, candidatoSeleccionado) {
  const p = feature.properties ?? {};
  const candidatos = JSON.parse(p.candidatos_json ?? "{}");
  const lista = Object.entries(candidatos).sort(([, a], [, b]) => b - a).filter(([, v]) => v > 0);
  const ganador = p.partido_ganador;
  const colorGanador = colorPartido(ganador);

  const barras = lista.map(([nombre, pct]) => {
    const esGanador    = nombre === ganador;
    const esSeleccion  = nombre === candidatoSeleccionado;
    const color        = colorPartido(nombre);
    const cls = esGanador ? "cand cand--ganador" : esSeleccion ? "cand cand--seleccion" : "cand";
    return `
      <div class="${cls}">
        <div class="cand__row">
          <span class="cand__dot" style="background:${color}"></span>
          <span class="cand__nombre">${nombre}</span>
          <span class="cand__pct" style="color:${color}">${fmt(pct)}</span>
        </div>
        <div class="cand__bg">
          <div class="cand__bar" style="width:${(pct * 100).toFixed(1)}%;background:${color}"></div>
        </div>
      </div>`;
  }).join("");

  return `
    <div class="popup" style="--acc:${colorGanador}">
      <div class="popup__head">
        <div class="popup__title">${p.recinto ?? "Recinto sin nombre"}</div>
        <div class="popup__ganador" style="background:${colorGanador}20;color:${colorGanador};border-color:${colorGanador}40">
          Ganador: <strong>${ganador ?? "—"}</strong> · ${fmt(p.ganador ?? 0)}
        </div>
      </div>
      <div class="popup__stats">
        <span>${fmtN(p.habilitados ?? 0)} habilitados</span>
        <span>${fmt(p.validos ?? 0)} válidos</span>
        <span>${fmt(p.blancos ?? 0)} blancos</span>
        <span>${fmt(p.nulos ?? 0)} nulos</span>
      </div>
      ${analizar(lista, p.invalido)}
      <div class="popup__lista">${barras}</div>
    </div>`;
}

// ── Leyenda de partidos (modo ganador) ────────────────────────────────────
export function renderizarLeyendaPartidos(candidatos) {
  const el = document.querySelector("#legend-container");
  if (!el) return;
  const items = candidatos
    .filter(c => c.porcentaje_total > 0.005)
    .sort((a, b) => b.porcentaje_total - a.porcentaje_total)
    .map(c => {
      const color = colorPartido(c.nombre);
      return `
        <div class="leg-item">
          <span class="leg-dot" style="background:${color}"></span>
          <span class="leg-nombre">${c.nombre}</span>
          <span class="leg-pct">${fmt(c.porcentaje_total)}</span>
        </div>`;
    }).join("");
  el.innerHTML = `<div class="leg-grid">${items}</div>`;
}

// ── Leyenda de gradiente (candidato / invalidos) ──────────────────────────
export function renderizarLeyendaGradiente(metrica) {
  const el = document.querySelector("#legend-container");
  const desc = document.querySelector("#legend-description");
  if (!el) return;
  if (desc) desc.textContent = metrica.nombre;
  el.replaceChildren(
    Plot.legend({
      margin: 0,
      width: 260,
      height: 44,
      className: "leyenda",
      color: {
        type: "linear",
        domain: metrica.dominio,
        range: metrica.colores,
        ticks: metrica.ticks,
        tickFormat: metrica.format,
      },
    })
  );
}
