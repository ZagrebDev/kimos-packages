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
function freshStore() {
  return { meta: {}, bit: [], equipo: DEFAULT_EQUIPO.slice() };
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
    if (ls) ls.setItem(LS_KEY, JSON.stringify({ meta: s.meta, bit: s.bit, equipo: s.equipo }));
  } catch { /* storage lleno o bloqueado */ }
}
function normalizeStore(s) {
  const out = freshStore();
  if (s && typeof s === "object") {
    if (s.meta && typeof s.meta === "object") out.meta = s.meta;
    if (Array.isArray(s.bit)) out.bit = s.bit;
    if (Array.isArray(s.equipo) && s.equipo.length) out.equipo = s.equipo;
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
    const [forms, setForms] = useState({}); // bitácora en edición por id
    const fileRef = useRef(null);
    const saveTimer = useRef(null);
    const skipSave = useRef(true);

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

    // ---------- Export / Import / Reset ----------
    const exportJSON = useCallback(() => {
      try {
        const blob = new Blob([JSON.stringify({ meta: store.meta, bit: store.bit, equipo: store.equipo }, null, 2)], { type: "application/json" });
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
        try { setStore(normalizeStore(JSON.parse(rd.result))); notify("success", "Estado importado."); }
        catch { notify("error", "Archivo inválido."); }
      };
      rd.readAsText(f);
      e.target.value = "";
    }, []);
    const resetAll = useCallback(() => {
      if (typeof window !== "undefined" && window.confirm && !window.confirm("¿Borrar todos los estados, asignaciones y bitácora guardados?")) return;
      setStore(freshStore());
      notify("info", "Estado reiniciado.");
    }, []);

    // ---------- Derivados ----------
    const P = SEED.prospectos;
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
    }, []);

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
            h("button", { className: "kp-btn", onClick: openEquipo }, "\u{1F465} Equipo"),
            h("button", { className: "kp-btn", onClick: exportJSON }, "⬇️ Exportar"),
            h("button", { className: "kp-btn", onClick: () => fileRef.current && fileRef.current.click() }, "⬆️ Importar"),
            h("input", { type: "file", ref: fileRef, accept: "application/json", style: { display: "none" }, onChange: importJSON }),
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
            BarList(SEED.rubros.map((r) => ({ label: (RUBRO_ICON[r] || "") + " " + r, value: byRubro[r] || 0, color: "#18b9ad" })))),
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
            h("button", { className: "kp-btn kp-primary", onClick: saveEquipo }, "Guardar"))))
    );

    // ---------- Sub-render: fila de la tabla ----------
    function Row(p) {
      const m = metaOf(store, p.id);
      const lc = lastContact(store, p.empresa);
      const nb = countBit(store, p.empresa);
      const fill = SEED.rubro_fill && SEED.rubro_fill[p.rubro] ? "#" + SEED.rubro_fill[p.rubro] : "#888";
      const open = expanded.indexOf(p.id) >= 0;
      const tel = p.telefono && p.telefono.indexOf("Ver") < 0
        ? h("a", { className: "kp-cbtn", title: p.telefono, href: "tel:" + p.telefono.replace(/[^0-9+]/g, ""), onClick: (e) => e.stopPropagation() }, "\u{1F4DE}")
        : null;

      const rows = [
        h("div", { className: "kp-trow", key: "r", onClick: () => toggleRow(p.id) },
          h("div", { style: { fontSize: "18px" } }, RUBRO_ICON[p.rubro] || ""),
          h("div", { className: "kp-cmp" },
            h("span", { className: "kp-cd2", style: { background: fill } }),
            h("div", null, p.empresa, h("small", null, p.rubro + (nb ? " · " + nb + " interacc." : "")))),
          h("div", { className: "kp-per" }, p.persona, h("small", null, p.cargo)),
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
              h("button", { className: "kp-btn kp-primary", onClick: () => addBit(p.empresa, p.id) }, "+ Registrar")))));
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

  return { Component };
}
