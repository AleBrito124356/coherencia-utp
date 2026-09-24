/* ==========================================================================
   cuantica.js — Motor de simulación cuántica
   Proyecto: Coherencia · Parcial N.º 1 de Ingeniería Web
   Universidad Tecnológica de Panamá · Brito & Gaitán · 2026

   Este archivo NO usa librerías: implementa desde cero el álgebra que hace
   falta para simular un registro de 1 a 4 cúbits en el navegador.

   Programación orientada a objetos:
     Complejo        → aritmética de números complejos
     Puerta          → una puerta cuántica (matriz unitaria 2x2 o 4x4)
     Puertas         → catálogo estático de puertas estándar
     EstadoCuantico  → vector de estado de n cúbits + medición + Bloch
     Circuito        → secuencia de operaciones sobre un estado
     Grover          → demostración del algoritmo de búsqueda de Grover

   Todo el álgebra sigue la convención estándar: |q(n-1) ... q1 q0>, es decir,
   el cúbit 0 es el bit menos significativo del índice de la base.
   ========================================================================== */
"use strict";

/* --------------------------------------------------------------------------
   Números complejos
   -------------------------------------------------------------------------- */
class Complejo {
  constructor(re = 0, im = 0) {
    this.re = re;
    this.im = im;
  }

  static cero() { return new Complejo(0, 0); }
  static uno() { return new Complejo(1, 0); }
  static i() { return new Complejo(0, 1); }

  /** Número complejo de módulo 1 y fase dada: e^(i·fase) */
  static fase(angulo) { return new Complejo(Math.cos(angulo), Math.sin(angulo)); }

  suma(o) { return new Complejo(this.re + o.re, this.im + o.im); }
  resta(o) { return new Complejo(this.re - o.re, this.im - o.im); }

  multiplica(o) {
    return new Complejo(
      this.re * o.re - this.im * o.im,
      this.re * o.im + this.im * o.re
    );
  }

  escala(k) { return new Complejo(this.re * k, this.im * k); }
  conjugado() { return new Complejo(this.re, -this.im); }

  /** |z|² — la probabilidad, según la regla de Born */
  moduloCuadrado() { return this.re * this.re + this.im * this.im; }
  modulo() { return Math.sqrt(this.moduloCuadrado()); }
  argumento() { return Math.atan2(this.im, this.re); }

  esCero(tol = 1e-12) { return this.moduloCuadrado() < tol * tol; }

  /** Representación legible: "0,707", "-0,707i", "0,5 + 0,5i" */
  aTexto(decimales = 3) {
    const f = (x) => x.toFixed(decimales).replace(".", ",");
    if (Math.abs(this.im) < 1e-9) return f(this.re);
    if (Math.abs(this.re) < 1e-9) return f(this.im) + "i";
    return f(this.re) + (this.im >= 0 ? " + " : " − ") + f(Math.abs(this.im)) + "i";
  }
}

/* --------------------------------------------------------------------------
   Puertas cuánticas
   -------------------------------------------------------------------------- */
class Puerta {
  #simbolo; #nombre; #matriz; #cubits; #descripcion;

  /**
   * @param {string} simbolo   Etiqueta corta: H, X, Z…
   * @param {string} nombre    Nombre legible
   * @param {Complejo[][]} matriz Matriz unitaria (2x2 para 1 cúbit, 4x4 para 2)
   * @param {number} cubits    Número de cúbits sobre los que actúa
   */
  constructor(simbolo, nombre, matriz, cubits = 1, descripcion = "") {
    this.#simbolo = simbolo;
    this.#nombre = nombre;
    this.#matriz = matriz;
    this.#cubits = cubits;
    this.#descripcion = descripcion;
  }

  get simbolo() { return this.#simbolo; }
  get nombre() { return this.#nombre; }
  get matriz() { return this.#matriz; }
  get cubits() { return this.#cubits; }
  get descripcion() { return this.#descripcion; }

  /** Aplica la matriz 2x2 a un par de amplitudes [a0, a1]. */
  aplicaPar(a0, a1) {
    const m = this.#matriz;
    return [
      m[0][0].multiplica(a0).suma(m[0][1].multiplica(a1)),
      m[1][0].multiplica(a0).suma(m[1][1].multiplica(a1)),
    ];
  }

  /** Comprueba numéricamente que la matriz es unitaria (U†U = I). */
  esUnitaria(tol = 1e-9) {
    const m = this.#matriz;
    const n = m.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let suma = Complejo.cero();
        for (let k = 0; k < n; k++) {
          suma = suma.suma(m[k][i].conjugado().multiplica(m[k][j]));
        }
        const esperado = i === j ? 1 : 0;
        if (Math.abs(suma.re - esperado) > tol || Math.abs(suma.im) > tol) return false;
      }
    }
    return true;
  }
}

/** Catálogo de puertas estándar. */
class Puertas {
  static get I() {
    return new Puerta("I", "Identidad", [
      [Complejo.uno(), Complejo.cero()],
      [Complejo.cero(), Complejo.uno()],
    ], 1, "No hace nada: deja el cúbit como estaba.");
  }

  static get X() {
    return new Puerta("X", "Pauli-X (NOT cuántica)", [
      [Complejo.cero(), Complejo.uno()],
      [Complejo.uno(), Complejo.cero()],
    ], 1, "Intercambia |0⟩ y |1⟩. Es la negación clásica, y en la esfera de Bloch es un giro de 180° alrededor del eje X.");
  }

  static get Y() {
    return new Puerta("Y", "Pauli-Y", [
      [Complejo.cero(), new Complejo(0, -1)],
      [Complejo.i(), Complejo.cero()],
    ], 1, "Giro de 180° alrededor del eje Y: combina la negación con un cambio de fase.");
  }

  static get Z() {
    return new Puerta("Z", "Pauli-Z (cambio de fase)", [
      [Complejo.uno(), Complejo.cero()],
      [Complejo.cero(), new Complejo(-1, 0)],
    ], 1, "Deja |0⟩ igual e invierte el signo de |1⟩. No cambia las probabilidades, pero sí la fase: por eso es invisible si mides enseguida.");
  }

  static get H() {
    const s = 1 / Math.SQRT2;
    return new Puerta("H", "Hadamard", [
      [new Complejo(s, 0), new Complejo(s, 0)],
      [new Complejo(s, 0), new Complejo(-s, 0)],
    ], 1, "Crea superposición: lleva |0⟩ a (|0⟩+|1⟩)/√2. Es la puerta con la que empieza casi todo circuito cuántico.");
  }

  static get S() {
    return new Puerta("S", "Fase S (√Z)", [
      [Complejo.uno(), Complejo.cero()],
      [Complejo.cero(), Complejo.i()],
    ], 1, "Añade un cuarto de vuelta de fase (90°) a la componente |1⟩.");
  }

  static get T() {
    return new Puerta("T", "Fase T (π/8)", [
      [Complejo.uno(), Complejo.cero()],
      [Complejo.cero(), Complejo.fase(Math.PI / 4)],
    ], 1, "Añade 45° de fase. Junto con H y CNOT basta para aproximar cualquier cómputo cuántico.");
  }

  /** Rotación de un ángulo arbitrario alrededor de X, Y o Z. */
  static rotacion(eje, angulo) {
    const c = Math.cos(angulo / 2);
    const s = Math.sin(angulo / 2);
    const grados = Math.round((angulo * 180) / Math.PI);
    if (eje === "x") {
      return new Puerta("Rx", "Rotación X de " + grados + "°", [
        [new Complejo(c, 0), new Complejo(0, -s)],
        [new Complejo(0, -s), new Complejo(c, 0)],
      ], 1, "Giro continuo alrededor del eje X.");
    }
    if (eje === "y") {
      return new Puerta("Ry", "Rotación Y de " + grados + "°", [
        [new Complejo(c, 0), new Complejo(-s, 0)],
        [new Complejo(s, 0), new Complejo(c, 0)],
      ], 1, "Giro continuo alrededor del eje Y.");
    }
    return new Puerta("Rz", "Rotación Z de " + grados + "°", [
      [Complejo.fase(-angulo / 2), Complejo.cero()],
      [Complejo.cero(), Complejo.fase(angulo / 2)],
    ], 1, "Giro continuo alrededor del eje Z: cambia solo la fase relativa.");
  }

  /** Puertas de un cúbit disponibles en la interfaz del laboratorio. */
  static get basicas() {
    return [Puertas.H, Puertas.X, Puertas.Y, Puertas.Z, Puertas.S, Puertas.T];
  }

  static porSimbolo(simbolo) {
    return Puertas.basicas.find((p) => p.simbolo === simbolo) || Puertas.I;
  }
}

/* --------------------------------------------------------------------------
   Estado cuántico de n cúbits
   -------------------------------------------------------------------------- */
class EstadoCuantico {
  #n; #amplitudes;

  /** @param {number} n Número de cúbits (1 a 8 en la práctica del navegador) */
  constructor(n = 1) {
    if (n < 1 || n > 12) throw new RangeError("Número de cúbits fuera de rango: " + n);
    this.#n = n;
    this.#amplitudes = new Array(1 << n).fill(null).map(() => Complejo.cero());
    this.#amplitudes[0] = Complejo.uno(); // |00…0⟩
  }

  get cubits() { return this.#n; }
  get dimension() { return this.#amplitudes.length; }
  get amplitudes() { return this.#amplitudes.map((a) => new Complejo(a.re, a.im)); }

  /** Reinicia el registro a |00…0⟩ */
  reinicia() {
    this.#amplitudes = this.#amplitudes.map(() => Complejo.cero());
    this.#amplitudes[0] = Complejo.uno();
    return this;
  }

  /** Fija el estado a partir de una lista de amplitudes (se normaliza). */
  fija(amplitudes) {
    if (amplitudes.length !== this.dimension) throw new RangeError("Dimensión incorrecta");
    this.#amplitudes = amplitudes.map((a) => new Complejo(a.re, a.im));
    return this.#normaliza();
  }

  #normaliza() {
    const norma = Math.sqrt(this.#amplitudes.reduce((s, a) => s + a.moduloCuadrado(), 0));
    if (norma > 1e-12) this.#amplitudes = this.#amplitudes.map((a) => a.escala(1 / norma));
    return this;
  }

  /** Aplica una puerta de un cúbit al cúbit indicado. */
  aplica(puerta, cubit = 0) {
    if (cubit < 0 || cubit >= this.#n) throw new RangeError("Cúbit inexistente: " + cubit);
    const paso = 1 << cubit;
    const nuevas = this.#amplitudes.slice();
    for (let i = 0; i < this.dimension; i++) {
      if ((i & paso) !== 0) continue;          // procesamos cada par una sola vez
      const j = i | paso;
      const [a, b] = puerta.aplicaPar(this.#amplitudes[i], this.#amplitudes[j]);
      nuevas[i] = a;
      nuevas[j] = b;
    }
    this.#amplitudes = nuevas;
    return this;
  }

  /** Aplica una puerta controlada: si el cúbit de control es 1, actúa sobre el objetivo. */
  aplicaControlada(puerta, control, objetivo) {
    if (control === objetivo) throw new Error("El control y el objetivo deben ser distintos");
    const bitC = 1 << control;
    const bitO = 1 << objetivo;
    const nuevas = this.#amplitudes.slice();
    for (let i = 0; i < this.dimension; i++) {
      if ((i & bitC) === 0) continue;          // control en |0⟩: no se toca
      if ((i & bitO) !== 0) continue;          // cada par, una vez
      const j = i | bitO;
      const [a, b] = puerta.aplicaPar(this.#amplitudes[i], this.#amplitudes[j]);
      nuevas[i] = a;
      nuevas[j] = b;
    }
    this.#amplitudes = nuevas;
    return this;
  }

  /** CNOT: la puerta que crea entrelazamiento. */
  cnot(control, objetivo) { return this.aplicaControlada(Puertas.X, control, objetivo); }

  /** Probabilidad de medir cada estado de la base computacional. */
  probabilidades() { return this.#amplitudes.map((a) => a.moduloCuadrado()); }

  /** Probabilidad de que un cúbit concreto salga 1. */
  probabilidadDe(cubit) {
    const bit = 1 << cubit;
    let p = 0;
    for (let i = 0; i < this.dimension; i++) if ((i & bit) !== 0) p += this.#amplitudes[i].moduloCuadrado();
    return p;
  }

  /** Etiqueta de un índice de la base: 5 → "|101⟩" */
  etiqueta(indice) {
    return "|" + indice.toString(2).padStart(this.#n, "0") + "⟩";
  }

  /**
   * Coordenadas del cúbit en la esfera de Bloch.
   * Para un estado de 1 cúbit son exactas; para más cúbits se calcula la
   * matriz densidad reducida, así que un cúbit entrelazado cae hacia el centro.
   */
  vectorBloch(cubit = 0) {
    const bit = 1 << cubit;
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < this.dimension; i++) {
      if ((i & bit) !== 0) continue;
      const j = i | bit;
      const a = this.#amplitudes[i];   // componente |0⟩ del cúbit
      const b = this.#amplitudes[j];   // componente |1⟩ del cúbit
      const prod = a.conjugado().multiplica(b);
      x += 2 * prod.re;
      y += 2 * prod.im;
      z += a.moduloCuadrado() - b.moduloCuadrado();
    }
    return { x, y, z };
  }

  /** Pureza del cúbit: 1 = estado puro, 0 = máximamente entrelazado/mezclado. */
  pureza(cubit = 0) {
    const v = this.vectorBloch(cubit);
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
   * Entropía de entrelazamiento aproximada de un cúbit (0 = separable,
   * 1 = máximamente entrelazado), a partir de la longitud del vector de Bloch.
   */
  entrelazamiento(cubit = 0) {
    const r = Math.min(1, this.pureza(cubit));
    const p = (1 + r) / 2;
    if (p >= 1 - 1e-12 || p <= 1e-12) return 0;
    const h = -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
    return h;
  }

  /**
   * Mide todo el registro: devuelve un índice de la base y COLAPSA el estado.
   * @param {() => number} aleatorio Generador (inyectable para poder hacer pruebas)
   */
  mide(aleatorio = Math.random) {
    const probs = this.probabilidades();
    const r = aleatorio();
    let acumulado = 0;
    let resultado = probs.length - 1;
    for (let i = 0; i < probs.length; i++) {
      acumulado += probs[i];
      if (r <= acumulado) { resultado = i; break; }
    }
    this.#amplitudes = this.#amplitudes.map(() => Complejo.cero());
    this.#amplitudes[resultado] = Complejo.uno();
    return { indice: resultado, bits: resultado.toString(2).padStart(this.#n, "0"), etiqueta: this.etiqueta(resultado) };
  }

  /** Mide un solo cúbit y colapsa solo esa parte del registro. */
  mideCubit(cubit, aleatorio = Math.random) {
    const p1 = this.probabilidadDe(cubit);
    const bit = 1 << cubit;
    const valor = aleatorio() < p1 ? 1 : 0;
    const norma = Math.sqrt(valor === 1 ? p1 : 1 - p1);
    this.#amplitudes = this.#amplitudes.map((a, i) => {
      const coincide = ((i & bit) !== 0 ? 1 : 0) === valor;
      return coincide && norma > 1e-12 ? a.escala(1 / norma) : Complejo.cero();
    });
    return valor;
  }

  /** Repite la medición N veces sobre copias del estado: histograma de resultados. */
  histograma(repeticiones = 1024, aleatorio = Math.random) {
    const probs = this.probabilidades();
    const cuentas = new Array(this.dimension).fill(0);
    for (let n = 0; n < repeticiones; n++) {
      const r = aleatorio();
      let acumulado = 0;
      for (let i = 0; i < probs.length; i++) {
        acumulado += probs[i];
        if (r <= acumulado) { cuentas[i]++; break; }
      }
    }
    return cuentas.map((c, i) => ({
      indice: i,
      etiqueta: this.etiqueta(i),
      cuenta: c,
      frecuencia: c / repeticiones,
      probabilidad: probs[i],
    }));
  }

  /** Notación de Dirac legible del estado completo. */
  aTexto(decimales = 3) {
    const term = [];
    for (let i = 0; i < this.dimension; i++) {
      const a = this.#amplitudes[i];
      if (a.esCero(1e-6)) continue;
      term.push(a.aTexto(decimales) + " " + this.etiqueta(i));
    }
    return term.length ? term.join("  +  ") : "0";
  }

  clona() {
    const copia = new EstadoCuantico(this.#n);
    copia.fija(this.amplitudes);
    return copia;
  }
}

/* --------------------------------------------------------------------------
   Circuito: una secuencia de operaciones con historial
   -------------------------------------------------------------------------- */
class Circuito {
  #n; #operaciones; #estado;

  constructor(n = 2) {
    this.#n = n;
    this.#operaciones = [];
    this.#estado = new EstadoCuantico(n);
  }

  get cubits() { return this.#n; }
  get operaciones() { return this.#operaciones.slice(); }
  get estado() { return this.#estado; }
  get profundidad() { return this.#operaciones.length; }

  /** Añade una puerta de un cúbit. */
  puerta(puerta, cubit) {
    this.#operaciones.push({ tipo: "simple", puerta, cubit });
    this.#estado.aplica(puerta, cubit);
    return this;
  }

  /** Añade una puerta controlada. */
  controlada(puerta, control, objetivo) {
    this.#operaciones.push({ tipo: "control", puerta, control, objetivo });
    this.#estado.aplicaControlada(puerta, control, objetivo);
    return this;
  }

  cnot(control, objetivo) { return this.controlada(Puertas.X, control, objetivo); }
  h(cubit) { return this.puerta(Puertas.H, cubit); }
  x(cubit) { return this.puerta(Puertas.X, cubit); }
  z(cubit) { return this.puerta(Puertas.Z, cubit); }

  /** Quita la última operación y recalcula el estado desde cero. */
  deshace() {
    this.#operaciones.pop();
    this.#recalcula();
    return this;
  }

  reinicia() {
    this.#operaciones = [];
    this.#estado = new EstadoCuantico(this.#n);
    return this;
  }

  /**
   * Amplia el registro a `n` cubits sin perder el circuito ya montado.
   * El cubit que entra lo hace en |0>, y como el indice de cada cubit es un
   * bit propio del numero de estado base, el resultado es exactamente el
   * estado de antes multiplicado tensorialmente por ese |0>: no se inventa
   * nada, solo se anade papel a la derecha de la hoja.
   */
  amplia(n) {
    if (n <= this.#n) return this;
    if (n > 12) throw new RangeError("Demasiados cubits: " + n);
    this.#n = n;
    this.#recalcula();
    return this;
  }

  #recalcula() {
    this.#estado = new EstadoCuantico(this.#n);
    for (const op of this.#operaciones) {
      if (op.tipo === "simple") this.#estado.aplica(op.puerta, op.cubit);
      else this.#estado.aplicaControlada(op.puerta, op.control, op.objetivo);
    }
  }

  /** Circuitos de ejemplo listos para la interfaz del laboratorio. */
  static ejemplos() {
    return [
      {
        clave: "bell",
        nombre: "Par de Bell",
        explicacion: "Hadamard sobre el primer cúbit y luego CNOT: el resultado es el estado entrelazado (|00⟩+|11⟩)/√2. Los dos cúbits siempre salen iguales, sin importar la distancia que los separe.",
        cubits: 2,
        construye: (c) => c.h(0).cnot(0, 1),
      },
      {
        clave: "superposicion",
        nombre: "Superposición uniforme",
        explicacion: "Una Hadamard en cada cúbit pone el registro en las cuatro combinaciones a la vez, todas con la misma probabilidad.",
        cubits: 2,
        construye: (c) => c.h(0).h(1),
      },
      {
        clave: "interferencia",
        nombre: "Interferencia H-Z-H",
        explicacion: "Dos Hadamard seguidas se cancelan. Pero si entre ellas metemos una Z, la fase que introduce convierte la cancelación en refuerzo: el resultado pasa de |0⟩ a |1⟩ con certeza. Esto es interferencia, y es el motor de los algoritmos cuánticos.",
        cubits: 1,
        construye: (c) => c.h(0).z(0).h(0),
      },
      {
        clave: "ghz",
        nombre: "Estado GHZ de 3 cúbits",
        explicacion: "Entrelazamiento de tres partículas: (|000⟩+|111⟩)/√2. Medir uno cualquiera determina al instante los otros dos.",
        cubits: 3,
        construye: (c) => c.h(0).cnot(0, 1).cnot(1, 2),
      },
    ];
  }
}

/* --------------------------------------------------------------------------
   Algoritmo de Grover (búsqueda en una lista desordenada)
   -------------------------------------------------------------------------- */
class Grover {
  #n; #marcado; #estado; #iteracion; #optimo;

  /**
   * @param {number} n        Número de cúbits (la lista tiene 2^n elementos)
   * @param {number} marcado  Índice del elemento buscado
   */
  constructor(n = 3, marcado = 5) {
    this.#n = n;
    this.#marcado = marcado % (1 << n);
    this.#estado = new EstadoCuantico(n);
    this.#iteracion = 0;
    this.#optimo = Math.round((Math.PI / 4) * Math.sqrt(1 << n));
    this.inicia();
  }

  get estado() { return this.#estado; }
  get iteracion() { return this.#iteracion; }
  get marcado() { return this.#marcado; }
  get iteracionesOptimas() { return this.#optimo; }
  get elementos() { return 1 << this.#n; }

  /** Probabilidad actual de encontrar el elemento buscado. */
  get probabilidadExito() { return this.#estado.probabilidades()[this.#marcado]; }

  /** Cuántas consultas necesitaría una búsqueda clásica, en promedio. */
  get consultasClasicas() { return Math.round(this.elementos / 2); }

  /** Paso 0: superposición uniforme sobre todos los elementos. */
  inicia() {
    this.#estado = new EstadoCuantico(this.#n);
    for (let q = 0; q < this.#n; q++) this.#estado.aplica(Puertas.H, q);
    this.#iteracion = 0;
    return this;
  }

  /** Oráculo: invierte el signo de la amplitud del elemento marcado. */
  #oraculo() {
    const amps = this.#estado.amplitudes;
    amps[this.#marcado] = amps[this.#marcado].escala(-1);
    this.#estado.fija(amps);
  }

  /** Difusión: refleja todas las amplitudes respecto a su media. */
  #difusion() {
    const amps = this.#estado.amplitudes;
    const media = amps
      .reduce((s, a) => s.suma(a), Complejo.cero())
      .escala(1 / amps.length);
    this.#estado.fija(amps.map((a) => media.escala(2).resta(a)));
  }

  /** Una iteración completa de Grover. */
  paso() {
    this.#oraculo();
    this.#difusion();
    this.#iteracion++;
    return this;
  }

  /** Ejecuta el número óptimo de iteraciones y mide. */
  resuelve(aleatorio = Math.random) {
    this.inicia();
    for (let i = 0; i < this.#optimo; i++) this.paso();
    return this.#estado.clona().mide(aleatorio);
  }

  /** Amplitudes reales (para dibujar el diagrama de barras). */
  amplitudesReales() {
    return this.#estado.amplitudes.map((a) => a.re);
  }
}

/* --------------------------------------------------------------------------
   Autocomprobación: verifica el motor en el propio navegador.
   Se ejecuta solo si la página lo pide con  window.COHERENCIA_PRUEBAS = true
   -------------------------------------------------------------------------- */
function pruebasCuantica() {
  const casi = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;
  const resultados = [];
  const prueba = (nombre, condicion) => resultados.push({ nombre, ok: !!condicion });

  prueba("Todas las puertas básicas son unitarias", Puertas.basicas.every((p) => p.esUnitaria()));

  const s1 = new EstadoCuantico(1).aplica(Puertas.H, 0);
  prueba("H|0⟩ da 50/50", casi(s1.probabilidades()[0], 0.5) && casi(s1.probabilidades()[1], 0.5));
  prueba("H|0⟩ apunta a +X en Bloch", casi(s1.vectorBloch().x, 1, 1e-9));

  const s2 = new EstadoCuantico(1).aplica(Puertas.H, 0).aplica(Puertas.H, 0);
  prueba("H·H = identidad", casi(s2.probabilidades()[0], 1));

  const s3 = new EstadoCuantico(1).aplica(Puertas.H, 0).aplica(Puertas.Z, 0).aplica(Puertas.H, 0);
  prueba("H·Z·H convierte |0⟩ en |1⟩ (interferencia)", casi(s3.probabilidades()[1], 1));

  const bell = new EstadoCuantico(2).aplica(Puertas.H, 0).cnot(0, 1);
  const pb = bell.probabilidades();
  prueba("Par de Bell: solo |00⟩ y |11⟩", casi(pb[0], 0.5) && casi(pb[3], 0.5) && casi(pb[1], 0) && casi(pb[2], 0));
  prueba("Cúbit entrelazado tiene vector de Bloch nulo", casi(bell.pureza(0), 0, 1e-9));
  prueba("Entrelazamiento máximo = 1 bit", casi(bell.entrelazamiento(0), 1, 1e-9));

  let iguales = true;
  for (let i = 0; i < 50; i++) {
    const c = bell.clona();
    const a = c.mideCubit(0);
    const b = c.mideCubit(1);
    if (a !== b) iguales = false;
  }
  prueba("Medir un par de Bell da siempre bits iguales", iguales);

  const g = new Grover(3, 5);
  const p0 = g.probabilidadExito;
  g.paso();
  prueba("Grover aumenta la probabilidad del elemento marcado", g.probabilidadExito > p0);
  g.inicia();
  for (let i = 0; i < g.iteracionesOptimas; i++) g.paso();
  prueba("Grover con 3 cúbits supera el 90 % de acierto", g.probabilidadExito > 0.9);

  const c1 = new Circuito(1).h(0);
  c1.amplia(2);
  const pa = c1.estado.probabilidades();
  prueba("Ampliar el registro conserva el estado y anade |0>",
    casi(pa[0], 0.5) && casi(pa[1], 0.5) && casi(pa[2], 0) && casi(pa[3], 0));
  c1.cnot(0, 1);
  prueba("CNOT tras ampliar entrelaza de verdad", casi(c1.estado.entrelazamiento(0), 1, 1e-9));
  prueba("Ampliar no toca la profundidad del circuito", c1.profundidad === 2);

  const total = resultados.length;
  const ok = resultados.filter((r) => r.ok).length;
  return { total, ok, fallos: resultados.filter((r) => !r.ok), resultados };
}

if (typeof window !== "undefined" && window.COHERENCIA_PRUEBAS) {
  const r = pruebasCuantica();
  const estilo = r.ok === r.total ? "color:#1d7a5a" : "color:#d9482b";
  console.log("%cMotor cuántico: " + r.ok + "/" + r.total + " pruebas correctas", estilo);
  if (r.fallos.length) console.table(r.fallos);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Complejo, Puerta, Puertas, EstadoCuantico, Circuito, Grover, pruebasCuantica };
}
