#!/usr/bin/env python3
"""
extraer-planilla.py — convierte la planilla del estudio en src/data.json.

    pip install openpyxl
    python3 apps/estudio-mercado/src/extraer-planilla.py KIMOS_Estudio_Mercado_Pricing.xlsx

Lee las 12 hojas del libro, se queda con los datos (no con las fórmulas: esas
están reimplementadas en src/app.js) y restaura las tildes, porque la planilla
original se escribió sin acentos. Escribe data.json junto a este archivo.
"""
import json, re, sys
from pathlib import Path

import openpyxl

AQUI = Path(__file__).resolve().parent
libro = Path(sys.argv[1] if len(sys.argv) > 1 else AQUI / 'KIMOS_Estudio_Mercado_Pricing.xlsx')
if not libro.exists():
    sys.exit(f'No encuentro la planilla: {libro}')

# openpyxl exige extensión .xlsx aunque el archivo venga nombrado .XLS.
wb = openpyxl.load_workbook(libro if libro.suffix.lower() == '.xlsx' else str(libro), data_only=False)
d = {}
for hoja in wb.worksheets:
    filas = []
    for fila in hoja.iter_rows(values_only=True):
        vals = ['' if v is None else v for v in fila]
        while vals and vals[-1] == '':
            vals.pop()
        filas.append([str(v) if not isinstance(v, (int, float)) else v for v in vals])
    d[hoja.title] = filas


def cell(rows, r, c):
    row = rows[r] if r < len(rows) else []
    return row[c] if c < len(row) else ''

# ---------- competidores ----------
det = d['Detalle Competencia']
comps = []
for i, r in enumerate(det[4:]):
    if not r or len(r) < 5 or not str(r[0]).strip() or str(r[0]).startswith('Los planes'):
        continue
    comps.append({
        'row': i,                      # indice original (row = 5+i en la planilla)
        'app': r[0], 'comp': r[1], 'plan': r[2],
        'precio': float(r[3]),
        'unidad': r[4],
        'seg': r[7] if len(r) > 7 else '',
        'nota': r[8] if len(r) > 8 else '',
        'fuente': r[9] if len(r) > 9 else '',
        'conf': r[10] if len(r) > 10 else '',
    })

# ---------- modulos ----------
mapa = d['Mapa Competitivo']
d6 = d['D6 Decisiones Cruzadas']
ventaja = {}
for r in d6[15:]:
    if r and len(r) > 3 and str(r[0]).strip() and str(r[0]) != 'Modulo':
        try: ventaja[r[0]] = float(r[3])
        except Exception: pass

mods = []
for r in mapa[4:]:
    if not r or len(r) < 6 or not str(r[1]).strip():
        continue
    mods.append({
        'n': int(r[0]), 'app': r[1], 'que': r[2], 'cat': r[3],
        'alt': r[4], 'target': r[5],
        'pro': r[12] if len(r) > 12 else '',
        'contra': r[13] if len(r) > 13 else '',
        'estrategia': r[14] if len(r) > 14 else '',
        'conf': r[15] if len(r) > 15 else '',
        'ventaja': ventaja.get(r[1], 5),
    })

# validar que cada modulo tenga competidores
apps_det = {c['app'] for c in comps}
for m in mods:
    assert m['app'] in apps_det, m['app']

# ---------- planes y kits ----------
IDX = {m['app']: m['n'] for m in mods}
def ids(*names): return [IDX[n] for n in names]

CORE = ('Escritorio Kimos','Archivos','Notas de Equipo','Equipos','Conocimiento','Integraciones')
planes = [
 {'id':'core','nombre':'Core','para':'Empresas que entran a probar la suite',
  'incluye':'Plataforma base: escritorio con agentes, archivos, notas, equipos, conocimiento e integraciones',
  'mods': ids(*CORE), 'desc':0.55},
 {'id':'starter','nombre':'Starter','para':'PyMEs de 5 a 20 personas sin procesos formales',
  'incluye':'Core + gestion de tareas + captura de leads',
  'mods': ids(*CORE,'Kanban','Formularios de Contacto'), 'desc':0.55},
 {'id':'business','nombre':'Business','para':'Empresas de 20 a 100 personas con equipo comercial',
  'incluye':'Core + proyectos + CRM + marketing + dashboards + agentes IA',
  'mods': ids(*CORE,'Kanban','Formularios de Contacto','Planificacion (Gantt)','Prospeccion Comercial',
              'Social Planner','Kreative Studio','HTML Panel / Dashboards','Agentes'), 'desc':0.60},
 {'id':'enterprise','nombre':'Enterprise','para':'Empresas de 100+ personas o con procesos regulados',
  'incluye':'Todos los modulos, incluidos BPM, PIM, Tienda, Cashflow, ProductLab, Eventos y Agentes Web',
  'mods': [m['n'] for m in mods], 'desc':0.62},
]
kits = [
 {'id':'comercial','nombre':'Kit Comercial','para':'Equipos de ventas y marketing',
  'incluye':'Captar, atender y cerrar: CRM + formularios + chatbot + redes + diseno',
  'mods': ids('Prospeccion Comercial','Formularios de Contacto','Agentes Web','Social Planner','Kreative Studio'),'desc':0.45},
 {'id':'operaciones','nombre':'Kit Operaciones','para':'PMOs, operaciones y consultoras',
  'incluye':'Ejecutar y controlar: tareas + Gantt + procesos + paneles',
  'mods': ids('Kanban','Planificacion (Gantt)','FossFLOW (BPM)','HTML Panel / Dashboards','Notas de Equipo'),'desc':0.45},
 {'id':'retail','nombre':'Kit Retail','para':'Retail, distribucion y marcas',
  'incluye':'Vender en linea: catalogo maestro + tienda + vitrina + bot + diseno',
  'mods': ids('Productos (PIM)','Tienda (e-commerce)','Vitrina (catalogo digital)','Agentes Web','Kreative Studio'),'desc':0.45},
 {'id':'ia','nombre':'Kit IA','para':'Equipos tecnicos y de innovacion',
  'incluye':'Automatizar con IA: escritorio + agentes + pipelines de datos + bot + base de conocimiento',
  'mods': ids('Escritorio Kimos','Agentes','Digitai (automatizacion IA)','Agentes Web','Conocimiento'),'desc':0.45},
 {'id':'finanzas','nombre':'Kit Finanzas y Gestion','para':'Gerencia financiera',
  'incluye':'Controlar la plata: flujo de caja + paneles + planificacion + documentos',
  'mods': ids('KIMOS Cashflow','HTML Panel / Dashboards','Planificacion (Gantt)','Archivos'),'desc':0.45},
]

# ---------- stack actual ----------
mod_sub = d['Modelo de Suscripcion']
stack = []
for r in mod_sub:
    if len(r) >= 4 and isinstance(r[3], str) and r[3].startswith("='Detalle Competencia'!G"):
        n = int(re.search(r'G(\d+)', r[3]).group(1))
        stack.append({'necesidad': r[0], 'herramienta': r[1], 'plan': r[2], 'comp': n - 5})

# ---------- demanda ----------
dem = {}
sup = d['D1 Supuestos Demanda']
KEYS = {'Mercado SaaS global 2026': 'saasGlobal', 'Gasto en suites de gestion': 'gastoSuites',
        'Participacion PyME y mid-market': 'pymeShare', 'Segmento 10-250 empleados': 'segmento',
        'Churn mensual': 'churn', 'Margen bruto': 'margen', 'CAC promedio': 'cac',
        'Clientes captados al ano 3': 'clientes3'}
demand_params = {}
for r in sup[3:]:
    if len(r) >= 2 and str(r[0]) in KEYS:
        demand_params[KEYS[str(r[0])]] = {'label': r[0], 'valor': float(r[1]),
            'unidad': r[2] if len(r) > 2 else '', 'nota': r[3] if len(r) > 3 else ''}

reg = []
for r in d['D2 Mercado por Region'][4:]:
    if not r or not str(r[0]).strip() or str(r[0]).startswith('TOTAL'): continue
    reg.append({'region': r[0], 'saas': float(r[1]), 'share': float(r[2]), 'cagr': float(r[3]),
                'cobertura': float(r[5]), 'indice': float(r[7]),
                'lectura': r[8], 'fuente': r[9], 'conf': r[10]})

pais = []
for r in d['D2b Mercados por Pais'][4:]:
    if not r or not str(r[0]).strip() or str(r[0]).startswith('TOTAL') or str(r[0]).startswith('El SAM'): continue
    pub = r[7]
    try: pub = float(pub)
    except Exception: pub = None
    emp = r[12]
    try: emp = float(emp)
    except Exception: emp = None
    pais.append({'pais': r[0], 'region': r[1], 'idioma': r[2], 'prioridad': r[3],
                 'cobertura': float(r[4]), 'peso': float(r[5]), 'publicado': pub,
                 'indice': float(r[11]), 'empresas': emp, 'contexto': r[13], 'conf': r[14]})

d3 = d['D3 Unit Economics']
mixPlan = [{'plan': r[0], 'peso': float(r[1])} for r in d3[5:8] if r and str(r[0]).strip()]
mixReg = [{'region': r[0], 'peso': float(r[1])} for r in d3[12:17] if r and str(r[0]).strip()]

# ---------- evidencia ----------
ev = d['D5 Evidencia de Demanda']
evidencia, grupo = [], None
for r in ev[2:]:
    if not r or not str(r[0]).strip(): continue
    if len(r) <= 2:
        grupo = {'titulo': r[0], 'cols': [], 'filas': []}; evidencia.append(grupo); continue
    if grupo is None: continue
    if not grupo['cols']: grupo['cols'] = [str(x) for x in r]
    else: grupo['filas'].append([('' if x is None else str(x)) for x in r])

# ---------- ICP ----------
icp, seg = [], []
rows = d['D4 ICP y Segmentos']
for r in rows[4:10]:
    if r and str(r[0]).strip():
        icp.append({'perfil': r[0], 'rol': r[1], 'tamano': r[2], 'producto': r[3],
                    'dolor': r[4], 'gatillo': r[5], 'objecion': r[6], 'venta': r[7]})
for r in rows[14:]:
    if r and str(r[0]).strip() and r[0] != 'Segmento':
        seg.append({'segmento': r[0], 'empleados': r[1], 'veredicto': r[2], 'plan': r[3],
                    'porque': r[4], 'riesgo': r[5]})

# ---------- decisiones ----------
dec = []
for r in d6[2:]:
    if not r or len(r) < 6 or not str(r[0]).strip(): continue
    if str(r[0]).startswith('Modulo') or str(r[0]) == '#': continue
    try: n = int(r[0])
    except Exception: continue
    dec.append({'n': n, 'decision': r[1], 'oferta': r[2], 'demanda': r[3], 'hacer': r[4], 'impacto': r[5]})

# ---------- notas metodologicas ----------
notas = [r[0] for r in d['Como usar y Fuentes'] if r and isinstance(r[0], str) and re.match(r'^\d\.', r[0].strip())]

out = {
  'meta': {'fecha': '2026-08-16', 'moneda': 'USD',
           'fuente': 'KIMOS - Estudio de mercado y modelo de precios (planilla + dashboard, ago-2026)'},
  'supuestos': {'usuarios': 10, 'canales': 5, 'factor': 0.55, 'descAnual': 0.20},
  'modulos': mods, 'competidores': comps, 'planes': planes, 'kits': kits, 'stack': stack,
  'demanda': {'params': demand_params, 'regiones': reg, 'paises': pais,
              'mixPlan': mixPlan, 'mixRegion': mixReg},
  'evidencia': evidencia, 'icp': icp, 'segmentos': seg, 'decisiones': dec, 'notas': notas,
}
print('modulos', len(mods), '| competidores', len(comps), '| stack', len(stack),
      '| paises', len(pais), '| evidencia grupos', len(evidencia),
      '| icp', len(icp), '| seg', len(seg), '| decisiones', len(dec), '| notas', len(notas))
print({g['titulo']: len(g['filas']) for g in evidencia})

# ---------- restauracion de tildes (la planilla origen viene sin acentos) ----------
import unicodedata
WORDS = {
 'alli':'allí','altisima':'altísima','altisimo':'altísimo','Ambito':'Ámbito','apreton':'apretón','atras':'atrás','auditoria':'auditoría','automaticamente':'automáticamente','autonomo':'autónomo','bajisimo':'bajísimo','busqueda':'búsqueda','campana':'campaña','campanas':'campañas','catalogos':'catálogos','cayo':'cayó','Centroamerica':'Centroamérica','cercania':'cercanía','comite':'comité','Conexion':'Conexión','consultoria':'consultoría','criticos':'críticos','decada':'década','demas':'demás','dueno':'dueño','empezo':'empezó','episodico':'episódico','estandar':'estándar','estrategico':'estratégico','fragiles':'frágiles','grafico':'gráfico','jamas':'jamás','lider':'líder','lideres':'líderes','Lideres':'Líderes','limite':'límite','linea':'línea','Linea':'Línea','ludicas':'lúdicas','mayoria':'mayoría','Metrica':'Métrica','modulo':'módulo','Modulo':'Módulo','modulos':'módulos','Modulos':'Módulos','Neerlandes':'Neerlandés','ningun':'ningún','opinion':'opinión','pais':'país','paises':'países','panico':'pánico','perdida':'pérdida','pestana':'pestaña','pestanas':'pestañas','Pequeno':'Pequeño','Portugues':'Portugués','region':'región','Region':'Región','reunion':'reunión','reves':'revés','sera':'será','solido':'sólido','Subio':'Subió','subio':'subió','tecnologica':'tecnológica','tecnologicos':'tecnológicos','terminos':'términos','tipico':'típico','Sudeste':'Sudeste','asiatico':'asiático','adquisitivo':'adquisitivo',
  'indice':'índice','Indice':'Índice','categoria':'categoría','Categoria':'Categoría','dias':'días',
 'ano':'año','anos':'años','Ano':'Año','tamano':'tamaño','Tamano':'Tamaño','tamanos':'tamaños',
 'pequena':'pequeña','Pequena':'Pequeña','pequenas':'pequeñas','Pequenas':'Pequeñas',
 'Espana':'España','Espanol':'Español','espanol':'español','compania':'compañía','companias':'compañías',
 'ingles':'inglés','Ingles':'Inglés','frances':'francés','Frances':'Francés','japones':'japonés',
 'Japones':'Japonés','aleman':'alemán','Aleman':'Alemán','arabe':'árabe','Arabe':'Árabe',
 'credito':'crédito','creditos':'créditos','dificil':'difícil','facil':'fácil','util':'útil',
 'rapido':'rápido','tecnico':'técnico','tecnicos':'técnicos','tecnica':'técnica','economico':'económico',
 'economicas':'económicas','unico':'único','unica':'única','ultimo':'último','numero':'número',
 'minimo':'mínimo','Minimo':'Mínimo','maximo':'máximo','segun':'según','Segun':'Según',
 'tambien':'también','Tambien':'También','ademas':'además','Ademas':'Además','aqui':'aquí','Aqui':'Aquí',
 'asi':'así','Asi':'Así','proximo':'próximo','logico':'lógico','senal':'señal','manana':'mañana',
 'estan':'están','mas':'más','Mas':'Más','Norteamerica':'Norteamérica','America':'América',
 'Asia-Pacifico':'Asia-Pacífico','Mexico':'México','Peru':'Perú','Japon':'Japón','Paises':'Países',
 'Sudafrica':'Sudáfrica','Arabes':'Árabes','Nordicos':'Nórdicos','nordicos':'nórdicos',
 'Latinoamerica':'Latinoamérica','latinoamericano':'latinoamericano','escepitico':'escéptico',
 'Pacifico':'Pacífico','Africa':'África','africa':'África','Canada':'Canadá','catalogo':'catálogo','Catalogo':'Catálogo','logistica':'logística','analisis':'análisis','Analisis':'Análisis','automatico':'automático','automatica':'automática','autoservicio':'autoservicio','deficit':'déficit','metricas':'métricas','historico':'histórico','trafico':'tráfico','practica':'práctica','publico':'público','publica':'pública','publicos':'públicos','basico':'básico','multiples':'múltiples','ultima':'última','ultimas':'últimas','ultimos':'últimos','unicos':'únicos','area':'área','optimo':'óptimo','sintesis':'síntesis','veredicto':'veredicto','planilla':'planilla','vitrina':'vitrina','Vitrina':'Vitrina','Gestion':'Gestión','gestion':'gestión',
 'Administracion':'Administración','administracion':'administración','Diseno':'Diseño','diseno':'diseño',
}
CION = re.compile(r'\b([A-Za-zñáéíóúÁÉÍÓÚ]+?)(ci|si)on\b')
WORD = re.compile(r'\b[A-Za-zñ]+\b')

URLISH = re.compile(r'/|[\w-]+\.(com|io|ai|org|net|cl|mx|ar|es|dev|co|st|im|ee|eu)\b')

def tildar_tok(t):
    if URLISH.search(t):
        return t                      # no tocar dominios ni rutas de fuente
    t = CION.sub(lambda m: m.group(1) + m.group(2) + 'ón', t)
    return WORD.sub(lambda m: WORDS.get(m.group(0), m.group(0)), t)

# 'esta' es ambiguo (demostrativo vs verbo): se corrige por frase, no por palabra.
FRASES = [
    ('se calculo ', 'se calculó '),
    ('esta dejando', 'está dejando'),
    ('esta regalando', 'está regalando'),
    ('LATAM esta 40-60%', 'LATAM está 40-60%'),
    ('no esta en el precio: esta en los', 'no está en el precio: está en los'),
    ('que perdio el control', 'que perdió el control'),
    ('nadie sabe cuanto suman', 'nadie sabe cuánto suman'),
    ('le costo un cliente', 'le costó un cliente'),
    ('saber que paso con cada', 'saber qué pasó con cada'),
    ('que rompio la planilla', 'que rompió la planilla'),
    ('No pidiendole que migre', 'No pidiéndole que migre'),
    ('planilla que solo el entiende', 'planilla que solo él entiende'),
    ('se cayó y paro la operación', 'se cayó y paró la operación'),
    ('Define cuanto tráfico', 'Define cuánto tráfico'),
]

def tildar(s):
    for a, b in FRASES:
        s = s.replace(a, b)
    return ' '.join(tildar_tok(t) for t in s.split(' '))

def walk(o, key=None):
    if isinstance(o, str):
        return o if key in ('fuente',) else tildar(o)
    if isinstance(o, list): return [walk(x, key) for x in o]
    if isinstance(o, dict): return {k: walk(v, k) for k, v in o.items()}
    return o

out = walk(out)
json.dump(out, open(AQUI / 'data.json', 'w'), ensure_ascii=False, indent=0)
print('data.json escrito con tildes restauradas')
