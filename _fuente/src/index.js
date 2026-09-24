/* ==========================================================================
   index.js — Punto de entrada del paquete 3D
   Proyecto Coherencia · Ingeniería Web · UTP

   Se compila con esbuild a ../../js/escena3d.js en formato IIFE, de manera que
   el sitio funciona también abriendo los archivos directamente desde el disco
   (sin servidor), que es como se va a revisar el proyecto.

   Uso en el HTML:
     <div class="escena" data-escena="bloch"></div>
   y desde JavaScript:  Coherencia3D.instancia("bloch")
   ========================================================================== */
import { EscenaBase, colorDeCSS, etiquetaSprite, amortigua, menosMovimiento } from "./base.js";
import { EsferaBloch } from "./bloch.js";
import { Criostato, ETAPAS } from "./criostato.js";
import { CadenaIones } from "./iones.js";
import { Interferencia } from "./interferencia.js";

const TIPOS = {
  bloch: EsferaBloch,
  criostato: Criostato,
  iones: CadenaIones,
  interferencia: Interferencia,
};

const instancias = new Map();

/** ¿Este navegador puede dibujar WebGL? */
function hayWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl"))
    );
  } catch (_) {
    return false;
  }
}

/** Crea una escena sobre un contenedor concreto. */
function crea(contenedor, tipo, opciones = {}) {
  const Clase = TIPOS[tipo];
  if (!Clase) throw new Error("Escena desconocida: " + tipo);
  if (!hayWebGL()) {
    contenedor.classList.add("sin-webgl");
    return null;
  }
  try {
    const escena = new Clase(contenedor, opciones).monta();
    instancias.set(tipo, escena);
    contenedor.classList.add("escena-lista");
    return escena;
  } catch (error) {
    console.error("No se pudo crear la escena 3D «" + tipo + "»:", error);
    contenedor.classList.add("sin-webgl");
    return null;
  }
}

/** Inicializa todas las escenas declaradas con data-escena en la página. */
function iniciaAutomatico() {
  const contenedores = document.querySelectorAll("[data-escena]");
  contenedores.forEach((contenedor) => {
    const tipo = contenedor.dataset.escena;
    let opciones = {};
    if (contenedor.dataset.opciones) {
      try {
        opciones = JSON.parse(contenedor.dataset.opciones);
      } catch (_) {
        opciones = {};
      }
    }
    crea(contenedor, tipo, opciones);
  });
  listo = true;
  document.dispatchEvent(new CustomEvent("coherencia3d:listo", { detail: { instancias } }));
}

// Quien llegue tarde al aviso (un script que cargue después) puede preguntar
// por esta bandera en vez de esperar un evento que ya pasó.
let listo = false;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciaAutomatico);
} else {
  // Si el documento ya está analizado, se espera un turno: así el pie del
  // paquete alcanza a publicar window.Coherencia3D antes de que nadie reciba
  // el aviso y vaya a buscarlo.
  setTimeout(iniciaAutomatico, 0);
}

export default {
  get listo() { return listo; },
  crea,
  instancia: (tipo) => instancias.get(tipo) || null,
  instancias,
  hayWebGL,
  menosMovimiento,
  ETAPAS,
  EscenaBase,
  EsferaBloch,
  Criostato,
  CadenaIones,
  Interferencia,
  colorDeCSS,
  etiquetaSprite,
  amortigua,
};
