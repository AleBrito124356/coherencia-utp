/* ==========================================================================
   criostato.js — Refrigerador de dilución construido por procedimiento
   Proyecto Coherencia · Ingeniería Web · UTP

   Es la pieza que casi todo el mundo ha visto en una foto y casi nadie sabe
   leer: la "lámpara de araña" dorada no es el computador cuántico, es el
   frigorífico que lo mantiene a milikelvin. Cada bandeja es una etapa térmica
   y el chip vive abajo del todo, colgado bajo la etapa más fría.

   La escena se recorre con el scroll: al bajar, la cámara desciende por las
   etapas y, al final, se mete por debajo de la placa de mezcla hasta el
   portamuestras donde está el procesador.
   ========================================================================== */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { EscenaBase, colorDeCSS, etiquetaSprite, amortigua, menosMovimiento } from "./base.js";

/** Etapas térmicas reales de un criostato de dilución comercial. */
export const ETAPAS = [
  { y: 3.15, radio: 1.62, nombre: "Brida de vacío", temp: "300 K", detalle: "Temperatura ambiente" },
  { y: 1.95, radio: 1.38, nombre: "Escudo de 50 K", temp: "50 K", detalle: "Primera etapa del pulso-tubo" },
  { y: 0.85, radio: 1.15, nombre: "Escudo de 4 K", temp: "4 K", detalle: "Segunda etapa: helio líquido" },
  { y: -0.1, radio: 0.94, nombre: "Placa fría", temp: "800 mK", detalle: "Olla de evaporación" },
  { y: -0.95, radio: 0.74, nombre: "Intercambiador", temp: "100 mK", detalle: "Circuito de ³He/⁴He" },
  { y: -1.78, radio: 0.56, nombre: "Placa de mezcla", temp: "10 mK", detalle: "Aquí vive el procesador" },
];

/* ---- Medidas del montaje (unidades de escena) ---- */
const GROSOR_PLACA = 0.052;
const Y_MEZCLA = ETAPAS[ETAPAS.length - 1].y;

// El portamuestras cuelga de un dedo frío bajo la placa de mezcla, boca
// abajo: la cara del chip mira al suelo. Así el giro del plato no lo aparta
// nunca de la cámara, que al final del recorrido lo mira desde abajo.
const LADO_CAJA = 0.5;
const PARED_CAJA = 0.05;
const FONDO_CAJA = 0.035;          // grosor del suelo del portamuestras
const ALTO_PARED = 0.085;          // lo que sobresale la pared por encima del suelo
const LARGO_DEDO = 0.274;          // de la cara inferior de la placa al portamuestras
const Y_SUELO_CAJA = Y_MEZCLA - GROSOR_PLACA / 2 - LARGO_DEDO - FONDO_CAJA;
const Y_CONECTOR = Y_SUELO_CAJA - 0.04;
const Y_CHIP = Y_SUELO_CAJA - 0.03; // punto de mira del plano final
const LADO_DADO = 0.19;

// Coaxiales: cuatro haces de tres líneas entre las columnas. Las laterales
// de los haces de 0° y 180° siguen hasta los conectores del portamuestras,
// así que su ángulo se elige para caer justo en la vertical del conector.
const X_BAJADA = 0.48;             // distancia al eje de la bajada final
const Z_CONECTOR = 0.12;
const X_PUNTA = 0.38;              // donde el cable entra en su conector
const DELTA_HAZ = Math.atan2(Z_CONECTOR, X_BAJADA);
const ESCALON = 0.085;             // el quiebro de anclaje, bajo cada placa
const Y_ENTRADA = ETAPAS[0].y + 0.24;

const suave = (x) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
const mezcla = (a, b, t) => a + (b - a) * t;

/**
 * Curva que pasa exactamente por una lista de puntos, tramo recto a tramo
 * recto. TubeGeometry reparte sus anillos por longitud de arco; aquí interesa
 * un anillo por punto, para que los tramos largos no gasten vértices y los
 * codos tengan los que necesitan.
 */
class Polilinea extends THREE.Curve {
  constructor(puntos) {
    super();
    this.puntos = puntos;
  }
  getPoint(t, destino = new THREE.Vector3()) {
    const n = this.puntos.length - 1;
    const f = Math.max(0, Math.min(n, t * n));
    const i = Math.min(n - 1, Math.floor(f));
    return destino.lerpVectors(this.puntos[i], this.puntos[i + 1], f - i);
  }
  getPointAt(u, destino) { return this.getPoint(u, destino); }
  getTangentAt(u, destino) { return this.getTangent(u, destino); }
}

/** Sustituye cada esquina de una polilínea por un codo de radio corto. */
function redondea(esquinas, radio, pasos = 5) {
  const salida = [esquinas[0].clone()];
  for (let i = 1; i < esquinas.length - 1; i++) {
    const a = esquinas[i - 1], b = esquinas[i], c = esquinas[i + 1];
    const ba = a.clone().sub(b), bc = c.clone().sub(b);
    const la = ba.length(), lc = bc.length();
    ba.normalize();
    bc.normalize();
    // Punto de paso en un tramo recto: no hay codo que hacer
    if (ba.dot(bc) < -0.9995) { salida.push(b.clone()); continue; }
    const r = Math.min(radio, la / 2, lc / 2);
    const p0 = b.clone().addScaledVector(ba, r);
    const p2 = b.clone().addScaledVector(bc, r);
    for (let k = 0; k <= pasos; k++) {
      const t = k / pasos, u = 1 - t;
      salida.push(new THREE.Vector3()
        .addScaledVector(p0, u * u)
        .addScaledVector(b, 2 * u * t)
        .addScaledVector(p2, t * t));
    }
  }
  salida.push(esquinas[esquinas.length - 1].clone());
  return salida;
}

/** Punto en coordenadas cilíndricas del aparato. */
const enAnillo = (r, a, y) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);

export class Criostato extends EscenaBase {
  constructor(contenedor, opciones = {}) {
    // Sin sombras arrojadas: el aparato cuelga del techo del laboratorio, no
    // se apoya en ningún suelo, y una sombra en el papel lo contradecía.
    super(contenedor, { ...opciones, sombras: false });
  }

  construye() {
    const raiz = this.contenedor;
    this.col = {
      metal: colorDeCSS("--c3d-cobre", "#A9632A", raiz),
      acero: colorDeCSS("--c3d-plomo", "#6E6C66", raiz),
      frio: colorDeCSS("--c3d-prusia", "#1C3A5B", raiz),
      acento: colorDeCSS("--c3d-cinabrio", "#BE3A26", raiz),
      papel: colorDeCSS("--c3d-papel", "#F2EFE6", raiz),
      fondo: colorDeCSS("--c3d-tinta", "#17181B", raiz),
    };

    // Sin niebla: esto es un objeto fotografiado en un estudio, sobre papel.

    this.camara.position.set(0, 3.4, 6.2);
    this.progreso = 0;
    this.progresoSuave = 0;
    this.etapaActiva = 0;
    this.etapaAnunciada = -1;
    this.avisoEtapa = null;

    this.conjunto = new THREE.Group();
    this.escena.add(this.conjunto);

    this.#luces();
    this.#materiales();
    this.#trazado();
    this.#bandejas();
    this.#columnas();
    this.#cableado();
    this.#procesador();
    this.#etiquetas();

    this.#recalcula(this.contenedor.clientWidth || 1, this.contenedor.clientHeight || 1);
    this.ponProgreso(0);
  }

  #luces() {
    // Iluminación de estudio: toda la luz entra desde fuera del objeto.
    this.escena.add(new THREE.AmbientLight(0xffffff, 0.5));

    const clave = new THREE.DirectionalLight(0xfff4e6, 2.5);
    clave.position.set(4.2, 7.5, 4.4);
    this.escena.add(clave);

    const relleno = new THREE.DirectionalLight(0xdde6ee, 0.95);
    relleno.position.set(-5, 1.5, -3);
    this.escena.add(relleno);

    // Rasante desde abajo: es la que deja leer la cara del chip, que mira al suelo
    const rasante = new THREE.DirectionalLight(0xffffff, 0.75);
    rasante.position.set(-1.5, -3, 3.5);
    this.escena.add(rasante);

    // Foco de estudio que acompaña a la etapa que se está mirando
    this.foco = new THREE.PointLight(0xfff0dc, 9, 9, 2.1);
    this.foco.position.set(1.4, 3, 2.4);
    this.escena.add(this.foco);
  }

  #materiales() {
    // Sobre papel claro, un metal oscuro se lee como plástico: el cobre real
    // rebota mucha luz, así que se aclara la base y se sube el entorno.
    const cobre = this.col.metal.clone().offsetHSL(0.004, 0.08, 0.17);
    this.matOro = new THREE.MeshStandardMaterial({
      color: cobre,
      metalness: 1,
      roughness: 0.22,
      envMapIntensity: 2.6,
    });
    this.matOroPulido = new THREE.MeshStandardMaterial({
      color: cobre.clone().offsetHSL(0, 0.02, 0.07),
      metalness: 1,
      roughness: 0.1,
      envMapIntensity: 3.1,
    });
    this.matAcero = new THREE.MeshStandardMaterial({
      color: this.col.acero.clone().offsetHSL(0, 0, 0.18),
      metalness: 1,
      roughness: 0.32,
      envMapIntensity: 2.0,
    });
    this.matCable = new THREE.MeshStandardMaterial({
      color: this.col.metal.clone().offsetHSL(-0.01, 0.02, 0.06),
      metalness: 0.95,
      roughness: 0.3,
      envMapIntensity: 2.2,
    });
    this.matCableFino = new THREE.MeshStandardMaterial({
      color: this.col.acero.clone().offsetHSL(0, 0, 0.22),
      metalness: 0.95,
      roughness: 0.26,
      envMapIntensity: 2.0,
    });
    // El portamuestras va chapado en oro, y el oro es AMARILLO: con el mismo
    // naranja que las placas, la caja del chip se confundía con la placa de
    // mezcla justo en el plano que remata el descenso.
    const oro = new THREE.Color("#d2a94c");
    this.matChapado = new THREE.MeshStandardMaterial({
      color: oro,
      metalness: 1,
      roughness: 0.26,
      envMapIntensity: 2.4,
    });
    this.matChapadoPulido = new THREE.MeshStandardMaterial({
      color: oro.clone().offsetHSL(0, 0.04, 0.08),
      metalness: 1,
      roughness: 0.12,
      envMapIntensity: 2.9,
    });
    this.matOscuro = new THREE.MeshStandardMaterial({
      color: this.col.fondo,
      metalness: 0.5,
      roughness: 0.9,
    });
  }

  /**
   * Recorrido de cada línea coaxial: por qué agujero cruza cada placa.
   * Lo usan a la vez las bandejas (para taladrar donde pasa el cable) y el
   * cableado, así que se decide una sola vez.
   */
  #trazado() {
    this.lineas = [];
    const ultima = ETAPAS.length - 1;
    for (let h = 0; h < 4; h++) {
      const centro = (h / 4) * Math.PI * 2;
      [-1, 0, 1].forEach((lado) => {
        const angulo = centro + lado * DELTA_HAZ;
        const fraccion = lado === 0 ? 0.6 : 0.72;
        const alPortamuestras = lado !== 0 && h % 2 === 0;
        const radios = ETAPAS.map((e, k) =>
          k === ultima && alPortamuestras ? Math.hypot(X_BAJADA, Z_CONECTOR) : e.radio * fraccion
        );
        this.lineas.push({ angulo, radios, alPortamuestras });
      });
    }
  }

  #bandejas() {
    this.bandejas = [];
    const m = new THREE.Matrix4();

    // Piezas pequeñas que se repiten en todas las bandejas: una geometría
    // compartida y una instancia por pieza.
    const geoPasamuros = new THREE.CylinderGeometry(0.024, 0.024, 0.075, 12);
    const geoAgujero = new THREE.CylinderGeometry(0.038, 0.038, 0.06, 16);
    const geoTornillo = new THREE.CylinderGeometry(0.019, 0.019, 0.07, 10);

    ETAPAS.forEach((etapa, i) => {
      const grupo = new THREE.Group();
      grupo.position.y = etapa.y;

      // Disco principal
      const disco = new THREE.Mesh(
        new THREE.CylinderGeometry(etapa.radio, etapa.radio, GROSOR_PLACA, 128),
        this.matOro.clone()
      );
      grupo.add(disco);

      // Canto biselado: el detalle que hace que parezca mecanizado
      const canto = new THREE.Mesh(
        new THREE.TorusGeometry(etapa.radio, 0.026, 12, 128),
        this.matOroPulido
      );
      canto.rotation.x = Math.PI / 2;
      grupo.add(canto);

      // Pasamuros: el conector por el que cada coaxial cruza la placa
      const pasamuros = new THREE.InstancedMesh(geoPasamuros, this.matAcero, this.lineas.length);
      this.lineas.forEach((l, k) => {
        const r = l.radios[i];
        m.makeTranslation(Math.cos(l.angulo) * r, 0, Math.sin(l.angulo) * r);
        pasamuros.setMatrixAt(k, m);
      });
      pasamuros.instanceMatrix.needsUpdate = true;
      grupo.add(pasamuros);

      // Agujeros de reserva, sin cable: las placas reales tienen muchos más
      const agujeros = new THREE.InstancedMesh(geoAgujero, this.matOscuro, 8);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const r = etapa.radio * 0.5;
        m.makeTranslation(Math.cos(a) * r, 0, Math.sin(a) * r);
        agujeros.setMatrixAt(k, m);
      }
      agujeros.instanceMatrix.needsUpdate = true;
      grupo.add(agujeros);

      // Tornillería del borde
      const tornillos = new THREE.InstancedMesh(geoTornillo, this.matAcero, 24);
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2 + 0.1;
        const r = etapa.radio * 0.93;
        m.makeTranslation(Math.cos(a) * r, 0.012, Math.sin(a) * r);
        tornillos.setMatrixAt(k, m);
      }
      tornillos.instanceMatrix.needsUpdate = true;
      grupo.add(tornillos);

      this.conjunto.add(grupo);
      this.bandejas.push({ grupo, disco, etapa, indice: i });
    });
  }

  #columnas() {
    const yArriba = ETAPAS[0].y;
    const yAbajo = ETAPAS[ETAPAS.length - 1].y;
    const alto = yArriba - yAbajo;

    // Terminan en la placa de mezcla: por debajo solo cuelga el portamuestras
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const r = 0.47;
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, alto + 0.175 + 0.02, 14),
        this.matAcero
      );
      col.position.set(Math.cos(a) * r, (yArriba + 0.175 + yAbajo - 0.02) / 2, Math.sin(a) * r);
      this.conjunto.add(col);
    }

    // Tubo central del pulso-tubo, que baja hasta la tercera bandeja
    const tubo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.09, 2.6, 28),
      this.matAcero
    );
    tubo.position.y = 2.0;
    this.conjunto.add(tubo);

    // Cabezal superior
    const cabezal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.26, 0.42, 36),
      this.matOroPulido
    );
    cabezal.position.y = ETAPAS[0].y + 0.3;
    this.conjunto.add(cabezal);
  }

  /**
   * Los cables coaxiales: lo que de verdad da el aspecto característico.
   * Son semirrígidos, no cuelgan: bajan rectos de placa en placa y, justo
   * debajo de cada una, hacen un quiebro corto que sirve de anclaje térmico
   * y absorbe la contracción del metal al enfriarse. Hasta la etapa de 4 K
   * son de acero inoxidable, que conduce mal el calor; por debajo, de cobre.
   */
  #cableado() {
    const acero = [];
    const cobre = [];
    const tapones = [];
    const ultima = ETAPAS.length - 1;

    this.lineas.forEach((l) => {
      const { angulo: a, radios } = l;
      const esquinas = [enAnillo(radios[0], a, Y_ENTRADA)];
      let corte = 0;
      tapones.push(esquinas[0].clone());

      for (let k = 0; k < ultima; k++) {
        if (k === 2) {
          // Cambio de material en el pasamuros de la placa de 4 K
          esquinas.push(enAnillo(radios[k], a, ETAPAS[k].y));
          corte = esquinas.length - 1;
        }
        const yQuiebro = ETAPAS[k].y - ESCALON;
        if (Math.abs(radios[k] - radios[k + 1]) > 1e-3) {
          esquinas.push(enAnillo(radios[k], a, yQuiebro));
          esquinas.push(enAnillo(radios[k + 1], a, yQuiebro));
        }
      }

      if (l.alPortamuestras) {
        // Baja hasta la altura del conector y entra en él en horizontal
        const bajada = enAnillo(radios[ultima], a, Y_CONECTOR);
        esquinas.push(bajada);
        esquinas.push(new THREE.Vector3(Math.sign(bajada.x) * X_PUNTA, Y_CONECTOR, bajada.z));
      } else {
        const fin = enAnillo(radios[ultima], a, Y_MEZCLA - 0.045);
        esquinas.push(fin);
        tapones.push(fin.clone());
      }

      const tramoAcero = redondea(esquinas.slice(0, corte + 1), 0.03);
      const tramoCobre = redondea(esquinas.slice(corte), 0.03);
      acero.push(new THREE.TubeGeometry(new Polilinea(tramoAcero), tramoAcero.length - 1, 0.0085, 6, false));
      cobre.push(new THREE.TubeGeometry(new Polilinea(tramoCobre), tramoCobre.length - 1, 0.0105, 6, false));
    });

    // Una llamada de dibujo por familia, no una por cable
    this.conjunto.add(new THREE.Mesh(mergeGeometries(acero), this.matCableFino));
    this.conjunto.add(new THREE.Mesh(mergeGeometries(cobre), this.matCable));
    acero.concat(cobre).forEach((g) => g.dispose());

    // Conectores en los extremos sueltos: arriba, la entrada por la brida
    // de vacío; abajo, las líneas que terminan en la placa de mezcla.
    const extremos = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.05, 12),
      this.matAcero,
      tapones.length
    );
    const m = new THREE.Matrix4();
    tapones.forEach((p, k) => {
      extremos.setMatrixAt(k, m.makeTranslation(p.x, p.y, p.z));
    });
    extremos.instanceMatrix.needsUpdate = true;
    this.conjunto.add(extremos);
  }

  /**
   * El chip: lo único que de verdad es "el computador cuántico". Va en una
   * caja de cobre chapado en oro, con el dado de silicio pegado al fondo,
   * hilos de unión hasta las pistas de entrada y conectores SMA a los lados.
   * Se modela boca arriba, como en la foto de banco, y luego se da la vuelta.
   */
  #procesador() {
    const porta = new THREE.Group();
    porta.rotation.x = Math.PI;
    porta.position.y = Y_SUELO_CAJA;
    this.conjunto.add(porta);

    const pieza = (geo, x, y, z) => geo.translate(x, y, z);
    const L = LADO_CAJA, P = PARED_CAJA, H = ALTO_PARED;

    // Cuerpo: suelo, cuatro paredes y el dedo frío que lo cuelga de la placa
    const cuerpo = [
      pieza(new THREE.BoxGeometry(L, FONDO_CAJA, L), 0, -FONDO_CAJA / 2, 0),
      pieza(new THREE.BoxGeometry(P, H, L), (L - P) / 2, H / 2, 0),
      pieza(new THREE.BoxGeometry(P, H, L), -(L - P) / 2, H / 2, 0),
      pieza(new THREE.BoxGeometry(L - 2 * P, H, P), 0, H / 2, (L - P) / 2),
      pieza(new THREE.BoxGeometry(L - 2 * P, H, P), 0, H / 2, -(L - P) / 2),
      pieza(new THREE.CylinderGeometry(0.055, 0.055, LARGO_DEDO, 24), 0, -FONDO_CAJA - LARGO_DEDO / 2, 0),
      pieza(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 32), 0, -FONDO_CAJA - LARGO_DEDO + 0.01, 0),
    ];
    porta.add(new THREE.Mesh(mergeGeometries(cuerpo), this.matChapado));
    cuerpo.forEach((g) => g.dispose());

    // Conectores SMA: tuerca de pasamuros, cuerpo y la tuerca del cable
    const conector = [
      new THREE.CylinderGeometry(0.036, 0.036, 0.02, 6).rotateZ(-Math.PI / 2).translate(L / 2 + 0.01, 0, 0),
      new THREE.CylinderGeometry(0.022, 0.022, 0.07, 16).rotateZ(-Math.PI / 2).translate(L / 2 + 0.035, 0, 0),
      new THREE.CylinderGeometry(0.03, 0.03, 0.045, 6).rotateZ(-Math.PI / 2).translate(L / 2 + 0.085, 0, 0),
      new THREE.CylinderGeometry(0.017, 0.017, 0.03, 12).rotateZ(-Math.PI / 2).translate(L / 2 + 0.12, 0, 0),
    ];
    const unConector = mergeGeometries(conector);
    conector.forEach((g) => g.dispose());
    const conectores = [];
    const m = new THREE.Matrix4();
    for (const lado of [1, -1]) {
      for (const z of [Z_CONECTOR, -Z_CONECTOR]) {
        m.makeRotationY(lado > 0 ? 0 : Math.PI).setPosition(0, Y_SUELO_CAJA - Y_CONECTOR, z);
        conectores.push(unConector.clone().applyMatrix4(m));
      }
    }
    porta.add(new THREE.Mesh(mergeGeometries(conectores), this.matChapadoPulido));
    unConector.dispose();
    conectores.forEach((g) => g.dispose());

    // Pistas de entrada: cuatro regletas de circuito impreso junto a las
    // paredes, con sus almohadillas chapadas, y los taladros de la tapa.
    const regletas = [];
    const almohadillas = [];
    const bordeInterior = L / 2 - P;
    const anchoRegleta = 0.05;
    const xRegleta = bordeInterior - anchoRegleta / 2 - 0.005;
    const puntas = []; // [x, z] de cada almohadilla, para los hilos de unión
    for (let lado = 0; lado < 4; lado++) {
      const n = lado < 2 ? 8 : 6;
      const largo = lado < 2 ? 0.27 : 0.22;
      const rota = new THREE.Matrix4().makeRotationY((lado % 2 ? Math.PI : 0) + (lado >= 2 ? Math.PI / 2 : 0));
      regletas.push(new THREE.BoxGeometry(anchoRegleta, 0.006, largo).translate(xRegleta, 0.003, 0).applyMatrix4(rota));
      for (let k = 0; k < n; k++) {
        const z = (k / (n - 1) - 0.5) * (largo - 0.04);
        almohadillas.push(new THREE.BoxGeometry(0.022, 0.003, 0.014).translate(xRegleta - 0.006, 0.0075, z).applyMatrix4(rota));
        const punta = new THREE.Vector3(xRegleta - 0.012, 0.009, z).applyMatrix4(rota);
        const salida = new THREE.Vector3(LADO_DADO / 2 - 0.008, 0.014, z * 0.55).applyMatrix4(rota);
        puntas.push([salida, punta]);
      }
    }
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        regletas.push(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 12).translate(x * (L / 2 - P / 2), H + 0.0015, z * (L / 2 - P / 2)));
      }
    }
    porta.add(new THREE.Mesh(mergeGeometries(regletas), this.matOscuro));
    porta.add(new THREE.Mesh(mergeGeometries(almohadillas), this.matChapadoPulido));
    regletas.concat(almohadillas).forEach((g) => g.dispose());

    // Sustrato de silicio
    const chip = new THREE.Mesh(
      new THREE.BoxGeometry(LADO_DADO, 0.014, LADO_DADO),
      new THREE.MeshStandardMaterial({
        color: 0x11151c,
        metalness: 0.45,
        roughness: 0.42,
      })
    );
    chip.position.y = 0.007;
    porta.add(chip);
    this.chip = chip;

    // Pistas del chip dibujadas en un canvas: metal depositado sobre el
    // silicio, que refleja la luz del estudio pero no da luz propia.
    const textura = this.#texturaChip();
    const pistas = new THREE.Mesh(
      new THREE.PlaneGeometry(LADO_DADO * 0.985, LADO_DADO * 0.985),
      new THREE.MeshStandardMaterial({
        map: textura,
        metalness: 0.85,
        roughness: 0.3,
        envMapIntensity: 1.6,
        transparent: true,
        depthWrite: false,
      })
    );
    pistas.rotation.x = -Math.PI / 2;
    pistas.position.y = 0.0145;
    porta.add(pistas);
    this.pistas = pistas;

    // Cables de unión (wire bonds) del chip a las almohadillas
    const hilos = puntas.map(([p0, p2]) => {
      const p1 = p0.clone().lerp(p2, 0.4);
      p1.y = 0.034;
      return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, p1, p2), 10, 0.0017, 4, false);
    });
    porta.add(new THREE.Mesh(mergeGeometries(hilos), this.matCableFino));
    hilos.forEach((g) => g.dispose());
  }

  #texturaChip() {
    const N = 512;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const g = c.getContext("2d");
    g.clearRect(0, 0, N, N);

    // Aluminio o niobio sobre silicio: pistas claras, no doradas
    const acento = "#" + this.col.acero.clone().offsetHSL(0, 0, 0.34).getHexString();
    g.strokeStyle = acento;
    g.lineCap = "round";

    // Resonadores: meandros característicos de un chip superconductor
    const meandro = (x, y, ancho, alto, pasos, grosor) => {
      g.lineWidth = grosor;
      g.beginPath();
      g.moveTo(x, y);
      for (let i = 0; i < pasos; i++) {
        const yy = y + (i * alto) / pasos;
        g.lineTo(x + (i % 2 === 0 ? ancho : 0), yy);
        g.lineTo(x + (i % 2 === 0 ? ancho : 0), yy + alto / pasos);
      }
      g.stroke();
    };

    g.globalAlpha = 0.85;
    meandro(70, 60, 90, 180, 8, 3);
    meandro(300, 70, 80, 160, 7, 3);
    meandro(90, 290, 100, 150, 6, 3);
    meandro(320, 300, 70, 150, 6, 3);

    // Bus central
    g.lineWidth = 5;
    g.globalAlpha = 1;
    g.beginPath();
    g.moveTo(40, 256);
    g.lineTo(472, 256);
    g.stroke();

    // Transmones: las "cruces" de los cúbits
    const cubits = [[150, 200], [256, 150], [362, 200], [150, 312], [256, 362], [362, 312]];
    for (const [x, y] of cubits) {
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(x - 22, y);
      g.lineTo(x + 22, y);
      g.moveTo(x, y - 22);
      g.lineTo(x, y + 22);
      g.stroke();
      g.fillStyle = acento;
      g.globalAlpha = 0.5;
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }

    // Almohadillas de contacto en el borde
    g.fillStyle = acento;
    g.globalAlpha = 0.7;
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      const x = 256 + Math.cos(t) * 225;
      const y = 256 + Math.sin(t) * 225;
      g.fillRect(x - 9, y - 9, 18, 18);
    }

    const textura = new THREE.CanvasTexture(c);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = 8;
    return textura;
  }

  /* ------------------------------------------------------------------
     Rótulos de etapa
     Tienen tamaño fijo en PANTALLA, no en el mundo: en el plano general y
     en el primer plano del chip se leen igual. Por eso se colocan a mano en
     cada fotograma, a la derecha de la bandeja según la mira la cámara.
     ------------------------------------------------------------------ */

  #etiquetas() {
    this.etiquetas = ETAPAS.map(() => {
      const grupo = new THREE.Group();
      const linea = new THREE.Line(
        new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(6, 3)),
        new THREE.LineBasicMaterial({ color: this.col.metal, transparent: true, opacity: 0.6 })
      );
      linea.frustumCulled = false;
      grupo.add(linea);
      grupo.userData.opacidad = 0;
      this.escena.add(grupo);
      return { grupo, linea, temp: null, nombre: null };
    });
    this.#rotulaEtiquetas();

    // Los rótulos se dibujan en un canvas con las tipografías de la revista;
    // si aún no han cargado, sale la de reserva. Se repintan en cuanto llegan.
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load('500 72px "IBM Plex Mono"'),
        document.fonts.load('400 64px "Source Serif 4"'),
      ]).then(() => {
        if (this.destruida) return;
        this.#rotulaEtiquetas();
        this.#recalcula(this.anchoPx, this.altoPx);
        if (!this.activa) this.render();
      }, () => {});
    }
  }

  #rotulaEtiquetas() {
    const tinta = "#" + this.col.fondo.getHexString();
    const metal = "#" + this.col.metal.getHexString();

    ETAPAS.forEach((etapa, i) => {
      const e = this.etiquetas[i];
      for (const viejo of [e.temp, e.nombre]) {
        if (!viejo) continue;
        e.grupo.remove(viejo);
        viejo.userData.dispose();
      }
      e.temp = etiquetaSprite(etapa.temp, {
        color: metal,
        fuente: '500 72px "IBM Plex Mono", ui-monospace, monospace',
      });
      e.nombre = etiquetaSprite(etapa.nombre, {
        color: tinta,
        tamano: 64,
        fuente: '400 64px "Source Serif 4", Georgia, serif',
      });
      for (const s of [e.temp, e.nombre]) {
        s.userData.aspecto = s.scale.x / s.scale.y;
        s.center.set(0, 0.5);               // anclados por la izquierda
        s.material.sizeAttenuation = false; // tamaño de pantalla, no de mundo
        s.material.needsUpdate = true;
        s.frustumCulled = false;
        e.grupo.add(s);
      }
    });
  }

  /** Tamaños de rótulo en píxeles CSS, según la altura de la caja. */
  #medidasRotulo(alto) {
    const lim = (v, a, b) => Math.max(a, Math.min(b, v));
    return {
      temp: lim(alto * 0.07, 36, 56),
      nombre: lim(alto * 0.05, 30, 40),
      hueco: lim(alto * 0.04, 18, 30),
    };
  }

  /* ------------------------------------------------------------------
     Encuadre
     ------------------------------------------------------------------ */

  /**
   * Distancia mínima de cámara (y desplazamiento lateral y vertical del
   * punto de mira) para que TODOS los puntos quepan en la caja con un margen.
   * La cámara mira con una elevación `el` (positiva: desde arriba). El fov
   * de Three es vertical; el horizontal sale de la proporción de la caja.
   * Cada punto puede pedir hueco extra en pantalla a la derecha, arriba o
   * abajo: es lo que ocupa el rótulo que cuelga de él.
   */
  #encuadra(puntos, el, margen, yMira, margenV = margen) {
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camara.fov / 2));
    const tanH = tanV * this.camara.aspect;
    const se = Math.sin(el), ce = Math.cos(el);
    const lim = 1 - margen;
    const limV = 1 - margenV;

    // Un rótulo puede sobresalir del hueco de un lado (lo compensa el otro),
    // pero no pedir más que la caja entera: en una caja diminuta, o aún sin
    // medir (1 px), no habría distancia que sirviera.
    const tope = (v, l) => Math.min(v, l * 0.9);

    const prueba = (d) => {
      let sxMin = -Infinity, sxMax = Infinity, syMin = -Infinity, syMax = Infinity;
      for (const q of puntos) {
        const y = q.p.y - yMira;
        const X = q.p.x;
        const Y = y * ce - q.p.z * se;
        const Z = y * se + q.p.z * ce;
        const prof = d - Z;
        if (prof < 0.3) return null;
        sxMin = Math.max(sxMin, X - (lim - tope(q.der, 2 * lim)) * tanH * prof);
        sxMax = Math.min(sxMax, X + lim * tanH * prof);
        syMin = Math.max(syMin, Y - (limV - tope(q.arr, limV)) * tanV * prof);
        syMax = Math.min(syMax, Y + (limV - tope(q.aba, limV)) * tanV * prof);
      }
      if (sxMin > sxMax || syMin > syMax) return null;
      return { sx: (sxMin + sxMax) / 2, sy: (syMin + syMax) / 2, syMin, syMax };
    };

    let bajo = 0.5, alto = 80;
    for (let i = 0; i < 40; i++) {
      const medio = (bajo + alto) / 2;
      if (prueba(medio)) alto = medio;
      else bajo = medio;
    }
    // Si ni a 80 unidades cabe, mejor un plano centrado que una cámara NaN
    const r = prueba(alto) || { sx: 0, sy: 0, syMin: 0, syMax: 0 };
    return { d: alto, el, ty: yMira, ...r };
  }

  /** Anillo de puntos: la silueta de una pieza de revolución a cualquier giro. */
  #anillo(lista, r, y, extra = {}) {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      lista.push({ p: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), der: 0, arr: 0, aba: 0, ...extra });
    }
  }

  /** Hueco que pide en pantalla el rótulo de una etapa, en unidades NDC. */
  #huecoRotulo(i) {
    const e = this.etiquetas[i];
    const med = this.#medidasRotulo(this.altoPx);
    const ancho = med.hueco + Math.max(e.temp.userData.aspecto * med.temp, e.nombre.userData.aspecto * med.nombre);
    const arriba = med.temp * 0.4 + med.temp / 2;
    const abajo = med.nombre * 0.45 + med.nombre / 2;
    return {
      der: (2 * ancho) / this.anchoPx,
      arr: (2 * arriba) / this.altoPx,
      aba: (2 * abajo) / this.altoPx,
    };
  }

  /** Alto en píxeles del rótulo a pie de caja, con su línea guía. */
  #altoPie(med) {
    return med.hueco + med.temp * 0.8 + med.nombre;
  }

  #recalcula(ancho, alto) {
    this.anchoPx = ancho;
    this.altoPx = alto;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camara.fov / 2));

    // Tamaño en pantalla de los rótulos
    const med = this.#medidasRotulo(alto);
    this.etiquetas.forEach((e) => {
      for (const [s, px] of [[e.temp, med.temp], [e.nombre, med.nombre]]) {
        const h = (px * 2 * tanV) / alto;
        s.scale.set(h * s.userData.aspecto, h, 1);
      }
    });

    // 1. Plano general: el aparato ENTERO, del cabezal al portamuestras, y
    //    el rótulo de la brida de vacío, que es la etapa activa a p = 0.
    const general = [];
    ETAPAS.forEach((e) => {
      this.#anillo(general, e.radio + 0.026, e.y + 0.04);
      this.#anillo(general, e.radio + 0.026, e.y - 0.04);
    });
    this.#anillo(general, 0.34, ETAPAS[0].y + 0.51);
    this.#anillo(general, ETAPAS[0].radio * 0.72, Y_ENTRADA + 0.03);
    this.#anillo(general, Math.hypot(X_BAJADA, Z_CONECTOR), Y_SUELO_CAJA - ALTO_PARED);
    general.push({ p: new THREE.Vector3(ETAPAS[0].radio, ETAPAS[0].y, 0), ...this.#huecoRotulo(0) });
    const yCentro = (ETAPAS[0].y + 0.51 + Y_SUELO_CAJA - ALTO_PARED) / 2;
    this.encuadreGeneral = this.#encuadra(general, 0.1, 0.07, yCentro);

    // 2. Plano de etapa: el de siempre, a 4,1 unidades, pero con el aparato
    //    corrido a la izquierda lo que ocupa el rótulo. En cajas estrechas se
    //    aleja un poco para que la bandeja no se salga por los dos lados.
    const aspecto = this.camara.aspect;
    const dCerca = 4.1 * Math.max(1, Math.min(1.3, 0.95 / aspecto));
    const anchoRotulo = (this.#huecoRotulo(2).der * this.anchoPx) / 2;
    this.encuadreEtapa = {
      d: dCerca,
      el: Math.atan2(0.35, 4.1),
      sx: (anchoRotulo / this.anchoPx) * tanV * aspecto * dCerca,
      sy: 0,
    };

    // 3. Plano final: la cámara bajo el portamuestras, mirando el chip desde
    //    abajo, con la placa de mezcla asomando por arriba. Aquí el rótulo
    //    de 10 mK pasa a pie, debajo de la caja: a la derecha le robaría al
    //    chip media pantalla en un teléfono, y debajo solo había papel.
    const pie = (2 * this.#altoPie(med)) / alto;
    const chip = [];
    this.#anillo(chip, Math.hypot(X_PUNTA + 0.02, Z_CONECTOR), Y_CONECTOR);
    this.#anillo(chip, 0.12, Y_SUELO_CAJA + FONDO_CAJA + 0.05);
    this.#anillo(chip, (LADO_CAJA / 2) * Math.SQRT2, Y_SUELO_CAJA - ALTO_PARED, { aba: pie });
    this.encuadreChip = this.#encuadra(chip, -0.68, 0.24, Y_CHIP, 0.08);
    // Manda el ancho, así que sobra alto: el conjunto baja hasta el pie de
    // la caja y el sitio de arriba se lo queda la placa de mezcla.
    this.encuadreChip.sy = this.encuadreChip.syMax;

    this.#aplicaProgreso();
  }

  alRedimensionar(ancho, alto) {
    this.#recalcula(ancho, alto);
  }

  /* ------------------------------------------------------------------
     API pública
     ------------------------------------------------------------------ */

  /** Progreso del recorrido, de 0 (arriba, 300 K) a 1 (abajo, 10 mK). */
  ponProgreso(p) {
    this.progreso = Math.max(0, Math.min(1, p));
    if (menosMovimiento()) {
      this.progresoSuave = this.progreso;
      this.#aplicaProgreso();
      this.render();
    }
    return this;
  }

  /** Índice de la etapa térmica que se está mirando. */
  get etapa() { return ETAPAS[this.etapaActiva]; }

  /**
   * Avisa cada vez que la cámara entra en una etapa térmica distinta.
   * La cámara baja con suavizado, así que la etapa no cambia en el momento
   * de mover el dial sino unos cuadros después: quien rotule la temperatura
   * tiene que enterarse por aquí y no leyendo `etapa` justo tras ponProgreso.
   */
  alCambiarEtapa(fn) {
    this.avisoEtapa = fn;
    if (typeof fn === "function") fn(this.etapa, this.etapaActiva);
    return this;
  }

  #aplicaProgreso() {
    if (!this.encuadreGeneral) return;
    const p = this.progresoSuave;

    // Altura por la que va el lector: baja de bandeja en bandeja, de la brida
    // de vacío a la placa de mezcla. Es el dato, y no depende del encuadre.
    const yEtapa = ETAPAS[0].y + (ETAPAS[ETAPAS.length - 1].y - ETAPAS[0].y) * p;

    // Etapa activa: la bandeja más cercana a esa altura
    let activa = 0;
    let mejor = Infinity;
    ETAPAS.forEach((e, i) => {
      const d = Math.abs(e.y - yEtapa);
      if (d < mejor) { mejor = d; activa = i; }
    });
    this.etapaActiva = activa;
    if (activa !== this.etapaAnunciada) {
      this.etapaAnunciada = activa;
      if (this.avisoEtapa) this.avisoEtapa(ETAPAS[activa], activa);
    }

    // El encuadre es otra cosa: arriba del todo hay que ver el aparato
    // ENTERO —si no, el lector no sabe de qué tamaño es lo que mira— y solo
    // al bajar se cierra el plano sobre la etapa. El suavizado hace que el
    // plano general aguante las primeras pulgadas del recorrido. En el último
    // tramo la cámara pasa por debajo de la placa de mezcla hasta el chip:
    // es la recompensa del descenso.
    const cierre = suave(p);
    const remate = suave((p - 0.86) / 0.14);
    const G = this.encuadreGeneral, E = this.encuadreEtapa, C = this.encuadreChip;

    let ty = mezcla(G.ty, yEtapa, cierre);
    let d = mezcla(G.d, E.d, cierre);
    let el = mezcla(G.el, E.el, cierre);
    let sx = mezcla(G.sx, E.sx, cierre);
    let sy = mezcla(G.sy, E.sy, cierre);
    ty = mezcla(ty, C.ty, remate);
    d = mezcla(d, C.d, remate);
    el = mezcla(el, C.el, remate);
    sx = mezcla(sx, C.sx, remate);
    sy = mezcla(sy, C.sy, remate);

    const angulo = -0.32 + p * 0.95 + this.punteroSuave.x * 0.16;
    const se = Math.sin(el), ce = Math.cos(el);
    const haciaCamara = new THREE.Vector3(Math.sin(angulo) * ce, se, Math.cos(angulo) * ce);
    const derecha = new THREE.Vector3(Math.cos(angulo), 0, -Math.sin(angulo));
    const arriba = new THREE.Vector3(-Math.sin(angulo) * se, ce, -Math.cos(angulo) * se);

    const mira = new THREE.Vector3(0, ty, 0).addScaledVector(derecha, sx).addScaledVector(arriba, sy);
    this.camara.position.copy(mira).addScaledVector(haciaCamara, d);
    this.camara.position.y += this.punteroSuave.y * -0.018 * d;
    this.camara.lookAt(mira);
    this.camara.updateMatrixWorld();

    // El foco acompaña a la cámara; al final baja con ella para iluminar la
    // cara del chip, que mira al suelo.
    const alturaCamara = this.camara.position.y;
    this.foco.position.set(
      mezcla(Math.sin(angulo + 0.6) * 2.6, Math.sin(angulo + 0.5) * 1.1, remate),
      mezcla(alturaCamara + 0.9, Y_CHIP - 1.0, remate),
      mezcla(Math.cos(angulo + 0.6) * 2.6, Math.cos(angulo + 0.5) * 1.1, remate)
    );

    // Realce de la bandeja activa: más pulida, no más luminosa
    this.bandejas.forEach((b, i) => {
      const cerca = 1 - Math.min(1, Math.abs(i - activa) / 1.6);
      b.disco.material.roughness = 0.27 - cerca * 0.1;
      b.disco.material.envMapIntensity = 2.6 + cerca * 0.7;
    });

    this.#colocaEtiquetas(activa, remate, derecha, arriba, haciaCamara);

    // Al acercarnos, el dibujo del chip se lee mejor: es enfoque, no brillo
    const cerca = Math.max(0, (p - 0.55) / 0.45);
    this.pistas.material.opacity = 0.45 + cerca * 0.55;
  }

  #colocaEtiquetas(activa, remate, derecha, arriba, haciaCamara) {
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camara.fov / 2));
    const med = this.#medidasRotulo(this.altoPx);
    const ultima = ETAPAS.length - 1;
    const ancla = new THREE.Vector3();
    const tmp = new THREE.Vector3();

    this.etiquetas.forEach((e, i) => {
      // En el plano final solo queda el rótulo de 10 mK: los demás caerían
      // fuera de la caja, cortados, y se apagan pronto.
      let objetivo = i === activa ? 1 : Math.max(0, 0.26 - Math.abs(i - activa) * 0.1) * Math.max(0, 1 - remate * 2.5);
      // El de 10 mK cambia de sitio a mitad del remate: se apaga junto a la
      // placa y reaparece a pie de caja, en vez de cruzar por encima de ella.
      const alPie = i === ultima && remate >= 0.5;
      if (i === ultima && remate > 0) objetivo *= suave(Math.abs(2 * remate - 1) * 1.6);
      if (objetivo <= 0.02) { e.grupo.visible = false; return; }

      // Punto del canto de la bandeja que la cámara ve a la derecha
      const etapa = ETAPAS[i];
      ancla.set(0, etapa.y, 0).addScaledVector(derecha, etapa.radio + 0.026);

      // Cuánto mundo cabe en un píxel a esa profundidad
      const prof = tmp.copy(this.camara.position).sub(ancla).dot(haciaCamara);
      const px = (2 * tanV * Math.max(0.2, prof)) / this.altoPx;

      e.temp.position.copy(ancla).addScaledVector(derecha, med.hueco * px).addScaledVector(arriba, med.temp * 0.4 * px);
      e.nombre.position.copy(ancla).addScaledVector(derecha, med.hueco * px).addScaledVector(arriba, -med.nombre * 0.45 * px);

      const pos = e.linea.geometry.attributes.position;
      tmp.copy(ancla).addScaledVector(derecha, 3 * px);
      pos.setXYZ(0, tmp.x, tmp.y, tmp.z);
      tmp.copy(ancla).addScaledVector(derecha, (med.hueco - 5) * px);
      pos.setXYZ(1, tmp.x, tmp.y, tmp.z);
      e.temp.center.x = e.nombre.center.x = 0;

      if (alPie) this.#rotuloAlPie(e, med);
      pos.needsUpdate = true;

      // Un rótulo de etapa vecina que se sale de la caja no se deja cortado:
      // se apaga según asoma. En el remate vale también para el activo: la
      // cámara se centra en el chip y el de 100 mK se saldría por la derecha.
      if (i !== activa || (remate > 0 && !alPie)) {
        const n = tmp.copy(e.temp.position).project(this.camara);
        const ancho = Math.max(e.temp.userData.aspecto * med.temp, e.nombre.userData.aspecto * med.nombre);
        const fuera = Math.max(
          n.x + (2 * ancho) / this.anchoPx - 1,
          n.y + med.temp / this.altoPx - 1,
          -1 - (n.y - (2 * (med.temp * 0.4 + med.nombre)) / this.altoPx)
        );
        objetivo *= Math.max(0, Math.min(1, 1 - fuera * 12));
      }

      e.grupo.userData.opacidad = objetivo;
      e.grupo.visible = objetivo > 0.02;
      e.temp.material.opacity = objetivo;
      e.nombre.material.opacity = objetivo;
      e.linea.material.opacity = objetivo * 0.6;
    });
  }

  /**
   * Plano final: el rótulo de 10 mK va a pie, centrado bajo el portamuestras,
   * con la línea guía en vertical. Se coloca en coordenadas de pantalla.
   */
  #rotuloAlPie(e, med) {
    const c = this.camara;
    c.updateMatrixWorld();
    const ndc = new THREE.Vector3();
    const centro = new THREE.Vector3(0, Y_CHIP, 0).project(c);

    // Punto más bajo de la caja en pantalla, gire como gire el plato
    let yMin = Infinity;
    const r = (LADO_CAJA / 2) * Math.SQRT2;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      ndc.set(Math.cos(a) * r, Y_SUELO_CAJA - ALTO_PARED, Math.sin(a) * r).project(c);
      yMin = Math.min(yMin, ndc.y);
    }

    const paso = 2 / this.altoPx;   // NDC por píxel en vertical
    const enPantalla = (y) => ndc.set(centro.x, y, centro.z).unproject(c);
    const yTemp = yMin - (med.hueco + med.temp * 0.3) * paso;
    const yNombre = yTemp - (med.temp * 0.4 + med.nombre * 0.45) * paso;

    e.temp.position.copy(enPantalla(yTemp));
    e.nombre.position.copy(enPantalla(yNombre));
    e.temp.center.x = e.nombre.center.x = 0.5;

    const pos = e.linea.geometry.attributes.position;
    const a = enPantalla(yMin - 4 * paso);
    pos.setXYZ(0, a.x, a.y, a.z);
    const b = enPantalla(yMin - (med.hueco - 6) * paso);
    pos.setXYZ(1, b.x, b.y, b.z);
  }

  actualiza(dt, t) {
    this.progresoSuave = amortigua(this.progresoSuave, this.progreso, 5, dt);
    this.#aplicaProgreso();

    // Giro lentísimo: el objeto gira sobre su plato de fotografía
    if (!menosMovimiento()) this.conjunto.rotation.y = t * 0.03;
  }
}
