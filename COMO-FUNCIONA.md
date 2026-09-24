# Cómo funciona «Coherencia»

Guía rápida del código para quien entra al proyecto por primera vez. No explica
cada línea: dice qué hace cada parte y dónde está.

Sitio publicado: https://coherencia-utp.vercel.app

---

## 1. Qué es

Una revista web sobre computación cuántica hecha con **HTML, CSS y JavaScript
puros**, sin frameworks. Tiene 7 páginas, un vídeo que avanza con el scroll,
cuatro piezas 3D (hechas con Three.js), un pequeño simulador cuántico y un
formulario de contacto.

Para verla en local basta con abrir `index.html` en el navegador. No hace falta
instalar nada.

---

## 2. Mapa de carpetas

```
index.html          Portada
html/               Las otras 6 páginas
css/                Estilos
js/                 Comportamiento (scroll, 3D, simulador, formulario)
img/  video/  audio/  fuentes/    Material multimedia y tipografías
api/guardar.js      Guarda el formulario cuando el sitio está en Vercel
guardar.php         Lo mismo, para un servidor con PHP (WAMP en clase)
datos/              Donde guardar.php escribe los mensajes
diseno/             Documento de «técnica de diseño» (entregable)
_fuente/            Código de origen de las piezas 3D y herramientas de revisión
vercel.json         Configuración del hosting
LEEME.md            Resumen para la rúbrica del parcial
```

---

## 3. Las páginas (HTML)

| Archivo | Contenido |
|---|---|
| `index.html` | Portada: el vídeo del descenso, la introducción, tres cifras y el índice de capítulos |
| `html/fundamentos.html` | Qué es un cúbit, la esfera de Bloch, la doble rendija en 3D |
| `html/hardware.html` | «La máquina»: el criostato 3D, las tecnologías de cúbits, los iones en 3D |
| `html/laboratorio.html` | El simulador: se aplican puertas y se ve girar la esfera de Bloch |
| `html/aplicaciones.html` | Qué se ha demostrado de verdad, criptografía y el panorama en Panamá |
| `html/acerca-de.html` | Autores, fuentes y cómo se hizo el sitio |
| `html/contacto.html` | Formulario de contacto |

Todas comparten la misma estructura: cabecera con menú, `<main>` dividido en
`<section>` y pie de página. Las piezas 3D se colocan con un
`<div class="escena" data-escena="...">`; el JavaScript las encuentra y las monta.

---

## 4. Los estilos (`css/`)

- **`tipografias.css`** carga las tres fuentes (Bodoni Moda, Source Serif 4 e
  IBM Plex Mono) desde la carpeta `fuentes/`.
- **`estilo.css`** es la hoja principal, dividida en bloques numerados:
  - **1. Tokens**: colores, tamaños de letra y espacios como variables CSS
    (`--papel`, `--tinta`, `--cinabrio`...). Si se quiere cambiar un color, se
    cambia aquí.
  - **2. Retícula**: la página es una rejilla de 12 columnas (`.pliego`). El texto
    va en las columnas 2-8 (`.columna`) y las notas al margen en la 10-12 (`.margen`).
  - **3 a 10**: tipografía, menú, héroe con vídeo, figuras, tablas, formulario y pie.
  - **11 y 14**: animaciones. Los bloques aparecen «imprimiéndose» al entrar en
    pantalla y las fotos se mueven un poco con el scroll.
  - **12**: adaptación a móvil (todo pasa a una sola columna) y a impresión.
  - **13 en adelante**: ajustes que salieron de las revisiones visuales. Cada
    uno lleva un comentario con el motivo.

---

## 5. El JavaScript (`js/`)

Cada archivo es independiente y se carga al final de la página.

### `sitio.js` — lo común a todas las páginas
- **Navegacion**: el menú del móvil.
- **Vigia** e **Impresor**: detectan cuándo un bloque entra en pantalla y lo
  muestran con la animación de impresión.
- **Contador**: hace que las cifras grandes cuenten hasta su valor.
- **ElDescenso**: el vídeo de la portada, que avanza o retrocede con el scroll.
  Si el navegador va lento, lo cambia por una secuencia de 36 imágenes.
- **Sonido** y **BajoConsumo**: los dos interruptores del lateral (sonido
  ambiente, y apagar animaciones y 3D para ahorrar batería).

### `cuantica.js` — el simulador
Matemáticas del cúbit escritas desde cero: números complejos (**Complejo**),
puertas cuánticas (**Puerta**, **Puertas**: H, X, Z, CNOT...), el estado del
sistema (**EstadoCuantico**), los circuitos (**Circuito**) y el algoritmo de
búsqueda de **Grover**. Incluye 14 pruebas: en la consola del navegador se
ejecutan con `pruebasCuantica()`.

### `piezas.js` — une el simulador y el 3D con los botones
Conecta cada escena 3D con sus controles: el deslizador del criostato
(**MandosCriostato**), la medición de los iones (**MandosIones**), la doble
rendija (**MandosInterferencia**), la consola del laboratorio
(**ConsolaLaboratorio**) y la demostración de Grover (**MandosGrover**).

### `formulario.js` — el formulario de contacto
Valida cada campo mientras se escribe (**Regla**, **Campo**) y envía el mensaje
al servidor (**Envio**). Si no hay servidor, lo guarda en el navegador y ofrece
descargarlo.

### `escena3d.js` — las piezas 3D (archivo generado)
**No se edita a mano.** Es el resultado de empaquetar el código de
`_fuente/src/` junto con Three.js (ver punto 7).

---

## 6. El servidor del formulario

El sitio es estático, pero el formulario necesita guardar datos:

- **`guardar.php`**: en un servidor con PHP (WAMP, en clase) valida los datos y
  los añade a `datos/mensajes.txt`.
- **`api/guardar.js`**: hace lo mismo en Vercel, que no ejecuta PHP. Vercel borra
  ese archivo cada cierto tiempo; en el Proyecto 2 se sustituirá por una base de
  datos.

Los datos se validan dos veces: en el navegador (`formulario.js`) y en el servidor.

---

## 7. La carpeta `_fuente/` (herramientas, no forma parte del sitio)

- **`src/`**: el código original de las escenas 3D, una clase por archivo:
  - `base.js` → **EscenaBase**: lo común (cámara, luces, tamaño, pausar fuera de pantalla).
  - `criostato.js` → el refrigerador que baja por sus seis etapas.
  - `bloch.js` → la esfera de Bloch del laboratorio.
  - `iones.js` → la cadena de iones atrapados.
  - `interferencia.js` → la doble rendija.
  - `index.js` → busca los `data-escena` de la página y crea la escena que toca.
- **`construir.mjs`**: empaqueta `src/` en `js/escena3d.js`. Tras cambiar una
  escena:
  ```bash
  cd _fuente
  npm install
  node construir.mjs
  ```
- **`revisar.py`**: comprueba la estructura de las páginas (títulos, figuras,
  enlaces, textos alternativos).
- **`qa/`**: scripts que recorren el sitio con un navegador automático y hacen
  capturas para revisar que no haya huecos ni errores.

---

## 8. Resumen en una frase por pieza

- **HTML**: el contenido y la estructura.
- **CSS**: la retícula de revista, los colores y las animaciones.
- **sitio.js**: el comportamiento general (menú, apariciones, vídeo, interruptores).
- **cuantica.js**: la física, calculada de verdad.
- **piezas.js**: los botones que mueven el 3D y el simulador.
- **escena3d.js**: las cuatro maquetas 3D.
- **formulario.js + guardar.php / api/guardar.js**: el contacto, validado en los dos lados.
