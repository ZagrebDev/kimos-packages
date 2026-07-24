/**
 * Dashboard Comercial — FIGIT + KIMOS · App instalable de Kimos.
 *
 * Conversión del dashboard HTML de prospección comercial al modelo plugin de
 * Kimos (AppShell v1). Bundle ESM autocontenido: usa globalThis.React (lo
 * expone el shell) y renderiza con React.createElement (sin JSX / sin build).
 *
 * - Datos maestros (59 prospectos, rubros, colores) embebidos en SEED.
 * - Estado del usuario (estados, resultados, responsables, notas, bitácora y
 *   equipo) se persiste en el NAVEGADOR con localStorage. App singleton
 *   (multiInstance: false): sin instancias por equipo. Export/Import para
 *   mover el estado entre navegadores.
 * - Gráficos en SVG/HTML puro (sin Chart.js ni red en runtime).
 *
 * Contrato: export default function mount(shell): { Component }
 */

const SEED = {"prospectos":[{"id":1,"rubro":"RETAIL","empresa":"Cencosud (Jumbo, Paris, Santa Isabel, Easy)","descripcion":"Mayor conglomerado de retail de Chile: supermercados, tiendas por departamento, mejoramiento del hogar y centros comerciales en 6 paises.","persona":"Rodrigo Larrain Kaplan (CEO) - punto de entrada","cargo":"Gerente de Operaciones / Gerente de Experiencia de Cliente","telefono":"+56 2 2959 0000","correo":"nombre.apellido@cencosud.cl","linkedin_q":"Gerente Operaciones Cencosud","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Cencosud","problematica":"Filas en cajas y mesones de atencion, falta de personal en piso de sala, baja captura de datos del cliente presencial y experiencia desigual entre locales.","propuesta":"FIGIT como vendedor IA 24/7 en sala (autoservicio, consulta de stock y precios). Directorio y wayfinding en malls. KIMOS unifica datos de cada interaccion y gobierna la IA a nivel corporativo.","notas":"Nombre CEO verificado (prensa 2026). Confirmar gerente operativo via LinkedIn."},{"id":2,"rubro":"RETAIL","empresa":"Cenco Malls (Costanera Center, Florida Center, etc.)","descripcion":"Marca que agrupa los centros comerciales de Cencosud en Chile, Peru y Colombia; foco en experiencia del visitante.","persona":"Sebastian Bellocchio Fioretti (GM)","cargo":"Gerente de Operaciones de Malls / Gerente de Experiencia","telefono":"+56 2 2959 0000","correo":"nombre.apellido@cencosud.cl","linkedin_q":"Gerente Operaciones Cenco Malls","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Cenco%20Malls","problematica":"Visitantes desorientados en superficies enormes, informacion de locales/eventos desactualizada y nula medicion de la experiencia en sitio.","propuesta":"Totem de wayfinding y directorio interactivo en accesos, cartelera de eventos y promociones, encuestas de satisfaccion en el momento. KIMOS centraliza analitica de flujo y consultas.","notas":"Nombre GM verificado (prensa 2026)."},{"id":3,"rubro":"RETAIL","empresa":"Falabella Retail","descripcion":"Cadena lider de tiendas por departamento en Latam, eje del ecosistema omnicanal del Grupo Falabella.","persona":"Francisco Irarrazaval (GM Falabella Retail)","cargo":"Gerente de Experiencia de Cliente / Gerente Omnicanal","telefono":"+56 2 2380 2000","correo":"nombre.apellido@falabella.cl","linkedin_q":"Gerente Experiencia Cliente Falabella","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Cliente%20Falabella","problematica":"Quiebres de atencion en piso, catalogo fisico limitado vs. el online y friccion entre canal digital y tienda fisica.","propuesta":"FIGIT como vendedor IA con catalogo infinito (endless aisle) que conecta tienda y e-commerce. KIMOS orquesta la IA con gobierno del dato y consistencia de marca.","notas":"Nombre GM verificado (prensa 2025-2026)."},{"id":4,"rubro":"RETAIL","empresa":"Sodimac Chile","descripcion":"Lider en mejoramiento del hogar y construccion; alto volumen de consultas tecnicas de producto en sala.","persona":"Sebastian Simonetti (GM Sodimac Chile)","cargo":"Gerente de Operaciones / Gerente de Experiencia de Cliente","telefono":"+56 2 2738 1000","correo":"nombre.apellido@sodimac.cl","linkedin_q":"Gerente Operaciones Sodimac","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Sodimac","problematica":"Clientes que no encuentran productos en tiendas grandes, asesoria tecnica saturada y largas filas en retiro/despacho.","propuesta":"Totem de busqueda de productos con ubicacion en pasillo, asesor IA de proyectos y gestion de turnos de retiro. KIMOS aprende del catalogo y la operacion.","notas":"Nombre GM verificado (asume ene-2026)."},{"id":5,"rubro":"RETAIL","empresa":"Mallplaza","descripcion":"Operador regional de centros comerciales (filial de Falabella) con fuerte foco en experiencia y nuevos formatos.","persona":"Pablo Pulido (GM Mallplaza)","cargo":"Gerente de Operaciones / Gerente de Experiencia","telefono":"+56 2 2785 2000","correo":"nombre.apellido@mallplaza.cl","linkedin_q":"Gerente Operaciones Mallplaza","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Mallplaza","problematica":"Orientacion del visitante, informacion de servicios dispersa y poca data del comportamiento presencial.","propuesta":"Wayfinding inteligente, directorio y concierge IA del mall, captura de encuestas y leads. KIMOS entrega analitica de afluencia y consultas.","notas":"Nombre GM verificado (asume ene-2026)."},{"id":6,"rubro":"RETAIL","empresa":"Parque Arauco","descripcion":"Uno de los mayores operadores de centros comerciales de la region, en expansion activa.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Innovacion","telefono":"+56 2 2299 0000","correo":"nombre.apellido@parauco.com","linkedin_q":"Gerente Operaciones Parque Arauco","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Parque%20Arauco","problematica":"Experiencia del visitante poco diferenciada, navegacion en mall complejo y medicion limitada de satisfaccion.","propuesta":"Totems de bienvenida, wayfinding y promociones; modulo de fidelizacion y encuestas. KIMOS como capa de IA y datos.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":7,"rubro":"RETAIL","empresa":"Ripley","descripcion":"Multitienda con banco propio; busca diferenciarse por experiencia y omnicanalidad.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Experiencia de Cliente","telefono":"+56 2 2694 1000","correo":"nombre.apellido@ripley.cl","linkedin_q":"Gerente Experiencia Cliente Ripley","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Cliente%20Ripley","problematica":"Atencion en piso limitada, consultas de credito/CMR que generan filas y poca captura de datos presenciales.","propuesta":"FIGIT de autoservicio y consulta de productos/credito, asesor IA y derivacion inteligente. KIMOS unifica la data del cliente.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":8,"rubro":"RETAIL","empresa":"SMU (Unimarc, Mayorista 10, Alvi)","descripcion":"Tercer actor supermercadista de Chile con foco en proximidad y conveniencia.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Experiencia de Cliente","telefono":"+56 2 2898 7000","correo":"nombre.apellido@smu.cl","linkedin_q":"Gerente Operaciones SMU","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20SMU","problematica":"Falta de personal en horas peak, filas y consultas de ofertas/precios sin atencion.","propuesta":"Totems de autoconsulta de precios y ofertas, balanza/etiquetado asistido y encuestas. KIMOS analiza consultas y quiebres.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":9,"rubro":"RETAIL","empresa":"Walmart Chile (Lider, Express, aCuenta)","descripcion":"Cadena de supermercados de alcance nacional; matriz Walmart, fuerte en precio y volumen.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Experiencia de Cliente","telefono":"+56 2 2200 5000","correo":"nombre.apellido@walmart.com","linkedin_q":"Gerente Experiencia Cliente Walmart Chile","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Cliente%20Walmart%20Chile","problematica":"Friccion en autoatencion, filas y baja resolucion de consultas en sala.","propuesta":"FIGIT de autoservicio, localizador de productos y soporte IA en piso; encuestas en caja. KIMOS gobierna la IA y la analitica.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":10,"rubro":"SALUD","empresa":"Clinica Alemana de Santiago","descripcion":"Centro privado de salud de alta complejidad y prestigio; alto volumen ambulatorio y de urgencias.","persona":"(Identificar via LinkedIn)","cargo":"Gerente General / Director de Operaciones Medicas","telefono":"+56 2 2210 1111","correo":"nombre.apellido@alemana.cl","linkedin_q":"Gerente Operaciones Clinica Alemana","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Clinica%20Alemana","problematica":"Filas en admision y toma de muestras, carga administrativa sobre personal clinico y datos sensibles de pacientes.","propuesta":"FIGIT para check-in y admision de pacientes, gestion de turnos y triage administrativo. KIMOS procesa localmente y protege datos sensibles.","notas":"Confirmar tomador de decision via LinkedIn. Evitar IT."},{"id":11,"rubro":"SALUD","empresa":"Red de Salud UC CHRISTUS","descripcion":"Red de salud universitaria (hospital clinico, centros medicos y red ambulatoria) ligada a la PUC.","persona":"(Identificar via LinkedIn)","cargo":"Director de Innovacion / Gerente de Operaciones Clinicas","telefono":"+56 2 2354 3000","correo":"nombre.apellido@ucchristus.cl","linkedin_q":"Director Innovacion UC Christus","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Director%20Innovacion%20UC%20Christus","problematica":"Coordinacion de turnos y citas, filas en multiples sedes y proteccion de informacion clinica.","propuesta":"FIGIT gestiona check-in, turnos y triage; procesamiento local de datos sensibles. KIMOS orquesta agentes de IA sobre el conocimiento institucional.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":12,"rubro":"SALUD","empresa":"Clinica Las Condes","descripcion":"Clinica privada de alta complejidad; nueva administracion enfocada en eficiencia y experiencia del paciente.","persona":"Pablo Yarmuch Fierro (GM) / Emilio Santelices (Dir. Medico)","cargo":"Gerente de Operaciones / Gerente de Experiencia del Paciente","telefono":"+56 2 2610 4000","correo":"nombre.apellido@clinicalascondes.cl","linkedin_q":"Gerente Operaciones Clinica Las Condes","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Clinica%20Las%20Condes","problematica":"Reestructuracion en curso, presion por eficiencia operacional, filas en admision y experiencia del paciente.","propuesta":"FIGIT para admision/check-in autonomo, orientacion intra-recinto (wayfinding) y encuestas de experiencia. KIMOS reduce carga administrativa y entrega analitica.","notas":"GM y Dir. Medico verificados (prensa 2025)."},{"id":13,"rubro":"SALUD","empresa":"Clinica Santa Maria (Grupo Banmedica)","descripcion":"Clinica privada de alta complejidad parte de Banmedica (UnitedHealth Group).","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Subgerente de Experiencia del Paciente","telefono":"+56 2 2913 0000","correo":"nombre.apellido@clinicasantamaria.cl","linkedin_q":"Gerente Operaciones Clinica Santa Maria","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Clinica%20Santa%20Maria","problematica":"Filas en admision e imagenes, agendamiento y carga sobre personal de recepcion.","propuesta":"FIGIT de autoadmision, turnos y wayfinding; encuestas de satisfaccion. KIMOS con procesamiento local de datos clinicos.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":14,"rubro":"SALUD","empresa":"RedSalud (CChC)","descripcion":"Mayor red privada de salud por cobertura nacional (clinicas y centros medicos) de la Camara Chilena de la Construccion.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Experiencia","telefono":"+56 2 2632 6000","correo":"nombre.apellido@redsalud.cl","linkedin_q":"Gerente Operaciones RedSalud","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20RedSalud","problematica":"Estandarizar la experiencia entre muchas sedes, filas y alto volumen ambulatorio.","propuesta":"FIGIT replicable en toda la red para check-in, turnos y orientacion. KIMOS centraliza la IA y la data multi-sede.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":15,"rubro":"SALUD","empresa":"Clinica Davila (Grupo Banmedica)","descripcion":"Clinica de alto volumen de atencion en Santiago; foco en eficiencia ambulatoria y de urgencias.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Experiencia del Paciente","telefono":"+56 2 2730 8000","correo":"nombre.apellido@davila.cl","linkedin_q":"Gerente Operaciones Clinica Davila","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Clinica%20Davila","problematica":"Saturacion en urgencias y admision, filas y tiempos de espera elevados.","propuesta":"FIGIT para triage administrativo, check-in y turnos; descomprime recepcion. KIMOS con analitica de flujo y datos protegidos.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":16,"rubro":"EDUCACION","empresa":"Pontificia Universidad Catolica de Chile","descripcion":"Principal universidad privada de Chile; multiples campus, alto flujo de estudiantes y publico.","persona":"(Identificar via LinkedIn)","cargo":"Vicerrector Economico / Gerente de Operaciones de Campus","telefono":"+56 2 2354 4000","correo":"nombre.apellido@uc.cl","linkedin_q":"Vicerrector Economico UC","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Vicerrector%20Economico%20UC","problematica":"Orientacion en campus extensos, tramites presenciales con filas y atencion descentralizada.","propuesta":"FIGIT convierte cualquier espacio en punto interactivo autonomo: wayfinding de campus, info academica y tramites. Opera sin depender de internet permanente. KIMOS como cerebro institucional.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":17,"rubro":"EDUCACION","empresa":"Universidad de Chile","descripcion":"Principal universidad estatal; gran comunidad y multiples facultades y campus.","persona":"(Identificar via LinkedIn)","cargo":"Vicerrectoria de Asuntos Economicos / Director de Servicios","telefono":"+56 2 2978 2000","correo":"nombre.apellido@uchile.cl","linkedin_q":"Director Operaciones Universidad de Chile","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Director%20Operaciones%20Universidad%20de%20Chile","problematica":"Tramites presenciales con filas, orientacion en campus y atencion estudiantil dispersa.","propuesta":"Totems de autoatencion para tramites, directorio y orientacion; info de admision y eventos. KIMOS unifica la atencion.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":18,"rubro":"EDUCACION","empresa":"Universidad Andres Bello (UNAB)","descripcion":"Una de las mayores universidades privadas por matricula; varios campus en el pais.","persona":"(Identificar via LinkedIn)","cargo":"Vicerrector de Operaciones / Gerente de Campus","telefono":"+56 2 2661 8000","correo":"nombre.apellido@unab.cl","linkedin_q":"Gerente Operaciones UNAB","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20UNAB","problematica":"Atencion de admision y matricula con filas estacionales y orientacion en campus.","propuesta":"FIGIT para admision, matricula asistida, wayfinding e info de carreras. KIMOS escala la atencion en peaks.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":19,"rubro":"EDUCACION","empresa":"Duoc UC","descripcion":"Instituto profesional de gran matricula; foco en empleabilidad y experiencia del estudiante.","persona":"(Identificar via LinkedIn)","cargo":"Director de Operaciones / Gerente de Experiencia del Estudiante","telefono":"+56 2 2354 0400","correo":"nombre.apellido@duoc.cl","linkedin_q":"Director Operaciones Duoc UC","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Director%20Operaciones%20Duoc%20UC","problematica":"Alto volumen de consultas de admision, matricula y orientacion entre sedes.","propuesta":"Totems de autoatencion para admision/matricula, info de carreras y orientacion. KIMOS estandariza la experiencia multi-sede.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":20,"rubro":"EDUCACION","empresa":"INACAP","descripcion":"Mayor institucion de educacion superior tecnico-profesional del pais, con presencia nacional.","persona":"(Identificar via LinkedIn)","cargo":"Vicerrector de Operaciones / Gerente de Sedes","telefono":"+56 2 2520 9000","correo":"nombre.apellido@inacap.cl","linkedin_q":"Gerente Operaciones INACAP","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20INACAP","problematica":"Cobertura nacional con experiencia heterogenea y atencion presencial intensiva.","propuesta":"FIGIT replicable en todas las sedes para admision, info y orientacion autonoma. KIMOS centraliza IA y datos.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":21,"rubro":"BANCA Y FINANZAS","empresa":"Banco de Chile","descripcion":"Uno de los mayores bancos del pais (grupo Luksic / Citi); amplia red de sucursales.","persona":"Eduardo Ebensperger Orrego (CEO/GG) - punto de entrada","cargo":"Gerente de Experiencia de Cliente / Gerente de Canales y Sucursales","telefono":"+56 2 2637 1111","correo":"nombre.apellido@bancochile.cl","linkedin_q":"Gerente Experiencia Cliente Banco de Chile","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Cliente%20Banco%20de%20Chile","problematica":"Filas en sucursales, tramites presenciales que saturan ejecutivos y migracion incompleta al autoservicio.","propuesta":"FIGIT de autoatencion bancaria (turnos, consultas, derivacion inteligente) y recepcion IA en sucursal. KIMOS orquesta agentes con gobierno del dato y seguridad.","notas":"Nombre CEO verificado (LinkedIn/prensa 2026)."},{"id":22,"rubro":"BANCA Y FINANZAS","empresa":"Banco Santander Chile","descripcion":"Mayor banco privado del pais; lider en transformacion digital y nuevos formatos de sucursal (Work Cafe).","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Experiencia de Cliente / Gerente de Transformacion","telefono":"+56 2 2320 0000","correo":"nombre.apellido@santander.cl","linkedin_q":"Gerente Experiencia Cliente Santander Chile","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Cliente%20Santander%20Chile","problematica":"Equilibrio entre digitalizacion y atencion presencial, filas y consultas repetitivas en sucursal.","propuesta":"FIGIT como anfitrion IA en Work Cafe y sucursales: turnos, onboarding y consultas frecuentes. KIMOS integra la IA al ecosistema.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":23,"rubro":"BANCA Y FINANZAS","empresa":"Banco BCI","descripcion":"Banco grande (grupo Yarur) con fuerte foco en innovacion y experiencia.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Experiencia de Cliente / Gerente de Operaciones","telefono":"+56 2 2692 7000","correo":"nombre.apellido@bci.cl","linkedin_q":"Gerente Experiencia Cliente BCI","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Cliente%20BCI","problematica":"Atencion presencial con friccion, tiempos de espera y captura limitada de feedback.","propuesta":"FIGIT de autoatencion y recepcion IA, encuestas en sucursal y derivacion. KIMOS como capa de orquestacion.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":24,"rubro":"BANCA Y FINANZAS","empresa":"BancoEstado","descripcion":"Banco estatal con la mayor red de sucursales y CajaVecina; rol de inclusion financiera y alto flujo presencial.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Atencion y Canales","telefono":"+56 2 2670 7000","correo":"nombre.apellido@bancoestado.cl","linkedin_q":"Gerente Operaciones BancoEstado","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20BancoEstado","problematica":"Enormes filas y alta demanda presencial (pagos, beneficios, tramites) en todo el pais.","propuesta":"FIGIT de autoatencion y gestion de turnos masiva; orientacion de tramites y beneficios. KIMOS escala atencion sin aumentar dotacion.","notas":"Confirmar via LinkedIn. Alto impacto por volumen."},{"id":25,"rubro":"TRANSPORTE Y SERVICIOS PUBLICOS","empresa":"Metro de Santiago","descripcion":"Empresa estatal del metro de Santiago; millones de viajes diarios y red en expansion.","persona":"Felipe Bravo (GG) / Patricio Rey Sommer (Presidente)","cargo":"Gerente de Operaciones / Gerente de Experiencia del Usuario","telefono":"+56 2 2937 3000","correo":"nombre.apellido@metro.cl","linkedin_q":"Gerente Operaciones Metro Santiago","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Metro%20Santiago","problematica":"Orientacion de pasajeros, informacion de recorridos/incidencias y atencion en estaciones de alto flujo.","propuesta":"FIGIT de informacion de viajes, wayfinding de estaciones, recarga/consulta y avisos en tiempo real. KIMOS centraliza la informacion y la analitica de consultas.","notas":"GG y Presidente verificados (prensa abr-2026)."},{"id":26,"rubro":"TRANSPORTE Y SERVICIOS PUBLICOS","empresa":"LATAM Airlines Group","descripcion":"Mayor grupo de aerolineas de Sudamerica; gran flujo de pasajeros y espacios aeroportuarios.","persona":"Roberto Alvo (CEO) - punto de entrada","cargo":"VP de Experiencia de Cliente / Gerente de Operaciones Terrestres Chile","telefono":"+56 2 2565 2525","correo":"nombre.apellido@latam.com","linkedin_q":"VP Customer Experience LATAM","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=VP%20Customer%20Experience%20LATAM","problematica":"Filas en check-in y counters, consultas repetitivas de pasajeros y experiencia en salas/espacios.","propuesta":"FIGIT para autoservicio de check-in, informacion de vuelos y wayfinding; control de visitas en espacios corporativos. KIMOS convierte la IA en infraestructura organizacional.","notas":"CEO grupo verificado. Confirmar VP/Gte Chile via LinkedIn."},{"id":27,"rubro":"TRANSPORTE Y SERVICIOS PUBLICOS","empresa":"Nuevo Pudahuel (Aeropuerto SCL)","descripcion":"Concesionaria del Aeropuerto Internacional de Santiago; gestiona la experiencia del pasajero en terminal.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Experiencia del Pasajero","telefono":"+56 2 2690 1796","correo":"nombre.apellido@nuevopudahuel.cl","linkedin_q":"Gerente Operaciones Nuevo Pudahuel","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Nuevo%20Pudahuel","problematica":"Orientacion en terminal, informacion de servicios/locales y atencion multilingue de pasajeros.","propuesta":"FIGIT de wayfinding aeroportuario, directorio de servicios y asistente IA multilingue. KIMOS gestiona consultas y analitica de flujo.","notas":"Confirmar via LinkedIn. Caso ideal de wayfinding."},{"id":28,"rubro":"TRANSPORTE Y SERVICIOS PUBLICOS","empresa":"Servicio de Registro Civil e Identificacion","descripcion":"Servicio publico que emite cedulas, pasaportes y certificados; altisimo flujo presencial en oficinas.","persona":"(Identificar via portal institucional)","cargo":"Subdirector de Operaciones / Jefe de Atencion de Usuarios","telefono":"+56 2 2820 8000","correo":"nombre.apellido@registrocivil.cl","linkedin_q":"Subdirector Operaciones Registro Civil","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Subdirector%20Operaciones%20Registro%20Civil","problematica":"Filas extensas, tramites presenciales repetitivos y demanda concentrada en horarios peak.","propuesta":"FIGIT de autoatencion para tramites, emision de turnos, orientacion y certificados. KIMOS reduce la carga presencial y ordena la demanda.","notas":"Validar via portal institucional. Altisimo impacto y volumen."},{"id":29,"rubro":"GOBIERNO MUNICIPAL","empresa":"Municipalidad de Las Condes","descripcion":"Municipio de alto presupuesto y estandar de servicio; gran volumen de atencion a vecinos y tramites.","persona":"Catalina San Martin Cavada (Alcaldesa) - punto de entrada","cargo":"Administrador Municipal / Director de Atencion al Vecino","telefono":"Ver sitio corporativo","correo":"inicialapellido@lascondes.cl","linkedin_q":"Administrador Municipal Las Condes","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Administrador%20Municipal%20Las%20Condes","problematica":"Filas en atencion al vecino, tramites repetitivos (permisos, patentes, certificados) y demanda en OIRS.","propuesta":"FIGIT de autoatencion municipal: emision de turnos, certificados, permisos y orientacion de tramites 24/7. KIMOS ordena la demanda y entrega analitica de atencion.","notas":"Alcaldesa verificada (sitio municipal). Dirigirse a Administrador Municipal."},{"id":30,"rubro":"GOBIERNO MUNICIPAL","empresa":"Municipalidad de Santiago","descripcion":"Municipio del centro civico de la capital; altisimo flujo de publico, comercio y tramites.","persona":"(Identificar via LinkedIn / portal)","cargo":"Administrador Municipal / Director de Atencion de Publico","telefono":"Ver sitio corporativo","correo":"inicialapellido@munistgo.cl","linkedin_q":"Administrador Municipal Santiago","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Administrador%20Municipal%20Santiago","problematica":"Enorme afluencia de publico, filas en tramites y atencion descentralizada.","propuesta":"FIGIT de autoatencion y turnos para tramites y patentes; orientacion y wayfinding del edificio consistorial. KIMOS centraliza la atencion.","notas":"Confirmar Administrador Municipal via portal."},{"id":31,"rubro":"GOBIERNO MUNICIPAL","empresa":"Municipalidad de Providencia","descripcion":"Municipio densamente poblado y de alto estandar de servicio al vecino.","persona":"(Identificar via LinkedIn / portal)","cargo":"Administrador Municipal / Director de Atencion al Vecino","telefono":"Ver sitio corporativo","correo":"inicialapellido@providencia.cl","linkedin_q":"Administrador Municipal Providencia","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Administrador%20Municipal%20Providencia","problematica":"Filas en atencion, tramites presenciales y necesidad de modernizar la experiencia del vecino.","propuesta":"FIGIT de autoatencion, turnos y certificados; orientacion de servicios municipales. KIMOS reduce carga y mide satisfaccion.","notas":"Confirmar Administrador Municipal via portal."},{"id":32,"rubro":"GOBIERNO MUNICIPAL","empresa":"Municipalidad de Maipu","descripcion":"Una de las comunas mas pobladas del pais; altisima demanda de servicios municipales.","persona":"(Identificar via LinkedIn / portal)","cargo":"Administrador Municipal / Director de Operaciones","telefono":"Ver sitio corporativo","correo":"inicialapellido@maipu.cl","linkedin_q":"Administrador Municipal Maipu","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Administrador%20Municipal%20Maipu","problematica":"Gran volumen de vecinos, filas extensas y tramites repetitivos que saturan la atencion.","propuesta":"FIGIT de autoatencion masiva y turnos para tramites; orientacion y derivacion. KIMOS escala la atencion sin aumentar dotacion.","notas":"Confirmar Administrador Municipal via portal. Alto impacto por poblacion."},{"id":33,"rubro":"TELECOMUNICACIONES","empresa":"Entel","descripcion":"Mayor operador de telecomunicaciones de Chile; amplia red de tiendas y servicio al cliente.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Experiencia de Cliente / Gerente de Retail","telefono":"+56 2 2360 6000","correo":"nombre.apellido@entel.cl","linkedin_q":"Gerente Experiencia Cliente Entel","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Cliente%20Entel","problematica":"Filas en tiendas, consultas tecnicas y de planes que saturan ejecutivos y baja autoatencion.","propuesta":"FIGIT de autoatencion (planes, equipos, soporte nivel 1), turnos y derivacion inteligente. KIMOS resuelve consultas frecuentes con IA.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":34,"rubro":"TELECOMUNICACIONES","empresa":"Movistar Chile (Telefonica)","descripcion":"Operador de telecom de gran escala; tiendas propias y fuerte volumen de atencion.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Experiencia de Cliente / Gerente de Tiendas","telefono":"+56 2 2691 2020","correo":"nombre.apellido@telefonica.com","linkedin_q":"Gerente Experiencia Cliente Movistar Chile","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Cliente%20Movistar%20Chile","problematica":"Tiempos de espera en tienda, consultas repetitivas y experiencia poco diferenciada.","propuesta":"FIGIT de autoatencion y asesor IA en tienda, turnos y encuestas. KIMOS orquesta la IA de atencion.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":35,"rubro":"MINERIA","empresa":"Codelco","descripcion":"Mayor productora de cobre del mundo; estatal, con divisiones y faenas a lo largo del pais.","persona":"Jorge Gomez Diaz (Pdte. Ejecutivo, asume 13-jul-2026) / Bernardo Fontaine (Pdte. Directorio)","cargo":"VP de Operaciones / Gerente de Innovacion / Gerente de Personas","telefono":"Ver sitio corporativo","correo":"nombre.apellido@codelco.cl","linkedin_q":"Gerente Innovacion Codelco","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Innovacion%20Codelco","problematica":"Control de acceso e induccion de seguridad de contratistas y visitas en faenas, sitios remotos sin conectividad estable y rotacion de personal.","propuesta":"FIGIT para control de acceso, induccion de seguridad autonoma y registro de visitas/contratistas; info operativa en faena. KIMOS procesa localmente, ideal donde no hay internet permanente.","notas":"Pdte. Ejecutivo verificado (prensa jun-2026, asume 13-jul). Dirigirse a VP Operaciones/Innovacion."},{"id":36,"rubro":"MINERIA","empresa":"SQM (Sociedad Quimica y Minera)","descripcion":"Lider mundial en litio y nutricion vegetal; operaciones en el Salar de Atacama.","persona":"Ricardo Ramos (Gerente General)","cargo":"Gerente de Operaciones / Gerente de Innovacion","telefono":"Ver sitio corporativo","correo":"nombre.apellido@sqm.com","linkedin_q":"Gerente Operaciones SQM","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20SQM","problematica":"Induccion y control de acceso en faenas remotas, gestion de contratistas y comunicacion con personal en terreno.","propuesta":"FIGIT de acceso, induccion y comunicacion interna autonoma en faena. KIMOS con procesamiento local y analitica operacional.","notas":"GG verificado (prensa 2025-2026)."},{"id":37,"rubro":"MINERIA","empresa":"Antofagasta Minerals (Grupo Luksic)","descripcion":"Grupo minero privado lider (Los Pelambres, Centinela, Antucoya, Zaldivar).","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Innovacion","telefono":"Ver sitio corporativo","correo":"nombre.apellido@aminerals.cl","linkedin_q":"Gerente Innovacion Antofagasta Minerals","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Innovacion%20Antofagasta%20Minerals","problematica":"Control de acceso e induccion de gran dotacion de contratistas y faenas distribuidas.","propuesta":"FIGIT para acceso, induccion de seguridad y registro de contratistas; comunicacion en faena. KIMOS centraliza la IA y la data multi-faena.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":38,"rubro":"MINERIA","empresa":"BHP Chile (Minera Escondida)","descripcion":"Operadora de la mayor mina de cobre del mundo (Escondida) y otras faenas en el norte.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Asuntos Corporativos","telefono":"Ver sitio corporativo","correo":"nombre.apellido@bhp.com","linkedin_q":"Gerente Operaciones BHP Escondida","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20BHP%20Escondida","problematica":"Acceso e induccion de miles de trabajadores y contratistas, faenas remotas y estandares de seguridad exigentes.","propuesta":"FIGIT de control de acceso, induccion autonoma y registro; tablero de info operativa. KIMOS con procesamiento local en sitio.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":39,"rubro":"ENERGIA","empresa":"Enel Chile","descripcion":"Mayor grupo de generacion y distribucion electrica del pais.","persona":"Gianluca Palumbo (Gerente General)","cargo":"Gerente de Clientes y Experiencia (Distribucion) / Gerente de Operaciones","telefono":"Ver sitio corporativo","correo":"nombre.apellido@enel.com","linkedin_q":"Gerente Experiencia Cliente Enel Chile","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Cliente%20Enel%20Chile","problematica":"Oficinas comerciales con filas, atencion de clientes de distribucion y reporte/consulta de fallas.","propuesta":"FIGIT de autoatencion en oficinas comerciales (consultas, pagos, reporte de fallas) y turnos. KIMOS resuelve consultas frecuentes con IA.","notas":"GG verificado (prensa 2025)."},{"id":40,"rubro":"ENERGIA","empresa":"Colbun","descripcion":"Gran generadora electrica chilena (grupo Matte) con matriz hidro-termica y renovable.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Innovacion","telefono":"Ver sitio corporativo","correo":"nombre.apellido@colbun.cl","linkedin_q":"Gerente Operaciones Colbun","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Colbun","problematica":"Control de acceso e induccion en centrales, visitas y contratistas en sitios distribuidos.","propuesta":"FIGIT para acceso, induccion de seguridad y registro de visitas en centrales. KIMOS con procesamiento local.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":41,"rubro":"ENERGIA","empresa":"ENGIE Chile","descripcion":"Generadora y comercializadora de energia con foco en transicion energetica.","persona":"Juan Villavicencio (CEO ENGIE Chile)","cargo":"Gerente de Operaciones / Gerente de Experiencia de Cliente","telefono":"Ver sitio corporativo","correo":"nombre.apellido@engie.cl","linkedin_q":"Gerente Operaciones ENGIE Chile","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20ENGIE%20Chile","problematica":"Atencion a clientes industriales, control de acceso en plantas y comunicacion con contratistas.","propuesta":"FIGIT de recepcion, acceso e induccion en plantas; atencion a clientes. KIMOS centraliza IA y analitica.","notas":"CEO verificado (evento sectorial 2026)."},{"id":42,"rubro":"ENERGIA","empresa":"Copec","descripcion":"Lider en distribucion de combustibles y conveniencia (estaciones de servicio y tiendas Pronto).","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Experiencia de Cliente / Gerente de Retail y Conveniencia","telefono":"Ver sitio corporativo","correo":"nombre.apellido@copec.cl","linkedin_q":"Gerente Experiencia Cliente Copec","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Cliente%20Copec","problematica":"Experiencia heterogenea en estaciones, autoatencion limitada en tiendas de conveniencia y captura de datos del cliente.","propuesta":"FIGIT de autoatencion y promociones en tiendas Pronto, fidelizacion y encuestas. KIMOS unifica la experiencia de la red de estaciones.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":43,"rubro":"MANUFACTURA","empresa":"CCU (Compania Cervecerias Unidas)","descripcion":"Multinacional chilena de bebidas (cervezas, gaseosas, aguas, vinos); plantas y centros de distribucion.","persona":"Eduardo Ffrench-Davis (GG, asume jul-2026)","cargo":"Gerente de Operaciones / Gerente de Experiencia (B2B)","telefono":"+56 2 2427 3000","correo":"nombre.apellido@ccu.cl","linkedin_q":"Gerente Operaciones CCU","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20CCU","problematica":"Recepcion y control de visitas/contratistas en plantas, induccion de seguridad y atencion a distribuidores.","propuesta":"FIGIT de recepcion, control de acceso e induccion autonoma en plantas; punto de info para distribuidores. KIMOS centraliza datos y analitica.","notas":"GG verificado (prensa 2026, asume jul)."},{"id":44,"rubro":"MANUFACTURA","empresa":"Empresas CMPC","descripcion":"Gigante de celulosa, papel y tissue (Softys) con plantas industriales en Chile y la region.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Innovacion","telefono":"Ver sitio corporativo","correo":"nombre.apellido@cmpc.cl","linkedin_q":"Gerente Innovacion CMPC","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Innovacion%20CMPC","problematica":"Control de acceso e induccion de gran dotacion en plantas, visitas y contratistas.","propuesta":"FIGIT para acceso, induccion de seguridad y registro en planta; tablero operativo. KIMOS con procesamiento local y analitica.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":45,"rubro":"MANUFACTURA","empresa":"Agrosuper","descripcion":"Mayor productora de proteinas de Chile (cerdo, pollo, pavo, salmon); plantas y centros de gran dotacion.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Personas","telefono":"Ver sitio corporativo","correo":"nombre.apellido@agrosuper.com","linkedin_q":"Gerente Operaciones Agrosuper","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Agrosuper","problematica":"Control de acceso e induccion de miles de trabajadores y contratistas, estandares sanitarios y de seguridad.","propuesta":"FIGIT de acceso, induccion sanitaria y de seguridad autonoma, registro y comunicacion interna. KIMOS centraliza la IA y la data.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":46,"rubro":"MANUFACTURA","empresa":"Embotelladora Andina (Coca-Cola)","descripcion":"Embotelladora del sistema Coca-Cola para Chile y la region; plantas y centros de distribucion.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Experiencia (B2B)","telefono":"Ver sitio corporativo","correo":"nombre.apellido@koandina.com","linkedin_q":"Gerente Operaciones Embotelladora Andina","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Embotelladora%20Andina","problematica":"Recepcion y control de visitas en plantas, induccion y atencion a clientes/distribuidores.","propuesta":"FIGIT de recepcion, acceso e induccion; punto de info para distribuidores. KIMOS unifica datos y analitica.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":47,"rubro":"AUTOMOTOR","empresa":"Derco (Inchcape)","descripcion":"Mayor distribuidor automotriz multimarca de Chile; venta, repuestos y servicio tecnico.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Experiencia de Cliente / Gerente de Retail","telefono":"Ver sitio corporativo","correo":"nombre.apellido@derco.cl","linkedin_q":"Gerente Experiencia Cliente Derco","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Cliente%20Derco","problematica":"Espera en salas de venta y servicio tecnico, agendamiento de mantencion y poca captura de datos del cliente.","propuesta":"FIGIT de recepcion en sala, agendamiento de servicio, configurador IA de modelos y encuestas. KIMOS unifica la experiencia de la red de concesionarios.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":48,"rubro":"AUTOMOTOR","empresa":"Kaufmann (Mercedes-Benz)","descripcion":"Representante de Mercedes-Benz en Chile (autos, camiones y buses); ventas y postventa.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Experiencia de Cliente","telefono":"Ver sitio corporativo","correo":"nombre.apellido@kaufmann.cl","linkedin_q":"Gerente Experiencia Cliente Kaufmann","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Cliente%20Kaufmann","problematica":"Recepcion en concesionario y servicio tecnico, agendamiento de postventa y experiencia premium esperada.","propuesta":"FIGIT de recepcion premium, agendamiento de servicio y showroom interactivo. KIMOS entrega analitica de la experiencia.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":49,"rubro":"AUTOMOTOR","empresa":"Automotores Gildemeister (Hyundai)","descripcion":"Importador y distribuidor automotriz (Hyundai y otras marcas) con amplia red de servicio.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Experiencia de Cliente / Gerente de Postventa","telefono":"Ver sitio corporativo","correo":"nombre.apellido@gildemeister.cl","linkedin_q":"Gerente Experiencia Cliente Gildemeister","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Cliente%20Gildemeister","problematica":"Espera en postventa, agendamiento y experiencia dispar entre sucursales.","propuesta":"FIGIT de recepcion, agendamiento y autoatencion en postventa; configurador IA. KIMOS estandariza la experiencia de la red.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":50,"rubro":"AUTOMOTOR","empresa":"Salfa (Salinas y Fabres)","descripcion":"Distribuidor automotriz y de maquinaria con fuerte presencia regional y postventa.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Experiencia de Cliente","telefono":"Ver sitio corporativo","correo":"nombre.apellido@salfa.cl","linkedin_q":"Gerente Operaciones Salfa","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Salfa","problematica":"Atencion en sucursales y servicio tecnico, agendamiento y experiencia entre regiones.","propuesta":"FIGIT de recepcion, agendamiento de servicio y autoatencion; info de productos. KIMOS centraliza datos multi-sucursal.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":51,"rubro":"HOTELERIA Y EVENTOS","empresa":"Espacio Riesco (Centro de Convenciones)","descripcion":"Principal centro de convenciones y ferias de Santiago; eventos masivos y corporativos.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente Comercial de Eventos","telefono":"+56 2 2247 6100","correo":"nombre.apellido@espacioriesco.cl","linkedin_q":"Gerente Operaciones Espacio Riesco","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20Espacio%20Riesco","problematica":"Acreditacion lenta de asistentes en eventos masivos, info dispersa y nula medicion en sitio.","propuesta":"FIGIT version maleta para acreditacion inteligente, info de agenda/expositores, encuestas y wayfinding del recinto. KIMOS entrega data del evento en tiempo real.","notas":"Confirmar via LinkedIn. Encaja con FIGIT portatil."},{"id":52,"rubro":"HOTELERIA Y EVENTOS","empresa":"Enjoy (Casinos y Hoteles)","descripcion":"Operador de casinos, hoteles y centros de entretenimiento en Chile.","persona":"(Identificar via LinkedIn)","cargo":"Gerente de Operaciones / Gerente de Experiencia del Huesped","telefono":"+56 2 2477 0900","correo":"nombre.apellido@enjoy.cl","linkedin_q":"Gerente Experiencia Huesped Enjoy","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Experiencia%20Huesped%20Enjoy","problematica":"Check-in y atencion al huesped con friccion, orientacion en complejos grandes y fidelizacion.","propuesta":"FIGIT para check-in, concierge IA, directorio del complejo y programa de fidelizacion. KIMOS unifica la experiencia del huesped.","notas":"Confirmar tomador de decision via LinkedIn."},{"id":53,"rubro":"DEPORTE Y EVENTOS","empresa":"FECHITRI (Federacion Chilena de Triatlon)","descripcion":"Federacion nacional del triatlon; organiza el ranking y campeonatos como el Americas Triathlon & Para Championships Antofagasta 2026.","persona":"Javier Parada (Presidente FECHITRI) - punto de entrada","cargo":"Presidente / Gerente / Director de Eventos","telefono":"Ver sitio (fechitri.cl)","correo":"contacto@fechitri.cl","linkedin_q":"Presidente FECHITRI Javier Parada","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Presidente%20FECHITRI%20Javier%20Parada","problematica":"Acreditacion de atletas, info de la prueba (rutas, horarios, resultados), atencion de consultas masivas antes y durante el evento.","propuesta":"CASO REAL EN PRODUCCION: el widget de agente consultivo de KIMOS ya opera en https://triatlonantofagasta.cl (Asistente Triatlon Antofagasta, Powered by Kimos.dev). Escalar a FIGIT para acreditacion y check-in de atletas, info y resultados en sitio.","notas":"CLIENTE ACTIVO / referencia viva. Presidente verificado (prensa jun-2026). Usar como caso de exito."},{"id":54,"rubro":"DEPORTE Y EVENTOS","empresa":"Corp. Municipal de Deportes y Recreacion Antofagasta (CMDR)","descripcion":"Organismo que organiza el deporte y los grandes eventos deportivos de Antofagasta (sede del Americas Triathlon 2026).","persona":"Braulio Otarola (Director Ejecutivo) - punto de entrada","cargo":"Director Ejecutivo / Jefe de Eventos","telefono":"Ver sitio corporativo","correo":"contacto@cmdantofagasta.cl","linkedin_q":"Director Ejecutivo Corporacion Deportes Antofagasta","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Director%20Ejecutivo%20Corporacion%20Deportes%20Antofagasta","problematica":"Organizacion de eventos masivos, acreditacion, informacion al publico y medicion de la experiencia.","propuesta":"Donde ya corre el widget KIMOS (evento Antofagasta 2026). Proponer FIGIT para acreditacion, info y wayfinding en eventos, y KIMOS como asistente permanente de sus webs de eventos.","notas":"Lead tibio: ya conviven con KIMOS en su evento. Director verificado (prensa jun-2026)."},{"id":55,"rubro":"DEPORTE Y EVENTOS","empresa":"Comite Olimpico de Chile (COCH)","descripcion":"Entidad rectora del deporte olimpico nacional; organiza delegaciones y eventos de alto rendimiento.","persona":"(Identificar via LinkedIn / sitio)","cargo":"Secretario General / Gerente de Operaciones","telefono":"Ver sitio corporativo","correo":"contacto@coch.cl","linkedin_q":"Secretario General Comite Olimpico de Chile","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Secretario%20General%20Comite%20Olimpico%20de%20Chile","problematica":"Acreditacion de delegaciones, informacion y atencion en eventos y sedes deportivas.","propuesta":"FIGIT para acreditacion e info en eventos; KIMOS como asistente consultivo en sus plataformas (caso probado en triatlon).","notas":"Confirmar tomador de decision via sitio/LinkedIn."},{"id":56,"rubro":"DEPORTE Y EVENTOS","empresa":"Instituto Nacional de Deportes (IND)","descripcion":"Servicio publico que fomenta el deporte; administra estadios y centros deportivos de alto flujo.","persona":"(Identificar via portal institucional)","cargo":"Director Nacional / Jefe de Operaciones de Recintos","telefono":"Ver sitio corporativo","correo":"contacto@ind.cl","linkedin_q":"Jefe Operaciones IND Instituto Nacional Deportes","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Jefe%20Operaciones%20IND%20Instituto%20Nacional%20Deportes","problematica":"Atencion de publico en recintos, inscripciones a programas y orientacion en eventos masivos.","propuesta":"FIGIT de autoatencion e info en recintos (Estadio Nacional, polideportivos); KIMOS como asistente en sus canales. Procesamiento local para eventos sin buena conectividad.","notas":"Validar via portal institucional. Alto volumen de publico."},{"id":57,"rubro":"DEPORTE Y EVENTOS","empresa":"Federacion Chilena de Deportes Acuaticos (Natacion)","descripcion":"Federacion que rige natacion, polo acuatico, saltos y aguas abiertas; organiza campeonatos nacionales.","persona":"(Identificar via LinkedIn / sitio)","cargo":"Presidente / Director de Eventos","telefono":"Ver sitio corporativo","correo":"contacto@fechda.cl","linkedin_q":"Presidente Federacion Natacion Chile","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Presidente%20Federacion%20Natacion%20Chile","problematica":"Inscripciones, acreditacion y resultados en campeonatos; atencion de consultas de deportistas y clubes.","propuesta":"KIMOS como asistente consultivo en su web (caso probado en triatlon) y FIGIT para acreditacion/resultados en piscina.","notas":"Confirmar tomador de decision via sitio/LinkedIn."},{"id":58,"rubro":"DEPORTE Y EVENTOS","empresa":"Federacion Atletica de Chile (Atletismo)","descripcion":"Federacion nacional de atletismo; organiza torneos y maratones de alta convocatoria.","persona":"(Identificar via LinkedIn / sitio)","cargo":"Presidente / Director de Eventos","telefono":"Ver sitio corporativo","correo":"contacto@fedachi.cl","linkedin_q":"Presidente Federacion Atletismo Chile","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Presidente%20Federacion%20Atletismo%20Chile","problematica":"Inscripciones masivas, acreditacion y entrega de kits en maratones, info de recorrido y resultados.","propuesta":"FIGIT para acreditacion y entrega de kits, info de recorrido y resultados; KIMOS como asistente de inscripcion y consultas en la web del evento.","notas":"Confirmar tomador de decision via sitio/LinkedIn."},{"id":59,"rubro":"DEPORTE Y EVENTOS","empresa":"Productoras de eventos masivos (Bizarro, Lotus, DG Medios)","descripcion":"Principales productoras de conciertos y espectaculos masivos del pais.","persona":"(Identificar via LinkedIn por productora)","cargo":"Gerente de Operaciones / Gerente de Produccion","telefono":"Ver sitio corporativo","correo":"contacto@productora.cl","linkedin_q":"Gerente Operaciones productora eventos Chile","linkedin_url":"https://www.linkedin.com/search/results/people/?keywords=Gerente%20Operaciones%20productora%20eventos%20Chile","problematica":"Acreditacion de prensa/VIP, control de acceso, informacion al publico y medicion de experiencia en espectaculos masivos.","propuesta":"FIGIT version maleta para acreditacion y control de acceso en eventos; KIMOS como asistente consultivo de venta/info en las webs de cada show.","notas":"Prospectar por productora individual via LinkedIn. Encaja con FIGIT portatil."}],"rubros":["RETAIL","SALUD","EDUCACION","BANCA Y FINANZAS","TRANSPORTE Y SERVICIOS PUBLICOS","GOBIERNO MUNICIPAL","TELECOMUNICACIONES","MINERIA","ENERGIA","MANUFACTURA","AUTOMOTOR","HOTELERIA Y EVENTOS","DEPORTE Y EVENTOS"],"rubro_fill":{"RETAIL":"FCE4D6","SALUD":"E2EFDA","EDUCACION":"DDEBF7","BANCA Y FINANZAS":"FFF2CC","TRANSPORTE Y SERVICIOS PUBLICOS":"EDEDED","GOBIERNO MUNICIPAL":"D9D2E9","TELECOMUNICACIONES":"E6E0EC","MINERIA":"F4B183","ENERGIA":"FFE699","MANUFACTURA":"C6E0B4","AUTOMOTOR":"B4C7E7","HOTELERIA Y EVENTOS":"FDE9D9","DEPORTE Y EVENTOS":"D1F2EB"}};

// ---------- Catálogos / iconos (portados del HTML original) ----------
const RUBRO_ICON = {
  "RETAIL": "\u{1F6D2}", "SALUD": "\u{1F3E5}", "EDUCACION": "\u{1F393}", "BANCA Y FINANZAS": "\u{1F3E6}",
  "TRANSPORTE Y SERVICIOS PUBLICOS": "\u{1F687}", "GOBIERNO MUNICIPAL": "\u{1F3DB}️", "TELECOMUNICACIONES": "\u{1F4E1}",
  "MINERIA": "⛏️", "ENERGIA": "⚡", "MANUFACTURA": "\u{1F3ED}", "AUTOMOTOR": "\u{1F697}",
  "HOTELERIA Y EVENTOS": "\u{1F3E8}", "DEPORTE Y EVENTOS": "\u{1F3C5}"
};
const ESTADO_COL = { "Por Contactar": "#5aa9e6", "Contactado": "#2e75b6", "Reunion Agendada": "#9b6ad6" };
const RES_COL = { "Aceptada": "#2ecc8f", "Esperando Confirmacion": "#f5b73d", "Rechazo": "#e5534b" };
const CANAL_ICON = {
  "Telefono": "\u{1F4DE}", "Correo": "✉️", "LinkedIn": "\u{1F4BC}", "WhatsApp": "\u{1F4AC}",
  "Reunion presencial": "\u{1F91D}", "Reunion online": "\u{1F4BB}", "Otro": "\u{1F4CC}"
};
const ESTADOS = ["Por Contactar", "Contactado", "Reunion Agendada"];
const RESULTADOS = ["", "Aceptada", "Esperando Confirmacion", "Rechazo"];
const DEFAULT_EQUIPO = ["Sin asignar", "Responsable 1", "Responsable 2", "Responsable 3"];

const LS_KEY = "kimos_prospeccion_v1";

// Campos de un prospecto (los mismos que trae SEED). Los prospectos añadidos
// por el usuario (manual o importados) viven en store.custom con estos campos.
const PROSPECTO_FIELDS = ["rubro", "empresa", "descripcion", "persona", "cargo", "telefono", "correo", "linkedin_url", "linkedin_q", "problematica", "propuesta", "notas", "foto"];
function blankProspecto() { const o = {}; PROSPECTO_FIELDS.forEach((k) => (o[k] = "")); return o; }
function nextId(list) { let mx = 0; list.forEach((p) => { const n = Number(p && p.id); if (isFinite(n) && n > mx) mx = n; }); return mx + 1; }

// Iniciales de respaldo para el avatar (persona; si no hay, empresa).
function initialsOf(p) {
  let src = p.persona || "";
  if (!src || /identificar|ver sitio/i.test(src)) src = p.empresa || "?";
  const words = src.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((words[0] || "?")[0] + ((words[1] || "")[0] || "")).toUpperCase();
}
// Archivo de imagen → data URI JPEG cuadrado 160x160 (recorte centrado), para
// que las fotos quepan holgadas en localStorage. cb(dataUri|null).
function fileToSquareDataUri(file, cb) {
  try {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const S = 160;
          const c = document.createElement("canvas");
          c.width = S; c.height = S;
          const ctx = c.getContext("2d");
          const scale = Math.max(S / img.width, S / img.height);
          const w = img.width * scale, hgt = img.height * scale;
          ctx.drawImage(img, (S - w) / 2, (S - hgt) / 2, w, hgt);
          cb(c.toDataURL("image/jpeg", 0.82));
        } catch { cb(null); }
      };
      img.onerror = () => cb(null);
      img.src = rd.result;
    };
    rd.onerror = () => cb(null);
    rd.readAsDataURL(file);
  } catch { cb(null); }
}

// Normaliza un encabezado de columna: minúsculas, sin acentos, sin símbolos.
function normKey(s) {
  return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
// Sinónimos de columna → campo canónico. Acepta JSON con las claves exactas
// (linkedin_url → "linkedin url") y planillas en español/inglés.
const COLUMN_ALIASES = {
  "rubro": "rubro", "sector": "rubro", "industria": "rubro", "categoria": "rubro", "area": "rubro",
  "empresa": "empresa", "compania": "empresa", "company": "empresa", "nombre": "empresa", "name": "empresa", "cuenta": "empresa", "razon social": "empresa",
  "descripcion": "descripcion", "description": "descripcion", "detalle": "descripcion", "resumen empresa": "descripcion",
  "persona": "persona", "contacto": "persona", "tomador": "persona", "tomador de decision": "persona", "decision maker": "persona", "referente": "persona",
  "cargo": "cargo", "puesto": "cargo", "title": "cargo", "role": "cargo", "rol": "cargo",
  "telefono": "telefono", "fono": "telefono", "phone": "telefono", "celular": "telefono", "movil": "telefono", "tel": "telefono",
  "correo": "correo", "email": "correo", "mail": "correo", "e mail": "correo", "correo electronico": "correo",
  "linkedin": "linkedin_url", "linkedin url": "linkedin_url", "url": "linkedin_url", "perfil": "linkedin_url", "linkedin link": "linkedin_url",
  "linkedin q": "linkedin_q", "busqueda linkedin": "linkedin_q", "linkedin query": "linkedin_q",
  "problematica": "problematica", "problema": "problematica", "pain": "problematica", "dolor": "problematica", "necesidad": "problematica",
  "propuesta": "propuesta", "proposal": "propuesta", "solucion": "propuesta", "pitch": "propuesta",
  "notas": "notas", "notes": "notas", "observaciones": "notas", "comentarios": "notas", "nota": "notas",
  "foto": "foto", "photo": "foto", "imagen": "foto", "image": "foto", "avatar": "foto", "picture": "foto", "foto url": "foto",
};
// Convierte una fila (objeto {encabezado: valor}) a un prospecto. Devuelve null
// si no reconoce ninguna columna útil.
function rowToProspecto(row) {
  if (!row || typeof row !== "object") return null;
  const p = blankProspecto();
  let has = false;
  Object.keys(row).forEach((k) => {
    const field = COLUMN_ALIASES[normKey(k)];
    if (field) { p[field] = String(row[k] == null ? "" : row[k]).trim(); if (p[field]) has = true; }
  });
  return has ? p : null;
}
// Detecta el separador de un CSV a partir del encabezado (coma, ; o tab).
function detectDelim(line) {
  const c = (line.match(/,/g) || []).length, s = (line.match(/;/g) || []).length, t = (line.match(/\t/g) || []).length;
  if (t > c && t > s) return "\t";
  return s > c ? ";" : ",";
}
// Parser CSV sin dependencias: soporta comillas, comillas escapadas (""),
// separadores , ; o tab, y saltos CRLF/LF. Devuelve array de objetos por header.
function parseCSV(text) {
  text = String(text || "").replace(/^\uFEFF/, "");
  const nl = text.indexOf("\n");
  const delim = detectDelim(nl < 0 ? text : text.slice(0, nl));
  const rows = []; let field = "", rec = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { rec.push(field); field = ""; }
    else if (ch === "\n") { rec.push(field); rows.push(rec); rec = []; field = ""; }
    else if (ch === "\r") { /* ignora */ }
    else field += ch;
  }
  if (field.length || rec.length) { rec.push(field); rows.push(rec); }
  if (!rows.length) return [];
  const headers = rows[0].map((x) => x.trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    if (rows[r].length === 1 && rows[r][0].trim() === "") continue;
    const obj = {};
    headers.forEach((hh, ci) => { obj[hh] = rows[r][ci] != null ? rows[r][ci] : ""; });
    out.push(obj);
  }
  return out;
}
// Acepta array, {prospectos:[...]}, {custom:[...]} o un único objeto.
function coerceRawList(j) {
  if (Array.isArray(j)) return j;
  if (j && Array.isArray(j.prospectos)) return j.prospectos;
  if (j && Array.isArray(j.custom)) return j.custom;
  if (j && typeof j === "object") return [j];
  return [];
}

// ============================================================================
// Lector .xlsx nativo (sin dependencias): DEFLATE (RFC1951) + ZIP + XML de Excel.
// ============================================================================
// Inflate raw (algoritmo tinf, dominio público, adaptado). in: Uint8Array.
function inflateRaw(input) {
  let bitBuf = 0, bitCnt = 0, pos = 0;
  const out = [];
  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  function bit() { if (bitCnt === 0) { bitBuf = input[pos++]; bitCnt = 8; } const b = bitBuf & 1; bitBuf >>= 1; bitCnt--; return b; }
  function bits(n) { let v = 0; for (let i = 0; i < n; i++) v |= bit() << i; return v; }
  function build(lengths, num) {
    const counts = new Array(16).fill(0);
    for (let i = 0; i < num; i++) counts[lengths[i]]++;
    counts[0] = 0;
    const offs = new Array(16).fill(0);
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
    const symbols = new Array(num);
    for (let i = 0; i < num; i++) if (lengths[i]) symbols[offs[lengths[i]]++] = i;
    return { counts, symbols };
  }
  function decode(tree) {
    let sum = 0, cur = 0, len = 0;
    do { cur = cur * 2 + bit(); len++; sum += tree.counts[len]; cur -= tree.counts[len]; } while (cur >= 0);
    return tree.symbols[sum + cur];
  }
  const fixedLit = (() => { const l = new Array(288); for (let i = 0; i < 144; i++) l[i] = 8; for (let i = 144; i < 256; i++) l[i] = 9; for (let i = 256; i < 280; i++) l[i] = 7; for (let i = 280; i < 288; i++) l[i] = 8; return build(l, 288); })();
  const fixedDist = (() => { const l = new Array(30).fill(5); return build(l, 30); })();
  let last = 0;
  do {
    last = bit();
    const type = bits(2);
    if (type === 0) {
      bitCnt = 0;
      const len = input[pos] | (input[pos + 1] << 8); pos += 4;
      for (let i = 0; i < len; i++) out.push(input[pos++]);
    } else {
      let lt, dt;
      if (type === 1) { lt = fixedLit; dt = fixedDist; }
      else {
        const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
        const cl = new Array(19).fill(0);
        for (let i = 0; i < hclen; i++) cl[ORDER[i]] = bits(3);
        const clt = build(cl, 19);
        const lens = new Array(hlit + hdist).fill(0);
        let n = 0;
        while (n < hlit + hdist) {
          const sym = decode(clt);
          if (sym < 16) lens[n++] = sym;
          else if (sym === 16) { const r = bits(2) + 3, prev = lens[n - 1]; for (let i = 0; i < r; i++) lens[n++] = prev; }
          else if (sym === 17) { const r = bits(3) + 3; for (let i = 0; i < r; i++) lens[n++] = 0; }
          else { const r = bits(7) + 11; for (let i = 0; i < r; i++) lens[n++] = 0; }
        }
        lt = build(lens.slice(0, hlit), hlit);
        dt = build(lens.slice(hlit), hdist);
      }
      for (;;) {
        const sym = decode(lt);
        if (sym === 256) break;
        if (sym < 256) out.push(sym);
        else {
          const s = sym - 257;
          const length = LBASE[s] + bits(LEXT[s]);
          const d = decode(dt);
          const dist = DBASE[d] + bits(DEXT[d]);
          const start = out.length - dist;
          for (let i = 0; i < length; i++) out.push(out[start + i]);
        }
      }
    }
  } while (!last);
  return Uint8Array.from(out);
}
// Lee un ZIP vía el directorio central. Devuelve { nombre: Uint8Array }.
function unzip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dec = new TextDecoder("utf-8");
  const out = {};
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error("ZIP inválido");
  const cnt = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  for (let e = 0; e < cnt; e++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = dec.decode(buf.subarray(off + 46, off + 46 + nameLen));
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    out[name] = method === 0 ? comp.slice() : inflateRaw(comp);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
function xmlDecode(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function parseSharedStrings(xml) {
  const arr = [];
  if (!xml) return arr;
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g; let m;
  while ((m = siRe.exec(xml))) {
    let text = ""; const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let tm;
    while ((tm = tRe.exec(m[1]))) text += xmlDecode(tm[1]);
    arr.push(text);
  }
  return arr;
}
function colIndex(ref) { let s = 0; for (let i = 0; i < ref.length; i++) { const c = ref.charCodeAt(i); if (c >= 65 && c <= 90) s = s * 26 + (c - 64); else break; } return s - 1; }
function parseSheet(xml, shared) {
  const rows = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g; let rm;
  while ((rm = rowRe.exec(xml))) {
    const cells = [];
    const cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let cm;
    while ((cm = cRe.exec(rm[1]))) {
      const attrs = cm[1] || "", body = cm[2] || "";
      const rMatch = /r="([A-Z]+)\d+"/.exec(attrs);
      const ci = rMatch ? colIndex(rMatch[1]) : cells.length;
      const tMatch = /t="([^"]+)"/.exec(attrs); const type = tMatch ? tMatch[1] : "";
      let val = "";
      if (type === "s") { const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body); val = v ? (shared[parseInt(v[1], 10)] || "") : ""; }
      else if (type === "inlineStr") { let t = ""; const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let tm; while ((tm = tRe.exec(body))) t += xmlDecode(tm[1]); val = t; }
      else { const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body); val = v ? xmlDecode(v[1]) : ""; }
      cells[ci >= 0 ? ci : cells.length] = val;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
    rows.push(cells);
  }
  return rows;
}
// .xlsx (ArrayBuffer) → filas [{encabezado: valor}] usando la 1ª hoja.
function xlsxToRows(arrayBuffer) {
  const files = unzip(new Uint8Array(arrayBuffer));
  const dec = new TextDecoder("utf-8");
  const shared = parseSharedStrings(files["xl/sharedStrings.xml"] ? dec.decode(files["xl/sharedStrings.xml"]) : "");
  const sheetKey = Object.keys(files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  if (!sheetKey) throw new Error("el .xlsx no tiene hojas legibles");
  const rows = parseSheet(dec.decode(files[sheetKey]), shared);
  if (!rows.length) return [];
  const headers = rows[0].map((x) => String(x == null ? "" : x).trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const rec = rows[r];
    if (!rec || rec.every((c) => String(c == null ? "" : c).trim() === "")) continue;
    const obj = {}; headers.forEach((hh, ci) => { obj[hh] = rec[ci] != null ? rec[ci] : ""; });
    out.push(obj);
  }
  return out;
}

function freshStore() {
  return { meta: {}, bit: [], equipo: DEFAULT_EQUIPO.slice(), custom: [], overrides: {} };
}
// Lista efectiva de prospectos: SEED + añadidos, con overrides (ediciones del
// usuario/agente sobre cualquier prospecto, incluidos los 59 base) aplicados.
function effProspectos(s) {
  const ov = (s && s.overrides) || {};
  return SEED.prospectos.concat((s && s.custom) || []).map((p) => (ov[p.id] ? { ...p, ...ov[p.id] } : p));
}
// Aplica un parche de campos a un prospecto: si es añadido se edita directo;
// si es de SEED se guarda como override (SEED es inmutable en el bundle).
function applyProspectoPatch(s, id, patch) {
  const clean = {};
  PROSPECTO_FIELDS.forEach((k) => { if (patch[k] !== undefined) clean[k] = String(patch[k]); });
  if (!Object.keys(clean).length) return s;
  if ((s.custom || []).some((p) => p.id === id)) {
    return { ...s, custom: s.custom.map((p) => (p.id === id ? { ...p, ...clean } : p)) };
  }
  const ov = { ...(s.overrides || {}) };
  ov[id] = { ...(ov[id] || {}), ...clean };
  return { ...s, overrides: ov };
}
function loadLocal() {
  try {
    const ls = globalThis.localStorage;
    const raw = ls && ls.getItem(LS_KEY);
    if (raw) return normalizeStore(JSON.parse(raw));
  } catch { /* sin datos previos o storage bloqueado */ }
  return freshStore();
}
function saveLocal(s) {
  try {
    const ls = globalThis.localStorage;
    if (ls) ls.setItem(LS_KEY, JSON.stringify({ meta: s.meta, bit: s.bit, equipo: s.equipo, custom: s.custom || [], overrides: s.overrides || {} }));
  } catch { /* storage lleno o bloqueado */ }
}
function normalizeStore(s) {
  const out = freshStore();
  if (s && typeof s === "object") {
    if (s.meta && typeof s.meta === "object") out.meta = s.meta;
    if (Array.isArray(s.bit)) out.bit = s.bit;
    if (Array.isArray(s.equipo) && s.equipo.length) out.equipo = s.equipo;
    if (Array.isArray(s.custom)) out.custom = s.custom;
    if (s.overrides && typeof s.overrides === "object") out.overrides = s.overrides;
  }
  return out;
}
function metaOf(store, id) {
  return store.meta[id] || { estado: "Por Contactar", resultado: "", responsable: "Sin asignar", notas: "" };
}
function lastContact(store, emp) {
  const xs = store.bit.filter((b) => b.empresa === emp && b.fecha).map((b) => b.fecha).sort();
  return xs.length ? xs[xs.length - 1] : "";
}
function countBit(store, emp) {
  return store.bit.filter((b) => b.empresa === emp).length;
}

export default function mount(shell) {
  const R = globalThis.React;
  if (!R) {
    return { Component() { return null; } };
  }
  const { useState, useEffect, useRef, useCallback, useMemo } = R;
  const h = R.createElement;

  function notify(level, text) {
    try { shell.notify({ level, text }); } catch { /* no-op */ }
  }

  // Puente entre el Component montado y el agente: el Component publica aquí
  // su setStore/estado actual en cada render (mismo estado → UI reactiva).
  const bridge = { setStore: null, getStore: null };

  function agentExists(id) {
    const s = bridge.getStore && bridge.getStore();
    return s ? effProspectos(s).some((p) => p.id === id) : false;
  }

  let unregisterAgent = null;
  if (shell && shell.agent && typeof shell.agent.register === "function") {
    try {
      unregisterAgent = shell.agent.register({
        label: "Prospección Comercial",
        description: "Pipeline de prospección FIGIT+KIMOS. Puedes investigar en la web la información de contacto de los prospectos (nombre del tomador de decisión, cargo, teléfono, correo, LinkedIn, rubro) y actualizarla con UPDATE_PROSPECTO; sumar prospectos nuevos; y llevar el avance comercial (estado, resultado, responsable, notas y bitácora de contactos). Usa getSnapshot para conocer los ids antes de actuar.",
        tools: [
          { name: "UPDATE_PROSPECTO", description: "Actualiza campos de contacto/ficha de un prospecto (tras investigarlos): empresa, rubro, persona, cargo, telefono, correo, linkedin_url, descripcion, problematica, propuesta, notas, foto (URL de imagen del contacto, p.ej. su foto de perfil de LinkedIn — verifica que corresponda a la persona real antes de asignarla).",
            inputSchema: { type: "object", properties: { id: { type: "number" }, campos: { type: "object" } }, required: ["id", "campos"] } },
          { name: "ADD_PROSPECTO", description: "Agrega un prospecto nuevo. Campos: empresa (obligatorio), rubro, persona, cargo, telefono, correo, linkedin_url, descripcion, problematica, propuesta, notas.",
            inputSchema: { type: "object", properties: { empresa: { type: "string" } }, required: ["empresa"] } },
          { name: "SET_ESTADO", description: "Cambia el estado del pipeline: 'Por Contactar' | 'Contactado' | 'Reunion Agendada'.",
            inputSchema: { type: "object", properties: { id: { type: "number" }, estado: { type: "string" } }, required: ["id", "estado"] } },
          { name: "SET_RESULTADO", description: "Fija el resultado: 'Aceptada' | 'Esperando Confirmacion' | 'Rechazo' | '' (sin resultado).",
            inputSchema: { type: "object", properties: { id: { type: "number" }, resultado: { type: "string" } }, required: ["id", "resultado"] } },
          { name: "SET_RESPONSABLE", description: "Asigna el prospecto a un responsable del equipo.",
            inputSchema: { type: "object", properties: { id: { type: "number" }, responsable: { type: "string" } }, required: ["id", "responsable"] } },
          { name: "ADD_NOTA", description: "Agrega/actualiza la nota de seguimiento del usuario sobre un prospecto.",
            inputSchema: { type: "object", properties: { id: { type: "number" }, nota: { type: "string" } }, required: ["id", "nota"] } },
          { name: "ADD_BITACORA", description: "Registra una interacción en la bitácora (fecha YYYY-MM-DD, canal: Telefono|Correo|LinkedIn|WhatsApp|Reunion presencial|Reunion online|Otro, resumen, proximo seguimiento opcional).",
            inputSchema: { type: "object", properties: { id: { type: "number" }, fecha: { type: "string" }, canal: { type: "string" }, resumen: { type: "string" }, proximo: { type: "string" } }, required: ["id", "resumen"] } },
        ],
        getSnapshot: () => {
          if (!bridge.getStore) return { ready: false };
          const s = bridge.getStore();
          return {
            ready: true,
            equipo: s.equipo,
            rubros: SEED.rubros,
            prospectos: effProspectos(s).map((p) => {
              const m = s.meta[p.id] || {};
              return { id: p.id, empresa: p.empresa, rubro: p.rubro, persona: p.persona, cargo: p.cargo,
                telefono: p.telefono, correo: p.correo, linkedin_url: p.linkedin_url,
                foto: p.foto ? (String(p.foto).startsWith("data:") ? "(foto subida manualmente)" : p.foto) : "",
                estado: m.estado || "Por Contactar", resultado: m.resultado || "", responsable: m.responsable || "Sin asignar", notas: m.notas || "" };
            }),
          };
        },
        dispatchAction: async (action) => {
          if (!bridge.setStore || !bridge.getStore) return { success: false, error: "La app aún no terminó de montar." };
          const t = (action && action.type) || "";
          const pl = (action && action.payload) || {};
          const id = Number(pl.id);
          const setMeta = (key, value) => {
            if (!agentExists(id)) return false;
            bridge.setStore((s) => {
              const cur = s.meta[id] || { estado: "Por Contactar", resultado: "", responsable: "Sin asignar", notas: "" };
              return { ...s, meta: { ...s.meta, [id]: { ...cur, [key]: value } } };
            });
            return true;
          };
          try {
            if (t === "UPDATE_PROSPECTO") {
              if (!agentExists(id)) return { success: false, error: "id no encontrado" };
              bridge.setStore((s) => applyProspectoPatch(s, id, pl.campos || {}));
              return { success: true, message: "Prospecto " + id + " actualizado." };
            }
            if (t === "ADD_PROSPECTO") {
              const empresa = String(pl.empresa || "").trim();
              if (!empresa) return { success: false, error: "empresa es obligatoria" };
              const newId = nextId(effProspectos(bridge.getStore()));
              bridge.setStore((s) => {
                const p = { ...blankProspecto(), id: nextId(effProspectos(s)) };
                PROSPECTO_FIELDS.forEach((k) => { if (pl[k] !== undefined) p[k] = String(pl[k]); });
                p.empresa = empresa; if (!p.rubro) p.rubro = "SIN RUBRO";
                return { ...s, custom: (s.custom || []).concat([p]) };
              });
              return { success: true, message: "Prospecto creado (id aprox. " + newId + "; confirma con getSnapshot)." };
            }
            if (t === "SET_ESTADO") {
              if (ESTADOS.indexOf(pl.estado) < 0) return { success: false, error: "estado inválido: " + ESTADOS.join(" | ") };
              return setMeta("estado", pl.estado) ? { success: true } : { success: false, error: "id no encontrado" };
            }
            if (t === "SET_RESULTADO") {
              if (RESULTADOS.indexOf(pl.resultado) < 0) return { success: false, error: "resultado inválido: " + RESULTADOS.filter(Boolean).join(" | ") + " | ''" };
              return setMeta("resultado", pl.resultado) ? { success: true } : { success: false, error: "id no encontrado" };
            }
            if (t === "SET_RESPONSABLE") {
              return setMeta("responsable", String(pl.responsable || "Sin asignar")) ? { success: true } : { success: false, error: "id no encontrado" };
            }
            if (t === "ADD_NOTA") {
              return setMeta("notas", String(pl.nota || "")) ? { success: true } : { success: false, error: "id no encontrado" };
            }
            if (t === "ADD_BITACORA") {
              const p = effProspectos(bridge.getStore()).find((x) => x.id === id);
              if (!p) return { success: false, error: "id no encontrado" };
              const canal = CANAL_ICON[pl.canal] ? pl.canal : "Otro";
              bridge.setStore((s) => ({ ...s, bit: s.bit.concat([{ empresa: p.empresa, fecha: String(pl.fecha || new Date().toISOString().slice(0, 10)), canal, resumen: String(pl.resumen || ""), proximo: String(pl.proximo || "") }]) }));
              return { success: true };
            }
            return { success: false, error: "Acción desconocida: " + t };
          } catch (err) {
            return { success: false, error: (err && err.message) || "error interno" };
          }
        },
      });
    } catch { /* shell sin soporte de agente: la app sigue funcionando */ }
  }

  function Component() {
    const [store, setStore] = useState(loadLocal);
    const [q, setQ] = useState("");
    const [fEstado, setFEstado] = useState("");
    const [fResp, setFResp] = useState("");
    const [fRes, setFRes] = useState("");
    const [activeRubros, setActiveRubros] = useState([]);
    const [expanded, setExpanded] = useState([]);
    const [equipoOpen, setEquipoOpen] = useState(false);
    const [equipoDraft, setEquipoDraft] = useState([]);
    const [addOpen, setAddOpen] = useState(false);
    const [addDraft, setAddDraft] = useState(null); // prospecto en edición (alta manual)
    const [editId, setEditId] = useState(null);     // prospecto en edición (✏️ ficha)
    const [editDraft, setEditDraft] = useState(null);
    const [forms, setForms] = useState({}); // bitácora en edición por id
    const fileRef = useRef(null); // importar respaldo (estado)
    const bdRef = useRef(null);   // importar base de datos de prospectos
    const fotoRef = useRef(null);       // input file de foto (compartido)
    const fotoTargetRef = useRef(null); // id del prospecto destino, o "edit" para el modal
    const saveTimer = useRef(null);
    const skipSave = useRef(true);
    const storeRef = useRef(store);
    storeRef.current = store;
    // Publica el estado vivo para el agente (bridge). El wrapper refresca el
    // espejo apenas React aplica el updater, para lecturas encadenadas.
    bridge.getStore = () => storeRef.current;
    bridge.setStore = (upd) => setStore((s) => {
      const next = typeof upd === "function" ? upd(s) : upd;
      storeRef.current = next;
      return next;
    });

    // Persistencia en el NAVEGADOR (sin instancias por equipo): localStorage,
    // con guardado debounceado. El estado inicial ya se cargó en useState.
    useEffect(() => {
      if (skipSave.current) { skipSave.current = false; return; }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveLocal(store), 400);
      return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    }, [store]);

    // ---------- Mutadores de estado ----------
    const setMetaField = useCallback((id, key, value) => {
      setStore((s) => {
        const cur = s.meta[id] || { estado: "Por Contactar", resultado: "", responsable: "Sin asignar", notas: "" };
        return { ...s, meta: { ...s.meta, [id]: { ...cur, [key]: value } } };
      });
    }, []);

    const addBit = useCallback((emp, id) => {
      const f = forms[id] || {};
      if (!f.fecha && !f.resumen) { notify("warn", "Indica al menos una fecha o un resumen."); return; }
      const entry = {
        empresa: emp,
        fecha: f.fecha || "",
        canal: f.canal || Object.keys(CANAL_ICON)[0],
        resumen: f.resumen || "",
        proximo: f.proximo || "",
      };
      setStore((s) => ({ ...s, bit: s.bit.concat([entry]) }));
      setForms((m) => ({ ...m, [id]: { canal: entry.canal } }));
    }, [forms]);

    const delBit = useCallback((emp, idxInEmp) => {
      setStore((s) => {
        const xs = s.bit.filter((b) => b.empresa === emp).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
        const target = xs[idxInEmp];
        if (!target) return s;
        const gi = s.bit.indexOf(target);
        if (gi < 0) return s;
        const next = s.bit.slice();
        next.splice(gi, 1);
        return { ...s, bit: next };
      });
    }, []);

    const toggleRubro = useCallback((r) => {
      setActiveRubros((xs) => (xs.indexOf(r) >= 0 ? xs.filter((x) => x !== r) : xs.concat([r])));
    }, []);
    const toggleRow = useCallback((id) => {
      setExpanded((xs) => (xs.indexOf(id) >= 0 ? xs.filter((x) => x !== id) : xs.concat([id])));
    }, []);

    // ---------- Equipo ----------
    const openEquipo = useCallback(() => { setEquipoDraft(store.equipo.slice()); setEquipoOpen(true); }, [store.equipo]);
    const saveEquipo = useCallback(() => {
      const out = equipoDraft.map((t) => (t || "").trim()).filter(Boolean);
      setStore((s) => ({ ...s, equipo: out.length ? out : ["Sin asignar"] }));
      setEquipoOpen(false);
    }, [equipoDraft]);

    // ---------- Alta manual de prospecto ----------
    const setField = useCallback((k, v) => setAddDraft((d) => ({ ...(d || blankProspecto()), [k]: v })), []);
    const openAdd = useCallback(() => { setAddDraft(blankProspecto()); setAddOpen(true); }, []);
    const saveAdd = useCallback(() => {
      const d = addDraft || {};
      if (!(d.empresa && d.empresa.trim())) { notify("warn", "Indica al menos el nombre de la empresa."); return; }
      setStore((s) => {
        const all = SEED.prospectos.concat(s.custom || []);
        const p = { ...blankProspecto(), ...d, id: nextId(all) };
        p.empresa = p.empresa.trim();
        if (!p.rubro) p.rubro = "SIN RUBRO";
        return { ...s, custom: (s.custom || []).concat([p]) };
      });
      setAddOpen(false);
      notify("success", "Prospecto agregado.");
    }, [addDraft]);
    const delProspecto = useCallback((id) => {
      if (typeof window !== "undefined" && window.confirm && !window.confirm("¿Eliminar este prospecto añadido?")) return;
      setStore((s) => {
        const meta = { ...s.meta }; delete meta[id];
        return { ...s, meta, custom: (s.custom || []).filter((p) => p.id !== id) };
      });
    }, []);

    // ---------- Edición de ficha (cualquier prospecto, incl. los 59 base) ----------
    const updateProspecto = useCallback((id, patch) => setStore((s) => applyProspectoPatch(s, id, patch)), []);
    const openEdit = useCallback((p) => {
      const d = {}; PROSPECTO_FIELDS.forEach((k) => (d[k] = p[k] || ""));
      setEditDraft(d); setEditId(p.id);
    }, []);
    const saveEdit = useCallback(() => {
      if (editId == null) return;
      updateProspecto(editId, editDraft || {});
      setEditId(null);
      notify("success", "Ficha actualizada.");
    }, [editId, editDraft]);

    // ---------- Foto del contacto ----------
    const pickFoto = useCallback((target) => {
      fotoTargetRef.current = target; // id numérico, o "edit" (modal ✏️)
      if (fotoRef.current) fotoRef.current.click();
    }, []);
    const onFotoFile = useCallback((e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      fileToSquareDataUri(f, (uri) => {
        if (!uri) { notify("error", "No se pudo leer la imagen."); return; }
        const target = fotoTargetRef.current;
        if (target === "edit") setEditDraft((d) => ({ ...(d || {}), foto: uri }));
        else if (target != null) { updateProspecto(target, { foto: uri }); notify("success", "Foto guardada."); }
      });
    }, []);
    const askFotoUrl = useCallback((id, current) => {
      if (typeof window === "undefined" || !window.prompt) return;
      const url = window.prompt("Pega la URL de la imagen (en LinkedIn: clic derecho sobre la foto del perfil → “Copiar dirección de la imagen”). Verifica visualmente que corresponda a la persona real.", current && !String(current).startsWith("data:") ? current : "");
      if (url == null) return;
      updateProspecto(id, { foto: url.trim() });
      notify(url.trim() ? "success" : "info", url.trim() ? "Foto enlazada. Confirma que coincide con la persona." : "Foto quitada.");
    }, []);
    // Avatar: foto si hay (con fallback automático a iniciales si la URL falla).
    function Avatar(p, size) {
      const st = { width: size + "px", height: size + "px", fontSize: Math.round(size * 0.38) + "px" };
      return h("div", { className: "kp-avatar", style: st },
        h("span", { className: "kp-avatar-ini" }, initialsOf(p)),
        p.foto ? h("img", {
          src: p.foto, alt: p.persona || p.empresa, loading: "lazy", referrerPolicy: "no-referrer",
          onError: (e) => { try { e.target.style.display = "none"; } catch { /* no-op */ } },
        }) : null);
    }

    // ---------- Enlaces de investigación por prospecto ----------
    function researchLinks(p) {
      const emp = encodeURIComponent(p.empresa);
      return [
        { label: "🔎 Google: gerente/contacto", href: "https://www.google.com/search?q=" + encodeURIComponent(p.empresa + " " + (p.cargo || "gerente operaciones") + " contacto") },
        { label: "💼 LinkedIn", href: p.linkedin_url || ("https://www.linkedin.com/search/results/people/?keywords=" + emp) },
        { label: "📰 Noticias recientes", href: "https://news.google.com/search?q=" + emp + "&hl=es-419" },
        { label: "🌐 Sitio oficial", href: "https://www.google.com/search?q=" + emp + "+sitio+oficial" },
      ];
    }


    // ---------- Importar base de datos de prospectos (JSON / CSV) ----------
    const importBD = useCallback((e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const name = (f.name || "").toLowerCase();
      const isXlsx = /\.xlsx$/.test(name);
      const rd = new FileReader();
      rd.onload = () => {
        try {
          let raw;
          if (isXlsx) {
            raw = xlsxToRows(rd.result); // ArrayBuffer → filas
          } else {
            const txt = String(rd.result || "");
            // .xls antiguo (binario OLE) no soportado → pedir .xlsx o CSV.
            if (/\.xls$/.test(name) || txt.charCodeAt(0) === 0xD0) {
              notify("warn", "El formato .xls antiguo no se soporta. Guárdalo como .xlsx o CSV y vuelve a cargar.");
              return;
            }
            const isJson = name.endsWith(".json") || /^\s*[[{]/.test(txt);
            raw = isJson ? coerceRawList(JSON.parse(txt)) : parseCSV(txt);
          }
          const mapped = raw.map(rowToProspecto).filter(Boolean);
          if (!mapped.length) { notify("warn", "No se reconocieron prospectos. Revisa las columnas (empresa, rubro, persona, correo…)."); return; }
          setStore((s) => {
            let all = SEED.prospectos.concat(s.custom || []);
            const added = mapped.map((p) => {
              const np = { ...blankProspecto(), ...p, id: nextId(all) };
              np.empresa = (np.empresa || "").trim() || "(sin nombre)";
              if (!np.rubro) np.rubro = "SIN RUBRO";
              all = all.concat([np]);
              return np;
            });
            return { ...s, custom: (s.custom || []).concat(added) };
          });
          notify("success", mapped.length + " prospecto(s) importado(s).");
        } catch (err) { notify("error", "Archivo inválido: " + ((err && err.message) || "formato no reconocido")); }
      };
      if (isXlsx) rd.readAsArrayBuffer(f); else rd.readAsText(f);
      e.target.value = "";
    }, []);
    const downloadTemplate = useCallback(() => {
      try {
        const cols = ["empresa", "rubro", "persona", "cargo", "telefono", "correo", "linkedin_url", "foto", "descripcion", "problematica", "propuesta", "notas"];
        const ej = ["ACME S.A.", "RETAIL", "Juan Pérez", "Gerente de Operaciones", "+56 2 2222 3333", "juan.perez@acme.cl", "https://www.linkedin.com/in/juanperez", "https://ejemplo.com/foto-juan.jpg", "Descripción breve de la empresa", "Problemática detectada", "Propuesta FIGIT + KIMOS", "Nota inicial"];
        const line = (arr) => arr.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(",");
        const csv = "﻿" + cols.join(",") + "\n" + line(ej) + "\n";
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "plantilla_prospectos.csv";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } catch { notify("error", "No se pudo generar la plantilla."); }
    }, []);

    // ---------- Export / Import / Reset ----------
    const exportJSON = useCallback(() => {
      try {
        const blob = new Blob([JSON.stringify({ meta: store.meta, bit: store.bit, equipo: store.equipo, custom: store.custom || [], overrides: store.overrides || {} }, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "kimos_prospeccion_estado.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } catch { notify("error", "No se pudo exportar."); }
    }, [store]);
    const importJSON = useCallback((e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { setStore(normalizeStore(JSON.parse(rd.result))); notify("success", "Respaldo importado."); }
        catch { notify("error", "Archivo inválido."); }
      };
      rd.readAsText(f);
      e.target.value = "";
    }, []);
    const resetAll = useCallback(() => {
      if (typeof window !== "undefined" && window.confirm && !window.confirm("¿Borrar estados, asignaciones y bitácora? (Se conservan los prospectos añadidos y los datos de contacto editados)")) return;
      setStore((s) => ({ ...freshStore(), custom: s.custom || [], overrides: s.overrides || {} }));
      notify("info", "Avance reiniciado.");
    }, []);

    // ---------- Derivados ----------
    const P = effProspectos(store);
    const customIds = useMemo(() => { const s = new Set(); (store.custom || []).forEach((p) => s.add(p.id)); return s; }, [store.custom]);
    const stats = useMemo(() => {
      let pc = 0, co = 0, ra = 0, ac = 0, es = 0, re = 0;
      P.forEach((p) => {
        const m = metaOf(store, p.id);
        if (m.estado === "Por Contactar") pc++; else if (m.estado === "Contactado") co++; else ra++;
        if (m.resultado === "Aceptada") ac++; else if (m.resultado === "Esperando Confirmacion") es++; else if (m.resultado === "Rechazo") re++;
      });
      return { pc, co, ra, ac, es, re, bit: store.bit.length };
    }, [store]);

    const byRubro = useMemo(() => {
      const m = {}; SEED.rubros.forEach((r) => (m[r] = 0)); P.forEach((p) => { m[p.rubro] = (m[p.rubro] || 0) + 1; }); return m;
    }, [store]);

    const byResp = useMemo(() => {
      const team = store.equipo;
      const ml = {}; team.forEach((t) => (ml[t] = { por: 0, con: 0, reu: 0 }));
      P.forEach((p) => {
        const m = metaOf(store, p.id);
        const t = team.indexOf(m.responsable) >= 0 ? m.responsable : "Sin asignar";
        if (!ml[t]) ml[t] = { por: 0, con: 0, reu: 0 };
        if (m.estado === "Por Contactar") ml[t].por++; else if (m.estado === "Contactado") ml[t].con++; else ml[t].reu++;
      });
      return ml;
    }, [store]);

    const filtered = useMemo(() => {
      const qq = q.toLowerCase();
      return P.filter((p) => {
        const m = metaOf(store, p.id);
        if (activeRubros.length && activeRubros.indexOf(p.rubro) < 0) return false;
        if (fEstado && m.estado !== fEstado) return false;
        if (fResp && m.responsable !== fResp) return false;
        if (fRes === "__none" && m.resultado !== "") return false;
        if (fRes && fRes !== "__none" && m.resultado !== fRes) return false;
        if (qq && !((p.empresa + p.persona + p.cargo + p.rubro).toLowerCase().includes(qq))) return false;
        return true;
      });
    }, [store, q, fEstado, fResp, fRes, activeRubros]);

    // ============ RENDER ============
    const kpiCards = [
      ["\u{1F3AF}", P.length, "Total prospectos", "#18b9ad"],
      ["⚪", stats.pc, "Por Contactar", "#5aa9e6"],
      ["\u{1F535}", stats.co, "Contactado", "#2e75b6"],
      ["\u{1F7E3}", stats.ra, "Reunión Agendada", "#9b6ad6"],
      ["✅", stats.ac, "Aceptadas", "#2ecc8f"],
      ["⏳", stats.es, "Esperando", "#f5b73d"],
      ["❌", stats.re, "Rechazos", "#e5534b"],
      ["\u{1F4DD}", stats.bit, "Interacciones", "#18b9ad"],
    ];

    const total = P.length;
    const funnel = [
      ["Total en pipeline", total, "#18b9ad"],
      ["Contactados (o más)", stats.co + stats.ra, "#2e75b6"],
      ["Reunión Agendada", stats.ra, "#9b6ad6"],
      ["Aceptadas", stats.ac, "#2ecc8f"],
    ];

    return h("div", { className: "kimos-prospeccion" },
      h("div", { className: "kp-scroll" },
        // Header
        h("header", { className: "kp-top" },
          h("div", { className: "kp-brand" },
            h("div", { className: "kp-logo" }, "\u{1F9E0}"),
            h("div", null,
              h("h1", null, "Dashboard Comercial · FIGIT + KIMOS"),
              h("p", null, "Prospección Chile — tótems IA + software de orquestación"))),
          h("div", { className: "kp-actions" },
            h("button", { className: "kp-btn kp-primary", onClick: openAdd }, "➕ Prospecto"),
            h("button", { className: "kp-btn", onClick: () => bdRef.current && bdRef.current.click(), title: "Importar prospectos desde Excel (.xlsx), CSV o JSON" }, "\u{1F5C4}️ Cargar BD"),
            h("input", { type: "file", ref: bdRef, accept: ".csv,.tsv,.txt,.json,.xlsx,.xls,text/csv,text/plain,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", style: { display: "none" }, onChange: importBD }),
            h("button", { className: "kp-btn", onClick: downloadTemplate, title: "Descargar plantilla CSV con las columnas" }, "\u{1F4C4} Plantilla"),
            h("button", { className: "kp-btn", onClick: openEquipo }, "\u{1F465} Equipo"),
            h("button", { className: "kp-btn", onClick: exportJSON, title: "Descargar respaldo completo (avance + prospectos añadidos)" }, "⬇️ Exportar"),
            h("button", { className: "kp-btn", onClick: () => fileRef.current && fileRef.current.click(), title: "Restaurar un respaldo exportado" }, "⬆️ Importar"),
            h("input", { type: "file", ref: fileRef, accept: "application/json", style: { display: "none" }, onChange: importJSON }),
            h("input", { type: "file", ref: fotoRef, accept: "image/*", style: { display: "none" }, onChange: onFotoFile }),
            h("button", { className: "kp-btn", onClick: resetAll }, "↻ Reiniciar"))),

        // Hero
        h("div", { className: "kp-hero" },
          h("div", null,
            h("span", { className: "kp-badge" }, "CASO REAL EN PRODUCCIÓN"),
            h("h2", null, "El agente consultivo de KIMOS ya está vivo en triatlonantofagasta.cl"),
            h("p", null, "Implementamos el widget “Asistente Triatlón Antofagasta” (Powered by Kimos.dev) dentro de la web del Americas Triathlon & Para Championships Antofagasta 2026. Prueba viva para abrir todo el rubro Deporte y Eventos, y para demostrar a cualquier prospecto que la solución ya opera en clientes reales.")),
          h("div", { className: "kp-hero-side" },
            h("div", { className: "kp-live" }, h("span", { className: "kp-dot-live" }), " Widget operativo"),
            h("a", { className: "kp-btn kp-primary", style: { marginTop: "8px" }, href: "https://triatlonantofagasta.cl/", target: "_blank", rel: "noreferrer" }, "Ver en vivo ↗"))),

        // KPIs
        h("div", { className: "kp-kpis" },
          kpiCards.map((c, i) => h("div", { className: "kp-kpi", key: i },
            h("div", { className: "kp-ic" }, c[0]),
            h("div", { className: "kp-v" }, c[1]),
            h("div", { className: "kp-l" }, c[2]),
            h("div", { className: "kp-bar", style: { background: c[3] } })))),

        // Funnel + Estados donut
        h("div", { className: "kp-grid" },
          h("div", { className: "kp-card" },
            h("h3", null, "\u{1F4C8} Embudo Comercial"),
            h("div", { className: "kp-funnel" },
              funnel.map((f, i) => {
                const w = total ? Math.max(6, Math.round(f[1] / total * 100)) : 6;
                return h("div", { className: "kp-fstage", key: i },
                  h("div", { className: "kp-lbl" }, f[0]),
                  h("div", { className: "kp-ftrack" },
                    h("div", { className: "kp-ffill", style: { width: w + "%", background: f[2] } }, String(f[1]))));
              }))),
          h("div", { className: "kp-card" },
            h("h3", null, "\u{1F9E9} Distribución de Estados"),
            Donut([
              { label: "Por Contactar", value: stats.pc, color: "#5aa9e6" },
              { label: "Contactado", value: stats.co, color: "#2e75b6" },
              { label: "Reunión Agendada", value: stats.ra, color: "#9b6ad6" },
            ]))),

        // Rubro + Responsable
        h("div", { className: "kp-grid" },
          h("div", { className: "kp-card" },
            h("h3", null, "\u{1F4CA} Prospectos por Rubro"),
            BarList(SEED.rubros.concat(Object.keys(byRubro).filter((r) => SEED.rubros.indexOf(r) < 0))
              .map((r) => ({ label: (RUBRO_ICON[r] || "\u{1F4CC}") + " " + r, value: byRubro[r] || 0, color: "#18b9ad" })))),
          h("div", { className: "kp-card" },
            h("h3", null, "\u{1F465} Carga por Responsable"),
            StackedBars(store.equipo, byResp))),

        // Filtros
        h("div", { className: "kp-filters" },
          h("div", { className: "kp-row" },
            h("input", { className: "kp-search", placeholder: "\u{1F50D} Buscar empresa, persona o cargo...", value: q, onInput: (e) => setQ(e.target.value), onChange: (e) => setQ(e.target.value) }),
            h("select", { value: fEstado, onChange: (e) => setFEstado(e.target.value) },
              h("option", { value: "" }, "Todos los estados"),
              ESTADOS.map((e) => h("option", { key: e, value: e }, e))),
            h("select", { value: fResp, onChange: (e) => setFResp(e.target.value) },
              h("option", { value: "" }, "Todos los responsables"),
              store.equipo.map((t) => h("option", { key: t, value: t }, t))),
            h("select", { value: fRes, onChange: (e) => setFRes(e.target.value) },
              h("option", { value: "" }, "Todo resultado"),
              h("option", { value: "Aceptada" }, "Aceptada"),
              h("option", { value: "Esperando Confirmacion" }, "Esperando Confirmacion"),
              h("option", { value: "Rechazo" }, "Rechazo"),
              h("option", { value: "__none" }, "Sin resultado"))),
          h("div", { className: "kp-chips" },
            SEED.rubros.map((r) => {
              const on = activeRubros.indexOf(r) >= 0;
              const col = SEED.rubro_fill && SEED.rubro_fill[r] ? "#" + SEED.rubro_fill[r] : "#888";
              return h("div", { key: r, className: "kp-chip" + (on ? " on" : ""), onClick: () => toggleRubro(r) },
                h("span", { className: "kp-cd", style: { background: col } }),
                (RUBRO_ICON[r] || "") + " " + r);
            }))),

        // Tabla
        h("div", { className: "kp-tablecard" },
          h("div", { className: "kp-thead" },
            h("div", null), h("div", null, "Empresa"), h("div", null, "Tomador de decisión"), h("div", null, "Contacto"),
            h("div", null, "Estado"), h("div", null, "Resultado"), h("div", null, "Responsable"), h("div", null, "Últ. contacto")),
          filtered.length
            ? filtered.map((p) => Row(p))
            : h("div", { style: { padding: "24px", textAlign: "center", color: "var(--kp-mut)" } }, "Sin resultados con los filtros actuales.")),

        h("footer", { className: "kp-footer" }, "Powered by ", h("b", null, "KIMOS"), " · FIGIT — documento editable — tus cambios se guardan en este navegador")
      ),

      // Modal Equipo
      equipoOpen && h("div", { className: "kp-modal open", onClick: (e) => { if (e.target === e.currentTarget) setEquipoOpen(false); } },
        h("div", { className: "kp-box" },
          h("h3", null, "\u{1F465} Equipo (editable)"),
          equipoDraft.map((t, i) => h("div", { className: "kp-erow", key: i },
            h("input", { value: t, onChange: (e) => setEquipoDraft((xs) => xs.map((v, j) => (j === i ? e.target.value : v))) }),
            h("button", { className: "kp-btn", onClick: () => setEquipoDraft((xs) => (xs.length <= 1 ? xs : xs.filter((_, j) => j !== i))) }, "✕"))),
          h("button", { className: "kp-btn", onClick: () => setEquipoDraft((xs) => xs.concat(["Nuevo responsable"])) }, "+ Agregar responsable"),
          h("div", { style: { marginTop: "14px", display: "flex", gap: "8px", justifyContent: "flex-end" } },
            h("button", { className: "kp-btn", onClick: () => setEquipoOpen(false) }, "Cerrar"),
            h("button", { className: "kp-btn kp-primary", onClick: saveEquipo }, "Guardar")))),

      // Modal Alta manual de prospecto
      addOpen && h("div", { className: "kp-modal open", onClick: (e) => { if (e.target === e.currentTarget) setAddOpen(false); } },
        h("div", { className: "kp-box kp-box-lg" },
          h("h3", null, "➕ Nuevo prospecto"),
          h("p", { className: "kp-modal-sub" }, "Se añade a tu lista y se guarda en este navegador. Sólo la empresa es obligatoria."),
          h("div", { className: "kp-form" },
            Field("Empresa *", "empresa"),
            h("label", { className: "kp-flbl" }, "Rubro",
              h("select", { value: (addDraft && addDraft.rubro) || "", onChange: (e) => setField("rubro", e.target.value) },
                h("option", { value: "" }, "— Selecciona un rubro —"),
                SEED.rubros.map((r) => h("option", { key: r, value: r }, r)))),
            Field("Tomador de decisión", "persona"),
            Field("Cargo", "cargo"),
            Field("Teléfono", "telefono"),
            Field("Correo", "correo"),
            Field("LinkedIn (URL)", "linkedin_url")),
          Area("Descripción", "descripcion"),
          Area("Posible problemática", "problematica"),
          Area("Propuesta FIGIT + KIMOS", "propuesta"),
          Area("Notas / próximo paso", "notas"),
          h("div", { style: { marginTop: "14px", display: "flex", gap: "8px", justifyContent: "flex-end" } },
            h("button", { className: "kp-btn", onClick: () => setAddOpen(false) }, "Cancelar"),
            h("button", { className: "kp-btn kp-primary", onClick: saveAdd }, "Guardar prospecto")))),

      // Modal Editar ficha (todos los campos de contacto, incl. prospectos base)
      editId != null && h("div", { className: "kp-modal open", onClick: (e) => { if (e.target === e.currentTarget) setEditId(null); } },
        h("div", { className: "kp-box kp-box-lg" },
          h("h3", null, "✏️ Editar ficha — " + ((editDraft && editDraft.empresa) || "")),
          h("p", { className: "kp-modal-sub" }, "Actualiza aquí los datos que investigues (contacto, cargo, teléfono, correo, LinkedIn…). Se guardan al instante en este navegador."),
          h("div", { className: "kp-fotorow kp-fotorow-modal" },
            Avatar({ ...(editDraft || {}), id: editId }, 64),
            h("div", { className: "kp-fotoinfo" },
              h("div", { className: "kp-fotobtns" },
                h("button", { className: "kp-btn kp-mini2", onClick: () => pickFoto("edit") }, "\u{1F4F7} Subir foto"),
                (editDraft && editDraft.foto) ? h("button", { className: "kp-btn kp-mini2 kp-danger", onClick: () => setEditDraft((d) => ({ ...(d || {}), foto: "" })) }, "✕ Quitar") : null),
              h("label", { className: "kp-flbl", style: { marginBottom: 0 } }, "URL de imagen (ej. foto de su LinkedIn)",
                h("input", {
                  placeholder: "https://media.licdn.com/…",
                  value: (editDraft && editDraft.foto && !String(editDraft.foto).startsWith("data:")) ? editDraft.foto : "",
                  onChange: (e) => setEditDraft((d) => ({ ...(d || {}), foto: e.target.value })),
                })))),
          h("div", { className: "kp-form" },
            EField("Empresa", "empresa"),
            h("label", { className: "kp-flbl" }, "Rubro",
              h("select", { value: (editDraft && editDraft.rubro) || "", onChange: (e) => setEditDraft((d) => ({ ...(d || {}), rubro: e.target.value })) },
                h("option", { value: (editDraft && editDraft.rubro) || "" }, (editDraft && editDraft.rubro) || "— Selecciona —"),
                SEED.rubros.filter((r) => r !== ((editDraft && editDraft.rubro) || "")).map((r) => h("option", { key: r, value: r }, r)))),
            EField("Tomador de decisión", "persona"),
            EField("Cargo", "cargo"),
            EField("Teléfono", "telefono"),
            EField("Correo", "correo"),
            EField("LinkedIn (URL)", "linkedin_url")),
          EArea("Descripción", "descripcion"),
          EArea("Posible problemática", "problematica"),
          EArea("Propuesta FIGIT + KIMOS", "propuesta"),
          EArea("Notas base", "notas"),
          h("div", { style: { marginTop: "14px", display: "flex", gap: "8px", justifyContent: "flex-end" } },
            h("button", { className: "kp-btn", onClick: () => setEditId(null) }, "Cancelar"),
            h("button", { className: "kp-btn kp-primary", onClick: saveEdit }, "Guardar cambios"))))
    );

    // Helpers de formulario (edición de ficha)
    function EField(label, key) {
      return h("label", { className: "kp-flbl" }, label,
        h("input", { value: (editDraft && editDraft[key]) || "", onChange: (e) => setEditDraft((d) => ({ ...(d || {}), [key]: e.target.value })) }));
    }
    function EArea(label, key) {
      return h("label", { className: "kp-flbl" }, label,
        h("textarea", { style: { minHeight: "48px" }, value: (editDraft && editDraft[key]) || "", onChange: (e) => setEditDraft((d) => ({ ...(d || {}), [key]: e.target.value })) }));
    }

    // Helpers de formulario (alta manual)
    function Field(label, key) {
      return h("label", { className: "kp-flbl" }, label,
        h("input", { value: (addDraft && addDraft[key]) || "", onChange: (e) => setField(key, e.target.value) }));
    }
    function Area(label, key) {
      return h("label", { className: "kp-flbl" }, label,
        h("textarea", { style: { minHeight: "48px" }, value: (addDraft && addDraft[key]) || "", onChange: (e) => setField(key, e.target.value) }));
    }

    // ---------- Sub-render: fila de la tabla ----------
    function Row(p) {
      const m = metaOf(store, p.id);
      const lc = lastContact(store, p.empresa);
      const nb = countBit(store, p.empresa);
      const fill = SEED.rubro_fill && SEED.rubro_fill[p.rubro] ? "#" + SEED.rubro_fill[p.rubro] : "#888";
      const open = expanded.indexOf(p.id) >= 0;
      const isCustom = customIds.has(p.id);
      const tel = p.telefono && p.telefono.indexOf("Ver") < 0
        ? h("a", { className: "kp-cbtn", title: p.telefono, href: "tel:" + p.telefono.replace(/[^0-9+]/g, ""), onClick: (e) => e.stopPropagation() }, "\u{1F4DE}")
        : null;

      const rows = [
        h("div", { className: "kp-trow", key: "r", onClick: () => toggleRow(p.id) },
          h("div", { style: { fontSize: "18px" } }, RUBRO_ICON[p.rubro] || ""),
          h("div", { className: "kp-cmp" },
            h("span", { className: "kp-cd2", style: { background: fill } }),
            h("div", null, p.empresa,
              isCustom ? h("span", { className: "kp-added" }, "añadido") : null,
              h("small", null, p.rubro + (nb ? " · " + nb + " interacc." : "")))),
          h("div", { className: "kp-per kp-per-av" },
            Avatar(p, 30),
            h("div", null, p.persona, h("small", null, p.cargo))),
          h("div", { className: "kp-contacts", onClick: (e) => e.stopPropagation() },
            h("a", { className: "kp-cbtn", title: "Escribir correo", href: "mailto:" + p.correo + "?subject=FIGIT%20+%20KIMOS%20-%20Propuesta" }, "✉️"),
            h("a", { className: "kp-cbtn", title: "Buscar en LinkedIn", href: p.linkedin_url, target: "_blank", rel: "noreferrer" }, "\u{1F4BC}"),
            tel),
          h("div", null, h("select", {
            className: "kp-mini", style: { background: ESTADO_COL[m.estado], color: "#04201d", border: "none" },
            value: m.estado, onClick: (e) => e.stopPropagation(), onChange: (e) => setMetaField(p.id, "estado", e.target.value),
          }, ESTADOS.map((e) => h("option", { key: e, value: e }, e)))),
          h("div", null, h("select", {
            className: "kp-mini", style: { background: m.resultado ? RES_COL[m.resultado] : "#0e1c30", color: m.resultado ? "#04201d" : "#9fb2cc", border: "1px solid var(--kp-line)" },
            value: m.resultado, onClick: (e) => e.stopPropagation(), onChange: (e) => setMetaField(p.id, "resultado", e.target.value),
          }, RESULTADOS.map((e) => h("option", { key: e || "none", value: e }, e ? e : "—")))),
          h("div", null, h("select", {
            className: "kp-mini", style: { background: "#0e1c30", border: "1px solid var(--kp-line)", color: "#e8eef7" },
            value: store.equipo.indexOf(m.responsable) >= 0 ? m.responsable : "Sin asignar",
            onClick: (e) => e.stopPropagation(), onChange: (e) => setMetaField(p.id, "responsable", e.target.value),
          }, store.equipo.map((t) => h("option", { key: t, value: t }, t)))),
          h("div", { style: { fontSize: "12px", color: "var(--kp-mut)", textAlign: "center" } }, lc || "—")),
      ];

      if (open) {
        const f = forms[p.id] || {};
        rows.push(h("div", { className: "kp-expand open", key: "x" },
          h("div", { className: "kp-exgrid" },
            h("div", { className: "kp-exblock" }, h("h4", null, "\u{1F4C4} Descripción"), h("p", null, p.descripcion)),
            h("div", { className: "kp-exblock" }, h("h4", null, "⚠️ Posible problemática"), h("p", null, p.problematica)),
            h("div", { className: "kp-exblock" }, h("h4", null, "\u{1F4A1} Propuesta FIGIT + KIMOS"), h("p", null, p.propuesta)),
            h("div", { className: "kp-exblock" },
              h("h4", null, "\u{1F4CC} Notas / próximo paso"),
              h("p", { className: "kp-note" }, p.notas),
              h("textarea", {
                style: { width: "100%", marginTop: "6px", minHeight: "50px" }, placeholder: "Tus notas...",
                value: m.notas || "", onClick: (e) => e.stopPropagation(), onChange: (e) => setMetaField(p.id, "notas", e.target.value),
              }))),
          h("div", { className: "kp-bit" },
            h("h4", { style: { margin: "0 0 4px", fontSize: "12px", color: "var(--kp-teal)" } }, "\u{1F4DE} BITÁCORA DE CONTACTO — " + p.empresa),
            h("div", { className: "kp-bitlist" }, BitList(p.empresa)),
            h("div", { className: "kp-bitform", onClick: (e) => e.stopPropagation() },
              h("input", { type: "date", value: f.fecha || "", onChange: (e) => setForms((mm) => ({ ...mm, [p.id]: { ...(mm[p.id] || {}), fecha: e.target.value } })) }),
              h("select", { value: f.canal || Object.keys(CANAL_ICON)[0], onChange: (e) => setForms((mm) => ({ ...mm, [p.id]: { ...(mm[p.id] || {}), canal: e.target.value } })) },
                Object.keys(CANAL_ICON).map((c) => h("option", { key: c, value: c }, c))),
              h("input", { placeholder: "Resumen / resultado de la interacción", value: f.resumen || "", onChange: (e) => setForms((mm) => ({ ...mm, [p.id]: { ...(mm[p.id] || {}), resumen: e.target.value } })) }),
              h("input", { type: "date", title: "Próximo seguimiento", value: f.proximo || "", onChange: (e) => setForms((mm) => ({ ...mm, [p.id]: { ...(mm[p.id] || {}), proximo: e.target.value } })) }),
              h("button", { className: "kp-btn kp-primary", onClick: () => addBit(p.empresa, p.id) }, "+ Registrar"))),
          h("div", { className: "kp-fotorow", onClick: (e) => e.stopPropagation() },
            Avatar(p, 72),
            h("div", { className: "kp-fotoinfo" },
              h("h4", null, "\u{1F4F7} Foto del contacto"),
              h("p", { className: "kp-tag" }, p.foto
                ? "Verifica que la imagen corresponda a la persona real antes de usarla."
                : "Sube una fotografía o pega la URL de la imagen de su LinkedIn (clic derecho sobre la foto → “Copiar dirección de la imagen”)."),
              h("div", { className: "kp-fotobtns" },
                h("button", { className: "kp-btn kp-mini2", onClick: () => pickFoto(p.id) }, "\u{1F4F7} Subir foto"),
                h("button", { className: "kp-btn kp-mini2", onClick: () => askFotoUrl(p.id, p.foto) }, "\u{1F517} URL / LinkedIn"),
                p.linkedin_url ? h("a", { className: "kp-btn kp-mini2", href: p.linkedin_url, target: "_blank", rel: "noreferrer" }, "\u{1F4BC} Abrir LinkedIn") : null,
                p.foto ? h("button", { className: "kp-btn kp-mini2 kp-danger", onClick: () => { updateProspecto(p.id, { foto: "" }); notify("info", "Foto quitada."); } }, "✕ Quitar") : null))),
          h("div", { className: "kp-rowactions", onClick: (e) => e.stopPropagation() },
            h("span", { className: "kp-tag", style: { marginRight: "auto" } }, "\u{1F50E} Investigar:"),
            researchLinks(p).map((l, j) => h("a", { key: j, className: "kp-btn kp-mini2", href: l.href, target: "_blank", rel: "noreferrer" }, l.label)),
            h("button", { className: "kp-btn", onClick: () => openEdit(p) }, "✏️ Editar ficha"),
            isCustom ? h("button", { className: "kp-btn kp-danger", onClick: () => delProspecto(p.id) }, "\u{1F5D1} Eliminar") : null)));
      }
      return h(R.Fragment, { key: p.id }, rows);
    }

    function BitList(emp) {
      const xs = store.bit.filter((b) => b.empresa === emp).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      if (!xs.length) return h("span", { className: "kp-tag" }, "Sin interacciones registradas todavía.");
      return xs.map((b, i) => h("div", { className: "kp-bititem", key: i },
        h("span", { className: "kp-bc" }, CANAL_ICON[b.canal] || "\u{1F4CC}"),
        h("div", { style: { flex: 1 } },
          h("b", null, b.fecha || "s/f"), " · " + b.canal + (b.resumen ? " — " + b.resumen : ""),
          b.proximo ? h("div", { className: "kp-tag" }, "⏰ Próximo seguimiento: " + b.proximo) : null),
        h("span", { style: { cursor: "pointer", color: "var(--kp-rojo)" }, onClick: () => delBit(emp, i) }, "✕")));
    }
  }

  // ---------- Charts (SVG/HTML puro, sin dependencias) ----------
  function Donut(segments) {
    const size = 200, stroke = 34, r = (size - stroke) / 2, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
    const total = segments.reduce((a, s) => a + s.value, 0);
    let acc = 0;
    const circles = total > 0 ? segments.map((s, i) => {
      const frac = s.value / total, dash = frac * C, off = acc; acc += dash;
      return h("circle", {
        key: i, cx, cy, r, fill: "none", stroke: s.color, strokeWidth: stroke,
        strokeDasharray: dash + " " + (C - dash), strokeDashoffset: -off,
        transform: "rotate(-90 " + cx + " " + cy + ")",
      });
    }) : [h("circle", { key: "e", cx, cy, r, fill: "none", stroke: "#1d3252", strokeWidth: stroke })];
    return h("div", { className: "kp-chartwrap" },
      h("svg", { viewBox: "0 0 " + size + " " + size, className: "kp-donut" },
        circles,
        h("text", { x: cx, y: cy - 4, textAnchor: "middle", className: "kp-donut-num" }, String(total)),
        h("text", { x: cx, y: cy + 16, textAnchor: "middle", className: "kp-donut-lbl" }, "prospectos")),
      h("div", { className: "kp-legend" },
        segments.map((s, i) => h("div", { className: "kp-leg", key: i },
          h("span", { className: "kp-cd", style: { background: s.color } }), s.label + " (" + s.value + ")"))));
  }

  function BarList(items) {
    const max = Math.max(1, ...items.map((it) => it.value));
    return h("div", { className: "kp-barlist" },
      items.map((it, i) => h("div", { className: "kp-brow", key: i },
        h("div", { className: "kp-blbl", title: it.label }, it.label),
        h("div", { className: "kp-btrack" },
          h("div", { className: "kp-bfill", style: { width: Math.max(2, it.value / max * 100) + "%", background: it.color } })),
        h("div", { className: "kp-bval" }, String(it.value)))));
  }

  function StackedBars(team, byResp) {
    const segs = [["por", "#5aa9e6", "Por Contactar"], ["con", "#2e75b6", "Contactado"], ["reu", "#9b6ad6", "Reunión"]];
    const totals = team.map((t) => { const d = byResp[t] || { por: 0, con: 0, reu: 0 }; return d.por + d.con + d.reu; });
    const max = Math.max(1, ...totals);
    return h("div", { className: "kp-barlist" },
      h("div", { className: "kp-legend", style: { marginBottom: "6px" } },
        segs.map((s) => h("div", { className: "kp-leg", key: s[0] }, h("span", { className: "kp-cd", style: { background: s[1] } }), s[2]))),
      team.map((t, i) => {
        const d = byResp[t] || { por: 0, con: 0, reu: 0 };
        return h("div", { className: "kp-brow", key: i },
          h("div", { className: "kp-blbl", title: t }, t),
          h("div", { className: "kp-btrack" },
            segs.map((s) => d[s[0]] > 0 ? h("div", {
              key: s[0], className: "kp-bseg",
              style: { width: (d[s[0]] / max * 100) + "%", background: s[1] }, title: s[2] + ": " + d[s[0]],
            }, d[s[0]]) : null)),
          h("div", { className: "kp-bval" }, String(totals[i])));
      }));
  }

  return {
    Component,
    unmount() {
      bridge.setStore = null; bridge.getStore = null;
      try {
        if (typeof unregisterAgent === "function") unregisterAgent();
        else if (unregisterAgent && typeof unregisterAgent.unregister === "function") unregisterAgent.unregister();
      } catch { /* no-op */ }
    },
  };
}
