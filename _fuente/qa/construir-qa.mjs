// Paquete de PRUEBA de las escenas 3D: mismo formato que construir.mjs pero
// escrito en qa/, para revisarlas en el banco sin tocar ../js/escena3d.js.
// Uso (desde _fuente):  node qa/construir-qa.mjs
import * as esbuild from "esbuild";
await esbuild.build({
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "iife",
  globalName: "Coherencia3D",
  footer: { js: "window.Coherencia3D = Coherencia3D.default || Coherencia3D;" },
  outfile: "qa/escena3d-qa.js",
  target: ["es2020"],
  minify: false,
  logLevel: "error",
});
console.log("Paquete de prueba: qa/escena3d-qa.js");
