/* ==========================================================================
   iones.js — Fig. 13, «La Cadena»: siete iones de bario en una trampa de Paul
   Proyecto Coherencia · Ingeniería Web · UTP

   Casi toda la divulgación enseña un único tipo de computador cuántico, el
   superconductor. Esta figura existe para romper ese monocultivo: aquí los
   cúbits son átomos de verdad, suspendidos en el vacío por campos eléctricos
   y leídos con un láser.

   El lector mira DENTRO de la cámara de vacío, como por la ventanilla de la
   foto de la lectura: fondo oscuro, cuatro cuchillas de acero que convergen
   hacia el eje, dos agujas en los extremos y, en medio, la cadena.

   Dos detalles que la hacen fiel y no decorativa:
   · El espaciado de la cadena no es uniforme. En un cristal de Coulomb los
     iones del centro se apiñan y los de los extremos se separan, porque la
     repulsión mutua se compensa distinto en cada posición.
   · La lectura es por fluorescencia: se ilumina la cadena y un ion que está
     en |0⟩ dispersa luz (se ve brillante) mientras uno en |1⟩ permanece
     oscuro. Es literalmente cómo se mide un cúbit de ion atrapado, y es la
     única emisión de luz permitida en todo el sitio, porque es real: el
     bario ionizado fluoresce en el verde azulado, a 493 nanómetros.
   ========================================================================== */
import * as THREE from "three";
import { EscenaBase, colorDeCSS, texturaHalo, amortigua, menosMovimiento } from "./base.js";

/** Posiciones de equilibrio de una cadena de N iones (cristal de Coulomb). */
function posicionesCadena(n, extension = 3.1) {
  // Aproximación estándar: los iones centrales quedan más juntos.
  const pos = [];
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * 2 - 1;            // −1 … 1
    const comprimido = Math.sign(u) * Math.pow(Math.abs(u), 1.32);
    pos.push(comprimido * (extension / 2));
  }
  return pos;
}

/*
 * Medidas de la trampa, en unidades de la escena (la cadena mide 3,1).
 * No es un plano a escala de ningún laboratorio concreto: es la disposición
 * típica de una trampa lineal de cuchillas, con las proporciones justas para
 * que la cadena se lea entera.
 */
const TRAMPA = {
  filo: 0.74,          // distancia del filo de cada cuchilla al eje
  raiz: 3.3,           // hasta dónde llega la cuchilla, ya fuera de cuadro
  penumbra: 0.6,       // a esta distancia del filo la cuchilla ya casi no se ve
  largoFilo: 1.85,     // semilongitud del filo, a lo largo del eje
  largoRaiz: 1.3,      // semilongitud de la raíz: la cuchilla se estrecha hacia fuera
  grosorFilo: 0.014,   // el filo es casi una arista…
  grosorRaiz: 0.15,    // …y la chapa engorda hacia la raíz
  punta: 1.95,         // distancia al centro de la punta de cada aguja de tapa
};

/*
 * Cronología de la medida, en segundos desde que se pulsa el botón.
 * El pulso es breve y se dibuja como indicación de diagrama; los iones se
 * encienden escalonados a lo largo de la cadena para que el ojo la recorra.
 */
const PULSO = { crece: 0.12, sostiene: 0.4, apaga: 0.56 };
const ENCENDIDO = { inicio: 0.16, paso: 0.05 };
const HILO_ENCENDIDO = 0.12;   // lo que queda del haz tras el pulso, relativo al pico

/**
 * Una cuchilla (o uno de sus segmentos) como sólido, entre a ≤ x ≤ b.
 * Se construye por filas desde el filo hasta la raíz: en cada fila la chapa
 * tiene su largo (el contorno es un trapecio) y su grosor, que se estrecha
 * hacia el filo; eso es lo que la hace cuchilla. Cada fila lleva además su
 * tono: la luz se concentra en el centro de la trampa y hacia la raíz la
 * cuchilla se hunde en la penumbra del vacío.
 */
function geometriaCuchilla(a = -Infinity, b = Infinity) {
  const { filo, raiz, largoFilo, largoRaiz, grosorFilo, grosorRaiz, penumbra } = TRAMPA;
  const filas = 30;
  const posiciones = [];
  const colores = [];
  const indices = [];

  // Datos de cada fila: radio, extremos a lo largo del eje, semigrosor, tono
  const fila = [];
  for (let j = 0; j <= filas; j++) {
    const t = Math.pow(j / filas, 1.7);             // más filas junto al filo
    const radio = filo + (raiz - filo) * t;
    const largo = largoFilo + (largoRaiz - largoFilo) * t;
    // Afilado en dos tramos: bisel rápido junto al filo, chapa casi recta después
    const grosor = grosorFilo + (grosorRaiz - grosorFilo) * Math.min(1, Math.sqrt(t * 3.2));
    const u = Math.min(1, (radio - filo) / penumbra);
    fila.push({
      radio,
      izq: Math.max(a, -largo),
      der: Math.min(b, largo),
      w: grosor / 2,
      luz: 1 - 0.94 * u * u * (3 - 2 * u),
    });
  }

  const vertice = (x, y, z, luz) => {
    posiciones.push(x, y, z);
    colores.push(luz, luz, luz);
    return posiciones.length / 3 - 1;
  };

  // Cuatro caras largas; cada una es una tira con dos vértices por fila.
  // El orden (A, B) de cada tira deja la normal hacia fuera.
  const caras = [
    (f) => [[f.izq, f.w], [f.der, f.w]],      // cara delantera (+z local)
    (f) => [[f.der, -f.w], [f.izq, -f.w]],    // cara trasera
    (f) => [[f.izq, -f.w], [f.izq, f.w]],     // canto izquierdo
    (f) => [[f.der, f.w], [f.der, -f.w]],     // canto derecho
  ];
  caras.forEach((cara) => {
    const tira = fila.map((f) => cara(f).map(([x, z]) => vertice(x, f.radio, z, f.luz)));
    for (let j = 0; j < filas; j++) {
      const [a0, b0] = tira[j];
      const [a1, b1] = tira[j + 1];
      indices.push(a0, b0, a1, b0, b1, a1);
    }
  });

  // Tapas: el filo (una arista de pocas centésimas) y la raíz
  [[fila[0], 1], [fila[filas], -1]].forEach(([f, sentido]) => {
    const q = [
      vertice(f.izq, f.radio, -f.w, f.luz),
      vertice(f.der, f.radio, -f.w, f.luz),
      vertice(f.der, f.radio, f.w, f.luz),
      vertice(f.izq, f.radio, f.w, f.luz),
    ];
    if (sentido > 0) indices.push(q[0], q[1], q[2], q[0], q[2], q[3]);
    else indices.push(q[0], q[2], q[1], q[0], q[3], q[2]);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(posiciones, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colores, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Aguja de tapa torneada: punta cónica, caña, escalón con chaflán. */
function geometriaAguja() {
  const perfil = [
    [0, 0], [0.012, 0.004], [0.046, 0.42], [0.05, 0.46], [0.05, 0.92],
    [0.058, 0.93], [0.078, 0.95], [0.078, 1.6], [0.07, 1.62], [0.07, 3.2],
  ].map(([r, h]) => new THREE.Vector2(r, h));
  return new THREE.LatheGeometry(perfil, 48);
}

/**
 * Rótulo de ion: texto monoespaciado con un cerco del color del fondo, como
 * en cartografía, para que se lea igual encima del vacío que encima del acero.
 */
function rotulo(texto, { color, cerco, peso = 500 }) {
  const tamano = 64;
  const fuente = peso + " " + tamano + 'px "IBM Plex Mono", ui-monospace, monospace';
  const lienzo = document.createElement("canvas");
  const ctx = lienzo.getContext("2d");
  ctx.font = fuente;
  const ancho = Math.ceil(ctx.measureText(texto).width) + 40;
  const alto = Math.ceil(tamano * 1.75);
  lienzo.width = ancho;
  lienzo.height = alto;

  const c = lienzo.getContext("2d");
  c.font = fuente;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  c.lineWidth = 14;
  c.strokeStyle = cerco;
  c.strokeText(texto, ancho / 2, alto / 2);
  c.fillStyle = color;
  c.fillText(texto, ancho / 2, alto / 2);

  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  const material = new THREE.SpriteMaterial({
    map: textura,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 12;
  // Proporción del lienzo y tamaño de letra relativo, para escalarlo después
  sprite.userData.proporcion = ancho / alto;
  sprite.userData.letraRelativa = tamano / alto;
  sprite.userData.dispose = () => { textura.dispose(); material.dispose(); };
  return sprite;
}

/** Aro fino: la silueta de un ion que está ahí pero no dispersa luz. */
function texturaAro(tamano = 128) {
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = tamano;
  const g = lienzo.getContext("2d");
  g.strokeStyle = "rgba(255,255,255,1)";
  g.lineWidth = tamano * 0.07;
  g.beginPath();
  g.arc(tamano / 2, tamano / 2, tamano * 0.38, 0, Math.PI * 2);
  g.stroke();
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

export class CadenaIones extends EscenaBase {
  constructor(contenedor, opciones = {}) {
    // Sin sombras: en una cámara de vacío no hay suelo donde caigan.
    // Sin el estudio blanco de la base: la escena monta su propio entorno,
    // el interior oscuro de la cámara (ver #entorno).
    super(contenedor, Object.assign(
      { campoVision: 20, exposicion: 1.0, sombras: false, entorno: false },
      opciones
    ));
  }

  construye() {
    const raiz = this.contenedor;
    const respaldoFondo = "#" + colorDeCSS("--huecograbado", "#0E1013", raiz).getHexString();
    this.col = {
      // El interior de la cámara: la tinta plena de la separata
      fondo: colorDeCSS("--c3d-huecograbado", respaldoFondo, raiz),
      prusia: colorDeCSS("--c3d-prusia", "#1C3A5B", raiz),
      cinabrio: colorDeCSS("--c3d-cinabrio", "#BE3A26", raiz),
      papel: colorDeCSS("--c3d-papel", "#F2EFE6", raiz),
      plomo: colorDeCSS("--c3d-plomo", "#6E6C66", raiz),
      // Fluorescencia real del Ba II a 493 nm: verde azulado
      bario: new THREE.Color("#3fd9c8"),
    };

    this.escena.background = this.col.fondo;
    this.escena.fog = new THREE.Fog(this.col.fondo, 6, 13);

    this.n = 7;
    this.parejaEntrelazada = [1, 5];
    this.xs = posicionesCadena(this.n);

    // Encuadre: se recalcula en alRedimensionar según la proporción de la caja
    this.distancia = 5;
    this.miraY = -0.2;
    this.letra = 0.08;
    this.tamanoIon = 1;

    this.resultados = new Array(this.n).fill(null);
    this.tMedida = null;           // instante de la última medida (o null)
    this.alMedirCallback = null;

    this.#entorno();
    this.#luces();
    this.#trampa();
    this.#iones();
    this.#laser();
    this.#marcas();

    // Vista de tres cuartos: de frente las cuchillas se leen como chapas
    // planas; un poco giradas se ve que son cuchillas
    this.giroObjetivo = 0.26;
    this.giro = 0.26;
    this.#conectaArrastre();

    // La letra de los rótulos puede llegar después que la escena: se pide
    // expresamente y, cuando está, se rehacen
    const letraLista = document.fonts?.load
      ? document.fonts.load('500 64px "IBM Plex Mono"')
      : null;
    letraLista?.then(() => {
      if (this.destruida) return;
      this.#rehaceRotulos();
      if (!this.activa) this.renderizaUnaVez();
    }).catch(() => {});
  }

  /**
   * Lo que reflejan los metales: el interior de la cámara, casi negro, con
   * dos franjas de luz fría y difusa a lo largo del eje, una arriba y otra
   * abajo, como las ventanillas por las que se ilumina y se fotografía la
   * trampa. Cada cuchilla refleja la suya y el acero se lee contra lo oscuro.
   */
  #entorno() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const sala = new THREE.Scene();
    sala.background = this.col.fondo.clone().multiplyScalar(0.6);

    const franja = new THREE.BoxGeometry(14, 0.2, 2.2);
    const fria = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xd6e2ec).multiplyScalar(1.6),
    });
    const tenue = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x9fb3c4).multiplyScalar(0.5),
    });
    [
      [0, 6, 1.2, fria],      // sobre la trampa, algo adelantada
      [0, -6, 1.2, fria],     // debajo, simétrica
      [0, 1.5, -7, tenue],    // fondo: un resto de luz que perfila las agujas
    ].forEach(([x, y, z, material]) => {
      const m = new THREE.Mesh(franja, material);
      m.position.set(x, y, z);
      if (z < 0) m.rotation.x = Math.PI / 2;
      sala.add(m);
    });

    this.escena.environment = pmrem.fromScene(sala, 0.04).texture;
    this.escena.environmentIntensity = 1;
    this.registra(this.escena.environment);
    franja.dispose();
    fria.dispose();
    tenue.dispose();
    pmrem.dispose();
  }

  #luces() {
    // Luz fría y tenue: una principal alta, un contraluz que recorta los filos
    const principal = new THREE.DirectionalLight(0xdce6ef, 1.5);
    principal.position.set(-2.6, 3.6, 3.2);
    this.escena.add(principal);

    const contraluz = new THREE.DirectionalLight(0xa9bccd, 1.3);
    contraluz.position.set(2.4, -1.6, -3.8);
    this.escena.add(contraluz);

    const rasante = new THREE.DirectionalLight(0xc8d3dc, 0.55);
    rasante.position.set(3.5, 0.4, 1.2);
    this.escena.add(rasante);

    // La fluorescencia es luz real: tiñe de cian, muy poco, los filos cercanos.
    // Empieza apagada y solo sube con los iones que brillan.
    this.luzBario = new THREE.PointLight(this.col.bario, 0, 1.6, 2);
    this.escena.add(this.luzBario);
  }

  /**
   * Trampa lineal de cuchillas: cuatro electrodos a 45° alrededor del eje y
   * dos agujas de tapa en los extremos. Dos cuchillas opuestas llevan la
   * radiofrecuencia y son de una pieza; las otras dos van partidas en
   * segmentos que llevan tensión continua.
   */
  #trampa() {
    const acero = new THREE.MeshStandardMaterial({
      color: this.col.plomo.clone().lerp(this.col.papel, 0.45).lerp(this.col.prusia, 0.08),
      metalness: 1,
      roughness: 0.34,
      vertexColors: true,
    });
    const aceroPulido = new THREE.MeshStandardMaterial({
      color: this.col.plomo.clone().lerp(this.col.papel, 0.55),
      metalness: 1,
      roughness: 0.16,
    });

    const entera = geometriaCuchilla();
    // Cortes de los segmentos de continua, con una rendija entre cada dos
    const cortes = [-Infinity, -0.95, -0.3, 0.3, 0.95, Infinity];
    const rendija = 0.028;
    const segmentos = [];
    for (let k = 0; k < cortes.length - 1; k++) {
      segmentos.push(geometriaCuchilla(cortes[k] + rendija, cortes[k + 1] - rendija));
    }

    this.trampaGrupo = new THREE.Group();
    // Las cuchillas van en su propio grupo para poder abrirlas en cajas
    // pequeñas (ver alRedimensionar); las agujas no se mueven
    this.cuchillas = new THREE.Group();
    this.trampaGrupo.add(this.cuchillas);
    const ejeX = new THREE.Vector3(1, 0, 0);
    [45, 135, 225, 315].forEach((grados, k) => {
      const phi = THREE.MathUtils.degToRad(grados);
      const radial = new THREE.Vector3(0, Math.cos(phi), Math.sin(phi));
      const normal = new THREE.Vector3(0, -Math.sin(phi), Math.cos(phi));
      const base = new THREE.Matrix4().makeBasis(ejeX, radial, normal);
      const piezas = k % 2 === 0 ? [entera] : segmentos;
      piezas.forEach((geo) => {
        const m = new THREE.Mesh(geo, acero);
        m.applyMatrix4(base);
        this.cuchillas.add(m);
      });
    });

    // Agujas de tapa: confinan la cadena a lo largo del eje
    const aguja = geometriaAguja();
    [-1, 1].forEach((lado) => {
      const m = new THREE.Mesh(aguja, aceroPulido);
      m.rotation.z = -lado * Math.PI / 2;
      m.position.x = lado * TRAMPA.punta;
      this.trampaGrupo.add(m);
    });

    this.escena.add(this.trampaGrupo);
  }

  #iones() {
    const halo = texturaHalo(128);
    const aro = texturaAro(128);
    const nucleoGeo = new THREE.SphereGeometry(0.042, 24, 16);

    this.col.fantasma = this.col.plomo.clone().lerp(this.col.papel, 0.25);
    this.col.apagado = this.col.fondo.clone().lerp(this.col.plomo, 0.22);
    this.col.encendido = this.col.bario.clone().lerp(new THREE.Color(0xffffff), 0.45);

    const sprite = (mapa, color, aditivo) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: mapa,
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
      return s;
    };

    this.iones = this.xs.map((x, i) => {
      const grupo = new THREE.Group();
      grupo.position.set(x, 0, 0);

      const nucleo = new THREE.Mesh(nucleoGeo, new THREE.MeshBasicMaterial({
        color: this.col.fantasma.clone(),
        transparent: true,
        fog: false,
        toneMapped: false,
      }));
      nucleo.renderOrder = 4;

      // Brillo: halo apretado + halo ancho, en mezcla aditiva sobre lo oscuro
      const haloCerca = sprite(halo, this.col.bario, true);
      const haloLejos = sprite(halo, this.col.bario, true);
      // Fantasma: una mancha gris, se ve que hay algo pero no qué vale
      const bruma = sprite(halo, this.col.fantasma, false);
      // Silueta: el aro que marca dónde está un ion oscuro
      const silueta = sprite(aro, this.col.plomo.clone().lerp(this.col.papel, 0.2), false);
      [haloCerca, haloLejos, bruma, silueta].forEach((s) => { s.renderOrder = 5; grupo.add(s); });
      grupo.add(nucleo);
      this.escena.add(grupo);

      return {
        grupo, nucleo, haloCerca, haloLejos, bruma, silueta,
        x,
        fase: i * 0.9,
        retardo: ENCENDIDO.inicio + i * ENCENDIDO.paso,
        // Pesos de los tres estados posibles; suman uno
        peso: { fantasma: 1, brillante: 0, oscuro: 0 },
      };
    });
  }

  /**
   * Pulso de lectura: una línea fina de 493 nm entre las dos agujas. Es una
   * indicación de diagrama, no el recorrido real del haz en el laboratorio.
   */
  #laser() {
    const largo = TRAMPA.punta * 2 - 0.08;
    const hilo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
    hilo.rotateZ(-Math.PI / 2);
    hilo.translate(0.5, 0, 0);             // de 0 a 1 a lo largo de x

    const material = (opacidad) => new THREE.MeshBasicMaterial({
      color: this.col.bario,
      transparent: true,
      opacity: opacidad,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.haz = new THREE.Group();
    this.haz.position.x = -largo / 2;
    this.hazLargo = largo;
    const nucleo = new THREE.Mesh(hilo, material(0.9));
    const vaina = new THREE.Mesh(hilo, material(0.16));
    this.haz.add(nucleo, vaina);
    this.hazMallas = [nucleo, vaina];
    this.#grosorHaz(0.0045);
    this.hazMateriales = [nucleo.material, vaina.material];
    this.hazOpacidades = [0.9, 0.16];
    this.haz.visible = false;
    this.escena.add(this.haz);
  }

  /** Radio del hilo del haz; la vaina es cuatro veces más ancha. */
  #grosorHaz(radio) {
    const [nucleo, vaina] = this.hazMallas;
    nucleo.scale.set(1, radio, radio);
    vaina.scale.set(1, radio * 4, radio * 4);
  }

  /** Marcas de diagrama: rótulos q0…q6 y el corchete de la pareja entrelazada. */
  #marcas() {
    this.#rehaceRotulos();

    const material = new THREE.MeshBasicMaterial({
      color: this.col.cinabrio,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      fog: false,
      toneMapped: false,
    });
    // El mismo cerco del color del fondo que llevan los rótulos: sin él, el
    // corchete se pierde cuando cae encima del filo iluminado de una cuchilla
    const cerco = new THREE.MeshBasicMaterial({
      color: this.col.fondo,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.9,
      fog: false,
      toneMapped: false,
    });
    const caja = new THREE.BoxGeometry(1, 1, 1);
    const grupo = new THREE.Group();
    // Tres trazos: pata izquierda, pata derecha y base
    const trazos = [0, 1, 2].map(() => new THREE.Mesh(caja, material));
    const cercos = [0, 1, 2].map(() => new THREE.Mesh(caja, cerco));
    cercos.forEach((m) => { m.renderOrder = 10; grupo.add(m); });
    trazos.forEach((m) => { m.renderOrder = 11; grupo.add(m); });
    this.corchete = { grupo, trazos, cercos };
    this.escena.add(grupo);
    this.#colocaMarcas(0.004);
  }

  #rehaceRotulos() {
    const quita = (s) => { if (s) { this.escena.remove(s); s.userData.dispose?.(); } };
    (this.rotulos || []).forEach(quita);
    quita(this.rotuloPareja);

    const cerco = "#" + this.col.fondo.getHexString();
    const claro = "#" + this.col.papel.getHexString();
    const rojo = "#" + this.col.cinabrio.clone().lerp(this.col.papel, 0.12).getHexString();
    this.rotulos = this.xs.map((x, i) => {
      const s = rotulo("q" + i, {
        color: this.parejaEntrelazada.includes(i) ? rojo : claro,
        cerco,
      });
      s.material.opacity = 0.86;
      this.escena.add(s);
      return s;
    });
    this.rotuloPareja = rotulo("entrelazados", { color: rojo, cerco, peso: 500 });
    this.escena.add(this.rotuloPareja);
    this.#colocaMarcas(this.grosorCorchete ?? 0.004);
  }

  /** Coloca rótulos y corchete según el tamaño de letra del encuadre actual. */
  #colocaMarcas(grosor) {
    this.grosorCorchete = grosor;
    const f = this.letra;
    const escalaDe = (s, letra) => {
      const alto = letra / s.userData.letraRelativa;
      s.scale.set(alto * s.userData.proporcion, alto, 1);
    };

    const yRotulo = -0.12 - f * 0.95;
    (this.rotulos || []).forEach((s, i) => {
      escalaDe(s, f);
      s.position.set(this.xs[i], yRotulo, 0);
    });

    if (!this.corchete) return;
    const [a, b] = this.parejaEntrelazada;
    const xa = this.xs[a];
    const xb = this.xs[b];
    const arriba = yRotulo - f * 0.72;
    const abajo = arriba - Math.max(0.05, f * 0.6);
    const medio = (arriba + abajo) / 2;
    const orla = grosor * 3;   // trazo más su cerco, uno y medio a cada lado
    [
      [xa, medio, 0, arriba - abajo],
      [xb, medio, 0, arriba - abajo],
      [(xa + xb) / 2, abajo, xb - xa, 0],
    ].forEach(([x, y, ancho, alto], k) => {
      const trazo = this.corchete.trazos[k];
      const cerco = this.corchete.cercos[k];
      trazo.scale.set(ancho + grosor, alto + grosor, grosor);
      trazo.position.set(x, y, 0);
      cerco.scale.set(ancho + orla, alto + orla, grosor);
      cerco.position.set(x, y, 0);
    });

    if (this.rotuloPareja) {
      escalaDe(this.rotuloPareja, f * 0.82);
      this.rotuloPareja.position.set((xa + xb) / 2, abajo - f * 0.85, 0);
    }
  }

  /**
   * Encuadre: la cadena entera, sus rótulos y el corchete tienen que caber
   * tanto en la caja apaisada del escritorio (21:9) como en la de 4:3 del
   * teléfono. Se aleja la cámara lo justo y se ajusta la letra para que los
   * rótulos se lean a un tamaño parecido en pantalla.
   */
  alRedimensionar(ancho, alto) {
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camara.fov / 2));
    const aspecto = ancho / alto;
    const semiAncho = 2.3;     // cadena ±1,55 más las puntas de las agujas
    const semiAlto = 1.0;      // de los halos de arriba al rótulo de la pareja
    this.distancia = Math.max(semiAncho / (tan * aspecto), semiAlto / tan);

    const pxPorUnidad = alto / (2 * this.distancia * tan);
    // Letra de unos 14 px en el escritorio y algo menor en el teléfono
    const letraPx = alto < 330 ? 12.5 : 14.5;
    this.letra = Math.min(0.2, Math.max(0.06, letraPx / pxPorUnidad));
    // En la caja pequeña los iones crecen un poco para no quedarse en puntos
    this.tamanoIon = Math.min(1.5, Math.max(1, Math.sqrt(180 / pxPorUnidad)));
    this.miraY = -0.04 - this.letra * 1.0;
    // Bajo el eje van rótulos, corchete y «entrelazados»: unas 3,4 letras.
    // En la caja del teléfono la letra ocupa más escena que en el escritorio
    // y no cabría entre los filos; ahí las cuchillas se abren lo justo, solo
    // en el plano del corte (la trampa no está a escala, ver TRAMPA).
    const bajoEje = 0.12 + this.letra * 3.4 + 0.08;
    const apertura = Math.max(1, bajoEje / (TRAMPA.filo * Math.SQRT1_2));
    this.cuchillas.scale.set(1, apertura, apertura);
    this.#colocaMarcas(Math.max(0.004, 1.8 / pxPorUnidad));
    // El hilo del láser no baja de un píxel y medio de ancho en ninguna caja
    this.#grosorHaz(Math.max(0.0045, 0.75 / pxPorUnidad));

    this.escena.fog.near = this.distancia + 0.6;
    this.escena.fog.far = this.distancia + 7.5;
    this.#colocaCamara();
  }

  #colocaCamara() {
    const d = this.distancia;
    const elevacion = 0.035 - this.punteroSuave.y * 0.04;
    this.camara.position.set(
      Math.sin(this.giro) * Math.cos(elevacion) * d,
      this.miraY + Math.sin(elevacion) * d,
      Math.cos(this.giro) * Math.cos(elevacion) * d
    );
    this.camara.lookAt(0, this.miraY, 0);
  }

  #conectaArrastre() {
    const lienzo = this.renderer.domElement;
    lienzo.style.touchAction = "pan-y";
    let ultimo = null;
    const inicio = (e) => { ultimo = e.clientX; lienzo.setPointerCapture?.(e.pointerId); };
    const mover = (e) => {
      if (ultimo === null) return;
      this.giroObjetivo = Math.max(-0.55, Math.min(0.55, this.giroObjetivo + (e.clientX - ultimo) * 0.004));
      ultimo = e.clientX;
      if (!this.activa) this.renderizaUnaVez();
    };
    const fin = () => { ultimo = null; };
    lienzo.addEventListener("pointerdown", inicio);
    lienzo.addEventListener("pointermove", mover);
    lienzo.addEventListener("pointerup", fin);
    lienzo.addEventListener("pointercancel", fin);
    lienzo.addEventListener("pointerleave", fin);
  }

  /* ------------------------------------------------------------------
     API pública
     ------------------------------------------------------------------ */

  alMedir(callback) { this.alMedirCallback = callback; return this; }

  /**
   * Ilumina la cadena y lee el estado de cada ion por fluorescencia.
   * Los iones sueltos salen al azar; los dos entrelazados salen siempre
   * correlacionados, que es justo lo que hay que enseñar.
   */
  mide(aleatorio = Math.random) {
    const [a, b] = this.parejaEntrelazada;
    const valorPar = aleatorio() < 0.5 ? 0 : 1;

    this.resultados = this.iones.map((ion, i) => {
      if (i === a || i === b) return valorPar;
      return aleatorio() < 0.5 ? 0 : 1;
    });

    this.tMedida = this.tiempo;
    // Con la escena pausada (o sin movimiento) no hay animación que ver
    if (!this.activa || menosMovimiento()) this.#saltaAlFinal();
    if (!this.activa) this.renderizaUnaVez();

    const info = {
      bits: this.resultados.join(""),
      pareja: this.parejaEntrelazada,
      valorPareja: valorPar,
      brillantes: this.resultados.filter((v) => v === 0).length,
    };
    this.alMedirCallback?.(info);
    return info;
  }

  /** Apaga el láser y devuelve la cadena a su estado indeterminado. */
  reinicia() {
    this.resultados = new Array(this.n).fill(null);
    this.tMedida = null;
    if (!this.activa || menosMovimiento()) this.#saltaAlFinal();
    if (!this.activa) this.renderizaUnaVez();
    return this;
  }

  /** Estado al que tiende el ion i en el instante t. */
  #estadoObjetivo(i, t, quieto = menosMovimiento()) {
    if (this.tMedida === null || this.resultados[i] === null) return "fantasma";
    const transcurrido = t - this.tMedida;
    const retardo = quieto ? 0 : this.iones[i].retardo;
    if (transcurrido < retardo) return "fantasma";
    // |0⟩ dispersa luz (brillante), |1⟩ queda oscuro
    return this.resultados[i] === 0 ? "brillante" : "oscuro";
  }

  /** Sin transición: cada ion pasa directamente a su estado final. */
  #saltaAlFinal() {
    const t = this.tMedida === null ? this.tiempo : this.tMedida + 10;
    this.iones.forEach((ion, i) => {
      const e = this.#estadoObjetivo(i, t);
      ion.peso.fantasma = e === "fantasma" ? 1 : 0;
      ion.peso.brillante = e === "brillante" ? 1 : 0;
      ion.peso.oscuro = e === "oscuro" ? 1 : 0;
    });
    if (this.tMedida !== null) this.tMedida = this.tiempo - 10;
  }

  /**
   * El pulso recorre el eje, se sostiene y se desvanece. Después, mientras no
   * se pulse «Apagar el láser», queda un hilo muy tenue: el láser sigue
   * encendido y por eso los iones en |0⟩ siguen dispersando luz.
   */
  #actualizaHaz(t, quieto) {
    if (this.tMedida === null) { this.haz.visible = false; return; }
    const tr = quieto ? Infinity : t - this.tMedida;
    const avance = Math.min(1, tr / PULSO.crece);
    const pulso = tr < PULSO.sostiene ? 1
      : Math.max(0, 1 - (tr - PULSO.sostiene) / (PULSO.apaga - PULSO.sostiene));
    const resto = [HILO_ENCENDIDO, 0];   // el hilo tenue no lleva vaina
    this.haz.visible = true;
    this.haz.scale.x = Math.max(0.001, avance * this.hazLargo);
    this.hazMateriales.forEach((m, k) => {
      m.opacity = this.hazOpacidades[k] * Math.max(pulso, resto[k]);
    });
  }

  actualiza(dt, t) {
    this.giro = amortigua(this.giro, this.giroObjetivo + this.punteroSuave.x * 0.1, 4, dt);
    this.#colocaCamara();

    const quieto = menosMovimiento();
    this.#actualizaHaz(t, quieto);

    let fluorescencia = 0;
    const mezcla = this.colorMezcla || (this.colorMezcla = new THREE.Color());
    this.iones.forEach((ion, i) => {
      // Micromovimiento del cristal de Coulomb: los iones vibran en sus modos
      const amplitud = quieto ? 0 : 0.01;
      ion.grupo.position.y = Math.sin(t * 2.1 + ion.fase) * amplitud;
      ion.grupo.position.z = Math.cos(t * 1.7 + ion.fase) * amplitud;

      const e = this.#estadoObjetivo(i, t, quieto);
      // Encenderse es rápido; apagarse o volver a fantasma, algo más lento
      const rapidez = e === "brillante" ? 20 : 11;
      const p = ion.peso;
      p.fantasma = amortigua(p.fantasma, e === "fantasma" ? 1 : 0, rapidez, dt);
      p.brillante = amortigua(p.brillante, e === "brillante" ? 1 : 0, rapidez, dt);
      p.oscuro = amortigua(p.oscuro, e === "oscuro" ? 1 : 0, rapidez, dt);
      const suma = p.fantasma + p.brillante + p.oscuro || 1;
      const wf = p.fantasma / suma;
      const wb = p.brillante / suma;
      const wo = p.oscuro / suma;

      // Núcleo: gris desaturado, cian casi blanco o casi fondo
      const n = ion.nucleo.material;
      n.color.copy(this.col.fantasma).multiplyScalar(wf)
        .add(mezcla.copy(this.col.encendido).multiplyScalar(wb))
        .add(mezcla.copy(this.col.apagado).multiplyScalar(wo));
      n.opacity = 0.42 * wf + 1 * wb + 0.9 * wo;
      const k = this.tamanoIon;
      ion.nucleo.scale.setScalar(k * (1 + wb * 0.25 - wo * 0.1));

      // El brillo respira muy poco, como una fluorescencia contada fotón a fotón
      const respira = quieto ? 1 : 0.94 + Math.sin(t * 5.3 + ion.fase) * 0.06;
      ion.haloCerca.material.opacity = wb * 0.95 * respira;
      ion.haloCerca.scale.setScalar(k * (0.3 + wb * 0.06));
      ion.haloLejos.material.opacity = wb * 0.22 * respira;
      ion.haloLejos.scale.setScalar(k * 0.85);

      ion.bruma.material.opacity = wf * 0.36;
      ion.bruma.scale.setScalar(k * 0.2);

      ion.silueta.material.opacity = wo * 0.75 + wf * 0.1;
      ion.silueta.scale.setScalar(k * 0.15);

      fluorescencia += wb;
    });

    this.luzBario.intensity = fluorescencia * 0.02;
  }
}
