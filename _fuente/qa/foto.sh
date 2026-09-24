#!/usr/bin/env bash
# Fotografía una escena del banco de pruebas con Edge sin interfaz y WebGL
# por software (SwiftShader).
# Uso: bash foto.sh "tipo=criostato&p=1" 900x900 salida.png
set -e
CONSULTA="$1"; TAM="${2:-900x700}"; SALIDA="$3"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
PERFIL="${TMPDIR:-/tmp}/coherencia-edge-$$-$RANDOM"
mkdir -p "$PERFIL"
"$EDGE" --headless=new --user-data-dir="$PERFIL" --no-first-run \
  --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist \
  --force-device-scale-factor=1 --window-size="${TAM/x/,}" \
  --screenshot="$SALIDA" \
  "file:///C:/Claude%20Ideas/Brito-Gaitan/_fuente/qa/escena.html?$CONSULTA&paquete=${PAQUETE:-publicado}" > /dev/null 2>&1 || true
rm -rf "$PERFIL" 2>/dev/null || true
echo "$SALIDA"
