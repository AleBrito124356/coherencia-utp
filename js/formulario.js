/* ==========================================================================
   formulario.js — Validación y envío del formulario de contacto
   Coherencia · Parcial N.º 1 de Ingeniería Web · UTP · Brito & Gaitán

   La rúbrica pide validar al menos cuatro campos; aquí se validan seis, en
   el navegador y otra vez en el servidor (guardar.php / api/guardar.js).

   Clases:
     Regla      → una comprobación con su mensaje de error
     Reglas     → catálogo de comprobaciones reutilizables
     Campo      → un campo del formulario con sus reglas y su aviso visual
     Envio      → intenta guardar en el servidor y, si no hay servidor,
                  guarda en el navegador y ofrece descargar el archivo
     Formulario → lo junta todo
   ========================================================================== */
"use strict";

(function () {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------------------------------------------------------------- */
  class Regla {
    #prueba; #mensaje;
    constructor(prueba, mensaje) {
      this.#prueba = prueba;
      this.#mensaje = mensaje;
    }
    /** Devuelve null si el valor es válido, o el mensaje de error. */
    revisa(valor) {
      return this.#prueba(valor) ? null : this.#mensaje;
    }
  }

  class Reglas {
    static obligatorio(mensaje = "Este campo es obligatorio.") {
      return new Regla((v) => (typeof v === "boolean" ? v : String(v ?? "").trim().length > 0), mensaje);
    }
    static minimo(n, mensaje) {
      return new Regla(
        (v) => String(v).trim().length === 0 || String(v).trim().length >= n,
        mensaje || "Escriba al menos " + n + " caracteres."
      );
    }
    static maximo(n, mensaje) {
      return new Regla((v) => String(v).trim().length <= n, mensaje || "Máximo " + n + " caracteres.");
    }
    static patron(regex, mensaje) {
      return new Regla((v) => String(v).trim() === "" || regex.test(String(v).trim()), mensaje);
    }
    static letras(mensaje = "El nombre solo puede llevar letras, espacios y guiones.") {
      return Reglas.patron(/^[\p{L}\s'.-]+$/u, mensaje);
    }
    static correo(mensaje = "Escriba un correo válido, por ejemplo nombre@utp.ac.pa.") {
      return Reglas.patron(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, mensaje);
    }
    /** Teléfono de Panamá: celular de 8 dígitos que empieza por 6, o fijo de 7. */
    static telefonoPanama(mensaje = "Use un número de Panamá: 6XXX-XXXX o un fijo de 7 dígitos.") {
      return new Regla((v) => {
        const limpio = String(v ?? "").replace(/[\s\-().]/g, "").replace(/^\+?507/, "");
        if (limpio === "") return true;                 // es opcional
        return /^6\d{7}$/.test(limpio) || /^[2-9]\d{6}$/.test(limpio);
      }, mensaje);
    }
    static elegido(mensaje = "Elija una de las opciones.") {
      return new Regla((v) => String(v ?? "").trim() !== "", mensaje);
    }
    static marcado(mensaje = "Necesitamos su permiso para responderle.") {
      return new Regla((v) => v === true, mensaje);
    }
  }

  /* ---------------------------------------------------------------- */
  class Campo {
    #nombre; #controles; #contenedor; #aviso; #reglas; #tocado = false;

    constructor(nombre, formulario, reglas) {
      this.#nombre = nombre;
      this.#controles = $$('[name="' + nombre + '"]', formulario);
      if (!this.#controles.length) throw new Error("No existe el campo " + nombre);
      this.#contenedor = this.#controles[0].closest(".campo") || this.#controles[0].parentElement;
      this.#aviso = $(".error", this.#contenedor);
      this.#reglas = reglas;
      this.#escucha();
    }

    get nombre() { return this.#nombre; }
    get control() { return this.#controles[0]; }

    get valor() {
      const c = this.#controles[0];
      if (c.type === "checkbox" && this.#controles.length === 1) return c.checked;
      if (c.type === "radio") return this.#controles.find((r) => r.checked)?.value ?? "";
      return c.value.trim();
    }

    set valor(nuevo) {
      const c = this.#controles[0];
      if (c.type === "checkbox") c.checked = Boolean(nuevo);
      else c.value = nuevo ?? "";
    }

    revisa(mostrar = true) {
      let mensaje = null;
      for (const regla of this.#reglas) {
        mensaje = regla.revisa(this.valor);
        if (mensaje) break;
      }
      if (mostrar) this.#pinta(mensaje);
      return mensaje === null;
    }

    muestraError(mensaje) { this.#pinta(mensaje); }

    limpia() {
      this.#tocado = false;
      this.#contenedor.classList.remove("es-invalido", "es-valido");
      if (this.#aviso) this.#aviso.textContent = "";
      this.#controles.forEach((c) => c.removeAttribute("aria-invalid"));
    }

    #escucha() {
      const evento = ["checkbox", "radio", "select-one"].includes(this.#controles[0].type)
        ? "change"
        : "blur";
      this.#controles.forEach((c) => {
        c.addEventListener(evento, () => { this.#tocado = true; this.revisa(); });
        c.addEventListener("input", () => { if (this.#tocado) this.revisa(); });
      });
    }

    #pinta(mensaje) {
      const malo = mensaje !== null;
      const vacio = this.valor === "" || this.valor === false;
      this.#contenedor.classList.toggle("es-invalido", malo);
      this.#contenedor.classList.toggle("es-valido", !malo && !vacio);
      this.#controles.forEach((c) => c.setAttribute("aria-invalid", String(malo)));
      if (this.#aviso) this.#aviso.textContent = mensaje ?? "";
    }
  }

  /* ---------------------------------------------------------------- */
  /**
   * Envio — prueba las dos rutas de guardado que trae el proyecto y, si no
   * hay ninguna (por ejemplo al abrir el archivo directamente desde el
   * disco), guarda en el navegador y ofrece descargar el archivo de datos.
   */
  class Envio {
    static async manda(datos, base) {
      const rutas = [base + "api/guardar", base + "guardar.php"];
      for (const ruta of rutas) {
        try {
          const r = await fetch(ruta, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos),
          });
          if (r.status === 404 || r.status === 405) continue;
          const cuerpo = await r.json();
          if (r.ok && cuerpo.ok) return { ...cuerpo, ruta };
          if (cuerpo.errores) return { ok: false, errores: cuerpo.errores, ruta };
        } catch (_) {
          /* esa ruta no existe en este alojamiento: se prueba la siguiente */
        }
      }
      return Envio.#local(datos);
    }

    /** Sin servidor: el archivo de datos se construye en el navegador. */
    static #local(datos) {
      const ahora = new Date();
      const dos = (n) => String(n).padStart(2, "0");
      const fecha =
        ahora.getFullYear() + "-" + dos(ahora.getMonth() + 1) + "-" + dos(ahora.getDate()) +
        " " + dos(ahora.getHours()) + ":" + dos(ahora.getMinutes());
      const folio =
        "CO-" + String(ahora.getFullYear()).slice(2) + dos(ahora.getMonth() + 1) + dos(ahora.getDate()) +
        "-" + String(Math.floor(Math.random() * 900) + 100);

      const bloque =
        "=====================================================\n" +
        "Folio:   " + folio + "\n" +
        "Fecha:   " + fecha + "\n" +
        "Nombre:  " + datos.nombre + "\n" +
        "Correo:  " + datos.correo + "\n" +
        "Tema:    " + datos.tema + "\n" +
        "Mensaje:\n" + datos.mensaje + "\n\n";

      let archivo = "";
      try {
        archivo = localStorage.getItem("coherencia:mensajes") || "";
        localStorage.setItem("coherencia:mensajes", archivo + bloque);
      } catch (_) {
        archivo = "";
      }

      return { ok: true, folio, fecha, motor: "navegador", archivo: archivo + bloque };
    }

    /** Descarga el archivo de datos acumulado en el navegador. */
    static descarga() {
      let contenido = "";
      try {
        contenido = localStorage.getItem("coherencia:mensajes") || "";
      } catch (_) { contenido = ""; }
      if (!contenido) {
        contenido = "Todavía no hay mensajes guardados en este navegador.\n";
      }
      const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mensajes.txt";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  /* ---------------------------------------------------------------- */
  class Formulario {
    #form; #campos = new Map(); #acuse; #enviando = false; #base;

    constructor(form) {
      this.#form = form;
      this.#acuse = $("#acuse");
      this.#base = form.dataset.base || "";
      form.setAttribute("novalidate", "");

      this.#define();
      this.#contador();
      form.addEventListener("submit", (e) => this.#envia(e));
      $("[data-accion='otro-mensaje']")?.addEventListener("click", () => this.#reinicia());
      $("[data-accion='descargar']")?.addEventListener("click", () => Envio.descarga());
      $("[data-accion='ver-archivo']")?.addEventListener("click", () => this.#verArchivo());
    }

    #define() {
      const definicion = [
        ["nombre", [Reglas.obligatorio("Escriba su nombre para saber a quién responder."),
                    Reglas.minimo(3, "El nombre debe tener al menos 3 caracteres."),
                    Reglas.maximo(80), Reglas.letras()]],
        ["correo", [Reglas.obligatorio("Necesitamos un correo para responderle."), Reglas.correo()]],
        ["telefono", [Reglas.telefonoPanama()]],
        ["tema", [Reglas.elegido("Elija de qué trata su mensaje.")]],
        ["mensaje", [Reglas.obligatorio("Escriba su mensaje."),
                     Reglas.minimo(20, "Cuéntenos algo más: mínimo 20 caracteres."),
                     Reglas.maximo(1200, "El mensaje no puede pasar de 1200 caracteres.")]],
        ["acepto", [Reglas.marcado()]],
      ];
      definicion.forEach(([nombre, reglas]) => {
        this.#campos.set(nombre, new Campo(nombre, this.#form, reglas));
      });
    }

    #contador() {
      const campo = this.#campos.get("mensaje");
      const salida = $("#contador-mensaje");
      if (!campo || !salida) return;
      const pinta = () => {
        const n = campo.control.value.length;
        salida.textContent = n + " / 1200";
        salida.classList.toggle("pasado", n > 1200);
      };
      campo.control.addEventListener("input", pinta);
      this.actualizaContador = pinta;
      pinta();
    }

    #datos() {
      const datos = {};
      this.#campos.forEach((campo, nombre) => { datos[nombre] = campo.valor; });
      datos.sitio = this.#form.elements.sitio ? this.#form.elements.sitio.value : "";
      return datos;
    }

    async #envia(evento) {
      evento.preventDefault();
      if (this.#enviando) return;

      let primerMalo = null;
      this.#campos.forEach((campo) => {
        if (!campo.revisa() && !primerMalo) primerMalo = campo;
      });
      if (primerMalo) {
        primerMalo.control.focus({ preventScroll: true });
        primerMalo.control.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }

      this.#enviando = true;
      const boton = $("button[type='submit']", this.#form);
      const textoOriginal = boton.textContent;
      boton.disabled = true;
      boton.textContent = "Guardando…";

      const respuesta = await Envio.manda(this.#datos(), this.#base);

      boton.disabled = false;
      boton.textContent = textoOriginal;
      this.#enviando = false;

      if (!respuesta.ok && respuesta.errores) {
        Object.entries(respuesta.errores).forEach(([nombre, mensaje]) => {
          this.#campos.get(nombre)?.muestraError(mensaje);
        });
        return;
      }
      this.#muestraAcuse(respuesta);
    }

    #muestraAcuse(respuesta) {
      document.dispatchEvent(new CustomEvent("coherencia:medida"));
      if (!this.#acuse) return;

      const temas = {
        correccion: "Corrección de un dato",
        duda: "Duda sobre un capítulo",
        colaboracion: "Propuesta de colaboración",
        otro: "Otro asunto",
      };
      const motores = {
        php: "guardar.php · datos/mensajes.txt",
        node: "api/guardar.js · archivo del servidor",
        navegador: "sin servidor · archivo guardado en este navegador",
      };

      const pon = (clave, valor) => {
        const el = $('[data-acuse="' + clave + '"]', this.#acuse);
        if (el) el.textContent = valor;
      };
      pon("folio", respuesta.folio || "—");
      pon("fecha", respuesta.fecha || "—");
      pon("nombre", this.#campos.get("nombre").valor);
      pon("correo", this.#campos.get("correo").valor);
      pon("tema", temas[this.#campos.get("tema").valor] || "—");
      pon("motor", motores[respuesta.motor] || respuesta.motor || "—");

      this.#form.hidden = true;
      this.#acuse.classList.add("visible");
      this.#acuse.scrollIntoView({ block: "center", behavior: "smooth" });
      $("h2", this.#acuse)?.focus?.();
    }

    async #verArchivo() {
      const salida = $("[data-salida='archivo']");
      if (!salida) return;
      salida.textContent = "Consultando el archivo de datos…";
      try {
        const r = await fetch(this.#base + "api/guardar");
        if (r.ok) {
          const cuerpo = await r.json();
          salida.textContent =
            cuerpo.contenido && cuerpo.contenido.trim()
              ? cuerpo.contenido
              : "El archivo existe pero todavía está vacío.";
          return;
        }
      } catch (_) { /* sin función en el servidor */ }

      let local = "";
      try { local = localStorage.getItem("coherencia:mensajes") || ""; } catch (_) { local = ""; }
      salida.textContent = local.trim()
        ? local
        : "Aquí no hay servidor que responda, así que el archivo se guarda en este navegador. " +
          "Todavía está vacío: envíe un mensaje y vuelva a pulsar.";
    }

    #reinicia() {
      this.#form.reset();
      this.#campos.forEach((c) => c.limpia());
      this.actualizaContador?.();
      this.#acuse?.classList.remove("visible");
      this.#form.hidden = false;
      this.#campos.get("nombre").control.focus({ preventScroll: true });
      this.#form.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  const arranca = () => {
    const form = document.querySelector("#formulario-contacto");
    if (form) window.formularioContacto = new Formulario(form);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arranca);
  else arranca();
})();
