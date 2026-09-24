# Descarga las tipografías (SIL OFL) y genera el CSS de @font-face autoalojado.
import io, os, re, urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
API = "https://fonts.googleapis.com/css2"
DESTINO = r"C:\Claude Ideas\Brito-Gaitan\fuentes"
os.makedirs(DESTINO, exist_ok=True)

FAMILIAS = [
    ("bodoni-moda", "Bodoni Moda",
     "family=Bodoni+Moda:opsz,wght@6..96,400..700&display=swap"),
    ("source-serif", "Source Serif 4",
     "family=Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..700&display=swap"),
    ("plex-mono", "IBM Plex Mono",
     "family=IBM+Plex+Mono:wght@400;500&display=swap"),
]

SUBCONJUNTOS = ("latin", "latin-ext")


def pide(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=60).read()


bloques_css = []
descargados = 0

for slug, nombre, consulta in FAMILIAS:
    css = pide(API + "?" + consulta).decode("utf-8")
    # El CSS trae un comentario con el nombre del subconjunto antes de cada @font-face
    trozos = re.split(r"/\*\s*([a-z0-9\-\[\]]+)\s*\*/", css)
    i = 1
    n = 0
    while i < len(trozos) - 1:
        subconjunto = trozos[i]
        bloque = trozos[i + 1]
        i += 2
        if subconjunto not in SUBCONJUNTOS:
            continue
        url = re.search(r"url\((https://[^)]+\.woff2)\)", bloque)
        if not url:
            continue
        estilo = "italic" if "font-style: italic" in bloque else "normal"
        peso = re.search(r"font-weight:\s*([^;]+);", bloque)
        peso = peso.group(1).strip() if peso else "400"
        rango = re.search(r"unicode-range:\s*([^;]+);", bloque)
        rango = rango.group(1).strip() if rango else None

        n += 1
        archivo = "%s-%s-%s-%d.woff2" % (slug, subconjunto, estilo, n)
        datos = pide(url.group(1))
        io.open(os.path.join(DESTINO, archivo), "wb").write(datos)
        descargados += 1

        lineas = [
            "@font-face {",
            '  font-family: "%s";' % nombre,
            "  font-style: %s;" % estilo,
            "  font-weight: %s;" % peso,
            "  font-display: swap;",
            '  src: url("../fuentes/%s") format("woff2");' % archivo,
        ]
        if rango:
            lineas.append("  unicode-range: %s;" % rango)
        lineas.append("}")
        bloques_css.append("\n".join(lineas))
        print("  %-42s %6d B  (%s %s %s)" % (archivo, len(datos), subconjunto, estilo, peso))

cabecera = """/* ==========================================================================
   tipografias.css — Familias autoalojadas (licencia SIL Open Font License)
   Coherencia · Ingeniería Web · UTP

   Se alojan en el propio proyecto para que el sitio funcione sin conexión,
   que es como se va a abrir en clase. Archivos en la carpeta fuentes/.

   Bodoni Moda   (Owen Earl, indestructible type*)  — titulares
   Source Serif 4 (Frank Grießhammer, Adobe)        — texto corrido
   IBM Plex Mono (Mike Abbink, Bold Monday, IBM)    — datos y aparatos
   ========================================================================== */

"""

io.open(os.path.join(r"C:\Claude Ideas\Brito-Gaitan\css", "tipografias.css"), "w", encoding="utf-8").write(
    cabecera + "\n\n".join(bloques_css) + "\n")

total = sum(os.path.getsize(os.path.join(DESTINO, f)) for f in os.listdir(DESTINO))
print("\n%d archivos, %.0f KB en total" % (descargados, total / 1024))
