// Recorrido de lector: abre una página, baja con la rueda como una persona,
// espera a que terminen las animaciones de «impresión» y fotografía cada
// pantalla a tamaño real. Además mide, en cada posición, la franja de
// pantalla completamente vacía más alta contando SOLO lo que se ve de verdad
// (sin forzar ninguna clase: así fue como se escapó el fallo de las figuras
// invisibles).
//
// Uso (desde _fuente/qa):
//   node recorrido.mjs index.html 2000x1030 salida/portada
//   node recorrido.mjs html/hardware.html 1440x900 salida/hardware 0.8
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire("C:/Claude Ideas/upscaling/package.json");
const { chromium } = require("playwright");

const [pagina = "index.html", tam = "1440x900", salida = "salida/recorrido", pasoRel = "0.85"] = process.argv.slice(2);
const [ancho, alto] = tam.split("x").map(Number);
fs.mkdirSync(salida, { recursive: true });

const RAIZ = process.env.RAIZ || "file:///C:/Claude%20Ideas/Brito-Gaitan/";
const navegador = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await navegador.newContext({
  viewport: { width: ancho, height: alto },
  deviceScaleFactor: 1,
  isMobile: ancho < 700,
  hasTouch: ancho < 700,
});
const hoja = await ctx.newPage();
const errores = [];
hoja.on("pageerror", (e) => errores.push("pageerror: " + e.message));
hoja.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text()); });

await hoja.goto(RAIZ + pagina, { waitUntil: "load" });
await hoja.waitForTimeout(1500);

// Mide la franja vacía más alta en la ventana actual, contando solo lo visible
const mide = () => hoja.evaluate(() => {
  const W = innerWidth, H = innerHeight;
  const cab = document.querySelector(".cabecera")?.getBoundingClientRect().height || 0;
  const tieneTexto = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
  const hojas = [...document.querySelectorAll("main *, footer *")].filter((e) =>
    !e.children.length || tieneTexto(e) || e.matches("img,canvas,svg,video,audio,input,select,textarea,table,.escena,.barra,hr"));
  const visible = (e) => {
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) return false;
      const cp = cs.clipPath;
      if (cp && cp.startsWith("inset(")) {
        const m = cp.match(/inset\(([^)]*)\)/)[1].split(/\s+/).map((v) => parseFloat(v));
        const der = m.length > 1 ? m[1] : m[0];
        if (der > 90) return false;          // recortado casi entero
      }
    }
    return true;
  };
  const tramos = [];
  const ocultosEnPantalla = [];
  for (const e of hojas) {
    const q = e.getBoundingClientRect();
    if (q.bottom < cab || q.top > H || q.width < 2 || q.height < 2) continue;
    if (!visible(e)) { ocultosEnPantalla.push(e.tagName.toLowerCase() + "." + (e.className || "").toString().split(" ")[0]); continue; }
    tramos.push([Math.max(q.top, cab), Math.min(q.bottom, H)]);
  }
  // Rectángulo vacío mayor en 2D (celdas de 24 px): una franja horizontal
  // no ve el hueco que deja un pie de figura estrujado en una columna.
  const G = 24, C = Math.ceil(W / G), F = Math.ceil((H - cab) / G);
  const lleno = Array.from({ length: F }, () => new Uint8Array(C));
  const estrechos = [];
  for (const e of hojas) {
    const q = e.getBoundingClientRect();
    if (q.bottom < cab || q.top > H || q.width < 2 || q.height < 2 || !visible(e)) continue;
    const f0 = Math.max(0, Math.floor((q.top - cab) / G)), f1 = Math.min(F - 1, Math.floor((q.bottom - cab) / G));
    const c0 = Math.max(0, Math.floor(q.left / G)), c1 = Math.min(C - 1, Math.floor(q.right / G));
    for (let f = f0; f <= f1; f++) for (let c = c0; c <= c1; c++) lleno[f][c] = 1;
    if (W >= 1000 && q.width < 200 && q.height > 160 && e.textContent.trim().length > 80)
      estrechos.push(e.tagName.toLowerCase() + "." + (e.className || "").toString().split(" ")[0] + " " + Math.round(q.width) + "x" + Math.round(q.height));
  }
  const alturas = new Array(C).fill(0);
  let mayor = { area: 0 };
  for (let f = 0; f < F; f++) {
    for (let c = 0; c < C; c++) alturas[c] = lleno[f][c] ? 0 : alturas[c] + 1;
    const pila = [];
    for (let c = 0; c <= C; c++) {
      const h = c < C ? alturas[c] : 0;
      while (pila.length && alturas[pila[pila.length - 1]] >= h) {
        const alt = alturas[pila.pop()];
        const izq = pila.length ? pila[pila.length - 1] + 1 : 0;
        const area = alt * (c - izq);
        if (area > mayor.area) mayor = { area, x: izq * G, y: Math.round(cab + (f - alt + 1) * G), w: (c - izq) * G, h: alt * G };
      }
      pila.push(c);
    }
  }
  const vacio = { x: mayor.x, y: mayor.y, w: mayor.w, h: mayor.h, frac: +(mayor.area / (C * F)).toFixed(2) };
  tramos.sort((a, b) => a[0] - b[0]);
  let fin = cab, hueco = 0, desde = cab;
  for (const [a, b] of tramos) { if (a - fin > hueco) { hueco = a - fin; desde = fin; } if (b > fin) fin = b; }
  if (H - fin > hueco) { hueco = H - fin; desde = fin; }
  return { y: Math.round(scrollY), hueco: Math.round(hueco), desde: Math.round(desde), util: Math.round(H - cab), vacio, estrechos: estrechos.slice(0, 4), ocultos: ocultosEnPantalla.slice(0, 4) };
});

const informe = [];
const total = await hoja.evaluate(() => document.documentElement.scrollHeight);
let n = 0;
while (true) {
  await hoja.waitForTimeout(750);                  // animaciones de 420 ms + margen
  const m = await mide();
  const nombre = path.join(salida, String(n).padStart(2, "0") + ".png");
  await hoja.screenshot({ path: nombre });
  informe.push({ ...m, captura: nombre });
  n++;
  const antes = await hoja.evaluate(() => scrollY);
  // Rueda del ratón, en varios golpes, como una persona
  const recorrido = Math.round(alto * parseFloat(pasoRel));
  for (let i = 0; i < 4; i++) { await hoja.mouse.wheel(0, recorrido / 4); await hoja.waitForTimeout(60); }
  const despues = await hoja.evaluate(() => scrollY);
  if (despues <= antes + 2 || n > 60) break;
}

const sinImprimir = await hoja.evaluate(() =>
  [...document.querySelectorAll(".imprime,.lineas")].filter((e) => !e.classList.contains("impresa"))
    .map((e) => e.tagName.toLowerCase() + "." + e.className.split(" ")[0] + " #" + (e.closest("section")?.id || "?")));

const resumen = {
  pagina, ventana: tam, altoPagina: total, pantallas: n,
  sinImprimirAlFinal: sinImprimir,
  huecosGrandes: informe.filter((r) => r.hueco > 0.4 * r.util).map((r) => ({ captura: r.captura, y: r.y, hueco: r.hueco, desde: r.desde, ocultos: r.ocultos })),
  vaciosGrandes: informe.filter((r) => r.vacio.frac > 0.3).map((r) => ({ captura: r.captura, y: r.y, vacio: r.vacio })),
  textoEstrujado: [...new Set(informe.flatMap((r) => r.estrechos))],
  errores,
};
fs.writeFileSync(path.join(salida, "informe.json"), JSON.stringify({ resumen, posiciones: informe }, null, 2));
console.log(JSON.stringify(resumen, null, 2));
await navegador.close();
