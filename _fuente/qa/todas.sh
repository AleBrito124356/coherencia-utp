#!/bin/sh
# Recorre las 7 páginas a los 3 tamaños y deja un resumen por línea.
cd "/c/Claude Ideas/Brito-Gaitan/_fuente/qa"
ETQ=${1:-v5}
rm -f salida/$ETQ-resumen.txt
for tam in 2000x1030 1440x900 390x844; do
  for p in index fundamentos hardware laboratorio aplicaciones acerca-de contacto; do
    f=html/$p.html; [ $p = index ] && f=index.html
    (node recorrido.mjs $f $tam salida/$ETQ-$p-$tam 0.85 > salida/$ETQ-$p-$tam.json 2>&1
     python -c "import json,sys; d=json.load(open(sys.argv[1],encoding='utf-8')); print('%-22s %-9s alto=%-6s sinImprimir=%d huecos=%d vacios=%s estrujado=%s errores=%s' % (d['pagina'], d['ventana'], d['altoPagina'], len(d['sinImprimirAlFinal']), len(d['huecosGrandes']), [(v['captura'][-6:], v['vacio']['frac']) for v in d['vaciosGrandes']], d['textoEstrujado'], d['errores']))" salida/$ETQ-$p-$tam.json >> salida/$ETQ-resumen.txt) &
  done
  wait
done
echo FIN >> salida/$ETQ-resumen.txt
