import * as d3 from "../../_npm/d3@7.9.0/66d82917.js";
import * as Plot from "../../_npm/@observablehq/plot@0.6.17/a96a6bbb.js";

/**
 * Genera el HTML del popup para un recinto.
 * Muestra TODOS los candidatos ordenados por porcentaje.
 */
export function popupHTML(feature, metrica, candidatoSeleccionado) {
  const p = feature.properties ?? {};
  const candidatos = JSON.parse(p.candidatos_json ?? "{}");

  // Ordenar candidatos de mayor a menor
  const lista = Object.entries(candidatos)
    .sort(([, a], [, b]) => b - a)
    .filter(([, v]) => v > 0);

  // Color del acento del popup según la métrica actual
  const valor = p[metrica.campo] ?? p["valor_candidato"];
  const colorScale = d3
    .scaleLinear()
    .domain([
      metrica.dominio[0],
      (metrica.dominio[0] + metrica.dominio[1]) / 2,
      metrica.dominio[1],
    ])
    .range(metrica.colores)
    .clamp(true);
  const acento = colorScale(valor ?? metrica.dominio[0]);

  const barras = lista
    .map(([nombre, pct]) => {
      const esGanador = nombre === p.partido_ganador;
      const esSeleccionado = nombre === candidatoSeleccionado;
      const clase = esGanador
        ? "candidato candidato--ganador"
        : esSeleccionado
        ? "candidato candidato--seleccionado"
        : "candidato";
      return `
        <div class="${clase}">
          <div class="candidato__header">
            <span class="candidato__nombre">${nombre}</span>
            <span class="candidato__pct">${d3.format(".1%")(pct)}</span>
          </div>
          <div class="candidato__barra-bg">
            <div class="candidato__barra" style="width:${(pct * 100).toFixed(1)}%"></div>
          </div>
        </div>`;
    })
    .join("");

  const modeLabel =
    metrica.campo === "invalido"
      ? `<div class="popup__metrica">Blancos/nulos: <strong>${d3.format(".1%")(p.invalido ?? 0)}</strong></div>`
      : metrica.campo === "valor_candidato" && candidatoSeleccionado
      ? `<div class="popup__metrica">${candidatoSeleccionado}: <strong>${d3.format(".1%")(p.valor_candidato ?? 0)}</strong></div>`
      : "";

  return `
    <div class="popup" style="--popup-accent:${acento}">
      <div class="popup__title">${p.recinto ?? "Recinto sin nombre"}</div>
      <div class="popup__sub">${d3.format(",")(p.habilitados ?? 0)} habilitados &middot; válidos: ${d3.format(".1%")(p.validos ?? 0)}</div>
      ${modeLabel}
      <div class="popup__candidatos">${barras}</div>
    </div>`;
}

export function renderizarLeyenda(metrica) {
  const container = document.querySelector("#legend-container");
  const desc = document.querySelector("#legend-description");
  if (!container) return;
  if (desc) desc.textContent = metrica.nombre;
  container.replaceChildren(
    Plot.legend({
      margin: 0,
      width: 260,
      height: 46,
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
