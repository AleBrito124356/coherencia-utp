# Revisión estructural de las páginas: etiquetas sin cerrar, atributos que
# faltan, enlaces rotos y cumplimiento de la rúbrica. No sustituye al
# validador del W3C, pero atrapa lo que se rompe de verdad.
import io, os, re, sys
from html.parser import HTMLParser

RAIZ = r"C:\Claude Ideas\Brito-Gaitan"
VACIAS = {"area","base","br","col","embed","hr","img","input","link","meta",
          "param","source","track","wbr","circle","path","rect","line","polygon",
          "polyline","ellipse","use","stop"}

class Revisor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.pila = []
        self.errores = []
        self.cuenta = {}
        self.imgs = []
        self.enlaces = []
        self.ids = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.cuenta[tag] = self.cuenta.get(tag, 0) + 1
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "img":
            self.imgs.append(a)
        if tag == "a" and "href" in a:
            self.enlaces.append(a["href"])
        if tag not in VACIAS:
            self.pila.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VACIAS and self.pila and self.pila[-1][0] == tag:
            self.pila.pop()

    def handle_endtag(self, tag):
        if tag in VACIAS:
            return
        if not self.pila:
            self.errores.append("cierre sobrante </%s> en linea %d" % (tag, self.getpos()[0]))
            return
        if self.pila[-1][0] == tag:
            self.pila.pop()
        else:
            abierta, linea = self.pila[-1]
            self.errores.append("se esperaba </%s> (abierta en %d) y llego </%s> en %d"
                                % (abierta, linea, tag, self.getpos()[0]))
            for i in range(len(self.pila) - 1, -1, -1):
                if self.pila[i][0] == tag:
                    del self.pila[i:]
                    break

paginas = [os.path.join(RAIZ, "index.html")]
carpeta = os.path.join(RAIZ, "html")
for f in sorted(os.listdir(carpeta)):
    if f.endswith(".html"):
        paginas.append(os.path.join(carpeta, f))
paginas.append(os.path.join(RAIZ, "diseno", "tecnica-de-diseno.html"))

problemas = 0
print("%-26s %5s %4s %4s %4s %4s %4s  %s" %
      ("pagina", "KB", "sec", "art", "asd", "fig", "img", "estado"))
print("-" * 92)

for ruta in paginas:
    html = io.open(ruta, encoding="utf-8").read()
    r = Revisor()
    try:
        r.feed(html)
    except Exception as e:
        r.errores.append("no se pudo analizar: %s" % e)

    for tag, linea in r.pila:
        if tag not in ("html", "body", "head"):
            r.errores.append("sin cerrar <%s> abierta en la linea %d" % (tag, linea))

    # Comprobaciones de la rúbrica y de calidad
    if "lang=\"es\"" not in html:
        r.errores.append("falta lang=es")
    if "<meta name=\"description\"" not in html:
        r.errores.append("falta meta description")
    if "<title>" not in html:
        r.errores.append("falta title")
    for img in r.imgs:
        if not img.get("alt"):
            r.errores.append("img sin alt: %s" % img.get("src", "?"))
        if not img.get("loading") and "descenso" not in img.get("src", ""):
            r.errores.append("img sin loading=lazy: %s" % img.get("src", "?"))

    # Enlaces internos
    base = os.path.dirname(ruta)
    for href in r.enlaces:
        if href.startswith(("http", "mailto:", "tel:", "#", "data:")):
            continue
        destino = href.split("#")[0]
        if not destino:
            continue
        completo = os.path.normpath(os.path.join(base, destino))
        if not os.path.exists(completo):
            r.errores.append("enlace roto: %s" % href)

    repetidos = [i for i in set(r.ids) if r.ids.count(i) > 1]
    if repetidos:
        r.errores.append("id repetido: %s" % ", ".join(repetidos))

    estado = "ok" if not r.errores else "%d PROBLEMA(S)" % len(r.errores)
    problemas += len(r.errores)
    print("%-26s %5d %4d %4d %4d %4d %4d  %s" % (
        os.path.basename(ruta), len(html) / 1024,
        r.cuenta.get("section", 0), r.cuenta.get("article", 0),
        r.cuenta.get("aside", 0), r.cuenta.get("figure", 0),
        r.cuenta.get("img", 0), estado))
    for e in r.errores[:8]:
        print("      · " + e)

print("-" * 92)
print("Total de problemas:", problemas)
sys.exit(0)
