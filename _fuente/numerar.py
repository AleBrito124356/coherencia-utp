# Renumera las figuras de toda la revista en orden de lectura.
# En una revista impresa las figuras van corridas de la primera página a la
# última, y cada capítulo lo escribió un redactor distinto sin saber cuántas
# había antes, así que la numeración hay que rehacerla al cerrar el número.
import io, os, re

RAIZ = r"C:\Claude Ideas\Brito-Gaitan"

ORDEN = [
    "index.html",
    os.path.join("html", "fundamentos.html"),
    os.path.join("html", "hardware.html"),
    os.path.join("html", "laboratorio.html"),
    os.path.join("html", "aplicaciones.html"),
    os.path.join("html", "acerca-de.html"),
    os.path.join("html", "contacto.html"),
]

PATRON = re.compile(r"<b>\s*Fig\.\s*(\d+)\s*</b>")
n = [0]          # la Fig. 0 es el vídeo del héroe, va aparte

for relativo in ORDEN:
    ruta = os.path.join(RAIZ, relativo)
    if not os.path.exists(ruta):
        continue
    s = io.open(ruta, encoding="utf-8").read()
    cambios = []

    def sustituye(m):
        n[0] += 1
        cambios.append((m.group(1), n[0]))
        return "<b>Fig. %d</b>" % n[0]

    nuevo = PATRON.sub(sustituye, s)

    # Las referencias en el texto a «Fig. N» sueltas se actualizan con el mapa
    mapa = {viejo: nuevo_n for viejo, nuevo_n in cambios}
    if mapa:
        def refiere(m):
            viejo = m.group(1)
            return "Fig. %d" % mapa[viejo] if viejo in mapa else m.group(0)
        # Solo fuera de <b>, que ya se trató
        nuevo = re.sub(r"(?<!<b>)Fig\.\s*(\d+)(?!</b>)", refiere, nuevo)

    if nuevo != s:
        io.open(ruta, "w", encoding="utf-8").write(nuevo)
    print("%-28s %s" % (relativo, ", ".join("%s->%d" % c for c in cambios) or "sin figuras"))

print("\nTotal de figuras numeradas:", n[0])
