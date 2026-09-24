# Convierte en <article> los bloques que la rúbrica espera como artículos.
import io, os

RAIZ = r"C:\Claude Ideas\Brito-Gaitan"

# --- index: las seis tarjetas del índice son artículos ---
p = os.path.join(RAIZ, "index.html")
s = io.open(p, encoding="utf-8").read()
antes = s.count("<article")
s = s.replace('<div class="mitad imprime">\n        <a class="pieza"',
              '<article class="mitad imprime">\n        <a class="pieza"')
s = s.replace('        </a>\n      </div>', '        </a>\n      </article>')
io.open(p, "w", encoding="utf-8").write(s)
print("index.html:", s.count("<article"), "article (antes", antes, ")")

# --- laboratorio: las dos tarjetas del final también ---
p = os.path.join(RAIZ, "html", "laboratorio.html")
s = io.open(p, encoding="utf-8").read()
antes = s.count("<article")
s = s.replace('<div class="mitad imprime">\n        <a class="pieza"',
              '<article class="mitad imprime">\n        <a class="pieza"')
s = s.replace('        </a>\n      </div>', '        </a>\n      </article>')
io.open(p, "w", encoding="utf-8").write(s)
print("laboratorio.html:", s.count("<article"), "article (antes", antes, ")")

# --- contacto: el formulario y el lector del archivo son artículos ---
p = os.path.join(RAIZ, "html", "contacto.html")
s = io.open(p, encoding="utf-8").read()
antes = s.count("<article")
s = s.replace('''      <div class="columna">
        <form class="formulario" id="formulario-contacto"''',
'''      <article class="columna">
        <form class="formulario" id="formulario-contacto"''')
s = s.replace('''            <button class="mando" type="button" data-accion="descargar" data-fantasma="Descargar archivo">Descargar archivo</button>
          </div>
        </div>
      </div>''',
'''            <button class="mando" type="button" data-accion="descargar" data-fantasma="Descargar archivo">Descargar archivo</button>
          </div>
        </div>
      </article>''')
s = s.replace('''      <div class="columna">
        <p class="rotulo">El archivo de datos</p>''',
'''      <article class="columna">
        <p class="rotulo">El archivo de datos</p>''')
s = s.replace('''<pre class="caja caja--vitela" data-salida="archivo" style="margin-top:1.2rem;white-space:pre-wrap;font-family:var(--mono);font-size:.82rem;max-height:22rem;overflow:auto">Pulse «Leer el archivo» para ver su contenido.</pre>
      </div>''',
'''<pre class="caja caja--vitela" data-salida="archivo" style="margin-top:1.2rem;white-space:pre-wrap;font-family:var(--mono);font-size:.82rem;max-height:22rem;overflow:auto">Pulse «Leer el archivo» para ver su contenido.</pre>
      </article>''')
io.open(p, "w", encoding="utf-8").write(s)
print("contacto.html:", s.count("<article"), "article (antes", antes, ")")
