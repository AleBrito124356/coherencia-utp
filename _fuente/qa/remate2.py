# Remate de la segunda pasada de revisión visual: cambios de marcado.
import io, os, re

RAIZ = r"C:\Claude Ideas\Brito-Gaitan"
PAGINAS = ["index.html"] + ["html/" + f for f in sorted(os.listdir(os.path.join(RAIZ, "html"))) if f.endswith(".html")]
NBSP = "\u00a0"
FINO = "\u202f"          # espacio fino duro, el que va entre cifra y unidad

UNIDADES = r"(mK|mW|µW|μW|µs|μs|ms|ns|kHz|MHz|GHz|µm|μm|nm|mm|kW)"

def lee(p):
    return io.open(os.path.join(RAIZ, p), encoding="utf-8", newline="").read()

def escribe(p, s):
    io.open(os.path.join(RAIZ, p), "w", encoding="utf-8", newline="").write(s)

def solo_texto(fragmento, fn):
    """Aplica fn a los trozos de texto, nunca dentro de las etiquetas."""
    partes = re.split(r"(<[^>]+>)", fragmento)
    return "".join(p if p.startswith("<") else fn(p) for p in partes)

def protege_unidades(texto):
    return re.sub(r"(?<![\wµμ])" + UNIDADES + r"(?![\w])", r'<span class="sin-mayus">\1</span>', texto)

# Elementos que el CSS pasa a versalitas o mayúsculas
EN_MAYUSCULAS = [
    r"<dt\b[^>]*>.*?</dt>",
    r"<caption\b[^>]*>.*?</caption>",
    r'<th scope="col"[^>]*>.*?</th>',
    r'<p class="(?:rotulo|folio)[^"]*"[^>]*>.*?</p>',
    r'<p class="nota[^"]*">\s*<b>.*?</b>',
]

cuentas = {}
for p in PAGINAS:
    s = lee(p)
    antes = s
    n_unid = 0

    # 1. Unidades en minúscula dentro de rótulos en mayúsculas
    for patron in EN_MAYUSCULAS:
        def cambia(m):
            global n_unid_local
            bloque = m.group(0)
            if "sin-mayus" in bloque:
                return bloque
            nuevo = solo_texto(bloque, protege_unidades)
            return nuevo
        s2 = re.sub(patron, cambia, s, flags=re.S)
        n_unid += s2.count("sin-mayus") - s.count("sin-mayus")
        s = s2

    # 2. Cifra y unidad pegadas con un espacio fino duro dentro de las magnitudes
    def magnitud(m):
        dentro = m.group(2)
        nuevo = re.sub(r"^([~≈<>+\-−]?[\d.,]+)\s+(\S{1,6})$", r"\1" + FINO + r"\2", dentro)
        return m.group(1) + nuevo + m.group(3)
    s = re.sub(r'(<span class="magnitud">)([^<]{1,24})(</span>)', magnitud, s)

    # 3. Créditos del pie: el separador no abre línea y «UTP» no se queda sola
    def creditos(m):
        bloque = m.group(0)
        bloque = re.sub(r" · ", NBSP + "· ", bloque)
        bloque = bloque.replace("con la UTP", "con la" + NBSP + "UTP")
        bloque = bloque.replace("Grupo 1SF134", "Grupo" + NBSP + "1SF134")
        bloque = bloque.replace("N.º 1", "N.º" + NBSP + "1")
        return bloque
    s = re.sub(r'<div class="pie__creditos">.*?</div>', creditos, s, flags=re.S)

    if s != antes:
        escribe(p, s)
    cuentas[p] = n_unid
print("unidades protegidas:", cuentas)

# 4. Laboratorio: la tarjeta del capítulo anterior
p = "html/laboratorio.html"
s = lee(p)
s = s.replace('<a class="pieza" href="hardware.html">\r\n          <p class="folio">Capítulo II · Anterior</p>',
              '<a class="pieza pieza--anterior" href="hardware.html">\r\n          <p class="folio">Capítulo II · Anterior</p>')
s = s.replace('<a class="pieza" href="hardware.html">\n          <p class="folio">Capítulo II · Anterior</p>',
              '<a class="pieza pieza--anterior" href="hardware.html">\n          <p class="folio">Capítulo II · Anterior</p>')
assert "pieza--anterior" in s
escribe(p, s)
print("laboratorio: flecha hacia atras en el anterior")

# 5. Fundamentos: la separata no repite el rótulo de la sección 7
p = "html/fundamentos.html"
s = lee(p)
i = s.index('class="separata"')
j = s.index("</section>", i)
sec = s[i:j].replace('<p class="rotulo">Separata · El antagonista</p>', '<p class="rotulo">Separata</p>')
s = s[:i] + sec + s[j:]
escribe(p, s)
print("fundamentos: rotulo de la separata")

# 6. Acerca de: la nota del sonido ya no describe una posición concreta
p = "html/acerca-de.html"
s = lee(p)
m = re.search(r"[^.]*esquina inferior[^.]*\.", s)
print("frase con la esquina:", m.group(0).strip()[:160] if m else "NO ENCONTRADA")
