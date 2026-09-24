/* ==========================================================================
   bloch.js — «El Goniómetro»: la esfera de Bloch como instrumento
   Proyecto Coherencia · Ingeniería Web · UTP

   Un cúbit no cabe en un bit, pero sí en una esfera. Esta pieza no es un
   adorno: recibe el vector de Bloch que calcula cuantica.js, así que la aguja
   apunta exactamente a donde está el estado del registro simulado.

   Se presenta como un aparato de latón fotografiado sobre el papel de la
   revista: luz de estudio, sombra de contacto y ninguna superficie que emita
   luz por su cuenta.

   Ejes: en física el polo norte es |0⟩ sobre Z; en three.js el eje vertical
   es Y. La conversión (x, y, z) → (x, z, −y) conserva el sistema dextrógiro.

   La cámara está en la vista de libro de texto: algo elevada sobre el
   ecuador, con +x (|+⟩) saliendo hacia el lector abajo a la izquierda, +y
   (|i⟩) hacia la derecha y z hacia arriba. El ecuador se lee como una elipse.
   ========================================================================== */
import * as THREE from "three";
import { EscenaBase, colorDeCSS, etiquetaSprite, planoSombra, texturaHalo, amortigua, menosMovimiento } from "./base.js";

const aTres = (v) => new THREE.Vector3(v.x, v.z, -v.y);

/* Vista de lectura: acimut desde +x hacia |i⟩ y elevación sobre el ecuador */
const ACIMUT = THREE.MathUtils.degToRad(32);
const ELEVACION = THREE.MathUtils.degToRad(21);

/* Alturas del aparato (el globo tiene radio 1 y está centrado en el origen) */
const SUELO = -1.74;
const BASE_ALTO = 0.075;
const BASE_Y = SUELO + 0.045 + BASE_ALTO / 2;
const BASE_ARRIBA = BASE_Y + BASE_ALTO / 2;

/* Margen del encuadre: fracción de la caja que queda libre a cada lado */
const MARGEN = 0.08;

/* Curva suave para las transiciones: arranca y frena sin tirones */
const suave = (s) => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
const suavisima = (s) => {
  const x = Math.min(1, Math.max(0, s));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export class EsferaBloch extends EscenaBase {
  constructor(contenedor, opciones = {}) {
    super(contenedor, Object.assign({ campoVision: 34, exposicion: 1.12 }, opciones));
  }

  construye() {
    const raiz = this.contenedor;
    this.col = {
      tinta: colorDeCSS("--c3d-tinta", "#17181B", raiz),
      prusia: colorDeCSS("--c3d-prusia", "#1C3A5B", raiz),
      cinabrio: colorDeCSS("--c3d-cinabrio", "#BE3A26", raiz),
      cobre: colorDeCSS("--c3d-cobre", "#A9632A", raiz),
      papel: colorDeCSS("--c3d-papel", "#F2EFE6", raiz),
      plomo: colorDeCSS("--c3d-plomo", "#6E6C66", raiz),
    };

    // Órbita de la cámara: la vista de lectura, más lo que añadan el puntero
    // (un paralaje pequeño) y el arrastre (que vuelve solo a su sitio).
    this.orbita = { acimut: ACIMUT, elevacion: ELEVACION };
    this.arrastre = { acimut: 0, elevacion: 0 };
    this.arrastrando = false;
    this.sueltoHace = 99;
    this.distancia = 7;
    this.mira = new THREE.Vector3(0, -0.3, 0);
    this.camara.up.set(0, 1, 0);

    this.grupo = new THREE.Group();
    this.escena.add(this.grupo);

    this.#luces();
    this.#peana();
    this.#globo();
    this.#anillos();
    this.#ejes();
    this.#etiquetas();
    this.#aguja();
    this.#estela();
    this.#conectaArrastre();

    this.vectorActual = new THREE.Vector3(0, 1, 0);
    this.vectorObjetivo = new THREE.Vector3(0, 1, 0);

    // Transición en curso: la dirección gira por un círculo máximo y la
    // longitud se interpola aparte (un estado mezcla encoge hacia el centro)
    this.transicion = {
      activa: false, t: 0, duracion: 0.75,
      dirA: new THREE.Vector3(0, 1, 0), eje: new THREE.Vector3(1, 0, 0), angulo: 0,
      largoA: 1, largoB: 1,
    };

    // Decoherencia: el reloj que corre en contra
    this.t2 = { activo: false, perdido: false, restante: 0, total: 0, alCambiar: null, inicio: new THREE.Vector3(0, 1, 0) };
    this.marcaMedida = 0;

    this.#aplicaVector();

    // Las etiquetas se dibujan en un canvas: si la tipografía del sitio llega
    // tarde, se vuelven a dibujar con ella para que no se queden en Georgia
    document.fonts?.ready?.then(() => {
      if (this.destruida) return;
      this.#etiquetas();
      this.alRedimensionar();
      if (!this.activa) this.renderizaUnaVez();
    });
  }

  #luces() {
    this.escena.add(new THREE.AmbientLight(0xffffff, 0.55));

    // La luz clave va alta y por delante, a la derecha del lector: así la
    // sombra de la peana cae casi en su vertical y no se despega del pie.
    const atras = this.#haciaCamara(ACIMUT, ELEVACION);
    const derecha = new THREE.Vector3(-Math.sin(ACIMUT), 0, -Math.cos(ACIMUT));
    const clave = new THREE.DirectionalLight(0xfff6ea, 2.6);
    clave.position.copy(atras.multiplyScalar(2.2)).addScaledVector(derecha, 1.6).add(new THREE.Vector3(0, 5.6, 0));
    clave.castShadow = true;
    clave.shadow.mapSize.set(1024, 1024);
    clave.shadow.camera.near = 1;
    clave.shadow.camera.far = 14;
    clave.shadow.camera.left = -1.4;
    clave.shadow.camera.right = 1.4;
    clave.shadow.camera.top = 1.4;
    clave.shadow.camera.bottom = -1.4;
    clave.shadow.bias = -0.0008;
    clave.shadow.normalBias = 0.01;
    clave.shadow.radius = 4;
    this.escena.add(clave);

    const relleno = new THREE.DirectionalLight(0xdfe7ee, 0.9);
    relleno.position.set(-3.4, 1.2, -2);
    this.escena.add(relleno);

    const rasante = new THREE.DirectionalLight(0xffffff, 0.6);
    rasante.position.set(0, -2.4, 2.6);
    this.escena.add(rasante);

    planoSombra(this.escena, { y: SUELO, tamano: 5, opacidad: 0.26 });

    // Sombra de contacto: la penumbra que deja el aparato sobre el papel,
    // más ancha y más tenue la del globo de vidrio que la del pie de latón
    const halo = this.registra(texturaHalo(128));
    const mancha = (radio, opacidad) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(radio * 2, radio * 2),
        new THREE.MeshBasicMaterial({
          color: this.col.tinta,
          map: halo,
          transparent: true,
          opacity: opacidad,
          depthWrite: false,
          toneMapped: false,
        })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = SUELO + 0.002;
      m.renderOrder = -2;
      this.escena.add(m);
    };
    mancha(1.35, 0.14);
    mancha(0.95, 0.3);
  }

  /** Peana de latón: ancla el instrumento al papel. */
  #peana() {
    // Latón cepillado: más mate que la aguja, para que la cara de arriba de
    // la base no se lleve todo el reflejo del estudio
    const laton = new THREE.MeshStandardMaterial({
      color: this.col.cobre,
      metalness: 1,
      roughness: 0.42,
      envMapIntensity: 1.0,
    });
    this.matLaton = laton;
    this.piezasPeana = [];

    const pieza = (geo, x, y, z) => {
      const m = new THREE.Mesh(geo, laton);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.escena.add(m);
      this.piezasPeana.push(m);
      return m;
    };

    pieza(new THREE.CylinderGeometry(0.62, 0.72, BASE_ALTO, 72), 0, BASE_Y, 0);

    const canto = pieza(new THREE.TorusGeometry(0.72, 0.022, 10, 80), 0, BASE_Y - BASE_ALTO / 2, 0);
    canto.rotation.x = Math.PI / 2;

    // El vástago llega justo al polo sur del globo: es el eje del aparato
    const largo = -1 - BASE_ARRIBA;
    pieza(new THREE.CylinderGeometry(0.045, 0.068, largo, 28), 0, BASE_ARRIBA + largo / 2, 0);
    pieza(new THREE.SphereGeometry(0.052, 24, 16), 0, -1.0, 0);

    // Tornillos de nivelación: detalle de aparato real
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      pieza(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 14), Math.cos(a) * 0.55, SUELO + 0.025, Math.sin(a) * 0.55);
    }
  }

  /** El globo: un velo de vidrio, nunca una bola opaca. */
  #globo() {
    const mat = new THREE.MeshPhysicalMaterial({
      color: this.col.papel,
      metalness: 0,
      roughness: 0.06,
      transparent: true,
      opacity: 0.075,
      envMapIntensity: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      depthWrite: false,
    });
    this.globo = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat);
    this.globo.renderOrder = -1;
    this.grupo.add(this.globo);

    // Contorno: el filete de tinta que dibujaría un grabador. Se orienta a la
    // cámara en cada cuadro y se coloca en el círculo de tangencia real.
    this.contorno = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.0042, 8, 220),
      new THREE.MeshBasicMaterial({ color: this.col.prusia, transparent: true, opacity: 0.6, depthWrite: false })
    );
    this.escena.add(this.contorno);
  }

  #anillos() {
    const tinta = (opacidad) =>
      new THREE.MeshBasicMaterial({
        color: this.col.prusia,
        transparent: true,
        opacity: opacidad,
        depthWrite: false,
      });

    // Ecuador en latón: es el limbo graduado del aparato. Fino, para que
    // desde arriba se lea como un anillo y no como una barra.
    const ecuador = new THREE.Mesh(
      new THREE.TorusGeometry(1.002, 0.0075, 12, 220),
      new THREE.MeshStandardMaterial({
        color: this.col.cobre,
        metalness: 1,
        roughness: 0.26,
        envMapIntensity: 1.4,
      })
    );
    ecuador.rotation.x = Math.PI / 2;
    this.grupo.add(ecuador);

    // Graduación del limbo cada 15°: trazos radiales por fuera del vidrio
    const matMarca = new THREE.MeshBasicMaterial({ color: this.col.tinta, transparent: true, opacity: 0.7 });
    const geoLarga = new THREE.BoxGeometry(0.006, 0.085, 0.006);
    const geoCorta = new THREE.BoxGeometry(0.005, 0.045, 0.005);
    const marcas = new THREE.Group();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const larga = i % 6 === 0;
      const m = new THREE.Mesh(larga ? geoLarga : geoCorta, matMarca);
      const r = 1.012 + (larga ? 0.0425 : 0.0225);
      m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      m.rotation.z = Math.PI / 2;
      m.rotation.y = -a;
      marcas.add(m);
    }
    this.grupo.add(marcas);

    // Meridianos principales, en tinta
    const m1 = new THREE.Mesh(new THREE.TorusGeometry(1.001, 0.0038, 10, 190), tinta(0.5));
    this.grupo.add(m1);
    const m2 = new THREE.Mesh(new THREE.TorusGeometry(1.001, 0.0038, 10, 190), tinta(0.5));
    m2.rotation.y = Math.PI / 2;
    this.grupo.add(m2);

    // Paralelos y meridianos secundarios: la retícula del globo
    for (const lat of [-0.7, -0.4, 0.4, 0.7]) {
      const r = Math.sqrt(Math.max(0.0001, 1 - lat * lat));
      const p = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0022, 8, 150), tinta(0.2));
      p.rotation.x = Math.PI / 2;
      p.position.y = lat;
      this.grupo.add(p);
    }
    for (let i = 1; i < 6; i++) {
      if (i === 3) continue; // ese ya es el meridiano principal m2
      const m = new THREE.Mesh(new THREE.TorusGeometry(1.0005, 0.0018, 8, 150), tinta(0.15));
      m.rotation.y = (i * Math.PI) / 6;
      this.grupo.add(m);
    }
  }

  #ejes() {
    const hacer = (dir, color, opacidad, desde, hasta) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        dir.clone().multiplyScalar(desde),
        dir.clone().multiplyScalar(hasta),
      ]);
      const linea = new THREE.Line(
        geo,
        new THREE.LineDashedMaterial({
          color,
          transparent: true,
          opacity: opacidad,
          dashSize: 0.05,
          gapSize: 0.04,
        })
      );
      linea.computeLineDistances();
      this.grupo.add(linea);
    };
    // El eje z no baja del polo sur: por debajo ya está el vástago de la peana
    hacer(new THREE.Vector3(0, 1, 0), this.col.tinta.getHex(), 0.55, -1, 1.12);
    hacer(new THREE.Vector3(1, 0, 0), this.col.prusia.getHex(), 0.45, -1.18, 1.18);
    hacer(new THREE.Vector3(0, 0, 1), this.col.prusia.getHex(), 0.45, -1.18, 1.18);
  }

  /**
   * Las seis etiquetas. No viven en un punto fijo del espacio: en cada cuadro
   * se colocan justo fuera del contorno del globo, en la dirección en que su
   * eje se ve en pantalla. Así nunca quedan dentro del vidrio ni se pisan.
   */
  #etiquetas() {
    if (this.etiquetas) {
      for (const e of this.etiquetas) {
        this.escena.remove(e.sprite);
        e.sprite.userData.dispose?.();
      }
    }
    const tinta = "#" + this.col.tinta.getHexString();
    const prusia = "#" + this.col.prusia.getHexString();
    const familia =
      getComputedStyle(document.documentElement).getPropertyValue("--texto").trim() ||
      '"Source Serif 4", "Iowan Old Style", "Palatino Linotype", Georgia, serif';
    const fuente = "500 72px " + familia;

    const poner = (texto, eje, color, escala, polo) => {
      const sprite = etiquetaSprite(texto, { color, escala, fuente });
      this.escena.add(sprite);
      // Mitades de la caja del texto, sin el relleno transparente del canvas
      const lienzo = sprite.material.map.image;
      const anchoTexto = (lienzo.width - 52) / lienzo.width;
      return { sprite, eje, escala, polo, proporcion: sprite.scale.x / escala, anchoTexto };
    };

    this.etiquetas = [
      poner("|0⟩", new THREE.Vector3(0, 1, 0), tinta, 0.3, "norte"),
      poner("|1⟩", new THREE.Vector3(0, -1, 0), tinta, 0.3, "sur"),
      poner("|+⟩", new THREE.Vector3(1, 0, 0), prusia, 0.27),
      poner("|−⟩", new THREE.Vector3(-1, 0, 0), prusia, 0.27),
      poner("|i⟩", new THREE.Vector3(0, 0, -1), prusia, 0.27),
      poner("|−i⟩", new THREE.Vector3(0, 0, 1), prusia, 0.27),
    ];
    this.escalaEtiquetas = this.escalaEtiquetas || 1;
  }

  /** La aguja de latón que marca el estado. */
  #aguja() {
    this.flecha = new THREE.Group();

    this.matAguja = new THREE.MeshStandardMaterial({
      color: this.col.cobre.clone().offsetHSL(0, 0.06, 0.1),
      metalness: 1,
      roughness: 0.18,
      envMapIntensity: 2.1,
    });
    this.colorAguja = this.matAguja.color.clone();

    // Asta y punta se escalan a lo largo; el grosor se mantiene legible
    this.asta = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 1, 22), this.matAguja);
    this.flecha.add(this.asta);

    this.puntaFlecha = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.2, 30), this.matAguja);
    this.flecha.add(this.puntaFlecha);

    // La rótula no se esconde nunca: con un estado de longitud cero (un
    // cúbit entrelazado del todo) es lo único que queda en el centro
    const rotula = new THREE.Mesh(new THREE.SphereGeometry(0.052, 28, 20), this.matAguja);
    this.grupo.add(rotula);

    // Punto de lectura sobre la superficie: disco de tinta roja, sin brillo
    this.punto = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 24, 18),
      new THREE.MeshStandardMaterial({
        color: this.col.cinabrio,
        metalness: 0.1,
        roughness: 0.5,
      })
    );
    this.grupo.add(this.punto);

    this.grupo.add(this.flecha);
  }

  #estela() {
    this.maxEstela = 240;
    this.estelaPuntos = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.maxEstela * 3), 3));
    geo.setDrawRange(0, 0);
    this.estela = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: this.col.cinabrio,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
    );
    this.estela.frustumCulled = false;
    this.grupo.add(this.estela);
  }

  #conectaArrastre() {
    const lienzo = this.renderer.domElement;
    lienzo.style.touchAction = "pan-y";
    lienzo.style.cursor = "grab";
    let ultimo = null;

    const inicio = (e) => {
      this.arrastrando = true;
      ultimo = { x: e.clientX, y: e.clientY };
      lienzo.style.cursor = "grabbing";
      lienzo.setPointerCapture?.(e.pointerId);
    };
    const mover = (e) => {
      if (!this.arrastrando || !ultimo) return;
      this.arrastre.acimut -= (e.clientX - ultimo.x) * 0.0072;
      // La elevación se limita: por debajo del ecuador la peana tapa el globo
      this.arrastre.elevacion = THREE.MathUtils.clamp(
        this.arrastre.elevacion + (e.clientY - ultimo.y) * 0.005,
        THREE.MathUtils.degToRad(6) - ELEVACION,
        THREE.MathUtils.degToRad(48) - ELEVACION
      );
      ultimo = { x: e.clientX, y: e.clientY };
      if (!this.activa) this.renderizaUnaVez();
    };
    const fin = () => {
      if (this.arrastrando) this.sueltoHace = 0;
      // Si se dio varias vueltas, la vuelta a la vista de lectura es la corta
      const a = this.arrastre.acimut;
      this.arrastre.acimut = Math.atan2(Math.sin(a), Math.cos(a));
      this.arrastrando = false;
      ultimo = null;
      lienzo.style.cursor = "grab";
    };

    lienzo.addEventListener("pointerdown", inicio);
    lienzo.addEventListener("pointermove", mover);
    lienzo.addEventListener("pointerup", fin);
    lienzo.addEventListener("pointercancel", fin);
    lienzo.addEventListener("pointerleave", fin);
  }

  /* ------------------------------------------------------------------
     Cámara y encuadre
     ------------------------------------------------------------------ */

  /** Vector unitario desde el centro hacia la cámara, dada la órbita. */
  #haciaCamara(acimut, elevacion) {
    return new THREE.Vector3(
      Math.cos(elevacion) * Math.cos(acimut),
      Math.sin(elevacion),
      -Math.cos(elevacion) * Math.sin(acimut)
    );
  }

  #colocaCamara(acimut, elevacion) {
    const atras = this.#haciaCamara(acimut, elevacion);
    this.camara.position.copy(this.mira).addScaledVector(atras, this.distancia);
    this.camara.lookAt(this.mira);
    this.camara.updateMatrixWorld(true);
  }

  /**
   * Coloca las etiquetas y el contorno según la cámara actual. Todo se mide
   * en el plano que pasa por el centro del globo, de frente a la cámara.
   */
  #colocaRotulos() {
    const derecha = new THREE.Vector3().setFromMatrixColumn(this.camara.matrixWorld, 0);
    const arriba = new THREE.Vector3().setFromMatrixColumn(this.camara.matrixWorld, 1);
    const haciaCam = this.camara.position.clone(); // el globo está en el origen
    const dc = haciaCam.length();
    haciaCam.divideScalar(dc);

    // Radio aparente del globo en ese plano (la perspectiva lo abulta un poco)
    const silueta = dc / Math.sqrt(Math.max(1.0001, dc * dc - 1));
    this.contorno.position.copy(haciaCam).multiplyScalar(1 / dc);
    this.contorno.scale.setScalar(Math.sqrt(1 - 1 / (dc * dc)));
    // Su plano es perpendicular a la visual que va al centro del globo, no al
    // eje de la cámara: la cámara mira un poco más abajo, hacia la peana
    this.contorno.lookAt(this.camara.position);

    const holgura = 0.07;
    for (const e of this.etiquetas) {
      const escala = e.escala * this.escalaEtiquetas;
      e.sprite.scale.set(e.proporcion * escala, escala, 1);
      const mx = (e.proporcion * escala * e.anchoTexto) / 2; // media anchura del texto
      const my = escala * 0.27; // media altura del texto

      let x, y;
      if (e.polo === "sur") {
        // |1⟩ no puede ir debajo del polo: ahí está el vástago. Va a su
        // derecha, pegada al vidrio y por encima de la base.
        x = 0.11 + mx;
        y = -Math.sqrt(Math.max(0, silueta * silueta - x * x)) - holgura * 0.6 - my;
      } else {
        const dx = e.eje.dot(derecha);
        const dy = e.eje.dot(arriba);
        const n = Math.hypot(dx, dy);
        // Un eje que apunta casi a la cámara no tiene dirección en pantalla:
        // su etiqueta se apaga hasta que el arrastre lo vuelve a tumbar
        e.sprite.material.opacity = THREE.MathUtils.smoothstep(n, 0.12, 0.3);
        const ux = n > 1e-4 ? dx / n : 0;
        const uy = n > 1e-4 ? dy / n : 1;
        const rho = silueta + holgura + mx * Math.abs(ux) + my * Math.abs(uy);
        x = ux * rho;
        y = uy * rho;
      }
      e.sprite.position.set(0, 0, 0).addScaledVector(derecha, x).addScaledVector(arriba, y);
      e.caja = { x, y, mx, my };
    }
  }

  /**
   * Distancia y punto de mira para que el instrumento entero —de la etiqueta
   * |0⟩ al pie de la peana— quepa con un margen de un 8 % a cada lado, sea
   * cual sea la proporción de la caja. Parte de la esfera envolvente del
   * aparato y afina con sus puntos extremos vistos desde la vista de lectura.
   */
  alRedimensionar() {
    if (!this.etiquetas) return;
    const cam = this.camara;
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const tanH = tanV * cam.aspect;
    const k = 1 - 2 * MARGEN;
    const altoPx = this.contenedor.clientHeight || 1;

    // Primera estimación: esfera envolvente del aparato
    const centro = new THREE.Vector3(0, (1.34 + SUELO) / 2, 0);
    const radio = Math.hypot(0.74, BASE_Y - centro.y) + 0.05;
    const angulo = Math.atan(k * Math.min(tanV, tanH));
    this.mira.copy(centro);
    this.distancia = radio / Math.sin(angulo);

    // Contorno de la peana: dos círculos (canto inferior y cara superior)
    const peana = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      peana.push(new THREE.Vector3(Math.cos(a) * 0.742, BASE_Y - BASE_ALTO / 2, Math.sin(a) * 0.742));
      peana.push(new THREE.Vector3(Math.cos(a) * 0.62, BASE_ARRIBA, Math.sin(a) * 0.62));
    }

    for (let pasada = 0; pasada < 5; pasada++) {
      // Rótulos legibles también en el teléfono: el cuerpo de los ecuatoriales
      // (escala 0,27; la letra ocupa 72/142 del alto del lienzo) no baja de 15 px
      const pxPorUnidad = altoPx / (2 * this.distancia * tanV);
      this.escalaEtiquetas = THREE.MathUtils.clamp(15 / (0.27 * (72 / 142) * pxPorUnidad), 1, 2.2);

      this.#colocaCamara(ACIMUT, ELEVACION);
      this.#colocaRotulos();
      const derecha = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const arriba = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const atras = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 2);

      // Puntos extremos: peana, contorno del globo y las cajas de los rótulos
      const puntos = peana.slice();
      for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        puntos.push(derecha.clone().multiplyScalar(sx * 1.02).addScaledVector(arriba, sy * 1.02));
      }
      for (const e of this.etiquetas) {
        const { x, y, mx, my } = e.caja;
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          puntos.push(derecha.clone().multiplyScalar(x + sx * mx).addScaledVector(arriba, y + sy * my));
        }
      }

      // Distancia mínima para que cada punto quede dentro del cono recortado
      let d = 0;
      let arribaMax = -Infinity, abajoMin = Infinity;
      for (const p of puntos) {
        const rel = p.clone().sub(this.mira);
        const px = rel.dot(derecha), py = rel.dot(arriba), pz = rel.dot(atras);
        d = Math.max(d, pz + Math.abs(py) / (k * tanV), pz + Math.abs(px) / (k * tanH));
        const prof = this.distancia - pz;
        arribaMax = Math.max(arribaMax, py / prof);
        abajoMin = Math.min(abajoMin, py / prof);
      }
      this.distancia = d;
      // Centra el aparato en vertical: iguala el margen de arriba y el de abajo
      this.mira.addScaledVector(arriba, ((arribaMax + abajoMin) / 2) * this.distancia);
    }

    this.#colocaCamara(this.orbita.acimut, this.orbita.elevacion);
    this.#colocaRotulos();
  }

  /* ------------------------------------------------------------------
     API pública
     ------------------------------------------------------------------ */

  /** Coloca el vector de estado. Espera {x, y, z} en coordenadas de física. */
  ponVector(v, opciones = {}) {
    const destino = aTres(v);
    // Mientras corre T2, o después de que se agote, la consola vuelve a
    // mandar el mismo estado lógico al repintar sus rótulos. Eso no es una
    // operación: la aguja sigue decayendo o se queda donde cayó. Solo un
    // estado distinto (o un paraT2 previo) la saca de ahí.
    if ((this.t2.activo || this.t2.perdido) && destino.distanceToSquared(this.vectorObjetivo) < 1e-10) {
      if (!this.activa) this.renderizaUnaVez();
      return this;
    }
    this.t2.activo = false;
    this.t2.perdido = false;
    this.vectorObjetivo.copy(destino);

    const inmediato = opciones.inmediato || menosMovimiento();
    this.#preparaTransicion(destino);

    if (inmediato) {
      // Sin animación, pero la estela sí dibuja el camino entero de la punta
      if (this.transicion.activa) {
        for (let i = 0; i <= 32; i++) this.#anotaEstela(this.#puntoDeTransicion(i / 32));
      }
      this.transicion.activa = false;
      this.vectorActual.copy(destino);
      this.#aplicaVector();
    }
    if (!this.activa) this.renderizaUnaVez();
    return this;
  }

  /**
   * Arranca el reloj de la decoherencia: durante `segundos` el vector se va
   * acortando hacia el centro y luego cae al polo |0⟩, que es lo que de
   * verdad le pasa a un cúbit cuando el entorno lo mira. Es el antagonista
   * de esta historia.
   */
  arrancaT2(segundos = 12, alCambiar = null) {
    this.transicion.activa = false;
    this.t2 = {
      activo: true,
      restante: segundos,
      total: segundos,
      alCambiar,
      perdido: false,
      inicio: this.vectorActual.clone(),
    };
    return this;
  }

  paraT2() {
    this.t2.activo = false;
    this.t2.perdido = false;
    return this;
  }

  /** Marca de medición: un golpe de tinta roja, sin destellos. */
  destello() {
    this.marcaMedida = 1;
    this.limpiaEstela();
    this.paraT2();
    if (!this.activa) this.renderizaUnaVez();
    return this;
  }

  limpiaEstela() {
    this.estelaPuntos.length = 0;
    this.estela.geometry.setDrawRange(0, 0);
    return this;
  }

  /* ------------------------------------------------------------------
     Movimiento del vector
     ------------------------------------------------------------------ */

  /**
   * Una puerta es una rotación: la punta viaja por la superficie siguiendo el
   * círculo máximo entre el estado de partida y el de llegada. La longitud,
   * que mide la pureza, se interpola por separado.
   */
  #preparaTransicion(destino) {
    const tr = this.transicion;
    const largoA = this.vectorActual.length();
    const largoB = destino.length();
    const dirB = largoB > 1e-4 ? destino.clone().divideScalar(largoB) : null;
    const dirA = largoA > 1e-4 ? this.vectorActual.clone().divideScalar(largoA) : dirB;
    const fin = dirB || dirA;

    if (!dirA || !fin) {
      tr.activa = false;
      return;
    }

    let angulo = dirA.angleTo(fin);
    const eje = new THREE.Vector3().crossVectors(dirA, fin);
    if (eje.lengthSq() < 1e-10) {
      if (angulo > Math.PI / 2) {
        // Estados opuestos (una X sobre |0⟩, por ejemplo): cualquier círculo
        // máximo vale. Se elige uno que pase por la cara que se ve pero
        // sesgado hacia un lado: el que pasa justo de frente se vería de
        // canto, como una recta que atraviesa el globo.
        const frente = this.#haciaCamara(this.orbita.acimut, this.orbita.elevacion);
        frente.addScaledVector(dirA, -frente.dot(dirA));
        if (frente.lengthSq() < 1e-6) frente.set(1, 0, 0).addScaledVector(dirA, -dirA.x);
        frente.normalize();
        const lado = new THREE.Vector3().crossVectors(frente, dirA).normalize();
        const paso = frente.multiplyScalar(0.6).addScaledVector(lado, 0.8);
        eje.crossVectors(dirA, paso);
        angulo = Math.PI;
      } else {
        eje.set(1, 0, 0);
        angulo = 0;
      }
    }
    eje.normalize();

    if (angulo < 1e-4 && Math.abs(largoA - largoB) < 1e-4) {
      tr.activa = false;
      return;
    }

    tr.dirA.copy(dirA);
    tr.eje.copy(eje);
    tr.angulo = angulo;
    tr.largoA = largoA;
    tr.largoB = largoB;
    tr.t = 0;
    // Entre 0,6 s para un giro corto y 0,9 s para media vuelta
    tr.duracion = 0.6 + 0.3 * Math.max(angulo / Math.PI, Math.abs(largoB - largoA));
    tr.activa = true;
  }

  #puntoDeTransicion(s) {
    const tr = this.transicion;
    const k = suave(Math.min(1, Math.max(0, s)));
    return tr.dirA
      .clone()
      .applyAxisAngle(tr.eje, tr.angulo * k)
      .multiplyScalar(THREE.MathUtils.lerp(tr.largoA, tr.largoB, k));
  }

  /**
   * Decoherencia a escala humana. Primero se pierde la fase (T2): la parte
   * transversal del vector se apaga y la punta se mete hacia el eje. Después
   * el cúbit se relaja a su estado fundamental (T1) y la punta sube a |0⟩.
   * Las dos curvas son didácticas, estiradas para que todo quepa en los
   * segundos del reloj; no son un ajuste a medidas de ningún procesador.
   */
  #vectorDecoherido(s) {
    const v = this.t2.inicio;
    const tau2 = 0.14;
    const transversal = (Math.exp(-s / tau2) - Math.exp(-1 / tau2)) / (1 - Math.exp(-1 / tau2));
    const pendiente = 1 - suavisima((s - 0.3) / 0.7);
    return new THREE.Vector3(v.x * transversal, 1 - (1 - v.y) * pendiente, v.z * transversal);
  }

  #aplicaVector() {
    const v = this.vectorActual;
    const largo = v.length();

    if (largo > 1e-4) {
      const dir = v.clone().divideScalar(largo);
      this.flecha.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      // La punta mide 0,2 y acaba justo en el punto de lectura; el asta
      // cubre el resto. Si el vector es muy corto, la punta se encoge con él.
      const punta = Math.min(0.2, largo * 0.45);
      const asta = Math.max(0.001, largo - punta);
      this.asta.scale.set(1, asta, 1);
      this.asta.position.y = asta / 2;
      this.puntaFlecha.scale.setScalar(punta / 0.2);
      this.puntaFlecha.position.y = largo - punta / 2;
      this.flecha.visible = largo > 0.04;
      this.punto.position.copy(dir.multiplyScalar(largo));
      this.punto.visible = largo > 0.04;
    } else {
      this.flecha.visible = false;
      this.punto.visible = false;
    }

    // Un estado entrelazado o decoherido pierde longitud: el latón se apaga
    const mezcla = 1 - Math.min(1, largo);
    this.matAguja.roughness = 0.2 + mezcla * 0.5;
    this.matAguja.color.copy(this.colorAguja).lerp(this.col.plomo, mezcla * 0.85);
    this.punto.material.color.copy(this.col.cinabrio).lerp(this.col.plomo, mezcla * 0.8);
  }

  #anotaEstela(p) {
    const ultimo = this.estelaPuntos[this.estelaPuntos.length - 1];
    if (ultimo && ultimo.distanceToSquared(p) <= 0.00006) return;
    this.estelaPuntos.push(p.clone());
    if (this.estelaPuntos.length > this.maxEstela) this.estelaPuntos.shift();

    const n = this.estelaPuntos.length;
    if (n < 2) {
      this.estela.geometry.setDrawRange(0, 0);
      return;
    }
    const pos = this.estela.geometry.attributes.position.array;
    for (let i = 0; i < n; i++) {
      const q = this.estelaPuntos[i];
      pos[i * 3] = q.x;
      pos[i * 3 + 1] = q.y;
      pos[i * 3 + 2] = q.z;
    }
    this.estela.geometry.attributes.position.needsUpdate = true;
    this.estela.geometry.setDrawRange(0, n);
  }

  actualiza(dt, t) {
    // Paralaje del puntero, pequeño; y el arrastre, que vuelve solo a la
    // vista de lectura un momento después de soltar el aparato
    if (!this.arrastrando) {
      this.sueltoHace += dt;
      if (this.sueltoHace > 1.4) {
        const vuelta = menosMovimiento() ? 60 : 1.6;
        this.arrastre.acimut = amortigua(this.arrastre.acimut, 0, vuelta, dt);
        this.arrastre.elevacion = amortigua(this.arrastre.elevacion, 0, vuelta, dt);
      }
    }
    const paralaje = menosMovimiento() ? 0 : 1;
    this.orbita.acimut = ACIMUT + this.arrastre.acimut - this.punteroSuave.x * 0.045 * paralaje;
    this.orbita.elevacion = ELEVACION + this.arrastre.elevacion + this.punteroSuave.y * 0.025 * paralaje;
    this.#colocaCamara(this.orbita.acimut, this.orbita.elevacion);
    this.#colocaRotulos();

    if (dt > 0) {
      if (this.t2.activo) {
        // Decoherencia: el vector se acorta hacia el centro y cae a |0⟩
        this.t2.restante = Math.max(0, this.t2.restante - dt);
        const caida = 1 - this.t2.restante / this.t2.total;
        this.vectorActual.copy(this.#vectorDecoherido(caida));
        const agotado = this.t2.restante <= 0;
        if (agotado) this.t2.perdido = true;
        this.t2.alCambiar?.(this.t2.restante, caida);
        if (agotado) {
          // El estado perdido no vuelve: la aguja se queda donde ha caído
          this.t2.activo = false;
          this.t2.perdido = true;
        }
      } else if (this.transicion.activa) {
        const tr = this.transicion;
        tr.t += dt;
        const s = tr.t / tr.duracion;
        if (s >= 1) {
          tr.activa = false;
          this.vectorActual.copy(this.vectorObjetivo);
        } else {
          this.vectorActual.copy(this.#puntoDeTransicion(s));
        }
      }
    }

    this.#aplicaVector();
    if (this.punto.visible) this.#anotaEstela(this.punto.position);

    // La marca de la medición se seca como tinta
    if (this.marcaMedida > 0.001) {
      this.marcaMedida = amortigua(this.marcaMedida, 0, 4.2, dt);
      const f = this.marcaMedida;
      this.punto.scale.setScalar(1 + f * 1.8);
    } else {
      this.punto.scale.setScalar(1);
    }
  }
}
