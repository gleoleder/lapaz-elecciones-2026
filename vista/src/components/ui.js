import * as d3 from "npm:d3";
import * as Plot from "npm:@observablehq/plot";
import { colorPartido } from "./definiciones.js";

const fmt  = d3.format(".1%");
const fmtN = d3.format(",");

// Ruta base de fotos de candidatos (partido.webp o partido.jpg)
const FOTOS_BASE = "./data/fotos/";

// Extensiones disponibles por partido
const FOTOS_EXT = {
  "A-UPP":        "jpg",
  "APB-SUMATE":   "jpg",
  "ASLP":         "jpg",
  "ASP":          "webp",
  "FRI":          "jpg",
  "IH":           "jpg",
  "JALLALLA LP":  "jpg",
  "LIBRE":        "jpg",
  "M.P.S.":       "webp",
  "MTS":          "jpg",
  "NGP":          "webp",
  "PATRIA-LA-PAZ":"webp",
  "PDC":          "jpg",
  "SPBC":         "jpg",
  "UPC":          "webp",
  "VENCEREMOS":   "jpg",
  "VIDA":         "jpg",
};

function fotoHTML(partido, size = 38) {
  const color   = colorPartido(partido);
  const inicial = (partido ?? "?")[0].toUpperCase();
  const ext     = FOTOS_EXT[partido] ?? "jpg";
  const src     = `${FOTOS_BASE}${partido}.${ext}`;
  const id      = `ph_${partido.replace(/[^a-zA-Z0-9]/g,"_")}_${size}`;
  return `
    <div id="${id}" style="width:${size}px;height:${size}px;border-radius:50%;
      background:${color}25;border:2px solid ${color};
      display:flex;align-items:center;justify-content:center;
      font:700 ${Math.round(size*.42)}px 'Outfit',sans-serif;color:${color};flex-shrink:0;">
      ${inicial}
    </div>
    <img src="${src}"
      style="display:none;width:${size}px;height:${size}px;border-radius:50%;
             object-fit:cover;border:2px solid ${color};flex-shrink:0;"
      onerror="this.style.display='none'"
      onload="this.style.display='block';document.getElementById('${id}').style.display='none'"
    />`;
}

function analizar(lista, invalido) {
  if (!lista.length) return "";
  const [g0, p0] = lista[0];
  const [, p1]   = lista[1] ?? ["", 0];
  const margen   = p0 - p1;
  const nCands   = lista.filter(([, v]) => v > 0.02).length;

  let icono, texto;
  if (margen < 0.04) {
    icono = "⚡"; texto = `Resultado muy reñido — margen de solo ${fmt(margen)}`;
  } else if (margen < 0.12) {
    icono = "📊"; texto = `Resultado competitivo — margen ${fmt(margen)} sobre el 2do`;
  } else if (margen < 0.25) {
    icono = "📌"; texto = `Victoria clara de ${g0} con ${fmt(p0)}`;
  } else {
    icono = "🏛"; texto = `Bastión de ${g0} — domina con ${fmt(p0)}`;
  }

  const invalTexto = invalido > 0.25
    ? `⚠️ Alto rechazo: ${fmt(invalido)} de votos nulos o blancos`
    : invalido > 0.12
    ? `📋 Rechazo moderado: ${fmt(invalido)} nulos/blancos`
    : null;

  return `
    <div class="pp-analisis">
      <div class="pp-analisis-row"><span class="pp-analisis-icon">${icono}</span>${texto}</div>
      <div class="pp-analisis-row"><span class="pp-analisis-icon">👥</span>${nCands} candidatos con más del 2% de los votos</div>
      ${invalTexto ? `<div class="pp-analisis-row">${invalTexto}</div>` : ""}
    </div>`;
}

export function popupHTML(feature, candidatoSeleccionado) {
  const p = feature.properties ?? {};
  const candidatos = JSON.parse(p.candidatos_json ?? "{}");
  const lista = Object.entries(candidatos).sort(([, a], [, b]) => b - a).filter(([, v]) => v > 0);
  const ganador = p.partido_ganador ?? "—";
  const colorG  = colorPartido(ganador);

  const barras = lista.map(([nombre, pct]) => {
    const color = colorPartido(nombre);
    const esG   = nombre === ganador;
    const esS   = nombre === candidatoSeleccionado;
    return `
      <div class="cand${esG ? " cand--ganador" : ""}">
        <div class="cand__row">
          ${fotoHTML(nombre, 20, "cand__foto")}
          <span class="cand__nombre">${nombre}</span>
          <span class="cand__pct" style="color:${color}">${fmt(pct)}</span>
        </div>
        <div class="cand__bg">
          <div class="cand__bar" style="width:${(pct*100).toFixed(1)}%;background:${color}${esG||esS?"":"88"}"></div>
        </div>
      </div>`;
  }).join("");

  return `
    <div class="pp-card">
      <div class="pp-header">
        <div class="pp-winner-row">
          ${fotoHTML(ganador, 38, "pp-winner-foto")}
          <div class="pp-winner-info">
            <div class="pp-title">${p.recinto ?? "Recinto sin nombre"}</div>
            <div class="pp-winner-badge" style="background:${colorG}18;color:${colorG};border-color:${colorG}44">
              ${ganador} · ${fmt(p.ganador ?? 0)}
            </div>
          </div>
        </div>
      </div>
      <div class="pp-stats">
        <div class="pp-stat"><span class="pp-stat-val">${fmtN(p.habilitados ?? 0)}</span><span class="pp-stat-lbl">Habilitados</span></div>
        <div class="pp-stat"><span class="pp-stat-val">${fmt(p.validos ?? 0)}</span><span class="pp-stat-lbl">Válidos</span></div>
        <div class="pp-stat"><span class="pp-stat-val">${fmt(p.blancos ?? 0)}</span><span class="pp-stat-lbl">Blancos</span></div>
        <div class="pp-stat"><span class="pp-stat-val">${fmt(p.nulos ?? 0)}</span><span class="pp-stat-lbl">Nulos</span></div>
      </div>
      ${analizar(lista, p.invalido ?? 0)}
      <div class="pp-lista">${barras}</div>
      <div class="pp-foot">Municipio de La Paz · Elecciones 2026</div>
    </div>`;
}

// Leyenda de partidos en panel lateral
export function renderizarLeyendaPartidos(candidatos, containerId) {
  const el = document.querySelector(`#${containerId}`);
  if (!el) return;
  const items = candidatos
    .filter(c => c.porcentaje_total > 0.003)
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
  el.innerHTML = `<div class="leg-lista">${items}</div>`;
}

// Leyenda de gradiente
export function renderizarLeyendaGradiente(metrica, containerId) {
  const el = document.querySelector(`#${containerId}`);
  if (!el) return;
  el.replaceChildren(
    Plot.legend({
      margin: 0, width: 200, height: 44,
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
