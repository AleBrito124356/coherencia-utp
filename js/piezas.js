/* ==========================================================================
   piezas.js — Los aparatos de la revista
   Coherencia · Parcial N.º 1 de Ingeniería Web · UTP · Brito & Gaitán

   Conecta las escenas 3D (js/escena3d.js) con el motor de simulación
   (js/cuantica.js). Aquí no hay física nueva: la física está en cuantica.js
   y lo que se ve en pantalla es su resultado, no una animación inventada.

     MandosInterferencia  → los dos deslizadores de la doble rendija
     MandosCriostato      → el descenso por las etapas térmicas
     MandosIones          → iluminar la cadena y leer la fluorescencia
     ConsolaLaboratorio   → el banco de trabajo completo: puertas, esfera de
                            Bloch, probabilidades, medición y reloj de T2

   Gramática de los números (regla de la dirección de arte):
   una cifra editorial puede contar hacia arriba; una LECTURA DE APARATO
   salta, como un display de siete segmentos. Aquí todo son aparatos.
   ========================================================================== */
"use strict";

(function () {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const avisaMedida = () => document.dispatchEvent(new CustomEvent("coherencia:medida"));

  /* ---------------------------------------------------------------- */
  class MandosInterferencia {
    constructor(escena) {
      this.escena = escena;
      const sep = $("#mando-separacion");
      const onda = $("#mando-onda");

      sep?.addEventListener("input", () => escena.ponSeparacion(sep.value / 100));
      onda?.addEventListener("input", () => escena.ponLongitudOnda(onda.value / 100));

      if (sep) escena.ponSeparacion(sep.value / 100);
      if (onda) escena.ponLongitudOnda(onda.value / 100);

      this.botones = $$("[data-rendijas]");
      this.botones.forEach((boton) => {
        boton.addEventListener("click", () => {
          const n = parseInt(boton.dataset.rendijas, 10);
          escena.ponRendijas(n);
          this.botones.forEach((b) => b.setAttribute("aria-pressed", String(b === boton)));
        });
      });
    }
  }

  /* ---------------------------------------------------------------- */
  class MandosCriostato {
    constructor(escena) {
      this.escena = escena;
      this.salidaTemp = $("[data-salida='criostato-temp']");
      this.salidaNombre = $("[data-salida='criostato-nombre']");
      const dial = $("#mando-etapa");

      // El rótulo lo pone la escena cuando la cámara entra de verdad en la
      // etapa, no al soltar el dial: entre una cosa y otra hay un descenso.
      escena.alCambiarEtapa((etapa) => {
        if (this.salidaTemp) this.salidaTemp.textContent = etapa.temp;
        if (this.salidaNombre) this.salidaNombre.textContent = etapa.nombre;
      });

      const aplica = () => {
        escena.ponProgreso((dial ? dial.value : 0) / 100);
      };

      dial?.addEventListener("input", aplica);
      aplica();

      // La cámara también desciende al hacer scroll sobre la figura. El recorrido
      // se cuenta SOLO en la franja en que la figura se considera «dentro»
      // (umbral del 35 %): de 0 cuando asoma su 35 % inferior a 1 cuando ya solo
      // queda su 35 % superior. Contado sobre todo el paso de la figura por la
      // ventana, el dial se quedaba entre 0,16 y 0,84 y nunca llegaba al chip.
      if ("IntersectionObserver" in window) {
        let dentro = false;
        const obs = new IntersectionObserver((e) => { dentro = e[0].isIntersecting; }, { threshold: 0.35 });
        obs.observe(escena.contenedor);
        window.addEventListener("scroll", () => {
          if (!dentro || !dial) return;
          const r = escena.contenedor.getBoundingClientRect();
          const inicio = window.innerHeight - r.height * 0.35;
          const fin = -r.height * 0.65;
          const p = Math.min(1, Math.max(0, (inicio - r.top) / (inicio - fin)));
          dial.value = Math.round(p * 100);
          aplica();
        }, { passive: true });
      }
    }
  }

  /* ---------------------------------------------------------------- */
  class MandosIones {
    constructor(escena) {
      this.escena = escena;
      this.salida = $("[data-salida='iones-bits']");

      escena.alMedir((info) => {
        if (this.salida) {
          this.salida.textContent = info.bits.split("").join(" ");
        }
        const detalle = $("[data-salida='iones-detalle']");
        if (detalle) {
          detalle.textContent =
            "Iones q" + info.pareja[0] + " y q" + info.pareja[1] + ": ambos " +
            (info.valorPareja === 0 ? "brillantes (|0⟩)" : "oscuros (|1⟩)") +
            ". " + info.brillantes + " de 7 brillantes.";
        }
        avisaMedida();
      });

      $("[data-accion='medir-iones']")?.addEventListener("click", () => escena.mide());
      $("[data-accion='reiniciar-iones']")?.addEventListener("click", () => {
        escena.reinicia();
        if (this.salida) this.salida.textContent = "— — — — — — —";
        const detalle = $("[data-salida='iones-detalle']");
        if (detalle) detalle.textContent = "Láser apagado: sin medir, no hay resultado.";
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /**
   * ConsolaLaboratorio — el banco de trabajo.
   * Mantiene un Circuito de cuantica.js, lo dibuja, y manda el vector de
   * Bloch del primer cúbit a la escena 3D después de cada operación.
   */
  class ConsolaLaboratorio {
    #circuito; #esfera; #cubitActivo = 0; #contadorMedidas = 0;

    constructor(esfera) {
      this.#esfera = esfera;
      this.#circuito = new Circuito(1);

      this.panelEstado = $("[data-salida='estado']");
      this.panelBarras = $("[data-barras]");
      this.panelPureza = $("[data-salida='pureza']");
      this.panelEntrelazamiento = $("[data-salida='entrelazamiento']");
      this.panelProfundidad = $("[data-salida='profundidad']");
      this.tira = $("[data-tira]");
      this.relojT2 = $("[data-salida='t2']");
      this.explicacion = $("[data-salida='explicacion']");

      this.#conecta();
      this.#pinta("Registro de un cúbit en |0⟩. Aplique una puerta para empezar.");
    }

    #conecta() {
      $$("[data-puerta]").forEach((boton) => {
        boton.addEventListener("click", () => {
          const puerta = Puertas.porSimbolo(boton.dataset.puerta);
          this.#circuito.puerta(puerta, this.#cubitActivo);
          this.#esfera?.paraT2();
          this.#pinta(puerta.descripcion);
        });
      });

      $$("[data-cubit]").forEach((boton) => {
        boton.addEventListener("click", () => {
          this.#cubitActivo = parseInt(boton.dataset.cubit, 10);
          $$("[data-cubit]").forEach((b) =>
            b.setAttribute("aria-pressed", String(b === boton))
          );
          this.#pinta("Las puertas se aplicarán ahora al cúbit q" + this.#cubitActivo + ".");
        });
      });

      $("[data-accion='cnot']")?.addEventListener("click", () => {
        // La CNOT necesita dos cúbits. En vez de dejar el botón muerto,
        // se añade el segundo en |0⟩ —que es justo lo que se hace en un
        // laboratorio— y se dice en el rótulo.
        let aviso = "";
        if (this.#circuito.cubits < 2) {
          this.#circuito.amplia(2);
          aviso = "Se ha añadido un segundo cúbit en |0⟩ para poder aplicarla. ";
        }
        this.#circuito.cnot(0, 1);
        this.#esfera?.paraT2();
        this.#pinta(
          aviso +
          "CNOT: si el cúbit de control está en |1⟩, invierte el objetivo. Aplicada sobre una " +
          "superposición es la puerta que crea entrelazamiento."
        );
      });

      $("[data-accion='medir']")?.addEventListener("click", () => this.#mide());
      $("[data-accion='reiniciar']")?.addEventListener("click", () => this.#reinicia());
      $("[data-accion='deshacer']")?.addEventListener("click", () => {
        this.#circuito.deshace();
        this.#pinta("Última operación deshecha.");
      });
      $("[data-accion='t2']")?.addEventListener("click", () => this.#arrancaT2());

      $$("[data-ejemplo]").forEach((boton) => {
        boton.addEventListener("click", () => this.#cargaEjemplo(boton.dataset.ejemplo));
      });
    }

    #cargaEjemplo(clave) {
      const ejemplo = Circuito.ejemplos().find((e) => e.clave === clave);
      if (!ejemplo) return;
      this.#circuito = new Circuito(ejemplo.cubits);
      ejemplo.construye(this.#circuito);
      this.#cubitActivo = 0;
      this.#esfera?.limpiaEstela();
      this.#esfera?.paraT2();
      this.#pinta(ejemplo.explicacion);
      this.#anota("Circuito cargado: " + ejemplo.nombre);
    }

    #mide() {
      const estado = this.#circuito.estado;
      const resultado = estado.mide();
      this.#contadorMedidas++;
      this.#esfera?.destello();
      avisaMedida();
      this.#pinta(
        "Medido. El registro ha colapsado a " + resultado.etiqueta + ": a partir de ahora " +
        "ese es su estado, y la superposición anterior ya no existe."
      );
      this.#anota("Medida " + this.#contadorMedidas + " → " + resultado.etiqueta);
    }

    #reinicia() {
      // Vuelve también al registro de un solo cúbit, no solo al estado |0…0⟩
      this.#circuito = new Circuito(1);
      this.#cubitActivo = 0;
      this.#esfera?.limpiaEstela();
      this.#esfera?.paraT2();
      this.#pinta("Registro reiniciado a |0…0⟩.");
    }

    /**
     * Arranca el reloj de la decoherencia. En un procesador real esto tarda
     * unos cientos de microsegundos; aquí se estira a doce segundos para que
     * se pueda ver a simple vista.
     */
    #arrancaT2() {
      if (!this.#esfera) return;
      this.#anota("T2 en marcha: el entorno empieza a mirar");
      this.#esfera.arrancaT2(12, (restante) => {
        if (this.relojT2) this.relojT2.textContent = restante.toFixed(1).replace(".", ",") + " s";
        if (restante <= 0) {
          this.#pinta(
            "Se acabó la coherencia. El vector ha caído al centro y luego al polo: el estado " +
            "que se iba a calcular ya no está. Esto es lo que ocurre de verdad cuando un " +
            "cúbit se calienta, y es el motivo de todo el refrigerador."
          );
          this.#anota("T2 agotado: estado perdido");
        }
      });
      this.#pinta(
        "Reloj de T2 en marcha. Mire la aguja: el vector se acorta y cae hacia el polo. " +
        "Eso es la decoherencia, escalada a doce segundos para poder verla."
      );
    }

    #anota(texto) {
      if (!this.tira) return;
      const linea = document.createElement("li");
      linea.textContent = texto;
      this.tira.prepend(linea);
      while (this.tira.children.length > 8) this.tira.lastElementChild.remove();
    }

    #pinta(explicacion) {
      const estado = this.#circuito.estado;

      if (this.panelEstado) this.panelEstado.textContent = estado.aTexto();
      if (this.panelProfundidad) this.panelProfundidad.textContent = String(this.#circuito.profundidad);

      const pureza = estado.pureza(0);
      if (this.panelPureza) this.panelPureza.textContent = pureza.toFixed(2).replace(".", ",");
      if (this.panelEntrelazamiento) {
        const e = estado.entrelazamiento(0);
        this.panelEntrelazamiento.textContent =
          e.toFixed(2).replace(".", ",") + (e > 0.9 ? " (máximo)" : e > 0.05 ? "" : " (ninguno)");
      }

      if (this.panelBarras) {
        const probs = estado.probabilidades();
        this.panelBarras.innerHTML = probs
          .map((p, i) => {
            const elegida = p > 0.999 ? " barra--elegida" : "";
            return (
              '<div class="barra' + elegida + '">' +
              '<span>' + estado.etiqueta(i) + "</span>" +
              '<span class="barra__pista"><span class="barra__valor" style="--p:' +
              (p * 100).toFixed(1) + '%"></span></span>' +
              '<span class="barra__cifra">' + (p * 100).toFixed(1).replace(".", ",") + " %</span>" +
              "</div>"
            );
          })
          .join("");
      }

      this.#esfera?.ponVector(estado.vectorBloch(0));

      if (this.explicacion && explicacion) this.explicacion.textContent = explicacion;

      // Los botones de cúbit solo tienen sentido con más de uno
      $$("[data-cubit]").forEach((b) => {
        const i = parseInt(b.dataset.cubit, 10);
        b.hidden = i >= this.#circuito.cubits;
        b.setAttribute("aria-pressed", String(i === this.#cubitActivo));
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /**
   * DemoFase — la esfera de Bloch como figura, fuera del laboratorio.
   * Da la vuelta al ecuador en pasos de 90° (|+⟩ → |i⟩ → |−⟩ → |−i⟩) y se
   * detiene más en |+⟩ y en |−⟩, que son los dos estados que compara el
   * texto. Se hace en cuatro cuartos y no de |+⟩ a |−⟩ de golpe porque son
   * antípodas: entre dos puntos opuestos no hay un único círculo máximo.
   */
  class DemoFase {
    constructor(esfera) {
      const pasos = [
        { v: { x: 1, y: 0, z: 0 }, espera: 2600 },
        { v: { x: 0, y: 1, z: 0 }, espera: 1300 },
        { v: { x: -1, y: 0, z: 0 }, espera: 2600 },
        { v: { x: 0, y: -1, z: 0 }, espera: 1300 },
      ];
      esfera.ponVector(pasos[0].v);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      let i = 0;
      const siguiente = () => {
        i = (i + 1) % pasos.length;
        esfera.ponVector(pasos[i].v);
        setTimeout(siguiente, pasos[i].espera);
      };
      setTimeout(siguiente, pasos[0].espera);
    }
  }

  /* ---------------------------------------------------------------- */
  /**
   * MandosGrover — la búsqueda de Grover, con su defecto incluido.
   * Se dibujan las amplitudes reales (que pueden ser negativas), no las
   * probabilidades, porque el algoritmo consiste precisamente en manejar
   * el signo de la amplitud marcada.
   */
  class MandosGrover {
    #grover; #barras; #iteracion; #exito;

    constructor() {
      this.#barras = $("[data-grover-barras]");
      this.#iteracion = $("[data-salida='grover-iteracion']");
      this.#exito = $("[data-salida='grover-exito']");
      if (!this.#barras || typeof Grover !== "function") return;

      this.#grover = new Grover(4, 11);

      $("[data-grover='paso']")?.addEventListener("click", () => {
        this.#grover.paso();
        this.#pinta();
      });
      $("[data-grover='resolver']")?.addEventListener("click", () => {
        const resultado = this.#grover.resuelve();
        this.#pinta();
        avisaMedida();
        if (this.#exito) this.#exito.textContent = "medido " + resultado.etiqueta;
      });
      $("[data-grover='reiniciar']")?.addEventListener("click", () => {
        this.#grover.inicia();
        this.#pinta();
      });

      this.#pinta();
    }

    #pinta() {
      const amplitudes = this.#grover.amplitudesReales();
      const marcado = this.#grover.marcado;
      // Escala fija sobre 1, la amplitud máxima posible. Escalando sobre la
      // mayor del momento, al empezar las 16 barras salían llenas —un muro
      // sin información— y no se veía crecer la marcada.
      const maximo = 1;

      this.#barras.innerHTML = amplitudes
        .map((a, i) => {
          const ancho = (Math.abs(a) / maximo) * 100;
          const elegida = i === marcado ? " barra--elegida" : "";
          const signo = a < 0 ? "−" : "";
          return (
            '<div class="barra' + elegida + '">' +
            "<span>" + String(i).padStart(2, "0") + "</span>" +
            '<span class="barra__pista"><span class="barra__valor" style="--p:' +
            ancho.toFixed(1) + '%"></span></span>' +
            '<span class="barra__cifra">' + signo +
            Math.abs(a).toFixed(2).replace(".", ",") + "</span>" +
            "</div>"
          );
        })
        .join("");

      if (this.#iteracion) this.#iteracion.textContent = String(this.#grover.iteracion);
      if (this.#exito) {
        this.#exito.textContent =
          (this.#grover.probabilidadExito * 100).toFixed(1).replace(".", ",") + " %";
      }
    }
  }

  /* ---------------------------------------------------------------- */
  // Los aparatos se conectan UNA vez, cuando las escenas existen. Si el aviso
  // ya pasó antes de que cargara este archivo, se pregunta por la bandera: sin
  // esto, un cambio en el orden de los <script> dejaría todos los mandos
  // muertos sin dar ni un error.
  let conectado = false;
  const conecta = () => {
    const api = window.Coherencia3D;
    if (conectado || !api) return;
    conectado = true;

    const interferencia = api.instancia("interferencia");
    if (interferencia) new MandosInterferencia(interferencia);

    const criostato = api.instancia("criostato");
    if (criostato) new MandosCriostato(criostato);

    const iones = api.instancia("iones");
    if (iones) new MandosIones(iones);

    // La consola solo existe en la página del laboratorio
    if ($("[data-salida='estado']") && typeof Circuito === "function") {
      window.consola = new ConsolaLaboratorio(api.instancia("bloch"));
    }

    // Fuera del laboratorio, la esfera puede hacer de figura
    const bloch = api.instancia("bloch");
    if (bloch && !window.consola && bloch.contenedor.dataset.demo === "fase") new DemoFase(bloch);
  };

  if (window.Coherencia3D?.listo) conecta();
  else document.addEventListener("coherencia3d:listo", conecta);

  // Grover no necesita ninguna escena 3D: arranca en cuanto hay documento.
  const arrancaGrover = () => { if ($("[data-grover-barras]")) new MandosGrover(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancaGrover);
  else arrancaGrover();

  // Si no hay WebGL —o el paquete 3D no llegó a cargar—, la consola sigue
  // funcionando sin la esfera. Solo si nadie la ha creado ya: dos consolas
  // sobre los mismos botones aplicarían cada puerta dos veces, y H·H es la
  // identidad, así que pulsar H parecería no hacer nada.
  window.addEventListener("load", () => {
    if (!window.consola && !window.Coherencia3D?.hayWebGL?.() && $("[data-salida='estado']") && typeof Circuito === "function") {
      window.consola = new ConsolaLaboratorio(null);
    }
  });
})();
