/* ==========================================================================
   montar-capitulos.mjs — Envuelve el contenido de cada capítulo interior
   con la cabecera, el pie y los scripts que comparten todas las páginas.

   Uso:  node montar-capitulos.mjs capitulos.json
   donde capitulos.json es [{clave, html}, ...]
   ========================================================================== */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

const PAGINAS = {
  fundamentos: {
    titulo: "Fundamentos",
    descripcion:
      "Qué es un cúbit de verdad, por qué la fase importa más que la superposición, cómo se lee la esfera de Bloch y qué significa medir. Con la doble rendija funcionando en la página.",
    escenas: true,
  },
  hardware: {
    titulo: "La máquina",
    descripcion:
      "Cómo se construye una computadora cuántica: el refrigerador de dilución etapa por etapa, las seis modalidades de hardware y el estado real de la corrección de errores.",
    escenas: true,
  },
  aplicaciones: {
    titulo: "Aplicaciones",
    descripcion:
      "Qué acelera de verdad un algoritmo cuántico, qué aplicaciones están demostradas y cuáles son proyección, la criptografía poscuántica del NIST y cómo empezar desde Panamá.",
    escenas: false,
  },
};

const MENU = [
  ["../index.html", "Portada", "portada"],
  ["fundamentos.html", "Fundamentos", "fundamentos"],
  ["hardware.html", "La máquina", "hardware"],
  ["laboratorio.html", "Laboratorio", "laboratorio"],
  ["aplicaciones.html", "Aplicaciones", "aplicaciones"],
  ["acerca-de.html", "Acerca de", "acerca"],
  ["contacto.html", "Contacto", "contacto"],
];

const MARCA = `      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle cx="50" cy="50" r="26" fill="none" stroke="currentColor" stroke-width="3"/>
        <path d="M50 8V34M50 66V92M8 50H34M66 50H92" stroke="currentColor" stroke-width="3"/>
        <circle class="marca__punto marca__punto--tinta" cx="44" cy="50" r="9" fill="currentColor"/>
        <circle class="marca__punto marca__punto--rojo" cx="56" cy="50" r="9" fill="#be3a26" style="mix-blend-mode:multiply"/>
      </svg>`;

const REDES = `      <div class="redes" style="margin-top:1.2rem">
        <a href="https://github.com/AleBrito124356" rel="noopener" aria-label="GitHub del proyecto">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2.9-.3 1.9-.4 2.9-.4s2 .1 2.9.4C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.9 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
        </a>
        <a href="https://www.linkedin.com/" rel="noopener" aria-label="LinkedIn">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5C4.98 4.9 3.9 6 2.5 6S0 4.9 0 3.5 1.1 1 2.5 1 4.98 2.1 4.98 3.5zM.2 8h4.6v15H.2V8zm7.4 0h4.4v2.1h.1c.6-1.1 2-2.3 4.2-2.3 4.5 0 5.3 2.9 5.3 6.7V23h-4.6v-7.5c0-1.8 0-4.1-2.5-4.1s-2.9 1.9-2.9 4V23H7.6V8z"/></svg>
        </a>
        <a href="https://www.instagram.com/" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 5.3A4.5 4.5 0 1 0 16.5 12 4.5 4.5 0 0 0 12 7.5zm0 7.4A2.9 2.9 0 1 1 14.9 12 2.9 2.9 0 0 1 12 14.9zm5.7-7.6a1.05 1.05 0 1 1-1.05-1.05A1.05 1.05 0 0 1 17.7 7.3z"/></svg>
        </a>
      </div>`;

function plantilla(clave, cuerpo) {
  const p = PAGINAS[clave];
  const navegacion = MENU.map(
    ([href, texto, id]) =>
      `      <a href="${href}"${id === clave ? ' aria-current="page"' : ""}>${texto}</a>`
  ).join("\n");
  const pie = MENU.slice(1).map(
    ([href, texto]) => `        <li><a href="${href}">${texto}</a></li>`
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${p.titulo} — Coherencia</title>
<meta name="description" content="${p.descripcion}">
<meta name="author" content="Alejandro Brito Olivera y Marcos Gaitán">
<meta name="theme-color" content="#f2efe6">
<link rel="icon" href="../img/marca.svg" type="image/svg+xml">
<link rel="stylesheet" href="../css/estilo.css">
</head>
<body data-pagina="${clave}">

<a class="saltar" href="#contenido">Saltar al contenido</a>

<header class="cabecera">
  <div class="cabecera__interior">
    <a class="marca" href="../index.html" aria-label="Coherencia, portada">
${MARCA}
      <span>
        <span class="marca__nombre">Coherencia</span>
        <span class="marca__pie">Revista de computación cuántica · UTP · N.º 01</span>
      </span>
    </a>
    <button class="menu-boton" type="button" aria-expanded="false" aria-controls="navegacion" aria-label="Abrir el índice"><span></span></button>
    <nav class="navegacion" id="navegacion" aria-label="Índice de la revista">
${navegacion}
    </nav>
  </div>
</header>

<main id="contenido">
${cuerpo}
</main>

<footer class="pie">
  <div class="pliego">
    <div class="tercio">
      <a class="marca" href="../index.html">
${MARCA}
        <span><span class="marca__nombre">Coherencia</span></span>
      </a>
      <p class="suave" style="margin-top:1rem;font-size:.92rem">
        Revista universitaria de divulgación sobre computación cuántica.
        Facultad de Ingeniería de Sistemas Computacionales, Universidad Tecnológica de Panamá.
      </p>
${REDES}
    </div>

    <nav class="tercio" aria-label="Índice del pie">
      <h4>Capítulos</h4>
      <ul>
${pie}
      </ul>
    </nav>

    <div class="tercio">
      <h4>Para seguir leyendo</h4>
      <ul>
        <li><a href="https://quantum.cloud.ibm.com/docs" rel="noopener">Documentación de IBM Quantum</a> — cursos y acceso real a procesadores.</li>
        <li><a href="https://csrc.nist.gov/projects/post-quantum-cryptography" rel="noopener">NIST · Criptografía poscuántica</a> — los estándares de 2024.</li>
      </ul>
      <h4 style="margin-top:1.6rem">Redacción</h4>
      <address>
        Campus Dr. Víctor Levi Sasso<br>
        Ciudad de Panamá<br>
        <a href="mailto:coherencia@utp.ac.pa">coherencia@utp.ac.pa</a>
      </address>
    </div>

    <div class="pie__creditos">
      <span>© 2026 Coherencia · Alejandro Brito Olivera y Marcos Gaitán</span>
      <span>Parcial N.º 1 · Ingeniería Web · Dra. Denis Cedeño · Grupo 1SF134</span>
      <span>Publicación estudiantil sin vínculo oficial con la UTP</span>
    </div>
  </div>
</footer>

<div class="mandos-fijos">
  <button class="mando" type="button" data-audio aria-pressed="false">Sonido: no</button>
  <button class="mando" type="button" data-bajo-consumo aria-pressed="false">Bajo consumo: no</button>
</div>

${p.escenas ? '<script src="../js/cuantica.js"></script>\n<script src="../js/escena3d.js"></script>\n' : ""}<script src="../js/sitio.js" defer></script>
${p.escenas ? '<script src="../js/piezas.js" defer></script>\n' : ""}</body>
</html>
`;
}

/** Limpieza defensiva de lo que devuelven los agentes. */
function limpia(html) {
  return html
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/<\/?main[^>]*>/gi, "")
    .trim();
}

const entrada = process.argv[2];
if (!entrada) {
  console.error("Uso: node montar-capitulos.mjs capitulos.json");
  process.exit(2);
}

const capitulos = JSON.parse(readFileSync(entrada, "utf8"));
let n = 0;
for (const cap of capitulos) {
  if (!PAGINAS[cap.clave]) {
    console.warn("Capítulo desconocido, se salta:", cap.clave);
    continue;
  }
  const cuerpo = limpia(cap.html || "");
  if (cuerpo.length < 500) {
    console.warn("Capítulo demasiado corto, se salta:", cap.clave, cuerpo.length);
    continue;
  }
  const destino = join(raiz, "html", cap.clave + ".html");
  writeFileSync(destino, plantilla(cap.clave, cuerpo), "utf8");
  console.log("✓ html/" + cap.clave + ".html  (" + Math.round(cuerpo.length / 1024) + " KB de contenido)");
  n++;
}
console.log(n + " capítulo(s) montados");
