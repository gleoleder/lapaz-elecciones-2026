import * as d3 from "npm:d3";

export async function cargarDatos(base) {
  const [resultadosRaw, candidatos, timestampRaw] = await Promise.all([
    d3.json(`${base}resultados_lapaz.json`),
    d3.json(`${base}candidatos.json`),
    d3.text(`${base}timestamp`).catch(() => null),
  ]);

  return {
    resultadosRaw,
    candidatos,
    timestamp: formatearTimestamp(timestampRaw),
  };
}

function formatearTimestamp(raw) {
  const ts = raw?.trim();
  if (!ts) return null;
  const [fecha, hora] = ts.split(" ");
  if (!fecha || !hora) return null;
  const [year, month, day] = fecha.split("-");
  const [hours, minutes] = hora.split(":");
  if (!year || !month || !day || !hours || !minutes) return null;
  return { fecha: `${day}/${month}/${year}`, hora: `${hours}:${minutes}` };
}

/**
 * Convierte los resultados planos a GeoJSON.
 * modo: "ganador" → colorear por % del ganador
 *       "candidato" → colorear por % de un candidato específico
 *       "invalido" → colorear por % blancos/nulos
 */
export function crearRecintos(resultadosRaw, modo, candidatoSeleccionado) {
  return {
    type: "FeatureCollection",
    features: Object.entries(resultadosRaw)
      .map(([codigo, v]) => {
        const invalido = v.validos != null ? +(1 - v.validos).toFixed(4) : null;
        const valorCandidato =
          modo === "candidato" && candidatoSeleccionado
            ? (v.candidatos?.[candidatoSeleccionado] ?? 0)
            : null;

        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [+v.x, +v.y],
          },
          properties: {
            codigo,
            recinto: v.recinto,
            habilitados: +v.habilitados || 0,
            validos: v.validos,
            invalido,
            ganador: v.ganador,
            partido_ganador: v.partido_ganador,
            blancos: v.blancos,
            nulos: v.nulos,
            valor_candidato: valorCandidato,
            // Serializar candidatos como JSON string para MapLibre
            candidatos_json: JSON.stringify(v.candidatos ?? {}),
          },
        };
      })
      .filter(
        (f) =>
          Number.isFinite(f.geometry.coordinates[0]) &&
          Number.isFinite(f.geometry.coordinates[1])
      ),
  };
}
