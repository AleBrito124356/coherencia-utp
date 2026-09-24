// Caracteres por línea de la prosa y ancho de la página a varios tamaños.
import { createRequire } from "node:module";
const require = createRequire("C:/Claude Ideas/upscaling/package.json");
const { chromium } = require("playwright");
const nav = await chromium.launch();
for (const [w, h] of [[1100, 800], [1440, 900], [2000, 1030], [2560, 1300]]) {
  const hoja = await nav.newPage({ viewport: { width: w, height: h } });
  await hoja.goto("file:///C:/Claude%20Ideas/Brito-Gaitan/html/hardware.html", { waitUntil: "load" });
  const r = await hoja.evaluate(() => {
    const ps = [...document.querySelectorAll(".columna > p:not(.rotulo):not(.entradilla)")].filter((p) => p.textContent.length > 400).slice(0, 6);
    const cpl = ps.map((p) => {
      const lineas = Math.round(p.getBoundingClientRect().height / parseFloat(getComputedStyle(p).lineHeight));
      return p.textContent.replace(/\s+/g, " ").trim().length / lineas;
    });
    const pl = document.querySelector("main .pliego").getBoundingClientRect();
    const fs = getComputedStyle(ps[0]).fontSize;
    return { cpl: Math.round(cpl.reduce((a, b) => a + b, 0) / cpl.length), pWidth: Math.round(ps[0].getBoundingClientRect().width), pliego: [Math.round(pl.left), Math.round(pl.width)], fs, raiz: getComputedStyle(document.documentElement).fontSize };
  });
  console.log(w, JSON.stringify(r));
  await hoja.close();
}
await nav.close();
