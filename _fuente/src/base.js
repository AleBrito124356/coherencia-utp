/* ==========================================================================
   base.js — Infraestructura común de las escenas 3D
   Proyecto Coherencia · Ingeniería Web · UTP

   EscenaBase resuelve lo que todas las escenas necesitan: renderizador con
   tonemapping cinematográfico, entorno para los reflejos (PBR), cadena de
   post-proceso con bloom, redimensionado, seguimiento del puntero, pausa
   automática cuando la escena no se ve, y respeto por "reducir movimiento".
   ========================================================================== */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const menosMovimiento = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Lee un color de una variable CSS y lo convierte en THREE.Color. */
export function colorDeCSS(nombre, porDefecto, elemento) {
  const raiz = elemento || document.documentElement;
  const valor = getComputedStyle(raiz).getPropertyValue(nombre).trim();
  try {
    return new THREE.Color(valor || porDefecto);
  } catch (_) {
    return new THREE.Color(porDefecto);
  }
}

/** Interpolación suave e independiente de los fotogramas por segundo. */
export const amortigua = (actual, objetivo, suavidad, dt) =>
  actual + (objetivo - actual) * (1 - Math.exp(-suavidad * dt));

/**
 * Etiqueta de texto dibujada en un canvas y colocada como sprite.
 * Se usa para |0⟩, |1⟩, las temperaturas del criostato, etc.
 */
export function etiquetaSprite(texto, opciones = {}) {
  const {
    color = "#f2ede3",
    fondo = "transparent",
    tamano = 72,
    fuente = '600 72px "Iowan Old Style", "Palatino Linotype", Georgia, serif',
    padding = 26,
    escala = 0.42,
  } = opciones;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = fuente;
  const metricas = ctx.measureText(texto);
  const ancho = Math.ceil(metricas.width) + padding * 2;
  const alto = Math.ceil(tamano * 1.6) + padding;

  canvas.width = ancho;
  canvas.height = alto;

  const c = canvas.getContext("2d");
  if (fondo !== "transparent") {
    c.fillStyle = fondo;
    const r = 14;
    c.beginPath();
    c.roundRect(0, 0, ancho, alto, r);
    c.fill();
  }
  c.font = fuente;
  c.fillStyle = color;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(texto, ancho / 2, alto / 2);

  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  textura.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: textura,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set((ancho / alto) * escala, escala, 1);
  sprite.renderOrder = 10;
  sprite.userData.dispose = () => {
    textura.dispose();
    material.dispose();
  };
  return sprite;
}

/**
 * Textura de halo: un degradado radial que se desvanece.
 * Sin ella, un sprite sale como un cuadrado sólido.
 */
export function texturaHalo(tamano = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = tamano;
  const g = canvas.getContext("2d");
  const r = tamano / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.28, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.62, "rgba(255,255,255,0.12)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, tamano, tamano);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/**
 * Plano que solo recibe sombra: es lo que ancla un objeto 3D al papel.
 * Sin él, cualquier pieza parece recortada y pegada encima.
 */
export function planoSombra(escena, { y = 0, tamano = 14, opacidad = 0.34 } = {}) {
  const plano = new THREE.Mesh(
    new THREE.PlaneGeometry(tamano, tamano),
    new THREE.ShadowMaterial({ opacity: opacidad, transparent: true })
  );
  plano.rotation.x = -Math.PI / 2;
  plano.position.y = y;
  plano.receiveShadow = true;
  escena.add(plano);
  return plano;
}

export class EscenaBase {
  constructor(contenedor, opciones = {}) {
    this.contenedor = contenedor;
    this.opciones = Object.assign(
      {
        alpha: true,
        // LEY DE LUZ: nada emite luz por su cuenta. Sin bloom ni post-proceso,
        // salvo que una escena lo pida expresamente por tener una fuente real.
        bloom: false,
        sombras: true,
        bloomFuerza: 0.5,
        bloomRadio: 0.7,
        bloomUmbral: 0.82,
        entorno: true,
        dprMaximo: 2,
        campoVision: 38,
        cerca: 0.1,
        lejos: 120,
        exposicion: 1.05,
      },
      opciones
    );

    this.reloj = new THREE.Clock();
    this.puntero = new THREE.Vector2(0, 0);
    this.punteroSuave = new THREE.Vector2(0, 0);
    this.activa = false;
    this.visible = false;
    this.destruida = false;
    this.tiempo = 0;
    this._rafId = null;
    this._recursos = [];

    this.#creaRenderizador();
    this.#creaEscena();
    if (this.opciones.entorno) this.#creaEntorno();
    if (this.opciones.bloom) this.#creaComposer();
    // Ojo: construye() NO se llama aquí. Los campos y métodos privados de una
    // subclase todavía no existen mientras corre el constructor de la base,
    // así que el montaje se hace después, con monta().
  }

  /**
   * Termina de montar la escena. Se llama justo después de construir el objeto
   * (lo hace la fábrica de index.js), cuando la subclase ya está completa.
   */
  monta() {
    this.construye();
    if (this._renderPass) this._renderPass.camera = this.camara;
    this.#conectaEventos();
    this.redimensiona();
    this.render();
    return this;
  }

  /* ---- ciclo de vida que sobrescriben las escenas hijas ---- */
  construye() {}
  actualiza(/* dt, t */) {}
  alRedimensionar(/* ancho, alto */) {}

  /* ---- montaje ---- */
  #creaRenderizador() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: this.opciones.alpha,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.opciones.dprMaximo));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.opciones.exposicion;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (this.opciones.sombras) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.renderer.domElement.classList.add("lienzo3d");
    this.contenedor.appendChild(this.renderer.domElement);
  }

  #creaEscena() {
    this.escena = new THREE.Scene();
    const ancho = this.contenedor.clientWidth || 1;
    const alto = this.contenedor.clientHeight || 1;
    this.camara = new THREE.PerspectiveCamera(
      this.opciones.campoVision,
      ancho / alto,
      this.opciones.cerca,
      this.opciones.lejos
    );
    this.camara.position.set(0, 0, 6);
  }

  #creaEntorno() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const entorno = new RoomEnvironment();
    this.escena.environment = pmrem.fromScene(entorno, 0.04).texture;
    this.escena.environmentIntensity = this.opciones.intensidadEntorno ?? 0.55;
    entorno.dispose?.();
    pmrem.dispose();
  }

  #creaComposer() {
    const ancho = this.contenedor.clientWidth || 1;
    const alto = this.contenedor.clientHeight || 1;
    this.composer = new EffectComposer(this.renderer);
    this._renderPass = new RenderPass(this.escena, this.camara);
    this.composer.addPass(this._renderPass);
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(ancho, alto),
      this.opciones.bloomFuerza,
      this.opciones.bloomRadio,
      this.opciones.bloomUmbral
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  #conectaEventos() {
    this._alRedimensionar = () => this.redimensiona();
    window.addEventListener("resize", this._alRedimensionar, { passive: true });

    if ("ResizeObserver" in window) {
      this._ro = new ResizeObserver(() => this.redimensiona());
      this._ro.observe(this.contenedor);
    }

    this._alMover = (e) => {
      const r = this.contenedor.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2 - 1;
      const y = ((e.clientY - r.top) / r.height) * 2 - 1;
      this.puntero.set(
        Math.max(-1, Math.min(1, x)),
        Math.max(-1, Math.min(1, y))
      );
    };
    window.addEventListener("pointermove", this._alMover, { passive: true });

    if ("IntersectionObserver" in window) {
      this._io = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) {
            this.visible = e.isIntersecting;
            if (this.visible) this.arranca();
            else this.detiene();
          }
        },
        { rootMargin: "120px" }
      );
      this._io.observe(this.contenedor);
    } else {
      this.arranca();
    }

    this._alOcultar = () => {
      if (document.hidden) this.detiene();
      else if (this.visible) this.arranca();
    };
    document.addEventListener("visibilitychange", this._alOcultar);
  }

  /* ---- bucle ---- */
  arranca() {
    if (this.activa || this.destruida) return;
    this.activa = true;
    this.reloj.getDelta();
    const paso = () => {
      if (!this.activa) return;
      this._rafId = requestAnimationFrame(paso);
      const dt = Math.min(this.reloj.getDelta(), 0.05);
      this.tiempo += dt;
      this.punteroSuave.x = amortigua(this.punteroSuave.x, this.puntero.x, 4, dt);
      this.punteroSuave.y = amortigua(this.punteroSuave.y, this.puntero.y, 4, dt);
      this.actualiza(dt, this.tiempo);
      this.render();
    };
    this._rafId = requestAnimationFrame(paso);
  }

  detiene() {
    this.activa = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  render() {
    if (this.destruida) return;
    if (this.composer) this.composer.render();
    else this.renderer.render(this.escena, this.camara);
  }

  /** Renderiza un fotograma suelto (para cuando la escena está pausada). */
  renderizaUnaVez() {
    this.actualiza(0, this.tiempo);
    this.render();
  }

  redimensiona() {
    const ancho = this.contenedor.clientWidth || 1;
    const alto = this.contenedor.clientHeight || 1;
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
    this.renderer.setSize(ancho, alto, false);
    if (this.composer) this.composer.setSize(ancho, alto);
    this.alRedimensionar(ancho, alto);
    if (!this.activa) this.render();
  }

  /** Registra material/geometría para liberarlos al destruir la escena. */
  registra(...recursos) {
    this._recursos.push(...recursos);
    return recursos[0];
  }

  destruye() {
    this.detiene();
    this.destruida = true;
    window.removeEventListener("resize", this._alRedimensionar);
    window.removeEventListener("pointermove", this._alMover);
    document.removeEventListener("visibilitychange", this._alOcultar);
    this._ro?.disconnect();
    this._io?.disconnect();
    this.escena.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const materiales = Array.isArray(o.material) ? o.material : [o.material];
        materiales.forEach((m) => {
          Object.values(m).forEach((v) => {
            if (v && v.isTexture) v.dispose();
          });
          m.dispose();
        });
      }
      o.userData?.dispose?.();
    });
    this._recursos.forEach((r) => r?.dispose?.());
    this.composer?.dispose?.();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
