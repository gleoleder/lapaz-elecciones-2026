// ── Configuración ──────────────────────────────────────────────────────────
const BASE = "https://raw.githubusercontent.com/gleoleder/lapaz-elecciones-2026/refs/heads/main/resultados/";
const FOTOS = "./fotos/";
const FOTOS_EXT = {"A-UPP":"jpg","APB-SUMATE":"jpg","ASLP":"jpg","ASP":"webp","FRI":"jpg","IH":"jpg","JALLALLA LP":"jpg","LIBRE":"jpg","M.P.S.":"webp","MTS":"jpg","NGP":"webp","PATRIA-LA-PAZ":"webp","PDC":"jpg","SPBC":"jpg","UPC":"webp","VENCEREMOS":"jpg","VIDA":"jpg"};

const COLORES = {
  "IH":"#00bcd4","SPBC":"#f5c518","VENCEREMOS":"#e53935","ASLP":"#7b1fa2",
  "APB-SUMATE":"#00897b","JALLALLA LP":"#ff8f00","ASP":"#2e7d32","M.P.S.":"#1565c0",
  "PATRIA-LA-PAZ":"#ad1457","LIBRE":"#e64a19","VIDA":"#558b2f","A-UPP":"#4527a0",
  "FRI":"#00838f","MTS":"#bf360c","UPC":"#6d4c41","NGP":"#37474f","PDC":"#0277bd"
};
const COLOR_DEF = "#9e9e9e";
const color = p => COLORES[p] ?? COLOR_DEF;
const fmt   = n => n == null ? "—" : (n * 100).toFixed(1) + "%";
const fmtN  = n => n == null ? "—" : n.toLocaleString("es-BO");

// ── Estado ─────────────────────────────────────────────────────────────────
let resultados = {}, candidatos = [], modo = "ganador", candActual = "";
let map, popup;

// ── Inicialización ─────────────────────────────────────────────────────────
async function init() {
  try {
    const [resJSON, candsJSON, tsRaw] = await Promise.all([
      fetch(BASE + "resultados_lapaz.json").then(r => r.json()),
      fetch(BASE + "candidatos.json").then(r => r.json()),
      fetch(BASE + "timestamp").then(r => r.text()).catch(() => ""),
    ]);
    resultados = resJSON;
    candidatos = candsJSON;
    candActual = candidatos[0]?.nombre ?? "";

    poblarStats(tsRaw);
    poblarSelect();
    crearMapa();
    setupUI();
    setupKDE();
    document.querySelector("#loader").classList.add("hidden");
  } catch(e) {
    document.querySelector(".loader-txt").textContent = "Error al cargar datos. Intente de nuevo.";
    console.error(e);
  }
}

// ── Estadísticas ───────────────────────────────────────────────────────────
function poblarStats(tsRaw) {
  const vals = Object.values(resultados);
  const totalHab = vals.reduce((s,v) => s + (v.habilitados||0), 0);
  const maxH     = Math.max(...vals.map(v=>v.habilitados||0));
  const minH     = Math.min(...vals.filter(v=>v.habilitados>0).map(v=>v.habilitados));

  document.querySelector("#st-rec").textContent = vals.length;
  document.querySelector("#st-hab").textContent = (totalHab/1000).toFixed(0) + "k";
  document.querySelector("#st-can").textContent = candidatos.length;
  document.querySelector("#p-rec").textContent  = fmtN(vals.length);
  document.querySelector("#p-hab").textContent  = fmtN(totalHab);
  document.querySelector("#p-max").textContent  = fmtN(maxH);
  document.querySelector("#p-min").textContent  = fmtN(minH);
  document.querySelector("#p-cands").textContent = candidatos.length;

  const ts = tsRaw?.trim();
  if (ts) {
    const [fecha, hora] = ts.split(" ");
    if (fecha && hora) {
      const [y,m,d] = fecha.split("-");
      document.querySelector("#header-ts").textContent = `${d}/${m}/${y} · ${hora.slice(0,5)}`;
    }
  }
}

// ── Selector candidato ─────────────────────────────────────────────────────
function poblarSelect() {
  const sel = document.querySelector("#sel-cand");
  candidatos.forEach(c => {
    const o = document.createElement("option");
    o.value = o.textContent = c.nombre;
    sel.appendChild(o);
  });
}

// ── GeoJSON ────────────────────────────────────────────────────────────────
function crearGeoJSON() {
  return {
    type: "FeatureCollection",
    features: Object.entries(resultados).map(([codigo, v]) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [+v.x, +v.y] },
      properties: {
        codigo,
        recinto:        v.recinto,
        habilitados:    v.habilitados || 0,
        validos:        v.validos,
        blancos:        v.blancos,
        nulos:          v.nulos,
        invalido:       v.validos != null ? +(1 - v.validos).toFixed(4) : null,
        ganador:        v.ganador,
        partido_ganador:v.partido_ganador,
        valor_candidato:v.candidatos?.[candActual] ?? 0,
        candidatos_json:JSON.stringify(v.candidatos ?? {}),
      }
    })).filter(f => isFinite(f.geometry.coordinates[0]) && isFinite(f.geometry.coordinates[1]))
  };
}

// ── Color expresión MapLibre ────────────────────────────────────────────────
function colorExpr() {
  if (modo === "ganador") {
    const cases = [];
    Object.entries(COLORES).forEach(([p,c]) => cases.push(p, c));
    return ["match", ["get","partido_ganador"], ...cases, COLOR_DEF];
  }
  if (modo === "invalido") {
    return ["interpolate",["linear"],["coalesce",["to-number",["get","invalido"]],0.05],0.03,"#e8f5e9",0.2,"#66bb6a",0.4,"#1b5e20"];
  }
  // candidato
  const c = color(candActual);
  const pct = candidatos.find(x=>x.nombre===candActual)?.porcentaje_total ?? 0.3;
  const max = Math.min(Math.max(pct * 2.2, 0.25), 0.95);
  return ["interpolate",["linear"],["coalesce",["to-number",["get","valor_candidato"]],0],0,"#f5f5f5",max/2,c+"99",max,c];
}

function opacidadExpr() {
  if (modo !== "ganador") return 0.78;
  return ["interpolate",["linear"],["coalesce",["to-number",["get","ganador"]],0.3],0.2,0.5,0.5,0.8,0.9,1.0];
}

const radioExpr = ["interpolate",["linear"],["zoom"],10,["min",5,["max",2,["*",0.005,["to-number",["get","habilitados"]]]]],13,["min",11,["max",4,["*",0.011,["to-number",["get","habilitados"]]]]],16,["min",24,["max",6,["*",0.032,["to-number",["get","habilitados"]]]]]];
const radioHover = ["interpolate",["linear"],["zoom"],10,["min",7,["max",3,["*",0.007,["to-number",["get","habilitados"]]]]],13,["min",14,["max",6,["*",0.014,["to-number",["get","habilitados"]]]]],16,["min",30,["max",8,["*",0.040,["to-number",["get","habilitados"]]]]]];

// ── Mapa ───────────────────────────────────────────────────────────────────
function crearMapa() {
  const stored = (() => { try { return JSON.parse(localStorage.getItem("lp26_map")); } catch{} return null; })();
  const center = stored?.center ?? [-68.15, -16.5];
  const zoom   = stored?.zoom   ?? 12;

  map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
    center, zoom,
    minZoom: 10, maxZoom: 18,
    attributionControl: false,
  });

  map.addControl(new maplibregl.NavigationControl(), "bottom-right");
  map.addControl(new maplibregl.GeolocateControl({ positionOptions:{enableHighAccuracy:true}, trackUserLocation:false }), "bottom-right");

  map.on("moveend", () => {
    const c = map.getCenter();
    localStorage.setItem("lp26_map", JSON.stringify({center:[c.lng,c.lat], zoom:map.getZoom()}));
  });

  popup = new maplibregl.Popup({ closeButton:true, closeOnClick:false, maxWidth:"none" });

  map.on("load", () => {
    map.addSource("recintos", { type:"geojson", data: crearGeoJSON() });
    map.addLayer({ id:"recintos", type:"circle", source:"recintos", paint:{
      "circle-radius": radioExpr,
      "circle-color":  colorExpr(),
      "circle-opacity": opacidadExpr(),
      "circle-stroke-width": 0.8,
      "circle-stroke-color": "rgba(255,255,255,0.3)",
    }});
    map.addSource("etiquetas", { type:"raster", tiles:["https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png"], tileSize:256 });
    map.addLayer({ id:"etiquetas", type:"raster", source:"etiquetas", paint:{"raster-opacity":0.85} });
    map.addLayer({ id:"hover", type:"circle", source:"recintos", paint:{ "circle-color":"rgba(0,0,0,0)", "circle-radius":radioHover }});

    // Inicializar KDE overlay
    kdeInit(map);
    kdeSetDatos(resultados, modo, candActual);

    actualizarLeyenda();
    setupPopup();
  });
}

function actualizarMapa() {
  if (!map.getSource("recintos")) return;
  const geo = crearGeoJSON();
  map.getSource("recintos").setData(geo);
  map.setPaintProperty("recintos", "circle-color",   colorExpr());
  map.setPaintProperty("recintos", "circle-opacity",  opacidadExpr());
  kdeSetDatos(resultados, modo, candActual);
  actualizarLeyenda();
}

// ── Leyenda ────────────────────────────────────────────────────────────────
function actualizarLeyenda() {
  const titulo = modo === "ganador" ? "Partido ganador por recinto"
    : modo === "invalido"           ? "Votos blancos / nulos"
    : `% votos · ${candActual}`;

  document.querySelector("#leg-titulo").textContent = titulo;
  document.querySelector("#lp-sub").textContent     = titulo;
  renderLeyenda("leg-panel");
  renderLeyenda("lp-content");
}

function renderLeyenda(id) {
  const el = document.querySelector("#" + id);
  if (!el) return;

  if (modo === "ganador") {
    const items = candidatos
      .filter(c => c.porcentaje_total > 0.003)
      .sort((a,b) => b.porcentaje_total - a.porcentaje_total)
      .map(c => `
        <div class="leg-item">
          <span class="leg-dot" style="background:${color(c.nombre)}"></span>
          <span class="leg-nom">${c.nombre}</span>
          <span class="leg-pct">${fmt(c.porcentaje_total)}</span>
        </div>`).join("");
    el.innerHTML = `<div class="leg-lista">${items}</div>`;
  } else {
    const colores = modo === "invalido"
      ? ["#e8f5e9","#66bb6a","#1b5e20"]
      : ["#f5f5f5", color(candActual)+"99", color(candActual)];
    const labels = modo === "invalido" ? ["3%","20%","40%"] : ["0%","—","máx"];
    el.innerHTML = `
      <div class="grad-bar" style="background:linear-gradient(to right,${colores.join(",")})"></div>
      <div class="grad-lbls">${labels.map(l=>`<span class="grad-lbl">${l}</span>`).join("")}</div>`;
  }
}

// ── Popup ──────────────────────────────────────────────────────────────────
function fotoSrc(partido) {
  const ext = FOTOS_EXT[partido] ?? "jpg";
  return `${FOTOS}${partido}.${ext}`;
}

function fotoEl(partido, size) {
  const c = color(partido);
  const inicial = (partido ?? "?")[0];
  const id = "ph_" + partido.replace(/[^a-z0-9]/gi,"_") + "_" + size;
  return `
    <div id="${id}" style="width:${size}px;height:${size}px;border-radius:50%;
      background:${c}25;border:2px solid ${c};display:flex;align-items:center;justify-content:center;
      font:700 ${Math.round(size*.42)}px Outfit,sans-serif;color:${c};flex-shrink:0">${inicial}</div>
    <img src="${fotoSrc(partido)}" style="display:none;width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid ${c};flex-shrink:0"
      onerror="this.style.display='none'"
      onload="this.style.display='block';var ph=document.getElementById('${id}');if(ph)ph.style.display='none'">`;
}

function analisisHTML(lista, invalido) {
  if (!lista.length) return "";
  const [g0,p0] = lista[0];
  const [,p1]   = lista[1] ?? ["",0];
  const margen  = p0 - p1;
  const nCands  = lista.filter(([,v])=>v>0.02).length;
  const [icono,texto] = margen < 0.04 ? ["⚡","Resultado muy reñido — margen menor al 4%"]
    : margen < 0.12 ? ["📊",`Resultado competitivo — margen ${fmt(margen)}`]
    : margen < 0.25 ? ["📌",`Victoria clara de ${g0} con ${fmt(p0)}`]
    : ["🏛",`Bastión de ${g0} — domina con ${fmt(p0)}`];
  const invalTxt = invalido > 0.25 ? `⚠️ Alto rechazo: ${fmt(invalido)} blancos/nulos`
    : invalido > 0.12 ? `📋 Rechazo moderado: ${fmt(invalido)} blancos/nulos` : null;
  return `
    <div class="pp-analisis">
      <div class="pp-arow"><span>${icono}</span>${texto}</div>
      <div class="pp-arow"><span>👥</span>${nCands} candidatos con más del 2%</div>
      ${invalTxt ? `<div class="pp-arow">${invalTxt}</div>` : ""}
    </div>`;
}

function popupHTML(props) {
  const cands = JSON.parse(props.candidatos_json ?? "{}");
  const lista = Object.entries(cands).sort(([,a],[,b])=>b-a).filter(([,v])=>v>0);
  const gan   = props.partido_ganador ?? "—";
  const cg    = color(gan);

  const barras = lista.map(([nom,pct]) => {
    const c  = color(nom);
    const eG = nom === gan;
    const eS = nom === candActual;
    return `<div class="cand${eG?" winner":""}">
      <div class="cand-row">
        ${fotoEl(nom, 20)}
        <span class="cand-nom">${nom}</span>
        <span class="cand-pct" style="color:${c}">${fmt(pct)}</span>
      </div>
      <div class="cand-bg"><div class="cand-bar" style="width:${(pct*100).toFixed(1)}%;background:${c}${eG||eS?"":"88"}"></div></div>
    </div>`;
  }).join("");

  return `<div class="pp">
    <div class="pp-head">
      <div class="pp-winner-row">
        ${fotoEl(gan, 38)}
        <div class="pp-info">
          <div class="pp-title">${props.recinto ?? "Recinto sin nombre"}</div>
          <div class="pp-badge" style="background:${cg}18;color:${cg};border-color:${cg}44">${gan} · ${fmt(props.ganador)}</div>
        </div>
      </div>
    </div>
    <div class="pp-stats">
      <div class="pp-stat"><span class="pp-sv">${fmtN(props.habilitados)}</span><span class="pp-sl">Habilitados</span></div>
      <div class="pp-stat"><span class="pp-sv">${fmt(props.validos)}</span><span class="pp-sl">Válidos</span></div>
      <div class="pp-stat"><span class="pp-sv">${fmt(props.blancos)}</span><span class="pp-sl">Blancos</span></div>
      <div class="pp-stat"><span class="pp-sv">${fmt(props.nulos)}</span><span class="pp-sl">Nulos</span></div>
    </div>
    ${analisisHTML(lista, props.invalido ?? 0)}
    <div class="pp-lista">${barras}</div>
    <div class="pp-foot">Municipio de La Paz · Elecciones 2026</div>
  </div>`;
}

function setupPopup() {
  let locked = false;
  map.on("mouseenter","hover", e => {
    map.getCanvas().style.cursor = "pointer";
    const f = e.features?.[0];
    if (f) popup.setLngLat(f.geometry.coordinates).setHTML(popupHTML(f.properties)).addTo(map);
  });
  map.on("mouseleave","hover", () => {
    map.getCanvas().style.cursor = "";
    if (!locked) popup.remove();
  });
  map.on("click","hover", () => { locked = true; });
  map.on("click", e => {
    if (!map.queryRenderedFeatures(e.point,{layers:["hover"]}).length) {
      locked = false; popup.remove();
    }
  });
}

// ── KDE estado ─────────────────────────────────────────────────────────────
let kdePaletaActual = "Fuego";
let kdePartidoActual = "";

function setupKDE() {
  // Poblar selector de partido KDE
  const sel = document.querySelector("#sel-kde-partido");
  candidatos.forEach(c => {
    const o = document.createElement("option");
    o.value = o.textContent = c.nombre;
    sel.appendChild(o);
  });
  kdePartidoActual = candidatos[0]?.nombre ?? "";

  // Poblar grid de paletas
  const grid = document.querySelector("#kde-palette-grid");
  KDE_PALETTE_NAMES.forEach(nombre => {
    const stops = KDE_PALETTES[nombre];
    const cols  = stops.map(s => `rgba(${s[0]},${s[1]},${s[2]},${s[3]/255})`).join(",");
    const btn   = document.createElement("button");
    btn.className = "kde-pal-btn" + (nombre === "Fuego" ? " active" : "");
    btn.title     = nombre;
    btn.dataset.paleta = nombre;
    btn.innerHTML = `<span class="kde-pal-strip" style="background:linear-gradient(to right,${cols})"></span><span class="kde-pal-name">${nombre}</span>`;
    btn.addEventListener("click", () => {
      document.querySelectorAll(".kde-pal-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      kdePaletaActual = nombre;
      kdeSetPaleta(nombre);
    });
    grid.appendChild(btn);
  });

  // Color del partido activo
  actualizarKdePartidoColor();
}

function actualizarKdePartidoColor() {
  const el = document.querySelector("#kde-partido-color");
  if (!el) return;
  const c = color(kdePartidoActual);
  el.style.cssText = `height:3px;border-radius:2px;margin-top:6px;background:linear-gradient(to right,${c}22,${c});`;
}

function aplicarKDE() {
  kdeSetDatos(resultados, kdePartidoActual, "partido");
  actualizarKdePartidoColor();
}

// ── UI eventos ─────────────────────────────────────────────────────────────
function setupUI() {
  // Panel toggle
  const panel = document.querySelector("#panel");
  const fab   = document.querySelector("#panelFab");
  [document.querySelector("#btnPanel"), fab].forEach(b => b?.addEventListener("click", () => {
    panel.classList.toggle("collapsed");
    fab.classList.toggle("open");
    fab.classList.toggle("closed");
  }));

  // Leyenda toggle
  document.querySelector("#legendBtn")?.addEventListener("click", () => {
    document.querySelector("#legendPanel").classList.toggle("open");
    document.querySelector("#legendBtn").classList.toggle("active");
  });

  // Pestañas Mapa / KDE
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.querySelector("#tab-mapa").style.display = tab === "mapa" ? "" : "none";
      document.querySelector("#tab-kde").style.display  = tab === "kde"  ? "" : "none";
      document.querySelector("#legendFab").style.display = tab === "mapa" ? "" : "none";
      if (tab === "kde") {
        kdeToggle(true);
        aplicarKDE();
      } else {
        kdeToggle(false);
      }
    });
  });

  // Botones modo
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      modo = btn.dataset.modo;
      const s = document.querySelector("#sect-cand");
      if (s) s.style.display = modo === "candidato" ? "" : "none";
      if (map.getSource("recintos")) actualizarMapa();
    });
  });

  // Selector candidato (mapa)
  document.querySelector("#sel-cand")?.addEventListener("change", e => {
    candActual = e.target.value;
    if (map.getSource("recintos")) actualizarMapa();
  });

  // Selector partido KDE
  document.querySelector("#sel-kde-partido")?.addEventListener("change", e => {
    kdePartidoActual = e.target.value;
    aplicarKDE();
  });

  // KDE radio
  document.querySelector("#kde-radio")?.addEventListener("input", e => {
    const v = +e.target.value;
    document.querySelector("#kde-radio-val").textContent = v + " m";
    kdeSetRadio(v);
  });

  // KDE opacidad
  document.querySelector("#kde-opac")?.addEventListener("input", e => {
    const v = +e.target.value;
    document.querySelector("#kde-opac-val").textContent = v + "%";
    kdeSetOpacidad(v / 100);
  });
}

// ── Arrancar ───────────────────────────────────────────────────────────────
init();
