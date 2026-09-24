/* ==========================================================================
   sitio.js — Comportamiento común de Coherencia
   Parcial N.º 1 de Ingeniería Web · UTP · Brito & Gaitán · 2026

   Programación orientada a objetos. Cada clase resuelve una sola cosa:

     Navegacion      → menú de pantallas pequeñas y enlace de la página actual
     Vigia           → avisa cuando algo entra en pantalla (sin IntersectionObserver)
     Impresor        → las figuras se «imprimen» al entrar en pantalla
     Contador        → cifras editoriales que cuentan una sola vez
     ElDescenso      → el héroe: vídeo de 10 s conducido por el scroll, con
                       respaldo de secuencia de imágenes decidido por una
                       prueba de capacidad, no por el ancho de la ventana
     Sonido          → tres capas de audio, apagadas por defecto
     BajoConsumo     → interruptor que congela las piezas 3D
     Sitio           → arranca lo que haga falta en cada página

   Todo el sitio usa UN solo listener de scroll y UN solo bucle de animación.
   ========================================================================== */
"use strict";

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const menosMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const limita = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Preferencias del lector (sonido, bajo consumo). localStorage puede lanzar
 * una excepción —ventana privada, datos del sitio bloqueados, algunas vistas
 * de archivo local—, y un error en un constructor abortaría Sitio.iniciar()
 * antes de llegar al héroe. Por eso se lee y se escribe siempre a través de
 * aquí: si el almacenamiento no está, la preferencia dura lo que la visita.
 */
const Preferencia = {
  lee(clave) {
    try { return window.localStorage.getItem(clave); } catch (_) { return null; }
  },
  guarda(clave, valor) {
    try { window.localStorage.setItem(clave, valor); } catch (_) { /* sin almacenamiento */ }
  },
};

/** Un único bucle de animación para todo el sitio. */
class Bucle {
  static #tareas = new Set();
  static #activo = false;

  static agrega(tarea) {
    Bucle.#tareas.add(tarea);
    Bucle.#arranca();
    return () => Bucle.#tareas.delete(tarea);
  }

  static #arranca() {
    if (Bucle.#activo) return;
    Bucle.#activo = true;
    let anterior = performance.now();
    const paso = (ahora) => {
      const dt = Math.min((ahora - anterior) / 1000, 0.05);
      anterior = ahora;
      for (const tarea of Bucle.#tareas) tarea(dt, ahora);
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }
}

/* ------------------------------------------------------------------------ */
class Navegacion {
  #boton; #menu;

  constructor() {
    this.#boton = $(".menu-boton");
    this.#menu = $(".navegacion");
    if (!this.#boton || !this.#menu) return;

    this.#boton.addEventListener("click", () => {
      const abierto = this.#menu.classList.toggle("abierta");
      this.#boton.setAttribute("aria-expanded", String(abierto));
    });

    this.#menu.addEventListener("click", (e) => {
      if (e.target.tagName === "A") this.#cierra();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.#cierra();
    });
  }

  #cierra() {
    this.#menu?.classList.remove("abierta");
    this.#boton?.setAttribute("aria-expanded", "false");
  }
}

/* ------------------------------------------------------------------------ */
/**
 * Vigía — avisa UNA vez cuando un elemento entra en la ventana.
 *
 * No usa IntersectionObserver a propósito. Chrome calcula la intersección
 * después de aplicar el clip-path DEL PROPIO elemento, y lo que se va a
 * «imprimir» está escondido justo así, con clip-path: inset(0 100% 0 0): su
 * intersección es siempre de 0×0 y el observador nunca se entera de que ha
 * entrado. El elemento se quedaba invisible para siempre, ocupando su hueco
 * —titulares, figuras, cifras, tarjetas—, y la página parecía llena de
 * espacios en blanco. getBoundingClientRect no ve el recorte: se mide la
 * caja, como mucho una vez por cuadro y solo mientras quede algo pendiente.
 */
class Vigia {
  static #pendientes = new Map();   // elemento → { alEntrar, fraccion }
  static #programado = false;
  static #escuchando = false;

  /** alEntrar(el) se llama cuando el borde superior de el sube por encima de
   *  `fraccion` del alto de la ventana (0,98 = en cuanto asoma). */
  static cuando(el, alEntrar, fraccion = 0.98) {
    Vigia.#pendientes.set(el, { alEntrar, fraccion });
    Vigia.#escucha();
    Vigia.#programa();
  }

  static #escucha() {
    if (Vigia.#escuchando) return;
    Vigia.#escuchando = true;
    const programa = () => Vigia.#programa();
    window.addEventListener("scroll", programa, { passive: true });
    window.addEventListener("resize", programa, { passive: true });
    window.addEventListener("load", programa);
    // Por si la pestaña se abrió en segundo plano: al volver, se mira otra vez
    document.addEventListener("visibilitychange", programa);
  }

  static #programa() {
    if (Vigia.#programado || !Vigia.#pendientes.size) return;
    Vigia.#programado = true;
    requestAnimationFrame(() => {
      Vigia.#programado = false;
      Vigia.#revisa();
    });
  }

  static #revisa() {
    const alto = window.innerHeight || document.documentElement.clientHeight;
    for (const [el, { alEntrar, fraccion }] of Vigia.#pendientes) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;            // oculto con display:none
      if (r.top < alto * fraccion && r.bottom > 0) {
        Vigia.#pendientes.delete(el);
        alEntrar(el);
      }
    }
  }
}

/* ------------------------------------------------------------------------ */
/** Las figuras y los bloques de texto se imprimen: una pasada de tinta. */
class Impresor {
  constructor(selector = ".imprime, .lineas") {
    // Solo a partir de aquí el CSS puede ocultar nada: si este archivo no
    // llegara a cargarse, la página se ve entera igualmente.
    document.documentElement.classList.add("js-animado");

    if (menosMovimiento()) {
      $$(selector).forEach((el) => el.classList.add("impresa"));
      return;
    }
    this.refresca(selector);
  }

  refresca(selector = ".imprime, .lineas", contexto = document) {
    $$(selector, contexto).forEach((el) => {
      if (el.dataset.observado) return;
      el.dataset.observado = "1";
      Vigia.cuando(el, (e) => {
        // Los hermanos que entran juntos se imprimen escalonados, no a la vez
        const hermanos = Array.from(e.parentElement?.children || []);
        const orden = Math.min(Math.max(hermanos.indexOf(e), 0), 3);
        e.style.setProperty("--retraso", orden * 40 + "ms");
        e.classList.add("impresa");
      });
    });
  }
}

/* ------------------------------------------------------------------------ */
/**
 * Cifra editorial: cuenta hacia arriba una sola vez.
 * Las lecturas de aparato NO usan esto: un instrumento no hace easing,
 * sus dígitos saltan (ver Laboratorio en laboratorio.js).
 */
class Contador {
  static observaTodos() {
    const objetivos = $$("[data-cuenta]");
    if (!objetivos.length) return;
    if (menosMovimiento()) {
      objetivos.forEach((el) => Contador.#pinta(el, parseFloat(el.dataset.cuenta)));
      return;
    }
    // Las cifras viven dentro de bloques que se «imprimen»: por la misma razón
    // que ahí, se vigila la caja y no la intersección recortada.
    objetivos.forEach((el) => Vigia.cuando(el, (e) => Contador.#anima(e), 0.8));
  }

  static #anima(el) {
    const destino = parseFloat(el.dataset.cuenta);
    const decimales = parseInt(el.dataset.decimales || "0", 10);
    const inicio = performance.now();
    const duracion = 1400;
    const paso = (ahora) => {
      const p = limita((ahora - inicio) / duracion, 0, 1);
      const suave = 1 - Math.pow(1 - p, 3);
      Contador.#pinta(el, destino * suave, decimales);
      if (p < 1) requestAnimationFrame(paso);
      else Contador.#pinta(el, destino, decimales);
    };
    requestAnimationFrame(paso);
  }

  static #pinta(el, valor, decimales = 0) {
    // En español una cifra de cuatro dígitos no lleva separador de miles
    // (2022, no «2,022»): se agrupa solo a partir de 10 000, como pide la
    // ortografía de la RAE. Importa porque una de las cifras es un año.
    const destino = Math.abs(parseFloat(el.dataset.cuenta || valor));
    el.textContent = valor.toLocaleString("es-PA", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
      useGrouping: destino >= 10000,
    });
  }
}

/* ------------------------------------------------------------------------ */
/**
 * ElDescenso — Fig. 0
 *
 * Un plano de 10 s recorre el refrigerador de dilución desde la brida de
 * vacío hasta el chip. El scroll no reproduce el vídeo: lo rebobina, como el
 * cabezal de una moviola. Por eso el archivo está recodificado con un
 * fotograma clave en cada fotograma (ffmpeg -g 1), que es lo que permite
 * saltar a cualquier instante sin tirones.
 *
 * En Safari de escritorio y en casi todos los móviles, mover currentTime a
 * 60 fps no funciona. En vez de olfatear el navegador, se hace una PRUEBA DE
 * CAPACIDAD: se pide un salto y se cronometra. Si no responde a tiempo, se
 * cambia a una secuencia de 36 imágenes dibujadas en un canvas, que es el
 * mismo plano y se comporta igual.
 */
class ElDescenso {
  #raiz; #video; #lienzo; #ctx; #titular; #marcas;
  #arriba = 0; #alto = 0; #ventana = 0;
  #objetivo = 0; #actual = 0; #progreso = 0;
  #listo = false; #secuencia = null; #imagenes = []; #ultimoCuadro = -1; #intro = 0;
  #marcaActiva = -1; #sobreVideo = null;

  /** Progreso del descenso (0-1) para quien lo necesite, como el sonido.
   *  Antes se publicaba como propiedad CSS en :root, y eso obligaba al
   *  navegador a recalcular el estilo del documento entero en cada cuadro
   *  del scroll sin que ninguna regla la usara. */
  static progreso = 0;

  static ETAPAS = [
    { p: 0.0, temp: "300 K", nombre: "Brida de vacío" },
    { p: 0.22, temp: "50 K", nombre: "Escudo exterior" },
    { p: 0.45, temp: "4 K", nombre: "Escudo de helio" },
    { p: 0.68, temp: "100 mK", nombre: "Intercambiador" },
    { p: 0.92, temp: "10 mK", nombre: "Placa de mezcla" },
  ];

  constructor(raiz) {
    this.#raiz = raiz;
    this.#video = $(".descenso__video", raiz);
    this.#lienzo = $(".descenso__lienzo", raiz);
    this.#titular = $(".descenso__titular", raiz);
    this.#construyeTermometro();
    this.#mide();

    if (menosMovimiento()) {
      this.#modoEstatico();
      return;
    }

    this.#preparaVideo();

    window.addEventListener("scroll", () => this.#lee(), { passive: true });
    window.addEventListener("resize", () => { this.#mide(); this.#lee(); }, { passive: true });
    Bucle.agrega((dt) => this.#actualiza(dt));
    this.#lee();
    this.#entinta();
  }

  #mide() {
    const rect = this.#raiz.getBoundingClientRect();
    this.#arriba = rect.top + window.scrollY;
    this.#alto = this.#raiz.offsetHeight;
    this.#ventana = window.innerHeight;
  }

  #construyeTermometro() {
    this.#marcas = $$(".termometro__marca", this.#raiz);
    this.#marcas.forEach((marca) => {
      marca.addEventListener("click", () => {
        const p = parseFloat(marca.dataset.p || "0");
        const destino = this.#arriba + p * (this.#alto - this.#ventana);
        window.scrollTo({ top: destino, behavior: menosMovimiento() ? "auto" : "smooth" });
      });
    });
  }

  #modoEstatico() {
    this.#raiz.style.setProperty("--entintado", "100%");
    this.#raiz.style.setProperty("--lema-visible", "1");
    this.#raiz.style.setProperty("--pie-visible", "1");
    this.#video?.removeAttribute("autoplay");
  }

  /**
   * La pasada de tinta del titular: ocurre una sola vez al cargar, de
   * izquierda a derecha, como si se imprimiera. A partir de ahí manda el
   * scroll. Sin esto, quien llega a la portada no vería el título.
   */
  #entinta() {
    const inicio = performance.now();
    const paso = (ahora) => {
      const p = limita((ahora - inicio) / 900, 0, 1);
      this.#intro = 1 - Math.pow(1 - p, 3);
      this.#aplica();
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  async #preparaVideo() {
    const video = this.#video;
    if (!video) return this.#usaSecuencia();

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.pause();

    const listo = await new Promise((resolve) => {
      if (video.readyState >= 2) return resolve(true);
      const alCargar = () => resolve(true);
      video.addEventListener("loadeddata", alCargar, { once: true });
      setTimeout(() => resolve(video.readyState >= 2), 3500);
    });

    if (!listo) return this.#usaSecuencia();

    // Prueba de capacidad: ¿responde a un salto en menos de 320 ms?
    const rapido = await this.#pruebaDeSalto(video);
    if (!rapido) return this.#usaSecuencia();

    this.#listo = true;
    this.#aplica(true);
  }

  #pruebaDeSalto(video) {
    return new Promise((resolve) => {
      const objetivo = Math.min(1.2, (video.duration || 2) * 0.35);
      const t0 = performance.now();
      let resuelto = false;
      const fin = (ok) => {
        if (resuelto) return;
        resuelto = true;
        video.removeEventListener("seeked", alSaltar);
        resolve(ok);
      };
      const alSaltar = () => fin(performance.now() - t0 < 320);
      video.addEventListener("seeked", alSaltar);
      try { video.currentTime = objetivo; } catch (_) { fin(false); }
      setTimeout(() => fin(false), 500);
    });
  }

  /** Respaldo: el mismo plano como 36 imágenes dibujadas en un canvas. */
  #usaSecuencia() {
    if (!this.#lienzo) return;
    this.#raiz.classList.add("usa-secuencia");
    this.#ctx = this.#lienzo.getContext("2d", { alpha: false });

    const total = parseInt(this.#lienzo.dataset.cuadros || "36", 10);
    const ruta = this.#lienzo.dataset.ruta || "img/secuencia/";
    this.#secuencia = { total, cargadas: 0 };

    for (let i = 1; i <= total; i++) {
      const img = new Image();
      img.decoding = "async";
      img.src = ruta + "f" + String(i).padStart(2, "0") + ".webp";
      const indice = i - 1;
      img.onload = () => {
        this.#secuencia.cargadas++;
        if (this.#secuencia.cargadas === 1) { this.#listo = true; this.#aplica(true); }
        // Si el lector se ha parado justo en este cuadro mientras llegaba, se
        // pinta ahora: el bucle no vuelve a dibujar hasta el próximo scroll.
        const pedido = limita(Math.round(this.#actual * (total - 1)), 0, total - 1);
        if (indice === pedido && this.#ultimoCuadro !== indice) this.#dibujaCuadro(this.#actual);
      };
      this.#imagenes.push(img);
    }

    const ajusta = () => {
      const r = this.#lienzo.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.#lienzo.width = Math.round(r.width * dpr);
      this.#lienzo.height = Math.round(r.height * dpr);
      this.#ultimoCuadro = -1;
      this.#aplica(true);
    };
    ajusta();
    window.addEventListener("resize", ajusta, { passive: true });
  }

  #lee() {
    const recorrido = this.#alto - this.#ventana;
    if (recorrido <= 0) return;
    this.#objetivo = limita((window.scrollY - this.#arriba) / recorrido, 0, 1);
    // Mientras el vídeo ocupa la pantalla, los interruptores fijos van en
    // negativo: sobre la foto oscura, un botón de papel parecía un parche.
    const sobreVideo = window.scrollY < this.#arriba + this.#alto - this.#ventana * 0.6;
    if (sobreVideo !== this.#sobreVideo) {
      this.#sobreVideo = sobreVideo;
      document.body.classList.toggle("sobre-video", sobreVideo);
    }
  }

  #actualiza(dt) {
    // Inercia de cabezal: el vídeo persigue al scroll, no salta con él
    const diferencia = this.#objetivo - this.#actual;
    if (Math.abs(diferencia) < 0.0004) {
      if (this.#progreso !== this.#objetivo) {
        this.#actual = this.#objetivo;
        this.#aplica();
      }
      return;
    }
    this.#actual += diferencia * Math.min(1, dt * 7.5);
    this.#aplica();
  }

  #aplica(forzado = false) {
    const p = this.#actual;
    this.#progreso = this.#objetivo;

    if (this.#listo) {
      if (this.#secuencia) this.#dibujaCuadro(p);
      else this.#mueveVideo(p);
    }

    // Coreografía editorial. Todo con opacidad y recorte: el texto no se mueve.
    const raiz = this.#raiz;
    // El titular se imprime al cargar y se va, más tarde, por reducción de su
    // propia máscara: nunca por desvanecido.
    const salida = limita((p - 0.34) / 0.16, 0, 1);
    const entintado = this.#intro * (1 - salida) * 100;
    raiz.style.setProperty("--entintado", entintado.toFixed(1) + "%");
    raiz.style.setProperty("--lema-visible", (this.#intro * (1 - salida)).toFixed(2));
    // El pie entra cuando el titular ya ha salido del todo (a 0,50): antes se
    // cruzaban y en el teléfono se leían tres capas de texto sobre la foto.
    raiz.style.setProperty("--pie-visible", limita((p - 0.53) / 0.1, 0, 1).toFixed(2));
    raiz.style.setProperty("--progreso", p.toFixed(4));

    // Marca activa del termómetro: solo se toca el DOM cuando cambia
    let activa = 0;
    ElDescenso.ETAPAS.forEach((etapa, i) => { if (p >= etapa.p - 0.06) activa = i; });
    if (activa !== this.#marcaActiva) {
      this.#marcaActiva = activa;
      this.#marcas.forEach((m, i) => m.setAttribute("aria-current", String(i === activa)));
    }

    ElDescenso.progreso = p;
  }

  #mueveVideo(p) {
    const video = this.#video;
    const duracion = video.duration || 0;
    if (!duracion) return;
    const t = p * (duracion - 0.05);
    if (Math.abs(video.currentTime - t) > 0.004) {
      try { video.currentTime = t; } catch (_) { /* el navegador aún no puede */ }
    }
  }

  #dibujaCuadro(p) {
    const total = this.#imagenes.length;
    const indice = limita(Math.round(p * (total - 1)), 0, total - 1);
    if (indice === this.#ultimoCuadro) return;
    const img = this.#imagenes[indice];
    if (!img || !img.complete || !img.naturalWidth) return;
    this.#ultimoCuadro = indice;

    const c = this.#lienzo;
    const ctx = this.#ctx;
    const escala = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
    const ancho = img.naturalWidth * escala;
    const alto = img.naturalHeight * escala;
    ctx.drawImage(img, (c.width - ancho) / 2, (c.height - alto) / 2, ancho, alto);
  }
}

/* ------------------------------------------------------------------------ */
/**
 * Sonido — tres capas, apagadas por defecto y con interruptor visible.
 * Nada suena sin un gesto explícito, nada informa solo por audio, y el
 * sitio se entiende entero en silencio.
 */
class Sonido {
  #ctx = null; #encendido = false; #boton; #lecho = null; #filtro = null; #ganancia = null;

  constructor() {
    this.#boton = $("[data-audio]");
    if (!this.#boton) return;

    this.#encendido = Preferencia.lee("coherencia:audio") === "1";
    this.#pinta();

    this.#boton.addEventListener("click", () => {
      this.#encendido = !this.#encendido;
      Preferencia.guarda("coherencia:audio", this.#encendido ? "1" : "0");
      if (this.#encendido) this.#arranca();
      else this.#para();
      this.#pinta();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.#para();
      else if (this.#encendido) this.#arranca();
    });
  }

  #pinta() {
    this.#boton.setAttribute("aria-pressed", String(this.#encendido));
    this.#boton.textContent = this.#encendido ? "Sonido: sí" : "Sonido: no";
  }

  #contexto() {
    if (!this.#ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.#ctx = new AC();
    }
    return this.#ctx;
  }

  /** Lecho grave de la bomba de circulación, sintetizado: no hay archivo. */
  #arranca() {
    const ctx = this.#contexto();
    if (!ctx || this.#lecho) return;
    ctx.resume?.();

    const ruido = ctx.createBufferSource();
    const largo = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, largo, ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    let ultimo = 0;
    for (let i = 0; i < largo; i++) {
      const blanco = Math.random() * 2 - 1;
      ultimo = (ultimo + 0.021 * blanco) / 1.021;   // ruido marrón: grave
      datos[i] = ultimo * 3.2;
    }
    ruido.buffer = buffer;
    ruido.loop = true;

    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 900;

    const ganancia = ctx.createGain();
    ganancia.gain.value = 0.0001;

    ruido.connect(filtro).connect(ganancia).connect(ctx.destination);
    ruido.start();

    this.#lecho = ruido;
    this.#filtro = filtro;
    this.#ganancia = ganancia;

    // El descenso cierra el filtro: al fondo del criostato se hace el silencio
    Bucle.agrega(() => {
      if (!this.#ganancia) return;
      const p = ElDescenso.progreso;
      const objetivo = p > 0.02 && p < 0.99 ? 0.05 + p * 0.09 : 0.02;
      this.#ganancia.gain.value += (objetivo - this.#ganancia.gain.value) * 0.05;
      this.#filtro.frequency.value += (900 - p * 620 - this.#filtro.frequency.value) * 0.05;
    });
  }

  #para() {
    try { this.#lecho?.stop(); } catch (_) { /* ya estaba parado */ }
    this.#lecho = null;
    this.#ganancia = null;
  }

  /** Clic seco de relé: suena al medir, si el audio está encendido. */
  clic() {
    if (!this.#encendido) return;
    const ctx = this.#contexto();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(2100, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.035);
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }
}

/* ------------------------------------------------------------------------ */
/** Interruptor de bajo consumo: congela las piezas 3D y quita el grano. */
class BajoConsumo {
  #boton; #activo = false;

  constructor() {
    this.#boton = $("[data-bajo-consumo]");
    if (!this.#boton) return;
    this.#activo = Preferencia.lee("coherencia:bajoconsumo") === "1";
    this.#aplica();
    this.#boton.addEventListener("click", () => {
      this.#activo = !this.#activo;
      Preferencia.guarda("coherencia:bajoconsumo", this.#activo ? "1" : "0");
      this.#aplica();
    });
    // Las escenas 3D pueden terminar de montarse después que este botón: si el
    // lector lo dejó activado en otra visita, se congelan en cuanto existen.
    document.addEventListener("coherencia3d:listo", () => this.#aplica());
  }

  #aplica() {
    document.body.classList.toggle("bajo-consumo", this.#activo);
    this.#boton.setAttribute("aria-pressed", String(this.#activo));
    this.#boton.textContent = this.#activo ? "Bajo consumo: sí" : "Bajo consumo: no";
    const instancias = window.Coherencia3D?.instancias;
    if (!instancias) return;
    instancias.forEach((escena) => {
      if (this.#activo) escena.detiene();
      else if (escena.visible) escena.arranca();
    });
  }
}

/* ------------------------------------------------------------------------ */
const Sitio = {
  iniciar() {
    this.navegacion = new Navegacion();
    this.impresor = new Impresor();
    Contador.observaTodos();
    this.sonido = new Sonido();
    this.bajoConsumo = new BajoConsumo();

    const descenso = $(".descenso");
    if (descenso) this.descenso = new ElDescenso(descenso);

    // El logo colapsa cada vez que se mide algo en el sitio
    document.addEventListener("coherencia:medida", () => {
      document.body.classList.add("midiendo");
      this.sonido?.clic();
      setTimeout(() => document.body.classList.remove("midiendo"), 420);
    });
  },
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => Sitio.iniciar());
} else {
  Sitio.iniciar();
}

window.Coherencia = { Sitio, Bucle, Vigia, Impresor, Contador, ElDescenso };
