#!/usr/bin/env python3

import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
from slugify import slugify

DEPARTAMENTO = "La Paz"
CODIGO_MUNICIPIO_LAPAZ = "20101"
ELECCION_SLUG = "alcaldesaalcalde"

ADMIN = [
    "CodigoProvincia",
    "NombreProvincia",
    "CodigoSeccion",
    "NombreMunicipio",
    "CodigoLocalidad",
    "NombreLocalidad",
    "CodigoRecinto",
    "NombreRecinto",
    "CodigoMesa",
    "NumeroMesa",
]
PARTICIPACION = [
    "VotoValido",
    "VotoEmitido",
    "InscritosHabilitados",
    "VotoBlanco",
    "VotoNulo",
    "VotoValidoReal",
    "VotoEmitidoReal",
]

BASE = Path(__file__).resolve().parent
REPO_ROOT = BASE.parent

# Ruta al archivo GeoPackage con ubicaciones de recintos
# Primero busca en el proyecto local, luego en el proyecto hermano
GEO_PATHS = [
    REPO_ROOT / "geo" / "recintos.gpkg",
    Path("C:/Users/Jhon-/Desktop/file/geo/2026/recintos.gpkg"),
]
GEO = next((p for p in GEO_PATHS if p.exists()), None)


def identificar(df, codigo_localidad, codigo_recinto):
    return df[codigo_localidad].astype(str) + "." + df[codigo_recinto].astype(str)


def procesar_recintos():
    if GEO is None:
        raise FileNotFoundError(
            "No se encontró recintos.gpkg. "
            "Copia el archivo a lapaz_2026/geo/recintos.gpkg"
        )
    recintos = gpd.read_file(GEO)
    recintos["codigo"] = identificar(recintos, "asiento", "recinto")
    recintos["x"] = recintos.geometry.x
    recintos["y"] = recintos.geometry.y
    return recintos.set_index("codigo")[["x", "y"]]


def main():
    folder = BASE / slugify(DEPARTAMENTO) / ELECCION_SLUG

    # Cargar CSVs
    participacion_df = pd.read_csv(folder / "participacion.csv")
    validos_df = pd.read_csv(folder / "validos.csv")

    # Crear código de municipio (departamento 2 + provincia 2 dig + sección 2 dig)
    for df in [participacion_df, validos_df]:
        df["municipio"] = (
            "2"
            + df["CodigoProvincia"].astype(str).str.rjust(2, "0")
            + df["CodigoSeccion"].astype(str).str.rjust(2, "0")
        )

    # Filtrar solo La Paz ciudad
    mask_p = participacion_df["municipio"] == CODIGO_MUNICIPIO_LAPAZ
    mask_v = validos_df["municipio"] == CODIGO_MUNICIPIO_LAPAZ
    participacion_lp = participacion_df[mask_p].copy()
    validos_lp = validos_df[mask_v].copy()

    if participacion_lp.empty:
        print("No hay datos para La Paz ciudad aún.")
        return

    # Crear códigos de recinto
    participacion_lp["codigo"] = identificar(
        participacion_lp, "CodigoLocalidad", "CodigoRecinto"
    )
    validos_lp["codigo"] = identificar(
        validos_lp, "CodigoLocalidad", "CodigoRecinto"
    )

    # Obtener lista de partidos/candidatos
    partidos = [
        col
        for col in validos_lp.columns
        if col not in ADMIN + PARTICIPACION + ["municipio", "codigo"]
    ]

    # Cargar coordenadas geográficas
    recintos_geo = procesar_recintos()

    # --- Métricas de participación por recinto ---
    part_agg = participacion_lp.groupby("codigo").agg(
        recinto=("NombreRecinto", "first"),
        VotoValido=("VotoValido", "sum"),
        VotoEmitido=("VotoEmitido", "sum"),
        VotoBlanco=("VotoBlanco", "sum"),
        VotoNulo=("VotoNulo", "sum"),
        habilitados=("InscritosHabilitados", "sum"),
    )
    part_agg["validos"] = part_agg["VotoValido"] / part_agg["VotoEmitido"]
    part_agg["blancos"] = part_agg["VotoBlanco"] / part_agg["VotoEmitido"]
    part_agg["nulos"] = part_agg["VotoNulo"] / part_agg["VotoEmitido"]

    # --- Votos por candidato por recinto ---
    votos_recinto = validos_lp.groupby("codigo")[partidos].sum()
    total_validos = votos_recinto.sum(axis=1)
    porcentajes_recinto = votos_recinto.div(total_validos, axis=0)

    # Candidato ganador por recinto
    ganador_pct = porcentajes_recinto.max(axis=1).rename("ganador")
    ganador_partido = porcentajes_recinto.idxmax(axis=1).rename("partido_ganador")

    # Combinar todo y filtrar recintos sin coordenadas
    resultado = pd.concat(
        [
            part_agg[["recinto", "validos", "blancos", "nulos", "habilitados"]],
            porcentajes_recinto,
            ganador_pct,
            ganador_partido,
            recintos_geo,
        ],
        axis=1,
    ).dropna(subset=["x", "y"])

    # --- Totales globales por candidato ---
    votos_totales = votos_recinto.sum()
    total_global = votos_totales.sum()
    porcentajes_totales = (votos_totales / total_global).sort_values(ascending=False)

    candidatos = [
        {
            "nombre": candidato,
            "porcentaje_total": round(float(pct), 4),
        }
        for candidato, pct in porcentajes_totales.items()
        if float(pct) > 0.001
    ]

    # --- Construir JSON de resultados ---
    resultados = {}
    for codigo, row in resultado.iterrows():
        entry = {
            "recinto": row["recinto"],
            "validos": round(float(row["validos"]), 4) if pd.notna(row["validos"]) else None,
            "blancos": round(float(row["blancos"]), 4) if pd.notna(row["blancos"]) else None,
            "nulos": round(float(row["nulos"]), 4) if pd.notna(row["nulos"]) else None,
            "habilitados": int(row["habilitados"]) if pd.notna(row["habilitados"]) else 0,
            "ganador": round(float(row["ganador"]), 4) if pd.notna(row["ganador"]) else None,
            "partido_ganador": row["partido_ganador"] if pd.notna(row["partido_ganador"]) else None,
            "x": round(float(row["x"]), 5),
            "y": round(float(row["y"]), 5),
            "candidatos": {},
        }
        for partido in partidos:
            if partido in row and pd.notna(row[partido]):
                val = round(float(row[partido]), 4)
                if val > 0:
                    entry["candidatos"][partido] = val
        resultados[codigo] = entry

    # --- Guardar JSONs ---
    # En resultados/ (para GitHub raw URL en producción)
    out_resultados = BASE / "resultados_lapaz.json"
    out_candidatos = BASE / "candidatos.json"

    with open(out_resultados, "w", encoding="utf-8") as f:
        json.dump(resultados, f, ensure_ascii=False)

    with open(out_candidatos, "w", encoding="utf-8") as f:
        json.dump(candidatos, f, ensure_ascii=False)

    # También en vista/src/data/ (para desarrollo local)
    data_dir = REPO_ROOT / "vista" / "src" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    with open(data_dir / "resultados_lapaz.json", "w", encoding="utf-8") as f:
        json.dump(resultados, f, ensure_ascii=False)

    with open(data_dir / "candidatos.json", "w", encoding="utf-8") as f:
        json.dump(candidatos, f, ensure_ascii=False)

    # Copiar timestamp
    timestamp_src = BASE / slugify(DEPARTAMENTO) / "timestamp"
    if timestamp_src.exists():
        ts = timestamp_src.read_text()
        (BASE / "timestamp").write_text(ts)
        (data_dir / "timestamp").write_text(ts)

    print(f"Procesados {len(resultados)} recintos en La Paz ciudad.")
    print(f"Candidatos ({len(candidatos)}): {[c['nombre'] for c in candidatos]}")


if __name__ == "__main__":
    main()
