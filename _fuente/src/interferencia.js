/* ==========================================================================
   interferencia.js — Experimento de la doble rendija en tiempo real
   Proyecto Coherencia · Ingeniería Web · UTP

   Un sombreador calcula, para cada píxel, la suma de dos ondas que salen de
   dos rendijas y la intensidad resultante. Es el fenómeno que explica por qué
   un algoritmo cuántico puede ser más rápido: no se trata de "probar todo a la
   vez", sino de hacer que las amplitudes de las respuestas equivocadas se
   cancelen entre sí y las de la correcta se refuercen.

   La pantalla de la derecha no es un gráfico relleno: es una placa que recibe
   impactos sueltos, uno a uno, como en la acumulación electrón a electrón de
   Tonomura. Cada impacto cae al azar, pero la densidad de impactos sigue la
   intensidad media y las franjas aparecen solas con el tiempo. Al lado, en una
   línea fina de tinta, la curva teórica.
   ========================================================================== */
import * as THREE from "three";
import { EscenaBase, colorDeCSS, menosMovimiento } from "./base.js";

const VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = `
  precision highp float;

  varying vec2 vUv;

  uniform vec2  uResolucion;   // tamaño del lienzo en píxeles CSS
  uniform float uTiempo;
  uniform float uSeparacion;   // separación entre rendijas (0.05 - 0.47)
  uniform float uOnda;         // longitud de onda relativa (0.018 - 0.088)
  uniform float uRendijas;     // 1.0 o 2.0
  uniform float uInicio;       // instante del último cambio: ahí empieza la acumulación
  uniform float uSemilla;      // cambia en cada reinicio: no caen los mismos impactos
  uniform vec3  uFondo;
  uniform vec3  uFrio;
  uniform vec3  uAcento;
  uniform vec3  uPapel;
  uniform vec3  uTinta;
  uniform vec3  uPlomo;

  const float PI = 3.14159265359;

  // Duración de la acumulación completa, en segundos. El ritmo de llegada es
  // constante, como en el experimento: al principio solo hay puntos sueltos.
  const float DURACION = 12.0;
  // Lado de la celda de la placa, en píxeles CSS: un impacto posible por celda.
  const float CELDA = 3.5;

  // Pseudoazar por celda, sin senos (hash de Dave Hoskins)
  float azar(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // Amplitud instantánea de una onda circular emitida desde "origen"
  float onda(vec2 p, vec2 origen, float k, float w) {
    float r = distance(p, origen);
    float atenuacion = 1.0 / sqrt(max(r, 0.035));
    return cos(k * r - w * uTiempo) * atenuacion;
  }

  // Intensidad promediada en el tiempo (lo que registra una pantalla)
  float intensidadMedia(vec2 p, vec2 a, vec2 b, float k, float dos) {
    float ra = max(distance(p, a), 0.035);
    float rb = max(distance(p, b), 0.035);
    float Aa = 1.0 / sqrt(ra);
    float Ab = dos > 0.5 ? 1.0 / sqrt(rb) : 0.0;
    float cruzado = (dos > 0.5) ? Aa * Ab * cos(k * (ra - rb)) : 0.0;
    return 0.5 * (Aa * Aa + Ab * Ab) + cruzado;
  }

  void main() {
    float aspecto = uResolucion.x / uResolucion.y;
    vec2 p = vec2(vUv.x * aspecto, vUv.y);
    // Un píxel CSS en las unidades de la figura (la altura mide 1)
    float px = 1.0 / uResolucion.y;

    float k = 2.0 * PI / uOnda;
    float w = 5.2;

    float xBarrera = 0.16 * aspecto;
    vec2 rendijaA = vec2(xBarrera, 0.5 + uSeparacion * 0.5);
    vec2 rendijaB = vec2(xBarrera, 0.5 - uSeparacion * 0.5);
    float dos = step(1.5, uRendijas);

    vec3 color = uFondo;

    float xPantalla = 0.80 * aspecto;

    if (p.x < xPantalla) {
      // --- Campo de ondas propagándose ---
      float campo = 0.0;
      if (p.x > xBarrera) {
        campo += onda(p, rendijaA, k, w);
        if (dos > 0.5) campo += onda(p, rendijaB, k, w);
      } else {
        // Antes de la barrera: onda plana que llega desde la izquierda. Su
        // amplitud se elige para que se imprima con la misma tinta que el
        // campo de la derecha; la fase empalma justo en las rendijas.
        campo += cos(k * (p.x - xBarrera) - w * uTiempo) * 1.6;
      }

      float intensidad = campo * campo * 0.16;
      float senal = clamp(intensidad, 0.0, 1.0);

      // Figura impresa: el papel es el fondo y la onda se imprime en tinta azul.
      // El rojo del corrector se reserva para los máximos, que es el dato.
      color = mix(uFondo, uFrio, smoothstep(0.02, 0.62, senal) * 0.86);
      color = mix(color, uAcento, smoothstep(0.93, 1.0, senal) * 0.7);

      // Línea fina donde el campo cruza por cero: el dibujo de la onda
      float cruce = 1.0 - smoothstep(0.0, 0.05, abs(campo));
      color = mix(color, uPapel, cruce * 0.55);

      // --- La barrera: una barra de tinta de 7 px con cortes limpios. Los
      // bordes se suavizan un solo píxel, como el canto de un filete impreso.
      float mitadRendija = max(0.012, 4.0 * px);
      float barrera = 1.0 - smoothstep(3.0 * px, 4.0 * px, abs(p.x - xBarrera));
      float huecoA = 1.0 - smoothstep(mitadRendija - 0.5 * px, mitadRendija + 0.5 * px, abs(p.y - rendijaA.y));
      float huecoB = dos > 0.5
        ? 1.0 - smoothstep(mitadRendija - 0.5 * px, mitadRendija + 0.5 * px, abs(p.y - rendijaB.y))
        : 0.0;
      float hueco = max(huecoA, huecoB);
      // Dentro del corte se ve el papel: la onda plana acaba en la barrera y
      // las ondas circulares nacen en ella, sin mezclarse en el hueco.
      color = mix(color, uFondo, barrera * hueco);
      color = mix(color, uTinta, barrera * (1.0 - hueco));
    } else {
      // --- Pantalla de detección ---
      // A la izquierda, la placa que acumula impactos; a la derecha, sobre su
      // propio eje, la curva teórica. Separadas, cada una se lee sin la otra.
      float anchoPantalla = aspecto - xPantalla;
      float xPlacaFin = xPantalla + 0.42 * anchoPantalla;
      float xEje = xPlacaFin + 6.0 * px;

      // Referencia común: el máximo central con dos rendijas. Con una sola
      // rendija la placa recibe una cuarta parte, y en los mínimos de dos
      // rendijas llega menos que con una: es lo que cuenta el texto.
      float rCentro = max(distance(vec2(xPantalla, 0.5), rendijaA), 0.035);
      float referencia = 2.0 / rCentro;

      // (a) Impactos. Cada celda tiene un instante de llegada, un umbral y una
      // posición al azar; el punto se dibuja si ya ha llegado y si el umbral
      // queda por debajo de la intensidad normalizada a su altura. Se miran
      // también las celdas vecinas: un punto puede caer junto al borde de la
      // suya y no debe salir cortado. La intensidad se mide a la altura del
      // centro del punto, no del píxel: así cada punto sale entero o no sale,
      // también en los flancos estrechos de las franjas.
      float transcurrido = uTiempo - uInicio;
      float normAqui = intensidadMedia(vec2(xPantalla, p.y), rendijaA, rendijaB, k, dos) / referencia;
      vec2 pix = vUv * uResolucion;
      vec2 celdaAqui = floor(pix / CELDA);
      float tinta = 0.0;
      float fresco = 0.0;
      // Solo sobre la franja de la placa: el resto de la pantalla no paga el bucle.
      if (p.x < xPlacaFin + 2.0 * px) {
        for (int i = -1; i <= 1; i++) {
          for (int j = -1; j <= 1; j++) {
            vec2 celda = celdaAqui + vec2(float(i), float(j));
            vec2 semilla = celda + vec2(uSemilla * 17.0, uSemilla * 31.0);
            float llegada = azar(semilla) * DURACION;
            float umbral = azar(semilla + 71.3);
            vec2 centro = (celda + vec2(azar(semilla + 13.7), azar(semilla + 47.1))) * CELDA;
            float dentro = step(xPantalla + 5.0 * px, centro.x * px) * step(centro.x * px, xPlacaFin);
            float normPunto = intensidadMedia(vec2(xPantalla, centro.y * px), rendijaA, rendijaB, k, dos) / referencia;
            float impacto = dentro * step(llegada, transcurrido) * step(umbral, normPunto * 0.92);
            float punto = impacto * (1.0 - smoothstep(0.85, 1.6, distance(pix, centro)));
            if (punto > tinta) {
              tinta = punto;
              fresco = 1.0 - smoothstep(0.0, 0.5, transcurrido - llegada);
            }
          }
        }
      }
      // El impacto recién llegado se marca en cinabrio y se asienta en azul:
      // así se ve dónde está cayendo cada partícula en este momento.
      color = mix(color, mix(uFrio, uAcento, fresco), tinta * 0.95);

      // (b) Curva teórica de intensidad sobre un eje de plomo. La distancia se
      // corrige con la pendiente para que el trazo tenga el mismo grueso
      // también en los flancos empinados de las franjas.
      float eje = 1.0 - smoothstep(0.4 * px, 1.0 * px, abs(p.x - xEje));
      color = mix(color, uPlomo, eje * 0.7);

      float escala = aspecto - xEje - 6.0 * px;
      float n0 = normAqui;
      float n1 = intensidadMedia(vec2(xPantalla, p.y + px), rendijaA, rendijaB, k, dos) / referencia;
      float xCurva = xEje + clamp(n0, 0.0, 1.0) * escala;
      float pendiente = (n1 - n0) * escala / px;
      float distCurva = abs(p.x - xCurva) / sqrt(1.0 + pendiente * pendiente) / px;
      float trazo = 1.0 - smoothstep(0.5, 1.2, distCurva);
      color = mix(color, uTinta, trazo * step(xEje, p.x));

      // Canto de la pantalla: un filete de tinta de 2 px
      float canto = 1.0 - smoothstep(1.5 * px, 2.5 * px, p.x - xPantalla);
      color = mix(color, uTinta, canto);
    }

    // Sin viñeta: una figura impresa no tiene viñeta de cámara.

    gl_FragColor = vec4(color, 1.0);
  }
`;

/** El color en sRGB, tal como lo escribe el CSS. */
const comoCSS = (c) => c.clone().convertLinearToSRGB();

export class Interferencia extends EscenaBase {
  constructor(contenedor, opciones = {}) {
    super(contenedor, Object.assign({ bloom: false, entorno: false, alpha: false }, opciones));
  }

  construye() {
    const raiz = this.contenedor;
    // La figura se imprime: el fondo es el papel y la onda es tinta. Las
    // mezclas se hacen en sRGB, como las del CSS, y el sombreador no convierte
    // la salida: así el papel del lienzo es exactamente el de la página.
    const col = {
      fondo: comoCSS(colorDeCSS("--c3d-papel", "#F2EFE6", raiz)),
      frio: comoCSS(colorDeCSS("--c3d-prusia", "#1C3A5B", raiz)),
      acento: comoCSS(colorDeCSS("--c3d-cinabrio", "#BE3A26", raiz)),
      papel: comoCSS(colorDeCSS("--c3d-claro", "#FBF8F1", raiz)),
      tinta: comoCSS(colorDeCSS("--c3d-tinta", "#17181B", raiz)),
      plomo: comoCSS(colorDeCSS("--c3d-plomo", "#6E6C66", raiz)),
    };

    this.camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.uniformes = {
      uResolucion: { value: new THREE.Vector2(1, 1) },
      uTiempo: { value: 0 },
      uSeparacion: { value: 0.16 },
      uOnda: { value: 0.062 },
      uRendijas: { value: 2 },
      uInicio: { value: 0 },
      uSemilla: { value: 0 },
      uFondo: { value: col.fondo },
      uFrio: { value: col.frio },
      uAcento: { value: col.acento },
      uPapel: { value: col.papel },
      uTinta: { value: col.tinta },
      uPlomo: { value: col.plomo },
    };
    this.#reiniciaPlaca();

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: this.uniformes,
      depthTest: false,
      depthWrite: false,
    });
    const plano = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    plano.frustumCulled = false;
    this.escena.add(plano);
  }

  alRedimensionar(ancho, alto) {
    this.uniformes.uResolucion.value.set(ancho, alto);
  }

  /**
   * La placa empieza de cero: los impactos anteriores eran de otro experimento.
   * Con movimiento reducido no hay espera: se muestra ya el estado acumulado.
   */
  #reiniciaPlaca() {
    const u = this.uniformes;
    u.uSemilla.value = (u.uSemilla.value + 1) % 64;
    u.uInicio.value = menosMovimiento() ? u.uTiempo.value - 1e4 : u.uTiempo.value;
  }

  /** Cambia un parámetro; solo si cambia de verdad se vacía la placa. */
  #ajusta(nombre, valor) {
    if (this.uniformes[nombre].value === valor) return this;
    this.uniformes[nombre].value = valor;
    this.#reiniciaPlaca();
    if (!this.activa) this.render();
    return this;
  }

  /** Separación entre rendijas: 0 (juntas) a 1 (muy separadas). */
  ponSeparacion(v) {
    return this.#ajusta("uSeparacion", 0.05 + Math.max(0, Math.min(1, v)) * 0.42);
  }

  /** Longitud de onda: 0 (corta, muchas franjas) a 1 (larga, pocas franjas). */
  ponLongitudOnda(v) {
    return this.#ajusta("uOnda", 0.018 + Math.max(0, Math.min(1, v)) * 0.07);
  }

  /** 1 = una rendija (sin interferencia), 2 = dos rendijas (franjas). */
  ponRendijas(n) {
    return this.#ajusta("uRendijas", n >= 2 ? 2 : 1);
  }

  actualiza(dt) {
    const u = this.uniformes;
    if (menosMovimiento()) {
      // Ni la onda avanza ni la placa se va llenando: se ve el resultado final.
      u.uInicio.value = u.uTiempo.value - 1e4;
      return;
    }
    u.uTiempo.value += dt;
  }
}
