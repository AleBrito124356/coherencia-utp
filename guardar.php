<?php
/* ==========================================================================
   guardar.php — Recibe el formulario de contacto y lo guarda en un archivo
   Coherencia · Parcial N.º 1 de Ingeniería Web · UTP · Brito & Gaitán

   La rúbrica pide que el formulario guarde los datos en un archivo de datos.
   Este script escribe DOS archivos dentro de la carpeta datos/:

     datos/mensajes.txt  legible por una persona, un bloque por mensaje
     datos/mensajes.csv  el mismo contenido en columnas, para abrir en Excel

   Funciona con cualquier servidor con PHP (WAMP, XAMPP, hosting gratuito).
   El sitio también trae una función equivalente en Node (api/guardar.js)
   para el hosting de Vercel, y el JavaScript del formulario prueba las dos.

   La validación se repite AQUÍ aunque ya se haya hecho en el navegador:
   la del navegador es comodidad para quien escribe, la del servidor es la
   que de verdad protege el archivo.
   ========================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Solo se acepta POST.'], JSON_UNESCAPED_UNICODE);
    exit;
}

/* El formulario puede llegar como JSON o como envío clásico de formulario */
$crudo = file_get_contents('php://input');
$datos = json_decode($crudo, true);
if (!is_array($datos)) {
    $datos = $_POST;
}

function limpia($valor, $maximo = 500)
{
    $valor = is_string($valor) ? $valor : '';
    $valor = trim($valor);
    $valor = str_replace(["\r", "\0"], '', $valor);
    if (function_exists('mb_substr')) {
        return mb_substr($valor, 0, $maximo, 'UTF-8');
    }
    return substr($valor, 0, $maximo);
}

$nombre  = limpia($datos['nombre']  ?? '', 80);
$correo  = limpia($datos['correo']  ?? '', 120);
$tema    = limpia($datos['tema']    ?? '', 40);
$mensaje = limpia($datos['mensaje'] ?? '', 1200);
$trampa  = limpia($datos['sitio']   ?? '', 200);   // campo señuelo para robots

/* ------------------------- Validación en servidor ------------------------ */
$errores = [];

if ($nombre === '' || mb_strlen($nombre, 'UTF-8') < 3) {
    $errores['nombre'] = 'El nombre debe tener al menos 3 caracteres.';
} elseif (!preg_match('/^[\p{L}\s\'.\-]+$/u', $nombre)) {
    $errores['nombre'] = 'El nombre solo puede llevar letras, espacios y guiones.';
}

if ($correo === '' || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
    $errores['correo'] = 'Escriba un correo electrónico válido.';
}

$temasValidos = ['correccion', 'duda', 'colaboracion', 'otro'];
if (!in_array($tema, $temasValidos, true)) {
    $errores['tema'] = 'Elija uno de los temas de la lista.';
}

$largoMensaje = mb_strlen($mensaje, 'UTF-8');
if ($largoMensaje < 20) {
    $errores['mensaje'] = 'Cuéntenos algo más: mínimo 20 caracteres.';
} elseif ($largoMensaje > 1200) {
    $errores['mensaje'] = 'El mensaje no puede pasar de 1200 caracteres.';
}

if ($trampa !== '') {
    /* Un robot rellenó el campo oculto: se responde bien y no se guarda nada */
    echo json_encode(['ok' => true, 'folio' => 'CO-0000-000'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!empty($errores)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'errores' => $errores], JSON_UNESCAPED_UNICODE);
    exit;
}

/* --------------------------- Guardado en archivo ------------------------- */
$carpeta = __DIR__ . DIRECTORY_SEPARATOR . 'datos';
if (!is_dir($carpeta)) {
    @mkdir($carpeta, 0775, true);
}

$fecha  = date('Y-m-d H:i:s');
$folio  = 'CO-' . date('ymd') . '-' . str_pad((string) random_int(1, 999), 3, '0', STR_PAD_LEFT);
$origen = $_SERVER['REMOTE_ADDR'] ?? 'desconocido';

$bloque = "=====================================================\n"
        . "Folio:   {$folio}\n"
        . "Fecha:   {$fecha}\n"
        . "Nombre:  {$nombre}\n"
        . "Correo:  {$correo}\n"
        . "Tema:    {$tema}\n"
        . "Origen:  {$origen}\n"
        . "Mensaje:\n{$mensaje}\n\n";

$escrito = @file_put_contents(
    $carpeta . DIRECTORY_SEPARATOR . 'mensajes.txt',
    $bloque,
    FILE_APPEND | LOCK_EX
);

if ($escrito === false) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'No se pudo escribir en datos/mensajes.txt. Revise los permisos de la carpeta.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/* La misma información en CSV, para poder abrirla en una hoja de cálculo */
$csv = $carpeta . DIRECTORY_SEPARATOR . 'mensajes.csv';
$nuevo = !file_exists($csv);
$manejador = @fopen($csv, 'a');
if ($manejador) {
    if (flock($manejador, LOCK_EX)) {
        if ($nuevo) {
            fputcsv($manejador, ['folio', 'fecha', 'nombre', 'correo', 'tema', 'mensaje']);
        }
        fputcsv($manejador, [$folio, $fecha, $nombre, $correo, $tema, $mensaje]);
        flock($manejador, LOCK_UN);
    }
    fclose($manejador);
}

echo json_encode([
    'ok'      => true,
    'folio'   => $folio,
    'fecha'   => $fecha,
    'archivo' => 'datos/mensajes.txt',
    'motor'   => 'php',
], JSON_UNESCAPED_UNICODE);
