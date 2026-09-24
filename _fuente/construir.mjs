// Compila las escenas 3D a un único archivo clásico (IIFE) para que el sitio
// funcione incluso abriendo los .html directamente desde el disco.
import * as esbuild from "esbuild";

const resultado = await esbuild.build({
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "iife",
  globalName: "Coherencia3D",
  footer: { js: "window.Coherencia3D = Coherencia3D.default || Coherencia3D;" },
  outfile: "../js/escena3d.js",
  target: ["es2020"],
  minify: true,
  legalComments: "none",
  metafile: true,
  banner: {
    js: "/* Coherencia · escenas 3D (three.js r181 + código propio). Fuente legible en _fuente/src/ */",
  },
});

const salida = Object.entries(resultado.metafile.outputs)[0];
console.log("Generado", salida[0], (salida[1].bytes / 1024).toFixed(0) + " KB");
