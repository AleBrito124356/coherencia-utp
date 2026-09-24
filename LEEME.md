# Coherencia — Revista de computación cuántica

**Parcial N.º 1 · Ingeniería Web · Universidad Tecnológica de Panamá**
Facultad de Ingeniería de Sistemas Computacionales · Grupo 1SF134
Facilitadora: Dra. Denis Cedeño · Entrega: 28 de septiembre de 2026

| Integrante | Cédula |
| --- | --- |
| Alejandro Brito Olivera | 20-24-7596 |
| Marcos Gaitán | 8-988-725 |

**Sitio publicado:** https://coherencia-utp.vercel.app

---

## Cómo abrir el proyecto

Hay dos formas y las dos funcionan:

1. **Sin servidor.** Doble clic en `index.html`. Todo el sitio funciona, incluidas las
   cuatro piezas en tres dimensiones y el simulador, porque las tipografías están
   autoalojadas y el paquete 3D se compiló a un archivo clásico. Lo único que cambia es
   el formulario: al no haber servidor, guarda el archivo de datos en el propio navegador
   y ofrece descargarlo.
2. **Con servidor.** Copie la carpeta al directorio del servidor (por ejemplo `www/` de
   WAMP) y abra `http://localhost/Brito-Gaitan/`. Así `guardar.php` escribe de verdad en
   `datos/mensajes.txt` y en `datos/mensajes.csv`.

---

## Qué pide la rúbrica y dónde está

| Requisito | Dónde se cumple |
| --- | --- |
| Carpeta con los apellidos de los integrantes | `Brito-Gaitan/` |
| Subcarpetas `html/`, `css/`, `img/` | Las tres, más `js/`, `audio/`, `video/`, `fuentes/`, `datos/` y `diseno/` |
| Técnica de diseño | `diseno/tecnica-de-diseno.html` — wireframes de las cuatro plantillas, retícula, paleta con contrastes medidos y reglas de movimiento |
| HTML5 y CSS3 | Siete páginas escritas a mano, sin frameworks. `css/estilo.css` |
| Al menos tres páginas (inicio, acerca de, contacto) | Siete: `index.html`, `html/fundamentos.html`, `html/hardware.html`, `html/laboratorio.html`, `html/aplicaciones.html`, `html/acerca-de.html`, `html/contacto.html` |
| Información verdadera, sin texto de relleno | Unas 200 fuentes consultadas; bibliografía en `html/acerca-de.html` |
| Varios `article` y `aside` | En todos los capítulos, más `section`, `figure`, `figcaption`, `dl`, `table`, `time` |
| Colores adecuados y listas | Paleta de seis tintas documentada; listas, glosarios y tablas en los capítulos |
| Diseño de logo | `img/marca.svg`, dibujado a mano: marca de registro de imprenta con dos puntos que colapsan al medir |
| Imágenes | Trece fotografías en `img/`, una distinta en cada figura, más los 36 fotogramas del descenso; todas declaradas como recreaciones generadas con IA |
| Audio y vídeo | `audio/narracion.mp3`, `audio/ambiente.mp3` y `video/descenso.mp4` |
| Vinculación a redes sociales | Pie de todas las páginas |
| Footer | En las siete páginas |
| Dos enlaces externos a sitios relacionados | IBM Quantum y NIST, en el pie de todas las páginas |
| Formulario que guarda en un archivo de datos | `html/contacto.html` → `guardar.php` o `api/guardar.js` → `datos/mensajes.txt` |
| Validación de al menos cuatro campos | Se validan **seis**, en el navegador y otra vez en el servidor |
| Hosting gratuito | Vercel |

---

## Estructura

```
Brito-Gaitan/
├── index.html                  portada, con el vídeo conducido por el scroll
├── html/                       los seis capítulos restantes
├── css/
│   ├── estilo.css              sistema completo: tokens, retícula, componentes
│   └── tipografias.css         @font-face de las tres familias
├── js/
│   ├── cuantica.js             motor de simulación cuántica (sin librerías)
│   ├── escena3d.js             paquete compilado: Three.js + las cuatro figuras
│   ├── sitio.js                navegación, figuras, el descenso, audio
│   ├── piezas.js               conecta los mandos con el motor y las escenas
│   └── formulario.js           validación y envío
├── img/                        fotografías, secuencia de respaldo del héroe y logo
├── audio/                      narración y pieza ambiental
├── video/                      descenso.mp4 (todo-clave, para poder rebobinarlo)
├── fuentes/                    las tres tipografías en WOFF2
├── datos/                      aquí escribe el formulario
├── diseno/                     documento de la técnica de diseño
├── api/guardar.js              función de Node para el hosting
├── guardar.php                 el mismo guardado para un servidor con PHP
└── _fuente/                    código fuente del paquete 3D y material de trabajo
```

`_fuente/` no hace falta para que el sitio funcione: contiene el código legible de las
escenas 3D antes de compilarse (`_fuente/src/`), el script que las compila y el material
de investigación. Se incluye para que se pueda revisar cómo está hecho.

---

## Lo que hay dentro, por si conviene mirarlo

- **`js/cuantica.js`** — Números complejos, puertas unitarias, vector de estado de hasta
  doce cúbits, puertas controladas, medición con colapso, matriz densidad reducida para
  la esfera de Bloch y el algoritmo de Grover. Trae catorce pruebas propias: abra la consola
  del navegador con `window.COHERENCIA_PRUEBAS = true` antes de cargar la página.
- **Las cuatro figuras 3D** — Ninguna usa post-proceso, y nada emite luz propia salvo los
  iones, cuya fluorescencia a 493 nm es real: toda la demás luz entra desde fuera del
  objeto, que es lo que las hace parecer objetos fotografiados y no efectos.
  - *El refrigerador de dilución* (La máquina): seis etapas con coaxiales semirrígidos; la
    cámara baja con el scroll o con el dial y termina bajo la placa de mezcla, en el
    portamuestras de oro donde va el chip. El encuadre se calcula según la caja.
  - *El goniómetro* (Laboratorio): la esfera de Bloch en vista de libro de texto. Las
    puertas giran el vector por la superficie de la esfera (interpolación geodésica), no
    en línea recta por dentro, y el reloj de T2 lo encoge hasta el centro.
  - *La cadena de iones* (La máquina): la trampa vista por dentro de la cámara de vacío.
    Al medir, un pulso de láser recorre la cadena; los iones en |0⟩ fluorescen y los de |1⟩
    quedan oscuros. La pareja q1-q5 está entrelazada y sale siempre igual.
  - *La doble rendija* (Fundamentos): el campo de ondas calculado en un shader y una placa
    donde los impactos llegan de uno en uno; las franjas solo aparecen al acumularse.
- **La maqueta** — Retícula de doce columnas con la lectura en la 2-8 y el riel de notas
  en la 10-12. La última nota de cada margen acompaña al texto mientras se lee sin salirse
  de su fila; los pies de las fotografías se componen en el riel; cada capítulo largo
  cierra con una separata en huecograbado. Por encima de 1440 px la retícula entera crece
  con la pantalla (hasta 1710 px de página), para que un monitor grande no vea una isla de
  texto rodeada de papel.
- **La impresión de los bloques** — Cada bloque entra en pantalla «imprimiéndose» de
  izquierda a derecha. Quién decide cuándo entra no es un `IntersectionObserver`: el
  navegador calcula la intersección *después* de aplicar el `clip-path` del propio elemento,
  y un bloque recortado al 100 % no llega a cruzar nunca. Lo mide `Vigia` con
  `getBoundingClientRect` en cada fotograma de scroll.
- **El movimiento ligado al scroll** — Las fotos se «revelan» al entrar en pantalla y se
  desplazan un poco dentro de su marco; un filete de cinabrio bajo la cabecera marca el
  avance de lectura. Lo calcula el navegador (`animation-timeline`), sin JavaScript, y se
  apaga con movimiento reducido o donde el navegador no lo soporta.
- **El héroe** — Un plano de diez segundos recodificado con un fotograma clave en cada
  fotograma. El scroll no lo reproduce: lo rebobina. Para los navegadores que no aguantan
  ese salto hay la misma toma como 36 imágenes, y el sitio elige entre las dos midiendo
  cuánto tarda en responder a un salto de prueba.

---

## Procedencia del material

Ninguna imagen del sitio es una fotografía documental: todas, y el vídeo, se generaron con
modelos de inteligencia artificial a partir de indicaciones escritas por nosotros, y cada
pie de figura lo declara. Las piezas 3D son esquemas construidos con Three.js, no
reconstrucciones de un equipo comercial concreto. Las tipografías (Bodoni Moda, Source
Serif 4 e IBM Plex Mono) tienen licencia SIL Open Font License; Three.js, licencia MIT.
Los textos, el diseño, el simulador y el resto del código son obra propia.
