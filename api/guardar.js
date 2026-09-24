/* ==========================================================================
   api/guardar.js — La misma función que guardar.php, para el hosting
   Coherencia · Parcial N.º 1 de Ingeniería Web · UTP · Brito & Gaitán

   El sitio se publica en Vercel, que sirve archivos estáticos y no ejecuta
   PHP. Esta función en Node hace exactamente lo mismo que guardar.php:
   valida los campos y añade el mensaje a un archivo de texto.

   AVISO HONESTO, y así está escrito también en la página de contacto:
   en un hosting gratuito sin base de datos, el único lugar donde una función
   puede escribir es el almacenamiento temporal del servidor. El archivo
   existe y se puede leer (GET a esta misma dirección), pero la plataforma
   lo borra cuando recicla la instancia. Cuando el sitio corre en un servidor
   con PHP —por ejemplo en WAMP, como en clase— guardar.php escribe en
   datos/mensajes.txt de forma permanente.

   En el Proyecto N.º 2 esto se sustituye por una base de datos.
   ========================================================================== */

const fs = require("fs");
const os = require("os");
const path = require("path");

const ARCHIVO = path.join(os.tmpdir(), "coherencia-mensajes.txt");
const TEMAS = ["correccion", "duda", "colaboracion", "otro"];

function limpia(valor, maximo) {
  if (typeof valor !== "string") return "";
  return valor.trim().replace(/[\r\0]/g, "").slice(0, maximo);
}

function valida(datos) {
  const errores = {};
  const nombre = limpia(datos.nombre, 80);
  const correo = limpia(datos.correo, 120);
  const tema = limpia(datos.tema, 40);
  const mensaje = limpia(datos.mensaje, 1200);

  if (nombre.length < 3) {
    errores.nombre = "El nombre debe tener al menos 3 caracteres.";
  } else if (!/^[\p{L}\s'.-]+$/u.test(nombre)) {
    errores.nombre = "El nombre solo puede llevar letras, espacios y guiones.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
    errores.correo = "Escriba un correo electrónico válido.";
  }

  if (!TEMAS.includes(tema)) {
    errores.tema = "Elija uno de los temas de la lista.";
  }

  if (mensaje.length < 20) {
    errores.mensaje = "Cuéntenos algo más: mínimo 20 caracteres.";
  } else if (mensaje.length > 1200) {
    errores.mensaje = "El mensaje no puede pasar de 1200 caracteres.";
  }

  return { errores, limpios: { nombre, correo, tema, mensaje } };
}

function dosDigitos(n) {
  return String(n).padStart(2, "0");
}

module.exports = function handler(peticion, respuesta) {
  respuesta.setHeader("Content-Type", "application/json; charset=utf-8");
  respuesta.setHeader("X-Content-Type-Options", "nosniff");

  // GET: devuelve el archivo de datos, para poder comprobar que se escribió
  if (peticion.method === "GET") {
    let contenido = "";
    try {
      contenido = fs.readFileSync(ARCHIVO, "utf8");
    } catch (_) {
      contenido = "";
    }
    const bloques = contenido.split("=====").filter((b) => b.trim().length > 0);
    return respuesta.status(200).json({
      ok: true,
      archivo: "almacenamiento temporal del servidor",
      mensajes: bloques.length,
      contenido: contenido.slice(-6000),
    });
  }

  if (peticion.method !== "POST") {
    return respuesta.status(405).json({ ok: false, error: "Solo se acepta POST." });
  }

  let datos = peticion.body;
  if (typeof datos === "string") {
    try { datos = JSON.parse(datos); } catch (_) { datos = {}; }
  }
  if (!datos || typeof datos !== "object") datos = {};

  // Campo señuelo: si un robot lo rellena, se responde bien y no se guarda
  if (limpia(datos.sitio, 200) !== "") {
    return respuesta.status(200).json({ ok: true, folio: "CO-0000-000" });
  }

  const { errores, limpios } = valida(datos);
  if (Object.keys(errores).length > 0) {
    return respuesta.status(422).json({ ok: false, errores });
  }

  const ahora = new Date();
  const fecha =
    ahora.getFullYear() + "-" + dosDigitos(ahora.getMonth() + 1) + "-" + dosDigitos(ahora.getDate()) +
    " " + dosDigitos(ahora.getHours()) + ":" + dosDigitos(ahora.getMinutes()) + ":" + dosDigitos(ahora.getSeconds());
  const folio =
    "CO-" + String(ahora.getFullYear()).slice(2) + dosDigitos(ahora.getMonth() + 1) +
    dosDigitos(ahora.getDate()) + "-" + String(Math.floor(Math.random() * 900) + 100);

  const bloque =
    "=====================================================\n" +
    "Folio:   " + folio + "\n" +
    "Fecha:   " + fecha + "\n" +
    "Nombre:  " + limpios.nombre + "\n" +
    "Correo:  " + limpios.correo + "\n" +
    "Tema:    " + limpios.tema + "\n" +
    "Mensaje:\n" + limpios.mensaje + "\n\n";

  try {
    fs.appendFileSync(ARCHIVO, bloque, "utf8");
  } catch (error) {
    return respuesta.status(500).json({
      ok: false,
      error: "No se pudo escribir el archivo de datos en el servidor.",
    });
  }

  return respuesta.status(200).json({
    ok: true,
    folio,
    fecha,
    archivo: "mensajes.txt (almacenamiento del servidor)",
    motor: "node",
  });
};
