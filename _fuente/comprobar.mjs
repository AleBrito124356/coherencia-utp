// Comprueba que UNA escena compila, sin tocar ../js/escena3d.js.
// Uso (desde _fuente):  node comprobar.mjs src/bloch.js
import * as esbuild from "esbuild";
import os from "node:os";
import path from "node:path";

const entrada = process.argv[2];
if (!entrada) { console.error("Falta la escena: node comprobar.mjs src/bloch.js"); process.exit(2); }
const salida = path.join(os.tmpdir(), "coherencia-comprueba-" + path.basename(entrada) + "-" + process.pid + ".js");
try {
  const r = await esbuild.build({
    entryPoints: [entrada], bundle: true, format: "esm", outfile: salida,
    target: ["es2020"], logLevel: "silent", metafile: true, write: true,
  });
  const kb = Object.values(r.metafile.outputs)[0].bytes / 1024;
  console.log("OK", entrada, "compila (" + kb.toFixed(0) + " KB de paquete de prueba)");
} catch (e) {
  for (const m of e.errors || []) console.error("ERROR", m.location ? m.location.file + ":" + m.location.line + ":" + m.location.column : "", m.text);
  process.exit(1);
}
