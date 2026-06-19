/**
 * Triatlón Antofagasta v2 — app instalable de Kimos (contrato AppShellV1).
 *
 * GENERADO por build.py — no editar a mano.
 * Fuente: src/totem.html + src/protocol.html (+ assets/ vía <base>).
 *
 * Kiosco del Americas Triathlon Championships Antofagasta 2026: inscripción
 * (categoría → atleta → confirmar → pago/validación → recibo), info (atletas,
 * guía, mapa, calendario) y 3 idiomas. Controlable por agente autorizado.
 */
const TOTEM_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <base href="https://raw.githubusercontent.com/ZagrebDev/kimos-packages/main/apps/triatlon-antofagasta/assets/">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Tótem Interactivo - Campeonato Panamericano de Triatlón Antofagasta 2026</title>
    
    <!-- CSS & JS Assets -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- Fonts: Montserrat -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,900&display=swap" rel="stylesheet">
    
    <!-- Leaflet CSS & JS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Montserrat"', 'sans-serif'],
                    },
                    colors: {
                        brand: {
                            navy: '#0A192F',       // Azul Petróleo
                            cyan: '#19ACB1',       // Turquesa Oficial
                            royal: '#2B57E6',      // Royal Blue del menu
                            orange: '#D67E46',     // Color primario FECHITRI
                            green: '#2C9A67',      // Color secundario FECHITRI
                        }
                    }
                }
            }
        }
    </script>

    <style>
        body {
            margin: 0;
            overflow: hidden;
            background-color: #FFFFFF;
            color: #0A192F;
            user-select: none;
            -webkit-user-select: none;
            height: 100vh;
            display: flex;
            flex-direction: column;
            font-family: 'Montserrat', sans-serif;
        }

        .screen {
            display: none;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
            width: 100%;
            height: 100%;
        }

        .screen.active {
            display: flex;
            opacity: 1;
        }

        .touch-scroll {
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
            scrollbar-color: rgba(25, 172, 177, 0.4) transparent;
        }

        .touch-scroll::-webkit-scrollbar {
            width: 14px;
        }

        .touch-scroll::-webkit-scrollbar-thumb {
            background: rgba(25, 172, 177, 0.4);
        }

        /* Custom style for Leaflet map */
        .leaflet-container {
            background: #F3F4F6 !important;
            font-family: 'Montserrat', sans-serif;
        }

        /* Keypad active effect */
        .key-btn:active {
            transform: scale(0.92);
            background-color: #19ACB1 !important;
            color: #ffffff !important;
        }

        /* Optimized rendering for long athlete lists */
        .athlete-row-item, .reg-athlete-row-item {
            content-visibility: auto;
            contain-intrinsic-size: 80px;
        }

        #screensaver {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100vh;
            z-index: 99999;
            transform: translateY(0);
            pointer-events: all;
            cursor: pointer;
            will-change: transform;
            background-color: #081225;
        }

        #screensaver img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
    </style>
</head>

<body class="touch-none text-brand-navy">

    <!-- SCREENSAVER / PROTECTOR DE PANTALLA -->
    <div id="screensaver">
        <img src="https://i.postimg.cc/PxZSGHrQ/protector-pantalla.png" alt="Protector de pantalla">
        <div class="absolute bottom-24 left-0 right-0 text-center animate-pulse">
            <span class="bg-brand-cyan text-white font-extrabold text-4xl px-16 py-8 border-4 border-white uppercase tracking-widest" id="lbl-tap-to-start">
                Toca la pantalla para comenzar
            </span>
        </div>
    </div>

    <!-- MAIN APP HEADER (Turquesa Oficial con Logos) -->
    <header class="w-full bg-brand-cyan flex-shrink-0 z-10 py-7 px-16 flex justify-between items-center shadow-lg h-[130px]">
        <div class="flex items-center gap-6 cursor-pointer" onclick="returnToHome()">
            <img src="fotos/logo.png" alt="Logo Triatlón Antofagasta 2026" class="h-20 object-contain">
            <img src="https://images.ligup2.com/eyJidWNrZXQiOiJsaWd1cC12MiIsImtleSI6InRyaWF0bG9uL3VzZXJzLzU5MjU5X2Rpc2VuX29fc2luX3RpX3R1bG9fMl8ucG5nIiwiZWRpdHMiOnsicmVzaXplIjp7IndpZHRoIjoyMDAwLCJoZWlnaHQiOjIwMDAsImZpdCI6Imluc2lkZSJ9LCJyb3RhdGUiOm51bGx9fQ=="
                 alt="Logo FECHITRI" class="h-20 object-contain">
        </div>
        
        <!-- Language Selector with Flags (Highly Visual) -->
        <div class="flex items-center bg-white/10 p-1 border border-white/20 rounded-none gap-2">
            <button onclick="changeLanguage('es')" id="btn-lang-es" class="flex items-center gap-2 px-4 py-2.5 text-sm font-black transition-all bg-white text-brand-navy rounded-none">
                <img src="banderas/CHI.svg" class="h-5 w-auto border border-gray-200">
                <span>ES</span>
            </button>
            <button onclick="changeLanguage('en')" id="btn-lang-en" class="flex items-center gap-2 px-4 py-2.5 text-sm font-black transition-all text-white hover:bg-white/25 rounded-none">
                <img src="banderas/EU.svg" class="h-5 w-auto border border-gray-200">
                <span>EN</span>
            </button>
            <button onclick="changeLanguage('pt')" id="btn-lang-pt" class="flex items-center gap-2 px-4 py-2.5 text-sm font-black transition-all text-white hover:bg-white/25 rounded-none">
                <img src="banderas/BRA.svg" class="h-5 w-auto border border-gray-200">
                <span>PT</span>
            </button>
        </div>
    </header>

    <!-- IMAGE EXPANDER MODAL OVERLAY -->
    <div id="image-modal" class="fixed inset-0 bg-brand-navy/95 hidden z-[999999] flex flex-col justify-center items-center p-8 cursor-pointer" onclick="closeImageModal()">
        <button class="absolute top-8 right-8 text-white text-5xl hover:text-brand-cyan active:scale-95 transition-all"><i class="fa-solid fa-xmark"></i></button>
        <img id="modal-img" src="" class="max-w-full max-h-[80vh] object-contain border-4 border-white shadow-2xl">
        <p class="text-white font-extrabold text-xl mt-6 uppercase tracking-wider" id="modal-caption"></p>
    </div>

    <!-- ATHLETE DETAIL MODAL OVERLAY -->
    <div id="athlete-modal" class="fixed inset-0 bg-brand-navy/90 hidden z-[99999] flex flex-col justify-center items-center p-8" onclick="closeAthleteModal(event)">
        <div class="bg-white border-4 border-brand-cyan w-full max-w-2xl rounded-none p-10 flex flex-col items-center shadow-2xl relative" onclick="event.stopPropagation()">
            <!-- Close Button -->
            <button class="absolute top-4 right-4 text-gray-400 hover:text-brand-cyan text-4xl active:scale-95 transition-all" onclick="closeAthleteModal(event)"><i class="fa-solid fa-xmark"></i></button>
            
            <!-- Modal Header / Title -->
            <span class="bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30 text-sm font-black px-6 py-2 uppercase tracking-wider mb-6" id="ath-modal-category">ELITE MEN</span>
            
            <!-- Large Image Frame -->
            <div class="w-72 h-96 overflow-hidden border-4 border-brand-cyan bg-[#E8E8E8] flex items-center justify-center shadow-lg mb-6 relative">
                <img id="ath-modal-photo" src="" alt="Athlete photo" class="w-full h-full object-cover">
            </div>
            
            <!-- Athlete Details -->
            <h3 id="ath-modal-name" class="text-4xl font-black text-brand-navy text-center mb-4 leading-tight">Bruno Festorazzi</h3>
            
            <div class="grid grid-cols-3 gap-4 w-full mt-4">
                <div class="bg-gray-50 border border-gray-200 p-4 text-center rounded-none shadow-sm flex flex-col items-center">
                    <span class="text-xs text-gray-400 uppercase font-black mb-1">Año de Nac.</span>
                    <span id="ath-modal-yob" class="text-xl font-black text-brand-navy">1997</span>
                </div>
                <div class="bg-gray-50 border border-gray-200 p-4 text-center rounded-none shadow-sm flex flex-col items-center">
                    <span class="text-xs text-gray-400 uppercase font-black mb-1">País</span>
                    <div class="flex items-center gap-1.5 mt-0.5">
                        <img id="ath-modal-flag" src="" alt="flag" class="h-4 w-auto object-contain border border-gray-200">
                        <span id="ath-modal-noc" class="text-xl font-black text-brand-navy">CHI</span>
                    </div>
                </div>
                <div class="bg-gray-50 border border-gray-200 p-4 text-center rounded-none shadow-sm flex flex-col items-center">
                    <span class="text-xs text-gray-400 uppercase font-black mb-1">Estado</span>
                    <span id="ath-modal-status" class="text-xs font-black uppercase px-2.5 py-1.5 mt-0.5 rounded-none bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">START LIST</span>
                </div>
            </div>
            
            <!-- Bottom spacing -->
            <div class="w-full mt-8 flex justify-center">
                <button onclick="closeAthleteModal(event)" class="px-8 py-3 bg-brand-navy hover:bg-brand-cyan text-white text-base font-bold rounded-none shadow active:scale-95 transition-all">
                    Cerrar Detalle
                </button>
            </div>
        </div>
    </div>

    <!-- CONTENT WRAPPER -->
    <div class="flex-grow flex flex-col w-full overflow-hidden relative h-[calc(100vh-210px)]">

        <!-- ==================== HOME SCREEN ==================== -->
        <main id="screen-home" class="screen active flex-col justify-between items-center p-12 max-w-7xl mx-auto w-full h-full">
            <div class="flex-grow flex flex-col justify-center items-center text-center w-full gap-16 mt-6">
                
                <div class="relative w-full h-[480px] bg-brand-navy rounded-none overflow-hidden border-2 border-gray-200 shadow-md flex items-center justify-center">
                    <img src="fotos/hero_background.jpg" alt="Hero Antofagasta" class="absolute inset-0 w-full h-full object-cover opacity-75">
                    <div class="relative text-center z-10 p-8">
                        <h1 class="text-6xl font-black text-white uppercase tracking-wider mb-6 leading-tight" id="home-title">
                            Campeonato Panamericano de Triatlón
                        </h1>
                        <span class="bg-brand-cyan text-white text-4xl font-black px-12 py-4 uppercase tracking-widest shadow-lg">Antofagasta 2026</span>
                    </div>
                </div>
                
                <div class="flex flex-col gap-10 w-full max-w-4xl mt-6">
                    <!-- Botón de Información -->
                    <button onclick="openInfoScreen()" class="bg-gray-50 border-4 border-gray-200 py-16 px-20 rounded-none flex items-center justify-between group hover:border-brand-cyan transition-all duration-300 shadow-lg active:scale-95 w-full">
                        <div class="flex items-center gap-10 text-left">
                            <div class="w-32 h-32 bg-brand-cyan/10 rounded-none flex items-center justify-center border-2 border-brand-cyan group-hover:bg-brand-cyan group-hover:text-white transition-all">
                                <i class="fa-solid fa-circle-info text-brand-cyan text-6xl group-hover:text-white"></i>
                            </div>
                            <div>
                                <h2 class="text-4xl font-black text-brand-navy mb-2" id="home-info-title">Información del Evento</h2>
                                <p class="text-gray-500 text-xl" id="home-info-desc">Circuitos, cronograma, alojamiento y guía oficial</p>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-400 text-4xl group-hover:text-brand-cyan transition-all mr-6"></i>
                    </button>

                    <!-- Botón de Inscripción -->
                    <button onclick="openRegisterScreen()" class="bg-gray-50 border-4 border-gray-200 py-16 px-20 rounded-none flex items-center justify-between group hover:border-brand-cyan transition-all duration-300 shadow-lg active:scale-95 w-full">
                        <div class="flex items-center gap-10 text-left">
                            <div class="w-32 h-32 bg-brand-cyan/10 rounded-none flex items-center justify-center border-2 border-brand-cyan group-hover:bg-brand-cyan group-hover:text-white transition-all">
                                <i class="fa-solid fa-user-check text-brand-cyan text-6xl group-hover:text-white"></i>
                            </div>
                            <div>
                                <h2 class="text-4xl font-black text-brand-navy mb-2" id="home-reg-title">Acreditación de Atletas</h2>
                                <p class="text-gray-500 text-xl" id="home-reg-desc">Confirma tu inscripción, realiza pagos y obtén tu código</p>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-400 text-4xl group-hover:text-brand-cyan transition-all mr-6"></i>
                    </button>
                </div>
            </div>
            
            <!-- Sponsors Section (Larger & More Prominent) -->
            <div class="w-full flex-shrink-0 mt-16 max-w-5xl">
                <p class="text-center text-base uppercase tracking-widest text-brand-navy font-black mb-6" id="home-sponsors-lbl">Sponsors Oficiales</p>
                <div class="bg-gray-50 border-2 border-gray-200 py-8 px-20 rounded-none grid grid-cols-5 items-center justify-items-center gap-10 shadow-md">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Comit%C3%A9_Ol%C3%ADmpico_de_Chile_%282014%29.svg/960px-Comit%C3%A9_Ol%C3%ADmpico_de_Chile_%282014%29.svg.png"
                         alt="COCh" class="h-32 object-contain hover:scale-105 transition-all">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/9/97/Logo_JetSmart.jpg"
                         alt="JetSmart" class="h-20 object-contain rounded-none hover:scale-105 transition-all">
                    <img src="https://statictbjcdn.s3.amazonaws.com/empresa/664627/logo_banner/banner_1683220328750.jpg"
                         alt="Sponsor" class="h-24 object-contain hover:scale-105 transition-all">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Subaru_logo_%28transparent%29.svg/1920px-Subaru_logo_%28transparent%29.svg.png"
                         alt="Subaru" class="h-18 object-contain hover:scale-105 transition-all">
                    <img src="https://www.sonda.com/tourvirtual/datacenter-kudos/skin/Image_0435F73B_2D0F_4BF4_4181_65F86A8DAC19.png?v=1611327904180"
                         alt="SONDA" class="h-18 object-contain hover:scale-105 transition-all">
                </div>
            </div>
        </main>


        <!-- ==================== INFORMATION SCREEN ==================== -->
        <main id="screen-info" class="screen flex-col w-full h-full p-8 overflow-hidden">
            <!-- Top Navigation Horizontal Bar (No Sidebars!) -->
            <div class="flex-shrink-0 flex justify-between items-stretch gap-4 border-b-2 border-gray-200 pb-4 mb-4 h-[85px]">
                <button onclick="returnToHome()" class="px-6 py-4 bg-gray-200 hover:bg-gray-300 font-extrabold text-base text-gray-700 flex items-center justify-center gap-2 active:scale-95 transition-all">
                    <i class="fa-solid fa-arrow-left"></i> <span id="lbl-back-home">Volver al Inicio</span>
                </button>
                
                <div class="flex gap-2 flex-grow justify-end">
                    <button onclick="showInfoTab('guide')" id="tab-btn-guide" class="px-6 py-4 font-black text-base transition-all rounded-none bg-brand-cyan text-white shadow-sm flex items-center gap-2">
                        <i class="fa-solid fa-book-open-reader"></i> <span id="lbl-tab-guide">Guía del Atleta</span>
                    </button>
                    <button onclick="showInfoTab('map')" id="tab-btn-map" class="px-6 py-4 font-black text-base transition-all rounded-none text-gray-600 hover:bg-gray-100 hover:text-brand-cyan flex items-center gap-2">
                        <i class="fa-solid fa-map-location-dot"></i> <span id="lbl-tab-map">Mapa de Rutas</span>
                    </button>
                    <button onclick="showInfoTab('schedule')" id="tab-btn-schedule" class="px-6 py-4 font-black text-base transition-all rounded-none text-gray-600 hover:bg-gray-100 hover:text-brand-cyan flex items-center gap-2">
                        <i class="fa-solid fa-calendar-days"></i> <span id="lbl-tab-schedule">Cronograma</span>
                    </button>
                    <button onclick="showInfoTab('athletes')" id="tab-btn-athletes" class="px-6 py-4 font-black text-base transition-all rounded-none text-gray-600 hover:bg-gray-100 hover:text-brand-cyan flex items-center gap-2">
                        <i class="fa-solid fa-users"></i> <span id="lbl-tab-athletes">Lista de Atletas</span>
                    </button>
                </div>
            </div>

            <!-- Tab Content Area (Full Width!) -->
            <div class="flex-grow bg-white border-2 border-gray-200 rounded-none overflow-hidden relative flex flex-col p-6 shadow-sm">
                
                <!-- TAB 1: Leaflet Interactive Map -->
                <div id="info-tab-map" class="info-tab hidden h-full flex flex-col gap-4">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
                        <div>
                            <h3 class="text-3xl font-black text-brand-navy" id="map-header-title">Circuitos de Competencia</h3>
                            <p class="text-sm text-gray-500" id="map-header-desc">Visualiza y filtra los trazados oficiales de las disciplinas.</p>
                        </div>
                        <!-- Map Toggles -->
                        <div class="flex items-center bg-gray-50 p-1 rounded-none border border-gray-200 flex-wrap gap-1">
                            <button onclick="toggleMapLayer('swim')" id="layer-btn-swim" class="px-5 py-2.5 rounded-none text-sm font-bold flex items-center gap-2 bg-brand-cyan/25 text-brand-cyan border border-brand-cyan/30">
                                <i class="fa-solid fa-water"></i> <span id="lbl-map-swim">Natación</span>
                            </button>
                            <button onclick="toggleMapLayer('bike')" id="layer-btn-bike" class="px-5 py-2.5 rounded-none text-sm font-bold flex items-center gap-2 bg-brand-orange/20 text-brand-orange border border-brand-orange/30">
                                <i class="fa-solid fa-bicycle"></i> <span id="lbl-map-bike">Ciclismo</span>
                            </button>
                            <button onclick="toggleMapLayer('run')" id="layer-btn-run" class="px-5 py-2.5 rounded-none text-sm font-bold flex items-center gap-2 bg-brand-green/20 text-brand-green border border-brand-green/30">
                                <i class="fa-solid fa-person-running"></i> <span id="lbl-map-run">Trote</span>
                            </button>
                            <button onclick="toggleMapLayer('zones')" id="layer-btn-zones" class="px-5 py-2.5 rounded-none text-sm font-bold flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-400">
                                <i class="fa-solid fa-compress"></i> <span id="lbl-map-zones">Zonas / Meta</span>
                            </button>
                        </div>
                    </div>
                    <div class="flex-grow rounded-none overflow-hidden border border-gray-200 relative shadow-inner" style="min-height: 480px;">
                        <div id="map" class="w-full h-full"></div>
                        <!-- Floating Map Type Toggle Button (Map Controller) -->
                        <button onclick="toggleMapType()" id="map-type-btn" class="absolute top-4 right-4 z-[1000] bg-white border-2 border-gray-300 px-5 py-3 font-black text-sm text-brand-navy shadow-md flex items-center gap-2 hover:border-brand-cyan active:scale-95 transition-all">
                            <i class="fa-solid fa-earth-americas"></i> <span id="lbl-map-type">Vista Satélite</span>
                        </button>
                    </div>
                </div>

                <!-- TAB 2: Cronograma / Schedule -->
                <div id="info-tab-schedule" class="info-tab hidden h-full flex flex-col gap-4 touch-scroll">
                    <div>
                        <h3 class="text-3xl font-black text-brand-navy" id="schedule-header-title">Cronograma Oficial</h3>
                        <p class="text-sm text-gray-500" id="schedule-header-desc">Horarios y actividades oficiales programadas para el evento.</p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <!-- Friday -->
                        <div class="bg-gray-50 border border-gray-200 rounded-none p-6 flex flex-col gap-4 shadow-sm">
                            <div class="border-b-2 border-brand-cyan pb-2">
                                <h4 class="text-xl font-bold text-brand-cyan" id="sch-day1-title">Viernes 3 de Julio</h4>
                                <p class="text-xs text-gray-500 font-bold uppercase tracking-wider">Reconocimientos y Acreditación</p>
                            </div>
                            <div class="flex flex-col gap-5">
                                <div class="flex flex-col gap-1 text-sm border-l-4 border-gray-300 pl-3">
                                    <span class="font-bold text-brand-cyan text-base">09:00 - 10:45 hrs</span>
                                    <span class="text-brand-navy font-black text-base">Familiarización Natación Para-Triatlón</span>
                                    <span class="text-xs text-gray-500"><i class="fa-solid fa-location-dot text-[10px] text-brand-cyan"></i> Balneario Municipal</span>
                                </div>
                                <div class="flex flex-col gap-1 text-sm border-l-4 border-gray-300 pl-3">
                                    <span class="font-bold text-brand-cyan text-base">13:00 - 18:00 hrs</span>
                                    <span class="text-brand-navy font-black text-base">Entrega de Kit (Grupos de Edad)</span>
                                    <span class="text-xs text-gray-500"><i class="fa-solid fa-location-dot text-[10px] text-brand-cyan"></i> Balneario Municipal</span>
                                </div>
                                <div class="flex flex-col gap-1 text-sm border-l-4 border-gray-300 pl-3">
                                    <span class="font-bold text-brand-cyan text-base">16:00 - 17:00 hrs</span>
                                    <span class="text-brand-navy font-black text-base">Charla Técnica (Elite / Junior)</span>
                                    <span class="text-xs text-gray-500"><i class="fa-solid fa-location-dot text-[10px] text-brand-cyan"></i> Hotel ENJOY</span>
                                </div>
                            </div>
                        </div>

                        <!-- Saturday -->
                        <div class="bg-gray-50 border border-gray-200 rounded-none p-6 flex flex-col gap-4 shadow-sm">
                            <div class="border-b-2 border-brand-orange pb-2">
                                <h4 class="text-xl font-bold text-brand-orange" id="sch-day2-title">Sábado 4 de Julio</h4>
                                <p class="text-xs text-gray-500 font-bold uppercase tracking-wider">Competencias Elite y Junior</p>
                            </div>
                            <div class="flex flex-col gap-5">
                                <div class="flex flex-col gap-1 text-sm border-l-4 border-gray-300 pl-3">
                                    <span class="font-bold text-brand-orange text-base">08:00 hrs</span>
                                    <span class="text-brand-navy font-black text-base">Campeonato Junior Femenino (Sprint)</span>
                                    <span class="text-xs text-gray-500"><i class="fa-solid fa-location-dot text-[10px] text-brand-orange"></i> Balneario Municipal</span>
                                </div>
                                <div class="flex flex-col gap-1 text-sm border-l-4 border-gray-300 pl-3">
                                    <span class="font-bold text-brand-orange text-base">09:45 hrs</span>
                                    <span class="text-brand-navy font-black text-base">Campeonato Junior Masculino (Sprint)</span>
                                    <span class="text-xs text-gray-500"><i class="fa-solid fa-location-dot text-[10px] text-brand-orange"></i> Balneario Municipal</span>
                                </div>
                                <div class="flex flex-col gap-1 text-sm border-l-4 border-gray-300 pl-3">
                                    <span class="font-bold text-brand-orange text-base">11:30 hrs</span>
                                    <span class="text-brand-navy font-black text-base">Campeonato Elite/U23 Femenino (Standard)</span>
                                    <span class="text-xs text-gray-500"><i class="fa-solid fa-location-dot text-[10px] text-brand-orange"></i> Balneario Municipal</span>
                                </div>
                                <div class="flex flex-col gap-1 text-sm border-l-4 border-gray-300 pl-3">
                                    <span class="font-bold text-brand-orange text-base">14:30 hrs</span>
                                    <span class="text-brand-navy font-black text-base">Campeonato Elite/U23 Masculino (Standard)</span>
                                    <span class="text-xs text-gray-500"><i class="fa-solid fa-location-dot text-[10px] text-brand-orange"></i> Balneario Municipal</span>
                                </div>
                            </div>
                        </div>

                        <!-- Sunday -->
                        <div class="bg-gray-50 border border-gray-200 rounded-none p-6 flex flex-col gap-4 shadow-sm">
                            <div class="border-b-2 border-brand-green pb-2">
                                <h4 class="text-xl font-bold text-brand-green" id="sch-day3-title">Domingo 5 de Julio</h4>
                                <p class="text-xs text-gray-500 font-bold uppercase tracking-wider">Para, Youth, AGE Groups & Relevos</p>
                            </div>
                            <div class="flex flex-col gap-5">
                                <div class="flex flex-col gap-1 text-sm border-l-4 border-gray-300 pl-3">
                                    <span class="font-bold text-brand-green text-base">07:20 hrs</span>
                                    <span class="text-brand-navy font-black text-base">Campeonato Para-Triatlón (Sprint)</span>
                                    <span class="text-xs text-gray-500"><i class="fa-solid fa-location-dot text-[10px] text-brand-green"></i> Balneario Municipal</span>
                                </div>
                                <div class="flex flex-col gap-1 text-sm border-l-4 border-gray-300 pl-3">
                                    <span class="font-bold text-brand-green text-base">10:30 hrs</span>
                                    <span class="text-brand-navy font-black text-base">Youth Masculino & Femenino (Super Sprint)</span>
                                    <span class="text-xs text-gray-500"><i class="fa-solid fa-location-dot text-[10px] text-brand-green"></i> Balneario Municipal</span>
                                </div>
                                <div class="flex flex-col gap-1 text-sm border-l-4 border-gray-300 pl-3">
                                    <span class="font-bold text-brand-green text-base">11:30 hrs</span>
                                    <span class="text-brand-navy font-black text-base">Grupos de Edad (Estándar & Sprint)</span>
                                    <span class="text-xs text-gray-500"><i class="fa-solid fa-location-dot text-[10px] text-brand-green"></i> Balneario Municipal</span>
                                </div>
                                <div class="flex flex-col gap-1 text-sm border-l-4 border-gray-300 pl-3">
                                    <span class="font-bold text-brand-green text-base">14:40 hrs</span>
                                    <span class="text-brand-navy font-black text-base">Relevos Mixtos 2x2 (Elite + Junior)</span>
                                    <span class="text-xs text-gray-500"><i class="fa-solid fa-location-dot text-[10px] text-brand-green"></i> Balneario Municipal</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TAB 3: Guía del Atleta / Athlete Guide -->
                <div id="info-tab-guide" class="info-tab h-full flex flex-col gap-4 overflow-hidden">
                    <div class="flex justify-between items-center flex-shrink-0">
                        <div>
                            <h3 class="text-3xl font-black text-brand-navy" id="guide-header-title">Guía del Atleta</h3>
                            <p class="text-sm text-gray-500" id="guide-header-desc">Información relevante de logística, alojamiento y normativas oficiales.</p>
                        </div>
                    </div>
                    
                    <!-- Inner Tabs Grid (rounded-none) -->
                    <div class="flex gap-4 border-b-2 border-gray-200 pb-2 flex-shrink-0 overflow-x-auto">
                        <button onclick="showGuideSubTab('loc')" id="guide-subbtn-loc" class="px-6 py-4 border-b-4 border-brand-cyan text-brand-cyan font-bold text-base whitespace-nowrap rounded-none">Ubicación y Clima</button>
                        <button onclick="showGuideSubTab('travel')" id="guide-subbtn-travel" class="px-6 py-4 text-gray-500 hover:text-brand-cyan font-bold text-base whitespace-nowrap rounded-none">Hospedaje y Viaje</button>
                        <button onclick="showGuideSubTab('costs')" id="guide-subbtn-costs" class="px-6 py-4 text-gray-500 hover:text-brand-cyan font-bold text-base whitespace-nowrap rounded-none">Inscripción y Costos</button>
                        <button onclick="showGuideSubTab('rules')" id="guide-subbtn-rules" class="px-6 py-4 text-gray-500 hover:text-brand-cyan font-bold text-base whitespace-nowrap rounded-none">Reglamento Técnico</button>
                    </div>
                    
                    <!-- Sub tab contents (extremely visual with official guide images) -->
                    <div class="flex-grow touch-scroll pr-2 mt-4 text-gray-700 text-sm leading-relaxed flex flex-col gap-4">
                        
                        <!-- SUB-TAB: Location -->
                        <div id="guide-sub-loc" class="guide-subtab flex flex-col md:flex-row gap-6">
                            <div class="flex-1 flex flex-col gap-4">
                                <div class="bg-gray-50 border border-gray-200 rounded-none p-6 shadow-sm">
                                    <h4 class="text-xl font-bold text-brand-navy mb-2" id="lbl-loc-title">Ubicación - Antofagasta</h4>
                                    <p class="text-base leading-relaxed">Antofagasta es una ciudad costera ubicada en el norte de Chile, entre el océano Pacífico y el vasto desierto de Atacama. La sede principal del evento estará ubicada en el <strong>Balneario Municipal de Antofagasta</strong> (Avenida República de Croacia), lugar donde se encontrará la meta, área de transición y zona de espectadores.</p>
                                </div>
                                <div class="bg-gray-50 border border-gray-200 rounded-none p-6 shadow-sm">
                                    <h4 class="text-xl font-bold text-brand-navy mb-2" id="lbl-climate-title">Clima en Julio</h4>
                                    <p class="text-base leading-relaxed">El clima en Antofagasta es de características desérticas costeras templadas. En el mes de julio (invierno austral):</p>
                                    <ul class="list-disc list-inside mt-2 flex flex-col gap-1.5 text-gray-600 text-base">
                                        <li><strong>Temperatura Máxima:</strong> ~18°C (64°F) promedio.</li>
                                        <li><strong>Temperatura Mínima:</strong> ~12-13°C (54°F) promedio.</li>
                                        <li><strong>Precipitaciones:</strong> Prácticamente nulas (~1mm de promedio mensual).</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="flex-1 border border-gray-200 bg-gray-50 rounded-none overflow-hidden relative min-h-[300px] flex items-center justify-center">
                                <img src="fotos/news_antofagasta_championship_launch.jpg" alt="Lanzamiento Oficial" class="w-full h-full object-cover">
                            </div>
                        </div>
                        
                        <!-- SUB-TAB: Travel -->
                        <div id="guide-sub-travel" class="guide-subtab hidden flex flex-col md:flex-row gap-6">
                            <div class="flex-1 flex flex-col gap-4">
                                <div class="bg-gray-50 border border-gray-200 rounded-none p-6 shadow-sm">
                                    <h4 class="text-xl font-bold text-brand-navy mb-2" id="lbl-hotel-title">Hotel Oficial</h4>
                                    <p class="text-base leading-relaxed">El hotel oficial del evento es el <strong>Hotel Enjoy Antofagasta</strong>, ubicado en <em>Av. Angamos 01455</em>. Contacto: (+56 55) 265 3000. Todas las charlas técnica presenciales se realizarán en sus dependencias.</p>
                                    <p class="mt-2 text-gray-600 text-base">Otras alternativas recomendadas: Hotel Florencia Suites & Apartments y NH Antofagasta, ubicados a pocos minutos de la sede del evento.</p>
                                </div>
                                <div class="bg-gray-50 border border-gray-200 rounded-none p-6 shadow-sm">
                                    <h4 class="text-xl font-bold text-brand-navy mb-2" id="lbl-transport-title">Transporte y Viaje</h4>
                                    <p class="text-base leading-relaxed"><strong>Por Aire:</strong> El Aeropuerto Internacional Andrés Sabella Gálvez (ANF) conecta diariamente con Santiago (2 horas de vuelo).</p>
                                    <p class="mt-2 text-base"><strong>Por Tierra:</strong> Buses interurbanos desde Santiago demoran aproximadamente entre 18 y 20 horas en recorrer la distancia.</p>
                                    <p class="mt-2 text-base"><strong>Mecánica de Bicicletas:</strong> Servicio técnico oficial a cargo de <em>MZN BIKE ART</em> (Salvador Reyes 929, Antofagasta; Tel: +56 9 6835 6012).</p>
                                </div>
                            </div>
                            <div class="flex-1 border border-gray-200 bg-gray-50 rounded-none overflow-hidden relative min-h-[300px] flex items-center justify-center">
                                <img src="fotos/news_swimming_training_pool.jpg" alt="Piscina de Entrenamiento" class="w-full h-full object-cover">
                            </div>
                        </div>

                        <!-- SUB-TAB: Costs -->
                        <div id="guide-sub-costs" class="guide-subtab hidden flex flex-col gap-4">
                            <div class="bg-gray-50 border border-gray-200 rounded-none p-6 shadow-sm">
                                <h4 class="text-xl font-bold text-brand-navy mb-2" id="lbl-costs-title">Costos de Inscripción (USD)</h4>
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                                    <div class="bg-white p-5 rounded-none text-center border border-gray-200 shadow-sm">
                                        <span class="block text-sm text-gray-500 font-bold">Elite / U23</span>
                                        <span class="text-3xl font-black text-brand-cyan">$150 USD</span>
                                    </div>
                                    <div class="bg-white p-5 rounded-none text-center border border-gray-200 shadow-sm">
                                        <span class="block text-sm text-gray-500 font-bold">Juniors</span>
                                        <span class="text-3xl font-black text-brand-cyan">$120 USD</span>
                                    </div>
                                    <div class="bg-white p-5 rounded-none text-center border border-gray-200 shadow-sm">
                                        <span class="block text-sm text-gray-500 font-bold">Youth</span>
                                        <span class="text-3xl font-black text-brand-cyan">$100 USD</span>
                                    </div>
                                    <div class="bg-white p-5 rounded-none text-center border border-gray-200 shadow-sm">
                                        <span class="block text-sm text-gray-500 font-bold">Para-Triatlón</span>
                                        <span class="text-3xl font-black text-brand-cyan">$50 USD</span>
                                    </div>
                                </div>
                                <p class="mt-4 text-sm text-gray-500">* Nota: Los grupos de edad (Age Group) tienen un costo de $150 USD + 8% de comisión por plataforma (Race Roster).</p>
                            </div>
                            <div class="bg-gray-50 border border-gray-200 rounded-none p-6 shadow-sm">
                                <h4 class="text-xl font-bold text-brand-navy mb-2" id="lbl-benefits-title">¿Qué incluye la inscripción?</h4>
                                <ul class="list-disc list-inside text-gray-600 flex flex-col gap-2 text-base leading-relaxed">
                                    <li>Recuerdo oficial del Campeonato (Souvenir oficial).</li>
                                    <li>Kit de competencia (Chip de cronometraje, dorsal, adhesivos de casco y bicicleta).</li>
                                    <li>Cupones de alimentación para el atleta.</li>
                                    <li>Medalla finisher en meta y atención médica de emergencias.</li>
                                </ul>
                            </div>
                        </div>

                        <!-- SUB-TAB: Rules (Mapas Oficiales Grandes y Ampliables!) -->
                        <div id="guide-sub-rules" class="guide-subtab hidden flex flex-col gap-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="bg-gray-50 border border-gray-200 rounded-none p-6 shadow-sm">
                                    <h4 class="text-xl font-bold text-brand-navy mb-2" id="lbl-rules-bikes">Bicicletas Permitidas (Grupos de Edad)</h4>
                                    <p class="text-base leading-relaxed">De acuerdo con la reglamentación técnica de la World Triathlon, en las categorías por grupos de edad:</p>
                                    <ul class="list-disc list-inside mt-2 text-gray-600 flex flex-col gap-2 text-base">
                                        <li><strong>Bicicletas:</strong> Solo se permiten bicicletas de ruta tradicionales.</li>
                                        <li>Las bicicletas de contrarreloj (TT / Cabras) o extensiones aerodinámicas (acoples largos o cortos) están <strong>estrictamente prohibidas</strong>.</li>
                                    </ul>
                                </div>
                                <div class="bg-gray-50 border border-gray-200 rounded-none p-6 shadow-sm">
                                    <h4 class="text-xl font-bold text-brand-navy mb-2" id="lbl-rules-helmets">Cascos y Uniformes</h4>
                                    <ul class="list-disc list-inside text-gray-600 flex flex-col gap-2 text-base leading-relaxed">
                                        <li><strong>Cascos:</strong> Solo se permiten cascos de ciclismo tradicionales. Los cascos aerodinámicos tipo gota o con viseras integradas están prohibidos.</li>
                                        <li><strong>Uniforme:</strong> Es obligatorio competir con el uniforme oficial aprobado por tu Federación Nacional.</li>
                                    </ul>
                                </div>
                            </div>
                            
                            <!-- Large clickable official maps -->
                            <div class="border-2 border-gray-200 p-8 bg-gray-50 rounded-none flex flex-col gap-6">
                                <span class="text-2xl font-black text-brand-navy text-center block py-2 border-b border-gray-200 uppercase tracking-wide">Mapas Oficiales de Circuitos</span>
                                <div class="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-2">
                                    <div class="flex flex-col items-center bg-white p-4 border-2 border-gray-200 cursor-pointer hover:border-brand-cyan transition-all shadow-md active:scale-95" onclick="openImageModal('fotos/guia_venue.png', 'Sede del Evento')">
                                        <span class="text-lg font-black text-brand-cyan mb-3">Sede del Evento</span>
                                        <div class="w-full h-56 flex items-center justify-center overflow-hidden bg-white">
                                            <img src="fotos/guia_venue.png" class="w-full h-full object-contain">
                                        </div>
                                    </div>
                                    <div class="flex flex-col items-center bg-white p-4 border-2 border-gray-200 cursor-pointer hover:border-brand-cyan transition-all shadow-md active:scale-95" onclick="openImageModal('fotos/guia_swim.png', 'Circuito de Natación (Swim)')">
                                        <span class="text-lg font-black text-brand-cyan mb-3">Natación</span>
                                        <div class="w-full h-56 flex items-center justify-center overflow-hidden bg-white">
                                            <img src="fotos/guia_swim.png" class="w-full h-full object-contain">
                                        </div>
                                    </div>
                                    <div class="flex flex-col items-center bg-white p-4 border-2 border-gray-200 cursor-pointer hover:border-brand-cyan transition-all shadow-md active:scale-95" onclick="openImageModal('fotos/guia_bike.png', 'Circuito de Ciclismo (Bike)')">
                                        <span class="text-lg font-black text-brand-orange mb-3">Ciclismo</span>
                                        <div class="w-full h-56 flex items-center justify-center overflow-hidden bg-white">
                                            <img src="fotos/guia_bike.png" class="w-full h-full object-contain">
                                        </div>
                                    </div>
                                    <div class="flex flex-col items-center bg-white p-4 border-2 border-gray-200 cursor-pointer hover:border-brand-cyan transition-all shadow-md active:scale-95" onclick="openImageModal('fotos/guia_run.png', 'Circuito de Trote (Run)')">
                                        <span class="text-lg font-black text-brand-green mb-3">Trote</span>
                                        <div class="w-full h-56 flex items-center justify-center overflow-hidden bg-white">
                                            <img src="fotos/guia_run.png" class="w-full h-full object-contain">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TAB 1: Leaflet Interactive Map (loaded on demand) -->
                <!-- TAB 2: Cronograma / Schedule (already above) -->

                <!-- TAB 4: Lista de Atletas (Start Lists Grid) -->
                <div id="info-tab-athletes" class="info-tab hidden h-full flex flex-col gap-4 overflow-hidden">
                    
                    <!-- Page 1: Categories Selector Grid -->
                    <div id="athletes-categories-grid-page" class="h-full flex flex-col gap-4">
                        <div class="flex-shrink-0">
                            <h3 class="text-3xl font-black text-brand-navy" id="athletes-header-title">Lista de Atletas</h3>
                            <p class="text-sm text-gray-500" id="athletes-header-desc">Revisa los competidores oficiales registrados por categoría.</p>
                        </div>
                        <div id="athletes-categories-buttons-list" class="flex-grow grid grid-cols-2 md:grid-cols-3 gap-4 touch-scroll pr-1 mt-2">
                            <!-- Populated dynamically with large touch buttons of active categories -->
                        </div>
                    </div>

                    <!-- Page 2: Athletes List Page (Full Width, Large Touch Cards) -->
                    <div id="athletes-list-page" class="hidden h-full flex flex-col gap-4 overflow-hidden">
                        <div class="flex-shrink-0 flex justify-between items-center border-b border-gray-200 pb-3">
                            <div class="flex items-center gap-3">
                                <button onclick="backToCategoriesGrid()" class="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-sm font-extrabold text-brand-navy rounded-none shadow-sm flex items-center gap-1.5 active:scale-95">
                                    <i class="fa-solid fa-arrow-left"></i> <span id="btn-back-cats">Cambiar Categoría</span>
                                </button>
                                <h3 id="athletes-category-title" class="text-2xl font-black text-brand-navy ml-2">Elite Men</h3>
                            </div>
                        </div>
                        
                        <!-- Single column full-width scrolling list (Super Fast, Touch Friendly!) -->
                        <div id="athletes-scroll-list" class="flex-grow touch-scroll flex flex-col gap-3 pr-1">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                    
                </div>

            </div>
        </main>


        <!-- ==================== REGISTRATION SCREEN ==================== -->
        <main id="screen-register" class="screen flex-col w-full h-full p-8 overflow-hidden">
            <!-- Top Step Progress Bar & Cancel Button (Full Width layout, no sidebars!) -->
            <div class="flex-shrink-0 flex justify-between items-stretch gap-4 border-b-2 border-gray-200 pb-4 mb-4 h-[85px]">
                <button onclick="cancelRegistration()" class="px-6 py-4 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 font-extrabold text-base flex items-center justify-center gap-2 active:scale-95 transition-all">
                    <i class="fa-solid fa-xmark"></i> <span id="lbl-cancel-reg">Cancelar</span>
                </button>
                
                <!-- Horizontal Steps Indicator -->
                <div class="flex flex-grow justify-end items-center gap-8 px-6">
                    <div id="step-ind-1" class="flex items-center gap-3 border-l-4 border-brand-cyan pl-3 text-brand-navy font-extrabold">
                        <span class="w-9 h-9 bg-brand-cyan flex items-center justify-center text-sm text-white rounded-none font-black shadow-sm">1</span>
                        <span id="ind-step1" class="text-base uppercase tracking-wider">Categoría</span>
                    </div>
                    <div id="step-ind-2" class="flex items-center gap-3 border-l-4 border-gray-200 pl-3 text-gray-400 font-extrabold">
                        <span class="w-9 h-9 bg-gray-100 border border-gray-200 flex items-center justify-center text-sm text-gray-500 rounded-none font-black">2</span>
                        <span id="ind-step2" class="text-base uppercase tracking-wider">Buscar Atleta</span>
                    </div>
                    <div id="step-ind-3" class="flex items-center gap-3 border-l-4 border-gray-200 pl-3 text-gray-400 font-extrabold">
                        <span class="w-9 h-9 bg-gray-100 border border-gray-200 flex items-center justify-center text-sm text-gray-500 rounded-none font-black">3</span>
                        <span id="ind-step3" class="text-base uppercase tracking-wider">Confirmar</span>
                    </div>
                </div>
            </div>

            <!-- Active Step Panel (Full Width!) -->
            <div class="flex-grow min-h-0 bg-white border-2 border-gray-200 rounded-none p-6 relative flex flex-col overflow-hidden shadow-sm">
                
                <!-- STEP 1: Select Category -->
                <div id="reg-step-category" class="reg-step flex flex-col h-full gap-4">
                    <div>
                        <h3 class="text-3xl font-black text-brand-navy" id="step1-header-title">Paso 1: Selecciona tu Categoría</h3>
                        <p class="text-sm text-gray-500" id="step1-header-desc">Toca sobre tu categoría deportiva para continuar con la acreditación.</p>
                    </div>
                    <div id="reg-categories-grid" class="flex-grow touch-scroll grid grid-cols-2 md:grid-cols-3 gap-4 pr-1 mt-2">
                        <!-- Populated dynamically -->
                    </div>
                </div>

                <!-- STEP 2: Search and Select Athlete (Fully stacked portrait touch design, keyboard at bottom) -->
                <div id="reg-step-search" class="reg-step hidden flex-col h-full gap-3 overflow-hidden">
                    <div class="flex-shrink-0 flex justify-between items-center border-b border-gray-200 pb-2">
                        <div class="flex items-center gap-3">
                            <button onclick="goToStep(1)" class="px-5 py-3 bg-gray-100 border border-gray-200 text-sm font-bold text-brand-navy rounded-none active:scale-95 transition-all flex items-center gap-1.5">
                                <i class="fa-solid fa-chevron-left"></i> <span id="lbl-change-cat">Cambiar Categoría</span>
                            </button>
                            <div class="ml-2">
                                <h3 class="text-3xl font-black text-brand-navy" id="step2-header-title">Paso 2: Busca tu Nombre</h3>
                                <p class="text-sm text-gray-500" id="step2-header-desc">Busca tu nombre en la lista.</p>
                            </div>
                        </div>
                        <div class="w-96 relative">
                            <input type="text" id="reg-search-input" placeholder="Escribe tu nombre o apellido..." class="bg-gray-50 border-2 border-gray-200 text-brand-navy rounded-none pl-12 pr-4 py-3 font-bold text-base focus:outline-none focus:border-brand-cyan w-full" readonly>
                            <i class="fa-solid fa-keyboard absolute left-4 top-4 text-gray-400 text-lg"></i>
                        </div>
                    </div>

                    <!-- Touch portrait stack: upper list (fixed height, scrolls), lower keyboard (fits at bottom) -->
                    <div class="flex-grow flex flex-col gap-4 overflow-hidden relative min-h-0">
                        <!-- Match List (flex-grow area to prevent keyboard shifting) -->
                        <div class="flex-grow min-h-0 bg-gray-50 border border-gray-200 rounded-none p-4 flex flex-col overflow-hidden">
                            <div id="reg-search-results" class="flex-grow touch-scroll flex flex-col gap-4 pr-1">
                                <!-- Populated dynamically -->
                            </div>
                        </div>
                        
                        <!-- Virtual On-screen Keyboard (fixed height at bottom) -->
                        <div class="flex-shrink-0 p-5 bg-gray-100 border-t border-gray-200 rounded-none w-full h-[460px] flex flex-col justify-center">
                            <div id="keyboard-container" class="flex flex-col gap-3.5 w-full max-w-6xl mx-auto">
                                <!-- Custom QWERTY layout populated by JS -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- STEP 3: Athlete Confirmation details -->
                <div id="reg-step-confirm" class="reg-step hidden flex flex-col h-full gap-4 touch-scroll">
                    <div class="flex-shrink-0 flex justify-between items-center">
                        <div>
                            <h3 class="text-3xl font-black text-brand-navy" id="step3-header-title">Paso 3: Confirma tu Identidad</h3>
                            <p class="text-sm text-gray-500" id="step3-header-desc">Verifica que tus datos y categoría estén correctos.</p>
                        </div>
                        <button onclick="goToStep(2)" class="px-5 py-3 bg-gray-100 border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-200 rounded-none active:scale-95 transition-all flex items-center gap-1">
                            <i class="fa-solid fa-chevron-left"></i> <span id="lbl-change-athlete">Volver al Buscador</span>
                        </button>
                    </div>
                    
                    <div class="flex-grow flex flex-col md:flex-row items-center justify-center gap-8 mt-2" id="confirm-details-container">
                        <!-- Populated dynamically -->
                    </div>
                </div>

                <!-- STEP 4: POS payment / checkout simulation -->
                <div id="reg-step-checkout" class="reg-step hidden flex flex-col justify-center items-center h-full max-w-2xl mx-auto">
                    <div class="bg-gray-50 border-2 border-gray-200 w-full rounded-none p-10 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
                        <div class="w-24 h-24 bg-brand-cyan/10 rounded-none flex items-center justify-center mb-6 border border-brand-cyan/30">
                            <i class="fa-solid fa-credit-card text-brand-cyan text-5xl"></i>
                        </div>
                        <h3 class="text-3xl font-black text-brand-navy mb-2" id="pos-title">Pago de Inscripción</h3>
                        <p class="text-gray-500 mb-6 text-lg" id="pos-desc">Monto total a transferir por inscripción extranjera.</p>
                        
                        <div class="bg-white border border-gray-200 py-4 px-8 rounded-none mb-8 shadow-sm">
                            <span class="text-xs uppercase tracking-widest text-gray-400 font-bold block mb-1">Monto</span>
                            <span class="text-4xl font-black text-brand-cyan">$50.00 USD</span>
                        </div>

                        <button onclick="startPOSSimulation()" class="bg-brand-cyan text-white font-extrabold py-5 px-12 rounded-none text-2xl shadow-md flex items-center justify-center gap-3 active:scale-95 transition-all w-full max-w-md">
                            <i class="fa-solid fa-square-check"></i> <span id="btn-pay-pos">PAGAR $50 USD</span>
                        </button>
                    </div>
                </div>

                <!-- STEP 5: POS Processing Screen -->
                <div id="reg-step-processing" class="reg-step hidden flex flex-col justify-center items-center h-full">
                    <div class="bg-gray-50 border border-gray-200 w-full max-w-lg rounded-none p-12 flex flex-col items-center text-center shadow-lg">
                        <div class="relative w-32 h-32 mb-8">
                            <div class="absolute inset-0 rounded-full border-8 border-gray-200"></div>
                            <div class="absolute inset-0 rounded-full border-8 border-brand-cyan border-t-transparent animate-spin"></div>
                            <div class="absolute inset-0 flex items-center justify-center">
                                <i class="fa-solid fa-wifi text-4xl text-brand-cyan animate-pulse"></i>
                            </div>
                        </div>
                        <h3 class="text-3xl font-black text-brand-navy mb-4" id="pos-sim-title">Procesando...</h3>
                        <p class="text-xl text-gray-500 font-semibold mb-2" id="pos-sim-step">Conectando con la terminal POS...</p>
                        <p class="text-sm text-gray-400" id="pos-sim-instruction">Por favor, acerque o inserte su tarjeta en el lector POS.</p>
                    </div>
                </div>

                <!-- STEP 6: Success / Receipt Screen (FIXED - No Auto-Redirect) -->
                <div id="reg-step-success" class="reg-step hidden flex flex-col justify-center items-center h-full p-6">
                    <div class="bg-white border-[6px] border-brand-cyan w-full max-w-4xl rounded-none p-10 flex flex-col items-center shadow-2xl relative">
                        
                        <!-- Digital Passport Header (Very Bold and Prominent) -->
                        <div class="w-full bg-brand-cyan text-white py-5 px-8 rounded-none mb-8 flex justify-between items-center shadow-sm">
                            <div class="flex flex-col text-left">
                                <span class="font-extrabold text-2xl tracking-wider uppercase">Credencial de Acreditación</span>
                                <span class="text-xs font-semibold tracking-widest text-white/80">CAMPEONATO PANAMERICANO DE TRIATLÓN ANTOFAGASTA 2026</span>
                            </div>
                            <div class="flex items-center gap-2 bg-white/20 py-2 px-4 border border-white/20">
                                <i class="fa-solid fa-id-badge text-xl"></i>
                                <span class="text-xs font-black uppercase tracking-wider">Pase Oficial</span>
                            </div>
                        </div>
                        
                        <!-- Credencial Core Info (Two columns split: left is photo, right is athlete data) -->
                        <div class="w-full grid grid-cols-1 md:grid-cols-2 gap-10 items-stretch mb-8 border-b border-gray-200 pb-8">
                            <!-- Left: Large Portrait photo -->
                            <div class="flex justify-center items-center">
                                <div id="receipt-photo-container" class="w-72 h-96 overflow-hidden border-4 border-brand-cyan bg-[#E8E8E8] flex items-center justify-center flex-shrink-0 shadow-lg relative">
                                    <!-- Rendered dynamically -->
                                </div>
                            </div>
                            
                            <!-- Right: Name, Category, NOC and Status -->
                            <div class="flex flex-col justify-between text-left py-1">
                                <div class="flex flex-col gap-2">
                                    <span class="text-xs text-gray-400 uppercase font-black tracking-widest">ATLETA REGISTRADO</span>
                                    <h4 id="receipt-name" class="font-black text-4xl text-brand-navy leading-tight">Bruno Festorazzi</h4>
                                    <span id="receipt-category" class="font-extrabold text-2xl text-brand-cyan uppercase tracking-wider">ELITE MEN</span>
                                </div>
                                
                                <div class="flex flex-col gap-3 mt-4">
                                    <!-- NOC Card -->
                                    <div class="flex items-center gap-3">
                                        <span class="text-sm text-gray-500 font-extrabold uppercase" id="lbl-receipt-noc-text">País:</span>
                                        <span id="receipt-noc" class="font-black text-lg text-gray-700 bg-gray-100 border border-gray-200 px-4 py-1.5 rounded-none">CHI</span>
                                        <span id="receipt-status" class="text-sm text-brand-green font-black uppercase bg-brand-green/10 border border-brand-green/20 px-4 py-1.5 rounded-none">Validado</span>
                                    </div>
                                </div>

                                <!-- Accreditation Code -->
                                <div class="bg-gray-50 border border-gray-200 p-5 rounded-none flex flex-col justify-center items-center shadow-inner mt-6">
                                    <span class="text-xs text-gray-400 uppercase font-black tracking-wider block mb-1" id="lbl-receipt-code">Código de Acreditación</span>
                                    <span id="receipt-code" class="text-5xl font-black text-brand-orange tracking-widest font-mono">A-25</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- QR Code for Retrieval & Instructions -->
                        <div class="flex flex-col items-center gap-4 w-full mb-8">
                            <div class="bg-white border-2 border-gray-200 p-4 rounded-none shadow-md flex justify-center items-center">
                                <img id="receipt-qr" src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=REGISTERED" alt="QR Code" class="w-40 h-40">
                            </div>
                            <p class="text-sm text-gray-500 font-bold max-w-xl text-center leading-relaxed" id="lbl-receipt-instr">Presenta este código QR en el módulo de acreditación para retirar tu pulsera de seguridad y kit de competencia.</p>
                        </div>

                        <!-- Hidden translation targets to prevent JS crash -->
                        <span id="success-title" class="hidden"></span>
                        <span id="success-desc" class="hidden"></span>
                        <span id="success-countdown" class="hidden"></span>

                        <button onclick="finishRegistration()" class="w-full bg-brand-navy hover:bg-brand-cyan text-white font-extrabold py-5 rounded-none text-xl shadow-md active:scale-95 transition-all">
                            <span id="btn-success-finish">Volver al Inicio</span>
                        </button>
                    </div>
                </div>

            </div>
        </main>

    </div>

    <!-- FOOTER PRINCIPAL (Turquesa, rectangular) -->
    <footer class="text-center py-6 flex-shrink-0 bg-brand-cyan text-white z-10 flex justify-between items-center px-12 rounded-none h-[80px]">
        <div class="text-white/80 text-xs font-bold" id="lbl-footer-copyright">
            © 2026 FECHITRI - Copa Panamericana de Triatlón Antofagasta
        </div>
        <div class="flex items-center gap-3">
            <span class="text-sm text-white/80 font-bold">Powered by</span>
            <div class="flex items-center gap-2">
                <img src="https://kimos.dev/assets/kimos-icon-DId6xZgX.png" alt="Kimos Icon" class="h-11 filter brightness-0 invert">
                <img src="https://kimos.dev/assets/kimos-full-MKfpXWN8.png" alt="Kimos Logo" class="h-8 filter brightness-0 invert">
            </div>
        </div>
    </footer>

    <!-- TRANSLATIONS & LOGIC SCRIPT -->
    <script>
        // Database Embedded Variables
        const PARTICIPANTES_DATA = {"event_id": 195267, "event_name": "2026 Americas Triathlon Championships Antofagasta", "start_lists": [{"program_id": 679129, "name": "Elite Men", "gender": "male", "date": "2026-07-04", "details": {"prog_id": 679129, "event_id": 195267, "prog_name": "Elite Men", "is_race": true, "prog_date": "2026-07-04", "prog_date_utc": "2026-07-04", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "male", "prog_min_age": 15, "prog_max_age": null, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 953822, "program_id": 679129, "athlete_id": 101578, "athlete_full_name": "Bruno Festorazzi", "athlete_slug": "bruno-festorazzi", "athlete_profile_image": null, "athlete_yob": 1997, "athlete_noc": "URU", "athlete_flag_circle": "banderas/URU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/101578/bruno-festorazzi", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/87f61897-2665-4b32-8c7c-b25eb3bcb90a"}, {"entry_id": 952072, "program_id": 679129, "athlete_id": 56054, "athlete_full_name": "Ramón Armando Matute", "athlete_slug": "ramon-armando-matute", "athlete_profile_image": "fotos/ramon-armando-matute_56054.jpg", "athlete_yob": 1994, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/56054/ramon-armando-matute", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/26d03b85-da32-4d59-923f-4e4a20c1b6f7", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 952073, "program_id": 679129, "athlete_id": 39560, "athlete_full_name": "Juan Jose Andrade Figueroa", "athlete_slug": "juan-jose-andrade-figueroa", "athlete_profile_image": "fotos/juan-jose-andrade-figueroa_39560.jpg", "athlete_yob": 1993, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/39560/juan-jose-andrade-figueroa", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/450ad27f-97c6-45af-9aa6-e032d4f4acc8", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 952131, "program_id": 679129, "athlete_id": 32501, "athlete_full_name": "Brian Moya", "athlete_slug": "brian-moya", "athlete_profile_image": "fotos/brian-moya_32501.jpg", "athlete_yob": 1993, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/32501/brian-moya", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/4aa3099c-b600-4119-8fc7-9419ea5c0427", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 952553, "program_id": 679129, "athlete_id": 136616, "athlete_full_name": "Tadeo Baruffato", "athlete_slug": "tadeo-baruffato", "athlete_profile_image": null, "athlete_yob": 2002, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/136616/tadeo-baruffato", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 952779, "program_id": 679129, "athlete_id": 98198, "athlete_full_name": "Chris Gregor", "athlete_slug": "chris-gregor", "athlete_profile_image": null, "athlete_yob": 1999, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/98198/chris-gregor", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 953151, "program_id": 679129, "athlete_id": 167921, "athlete_full_name": "Santiago Sierra", "athlete_slug": "santiago-sierra", "athlete_profile_image": null, "athlete_yob": 2001, "athlete_noc": "URU", "athlete_flag_circle": "banderas/URU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/167921/santiago-sierra", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/87f61897-2665-4b32-8c7c-b25eb3bcb90a"}, {"entry_id": 953271, "program_id": 679129, "athlete_id": 124906, "athlete_full_name": "Matias Sebastian Bravo Delgado", "athlete_slug": "matias-sebastian-bravo-delgado", "athlete_profile_image": null, "athlete_yob": 2002, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/124906/matias-sebastian-bravo-delgado", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 953722, "program_id": 679129, "athlete_id": 123751, "athlete_full_name": "Arturo Salinas", "athlete_slug": "arturo-salinas", "athlete_profile_image": "fotos/arturo-salinas_123751.jpg", "athlete_yob": 2003, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/123751/arturo-salinas", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/07d7b1d7-5a9a-48d0-a31c-82260fba00e0", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 953723, "program_id": 679129, "athlete_id": 143294, "athlete_full_name": "Brener Valencia Nuñez", "athlete_slug": "brener-valencia-nunez", "athlete_profile_image": null, "athlete_yob": 2001, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/143294/brener-valencia-nunez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 952070, "program_id": 679129, "athlete_id": 112754, "athlete_full_name": "Gabriel Terán Carvajal", "athlete_slug": "gabriel-teran-carvajal", "athlete_profile_image": "fotos/gabriel-teran-carvajal_112754.jpg", "athlete_yob": 2001, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/112754/gabriel-teran-carvajal", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/e0775f94-91a3-434d-9880-6a0c0d323aef", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 954124, "program_id": 679129, "athlete_id": 79840, "athlete_full_name": "Ivan Anzaldo", "athlete_slug": "ivan-anzaldo", "athlete_profile_image": "fotos/ivan-anzaldo_79840.jpg", "athlete_yob": 1998, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/79840/ivan-anzaldo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/1469e738-a348-4e0e-bb09-ff846b4442a3", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 954265, "program_id": 679129, "athlete_id": 111669, "athlete_full_name": "Zach Leachman", "athlete_slug": "zach-leachman", "athlete_profile_image": "fotos/zach-leachman_111669.jpg", "athlete_yob": 2001, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/111669/zach-leachman", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/aa7e780e-553d-4f06-b14b-b6cad6ab1de2", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 954336, "program_id": 679129, "athlete_id": 79730, "athlete_full_name": "Tyler Smith", "athlete_slug": "tyler-smith", "athlete_profile_image": "fotos/tyler-smith_79730.jpg", "athlete_yob": 1998, "athlete_noc": "BER", "athlete_flag_circle": "banderas/BER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/79730/tyler-smith", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/94608f19-5382-409d-9e8f-e3c09bf4c34f", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f63e3d99-01be-4fd7-b687-345ca1b12e9c"}, {"entry_id": 954770, "program_id": 679129, "athlete_id": 103482, "athlete_full_name": "Alejandro Rodriguez Diez", "athlete_slug": "alejandro-rodriguez-diez", "athlete_profile_image": null, "athlete_yob": 2001, "athlete_noc": "CUB", "athlete_flag_circle": "banderas/CUB.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/103482/alejandro-rodriguez-diez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8d53277f-e4aa-412d-9518-ab1b83741efa"}, {"entry_id": 954796, "program_id": 679129, "athlete_id": 103889, "athlete_full_name": "Alvaro Campos Solano", "athlete_slug": "alvaro-campos-solano", "athlete_profile_image": "fotos/alvaro-campos-solano_103889.jpg", "athlete_yob": 2000, "athlete_noc": "CRC", "athlete_flag_circle": "banderas/CRC.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/103889/alvaro-campos-solano", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/c853d66f-3353-40b0-a325-188dd951ed1f", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/addc5f8b-a19f-400c-a94c-fbd2674f2070"}, {"entry_id": 954797, "program_id": 679129, "athlete_id": 103109, "athlete_full_name": "David Hernandez Muñoz", "athlete_slug": "david-hernandez-munoz", "athlete_profile_image": null, "athlete_yob": 2000, "athlete_noc": "CRC", "athlete_flag_circle": "banderas/CRC.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/103109/david-hernandez-munoz", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/addc5f8b-a19f-400c-a94c-fbd2674f2070"}, {"entry_id": 954807, "program_id": 679129, "athlete_id": 96667, "athlete_full_name": "Chase McQueen", "athlete_slug": "chase-mcqueen", "athlete_profile_image": "fotos/chase-mcqueen_96667.jpg", "athlete_yob": 1998, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/96667/chase-mcqueen", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/41f4ec53-73fe-4687-bf92-a375eb1a0920", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 954820, "program_id": 679129, "athlete_id": 162549, "athlete_full_name": "Reese Vannerson", "athlete_slug": "reese-vannerson", "athlete_profile_image": "fotos/reese-vannerson_162549.jpg", "athlete_yob": 2005, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/162549/reese-vannerson", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/a46c0a51-cbd0-47e2-b28f-43d6431f0b24", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 954842, "program_id": 679129, "athlete_id": 168086, "athlete_full_name": "Yhousman David Perdomo Peña", "athlete_slug": "yhousman-david-perdomo-pena", "athlete_profile_image": "fotos/yhousman-david-perdomo-pena_168086.png", "athlete_yob": 1996, "athlete_noc": "VEN", "athlete_flag_circle": "banderas/VEN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/168086/yhousman-david-perdomo-pena", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/7a651913-f95b-42b3-8540-5ec79e65cb3f", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/0c8160fd-8277-4761-98f4-ecfc875dd828"}, {"entry_id": 948000, "program_id": 679129, "athlete_id": 93402, "athlete_full_name": "Martin Sobey", "athlete_slug": "martin-sobey", "athlete_profile_image": "fotos/martin-sobey_93402.jpg", "athlete_yob": 1996, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/93402/martin-sobey", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/550cf333-6b62-4e70-9a01-a0cfdd46938f", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 893508, "program_id": 679129, "athlete_id": 56027, "athlete_full_name": "Diego Moya", "athlete_slug": "diego-moya", "athlete_profile_image": "fotos/diego-moya_56027.jpg", "athlete_yob": 1998, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/56027/diego-moya", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/0d4ce563-b7f6-4080-8ee4-30a13bcaa321", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 893652, "program_id": 679129, "athlete_id": 110028, "athlete_full_name": "Mateo Mendoza Burgos", "athlete_slug": "mateo-mendoza-burgos", "athlete_profile_image": "fotos/mateo-mendoza-burgos_110028.jpg", "athlete_yob": 2001, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/110028/mateo-mendoza-burgos", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/ea930a32-5709-41b5-86fc-437684b2712e", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 893658, "program_id": 679129, "athlete_id": 132948, "athlete_full_name": "Andree Buc", "athlete_slug": "andree-buc", "athlete_profile_image": "fotos/andree-buc_132948.jpg", "athlete_yob": 2004, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/132948/andree-buc", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/80dd6192-b2dc-45f9-9cd9-a2c187c73f36", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 893967, "program_id": 679129, "athlete_id": 29226, "athlete_full_name": "Matthew Wright", "athlete_slug": "matthew-wright", "athlete_profile_image": "fotos/matthew-wright_29226.jpg", "athlete_yob": 1992, "athlete_noc": "BAR", "athlete_flag_circle": "banderas/BAR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/29226/matthew-wright", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/83f2e422-3eeb-42f0-bed5-5f42ecfc2df7", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f12587d9-4bbc-408b-9392-3813ee60799c"}, {"entry_id": 894673, "program_id": 679129, "athlete_id": 83325, "athlete_full_name": "Juan Giraldo Gomez", "athlete_slug": "juan_jose_giraldo_gomez", "athlete_profile_image": null, "athlete_yob": 1997, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/83325/juan-jose-giraldo-gomez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 900046, "program_id": 679129, "athlete_id": 105480, "athlete_full_name": "Miguel Hidalgo", "athlete_slug": "miguel-hidalgo", "athlete_profile_image": "fotos/miguel-hidalgo_105480.jpg", "athlete_yob": 2000, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/105480/miguel-hidalgo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/bfe941ad-8f9e-425e-b18b-af3e8fae1a93", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900047, "program_id": 679129, "athlete_id": 69143, "athlete_full_name": "Manoel Messias", "athlete_slug": "manoel-messias", "athlete_profile_image": "fotos/manoel-messias_69143.jpg", "athlete_yob": 1996, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/69143/manoel-messias", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/f4d6c59c-d8ea-455c-a805-aff8c4166a24", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900048, "program_id": 679129, "athlete_id": 125038, "athlete_full_name": "Antonio Bravo Neto", "athlete_slug": "antonio-bravo-neto", "athlete_profile_image": "fotos/antonio-bravo-neto_125038.jpg", "athlete_yob": 1999, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/125038/antonio-bravo-neto", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/8b9b8066-da3e-4712-b023-33cdf93112a4", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900050, "program_id": 679129, "athlete_id": 55886, "athlete_full_name": "Kauê Willy", "athlete_slug": "kaue-willy", "athlete_profile_image": "fotos/kaue-willy_55886.jpg", "athlete_yob": 1996, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/55886/kaue-willy", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/636fe914-7f60-4067-88df-c9351b9bc912", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 892197, "program_id": 679129, "athlete_id": 103258, "athlete_full_name": "Liam Donnelly", "athlete_slug": "liam-donnelly", "athlete_profile_image": "fotos/liam-donnelly_103258.jpg", "athlete_yob": 1999, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/103258/liam-donnelly", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/11ce2d1c-c4ee-431e-8568-10bcc5b992ce", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 948785, "program_id": 679129, "athlete_id": 175677, "athlete_full_name": "Diego Ladera Querales", "athlete_slug": "diego-ladera-querales", "athlete_profile_image": "fotos/diego-ladera-querales_175677.jpg", "athlete_yob": 2005, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175677/diego-ladera-querales", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/875c7353-67e3-4fc8-8282-153aebc60485", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 948922, "program_id": 679129, "athlete_id": 18332, "athlete_full_name": "Carlos Javier Quinchara Forero", "athlete_slug": "carlos_javier_quinchara_forero", "athlete_profile_image": "fotos/carlos_javier_quinchara_forero_18332.jpg", "athlete_yob": 1988, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/18332/carlos-javier-quinchara-forero", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/4a56f38a-b9e5-4cc8-b5b2-033c4d2b3c91", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 949105, "program_id": 679129, "athlete_id": 103530, "athlete_full_name": "Aram Michell Peñaflor Moysen", "athlete_slug": "aram-michell-penaflor-moysen", "athlete_profile_image": "fotos/aram-michell-penaflor-moysen_103530.jpg", "athlete_yob": 1999, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/103530/aram-michell-penaflor-moysen", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/1c1f2d31-46f9-4fd6-9f5d-bd51f1ea79a9", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 949106, "program_id": 679129, "athlete_id": 124358, "athlete_full_name": "Erik Yamir Ramos Croda", "athlete_slug": "erik-yamir-ramos-croda", "athlete_profile_image": "fotos/erik-yamir-ramos-croda_124358.png", "athlete_yob": 2001, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/124358/erik-yamir-ramos-croda", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/b994aeaf-1af7-46e6-afda-40c101aa273c", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 949108, "program_id": 679129, "athlete_id": 124579, "athlete_full_name": "Dylan Didier Campa Carranza", "athlete_slug": "dylan_didier_campa_carranza", "athlete_profile_image": "fotos/dylan_didier_campa_carranza_124579.jpg", "athlete_yob": 2000, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/124579/dylan-didier-campa-carranza", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/8792108b-caae-4d4b-8313-366e6c94c434", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 949109, "program_id": 679129, "athlete_id": 12773, "athlete_full_name": "Rodrigo Gonzalez Lopez", "athlete_slug": "rodrigo-gonzalez-lopez", "athlete_profile_image": "fotos/rodrigo-gonzalez-lopez_12773.jpg", "athlete_yob": 1989, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/12773/rodrigo-gonzalez-lopez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/9cb20c61-2fc3-43e6-8927-f975ad86f9cc", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 950495, "program_id": 679129, "athlete_id": 131932, "athlete_full_name": "Keller Norland", "athlete_slug": "keller-norland", "athlete_profile_image": "fotos/keller-norland_131932.jpg", "athlete_yob": 2003, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/131932/keller-norland", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/8618e6c3-ac0c-46ef-9d13-f6e503a3eed4", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 951315, "program_id": 679129, "athlete_id": 167641, "athlete_full_name": "Gerónimo Dherete", "athlete_slug": "geronimo-dherete", "athlete_profile_image": null, "athlete_yob": 1999, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/167641/geronimo-dherete", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 951984, "program_id": 679129, "athlete_id": 151227, "athlete_full_name": "Joaquín Mojica Baquero", "athlete_slug": "joaquin-mojica-baquero", "athlete_profile_image": "fotos/joaquin-mojica-baquero_151227.jpg", "athlete_yob": 2002, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/151227/joaquin-mojica-baquero", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/21e3fbed-1772-4654-bd75-164fda361cf5", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}]}, "wait_list": {"team": false, "entries": [{"entry_id": 900051, "program_id": 679129, "athlete_id": 141071, "athlete_full_name": "Gabriel Lecheta", "athlete_slug": "gabriel-lecheta", "athlete_profile_image": "fotos/gabriel-lecheta_141071.jpg", "athlete_yob": 1996, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/141071/gabriel-lecheta", "start_num": null, "wait_pos": 2, "notes": "Exceeds National  quota of 4", "athlete_profile_image_original": "https://cms.triathlon.org/assets/ce8d9b17-a81d-485d-b060-4d28b2606d3c", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900052, "program_id": 679129, "athlete_id": 102855, "athlete_full_name": "João Teixeira Alvares", "athlete_slug": "joao-teixeira-alvares", "athlete_profile_image": null, "athlete_yob": 1998, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/102855/joao-teixeira-alvares", "start_num": null, "wait_pos": 4, "notes": "Exceeds National  quota of 4", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900054, "program_id": 679129, "athlete_id": 164746, "athlete_full_name": "Julio Monteiro Martins", "athlete_slug": "julio_monteiro_martins", "athlete_profile_image": null, "athlete_yob": 2000, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/164746/julio-monteiro-martins", "start_num": null, "wait_pos": 6, "notes": "Exceeds National  quota of 4", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900055, "program_id": 679129, "athlete_id": 124180, "athlete_full_name": "Matheus Oliveira Martinhaki", "athlete_slug": "matheus-oliveira-martinhaki", "athlete_profile_image": "fotos/matheus-oliveira-martinhaki_124180.jpg", "athlete_yob": 2002, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/124180/matheus-oliveira-martinhaki", "start_num": null, "wait_pos": 7, "notes": "Exceeds National  quota of 4", "athlete_profile_image_original": "https://cms.triathlon.org/assets/515d684e-38ca-4b15-8ebc-4f15a63c9116", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 949110, "program_id": 679129, "athlete_id": 143170, "athlete_full_name": "Rodrigo Probert González", "athlete_slug": "rodrigo-probert-gonzalez", "athlete_profile_image": "fotos/rodrigo-probert-gonzalez_143170.jpg", "athlete_yob": 2002, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/143170/rodrigo-probert-gonzalez", "start_num": null, "wait_pos": 5, "notes": "Exceeds National  quota of 4", "athlete_profile_image_original": "https://cms.triathlon.org/assets/f975bed0-22d1-41da-a8eb-969187051693", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 951881, "program_id": 679129, "athlete_id": 124356, "athlete_full_name": "Eduardo Nuñez Gomez", "athlete_slug": "eduardo-nunez-gomez", "athlete_profile_image": "fotos/eduardo-nunez-gomez_124356.jpg", "athlete_yob": 2002, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/124356/eduardo-nunez-gomez", "start_num": null, "wait_pos": 1, "notes": "Exceeds National  quota of 4", "athlete_profile_image_original": "https://cms.triathlon.org/assets/7213a11b-f4a2-43e1-b1fe-2fa036c7a303", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 955981, "program_id": 679129, "athlete_id": 40046, "athlete_full_name": "Luis Miguel Velasquez Ramos", "athlete_slug": "luis-miguel-velasquez-ramos", "athlete_profile_image": "fotos/luis-miguel-velasquez-ramos_40046.jpg", "athlete_yob": 1994, "athlete_noc": "VEN", "athlete_flag_circle": "banderas/VEN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/40046/luis-miguel-velasquez-ramos", "start_num": null, "wait_pos": 12, "notes": "Entered late 09/06", "athlete_profile_image_original": "https://cms.triathlon.org/assets/b5b7508b-b757-432e-aa35-2cb30e413d5a", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/0c8160fd-8277-4761-98f4-ecfc875dd828"}, {"entry_id": 956123, "program_id": 679129, "athlete_id": 124908, "athlete_full_name": "Joaquin Solis Narvaez", "athlete_slug": "joaquin-solis-narvaez", "athlete_profile_image": null, "athlete_yob": 2002, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/124908/joaquin-solis-narvaez", "start_num": null, "wait_pos": 14, "notes": "Entered late 09/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 957052, "program_id": 679129, "athlete_id": 167965, "athlete_full_name": "Victor Aurelio Feliz Feliz", "athlete_slug": "victor-aurelio-feliz-feliz", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "DOM", "athlete_flag_circle": "banderas/DOM.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/167965/victor-aurelio-feliz-feliz", "start_num": null, "wait_pos": null, "notes": "Entered late 16/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/90e7f006-a09f-4c4b-b19d-c6fddcfc19fa"}, {"entry_id": 957057, "program_id": 679129, "athlete_id": 172439, "athlete_full_name": "David Ballesta Garcia", "athlete_slug": "david-ballesta-garcia", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "DOM", "athlete_flag_circle": "banderas/DOM.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/172439/david-ballesta-garcia", "start_num": null, "wait_pos": null, "notes": "Entered late 16/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/90e7f006-a09f-4c4b-b19d-c6fddcfc19fa"}, {"entry_id": 957061, "program_id": 679129, "athlete_id": 132632, "athlete_full_name": "Alexis Gabriel Vasquez Fernandez", "athlete_slug": "alexis-gabriel-vasquez-fernandez", "athlete_profile_image": null, "athlete_yob": 2004, "athlete_noc": "DOM", "athlete_flag_circle": "banderas/DOM.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/132632/alexis-gabriel-vasquez-fernandez", "start_num": null, "wait_pos": null, "notes": "Entered late 16/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/90e7f006-a09f-4c4b-b19d-c6fddcfc19fa"}, {"entry_id": 957064, "program_id": 679129, "athlete_id": 121673, "athlete_full_name": "Rafael Martinez", "athlete_slug": "rafael-martinez", "athlete_profile_image": "fotos/rafael-martinez_121673.jpg", "athlete_yob": 2002, "athlete_noc": "DOM", "athlete_flag_circle": "banderas/DOM.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/121673/rafael-martinez", "start_num": null, "wait_pos": null, "notes": "Entered late 16/06", "athlete_profile_image_original": "https://cms.triathlon.org/assets/ad708392-7a50-4d55-9f70-2ad02ab250a4", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/90e7f006-a09f-4c4b-b19d-c6fddcfc19fa"}]}}, {"program_id": 679130, "name": "Elite Women", "gender": "female", "date": "2026-07-04", "details": {"prog_id": 679130, "event_id": 195267, "prog_name": "Elite Women", "is_race": true, "prog_date": "2026-07-04", "prog_date_utc": "2026-07-04", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "female", "prog_min_age": null, "prog_max_age": null, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 953880, "program_id": 679130, "athlete_id": 93585, "athlete_full_name": "Moira Miranda", "athlete_slug": "moira-miranda", "athlete_profile_image": "fotos/moira-miranda_93585.jpg", "athlete_yob": 1998, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/93585/moira-miranda", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/bbb50573-b818-4b0e-b123-e59737d7812c", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 951982, "program_id": 679130, "athlete_id": 49803, "athlete_full_name": "Diana Castillo", "athlete_slug": "diana-castillo", "athlete_profile_image": "fotos/diana-castillo_49803.jpg", "athlete_yob": 1993, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/49803/diana-castillo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/82020f24-0867-492a-910a-251d8ec0964e", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 952059, "program_id": 679130, "athlete_id": 7525, "athlete_full_name": "Elizabeth Bravo", "athlete_slug": "elizabeth-bravo", "athlete_profile_image": "fotos/elizabeth-bravo_7525.jpg", "athlete_yob": 1987, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/7525/elizabeth-bravo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/9ae48223-4939-4b1d-be2d-1bd5598a0b0d", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 952061, "program_id": 679130, "athlete_id": 70073, "athlete_full_name": "Paula Jara", "athlete_slug": "paula-jara", "athlete_profile_image": "fotos/paula-jara_70073.jpg", "athlete_yob": 1997, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/70073/paula-jara", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/fa5a7970-5057-45b1-9e68-bb24d48d65da", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 952747, "program_id": 679130, "athlete_id": 186318, "athlete_full_name": "Danielle Orie", "athlete_slug": "danielle-orie", "athlete_profile_image": "fotos/danielle-orie_186318.jpg", "athlete_yob": 1999, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186318/danielle-orie", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/a7e724ef-3151-4d87-8d76-613923cb5c27", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 953724, "program_id": 679130, "athlete_id": 175017, "athlete_full_name": "Carla Larrabeiti Jefferson", "athlete_slug": "carla-larrabeiti-jefferson", "athlete_profile_image": null, "athlete_yob": 2003, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175017/carla-larrabeiti-jefferson", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 953725, "program_id": 679130, "athlete_id": 131972, "athlete_full_name": "Gianella Debra Coaguila Pita", "athlete_slug": "gianella-debra-coaguila-pita", "athlete_profile_image": "fotos/gianella-debra-coaguila-pita_131972.jpg", "athlete_yob": 2003, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/131972/gianella-debra-coaguila-pita", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/51f9cfed-6f6e-4320-b2bd-9f434074ba8c", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 953823, "program_id": 679130, "athlete_id": 201790, "athlete_full_name": "Belen Vasallo", "athlete_slug": "belen-vasallo", "athlete_profile_image": null, "athlete_yob": 1998, "athlete_noc": "URU", "athlete_flag_circle": "banderas/URU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201790/belen-vasallo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/87f61897-2665-4b32-8c7c-b25eb3bcb90a"}, {"entry_id": 953836, "program_id": 679130, "athlete_id": 112757, "athlete_full_name": "Paula Vega", "athlete_slug": "paula-vega", "athlete_profile_image": "fotos/paula-vega_112757.jpg", "athlete_yob": 2002, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/112757/paula-vega", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/1383c8f9-ce85-4296-b65e-7f8d29536fee", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 949102, "program_id": 679130, "athlete_id": 25176, "athlete_full_name": "Cecilia Perez", "athlete_slug": "cecilia_perez", "athlete_profile_image": "fotos/cecilia_perez_25176.jpg", "athlete_yob": 1991, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/25176/cecilia-perez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/6608a8cb-b737-4c7a-914c-25eb0b62893d", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 954772, "program_id": 679130, "athlete_id": 39533, "athlete_full_name": "Leslie Amat Alvarez", "athlete_slug": "leslie-amat-alvarez", "athlete_profile_image": "fotos/leslie-amat-alvarez_39533.jpg", "athlete_yob": 1992, "athlete_noc": "CUB", "athlete_flag_circle": "banderas/CUB.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/39533/leslie-amat-alvarez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/5f6aea6b-628c-4484-ba01-893ec90331df", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8d53277f-e4aa-412d-9518-ab1b83741efa"}, {"entry_id": 954794, "program_id": 679130, "athlete_id": 170577, "athlete_full_name": "Catalina Torres Espinoza", "athlete_slug": "catalina-torres-espinoza", "athlete_profile_image": null, "athlete_yob": 1998, "athlete_noc": "CRC", "athlete_flag_circle": "banderas/CRC.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/170577/catalina-torres-espinoza", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/addc5f8b-a19f-400c-a94c-fbd2674f2070"}, {"entry_id": 954795, "program_id": 679130, "athlete_id": 93997, "athlete_full_name": "Raquel Solis", "athlete_slug": "raquel-solis", "athlete_profile_image": "fotos/raquel-solis_93997.jpg", "athlete_yob": 1998, "athlete_noc": "CRC", "athlete_flag_circle": "banderas/CRC.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/93997/raquel-solis", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/1a771380-39b6-4759-8576-57aba30303f9", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/addc5f8b-a19f-400c-a94c-fbd2674f2070"}, {"entry_id": 954834, "program_id": 679130, "athlete_id": 142820, "athlete_full_name": "Naomi Ruff", "athlete_slug": "naomi-ruff", "athlete_profile_image": "fotos/naomi-ruff_142820.png", "athlete_yob": 2004, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/142820/naomi-ruff", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/91ae416f-2f48-4321-8aca-7cc97329a86a", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 954845, "program_id": 679130, "athlete_id": 89986, "athlete_full_name": "Genesis Carolina Ruiz Volcan", "athlete_slug": "genesis-carolina-ruiz-volcan", "athlete_profile_image": null, "athlete_yob": 1993, "athlete_noc": "VEN", "athlete_flag_circle": "banderas/VEN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/89986/genesis-carolina-ruiz-volcan", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/0c8160fd-8277-4761-98f4-ecfc875dd828"}, {"entry_id": 954846, "program_id": 679130, "athlete_id": 168089, "athlete_full_name": "Rosa Elena Martinez Melchior", "athlete_slug": "rosa-elena-martinez-melchior", "athlete_profile_image": "fotos/rosa-elena-martinez-melchior_168089.jpg", "athlete_yob": 1995, "athlete_noc": "VEN", "athlete_flag_circle": "banderas/VEN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/168089/rosa-elena-martinez-melchior", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/81444056-2f6d-4a03-93b7-f871fe8db606", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/0c8160fd-8277-4761-98f4-ecfc875dd828"}, {"entry_id": 955624, "program_id": 679130, "athlete_id": 132920, "athlete_full_name": "Gabriela Chavez Torrico", "athlete_slug": "gabriela-chavez-torrico", "athlete_profile_image": null, "athlete_yob": 2002, "athlete_noc": "BOL", "athlete_flag_circle": "banderas/BOL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/132920/gabriela-chavez-torrico", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/30fafab4-f975-4b11-a6f5-5e0f23af3586"}, {"entry_id": 892252, "program_id": 679130, "athlete_id": 83323, "athlete_full_name": "Maria Carolina Velasquez Soto", "athlete_slug": "maria-carolina-velasquez-soto", "athlete_profile_image": "fotos/maria-carolina-velasquez-soto_83323.jpg", "athlete_yob": 1997, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/83323/maria-carolina-velasquez-soto", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/1c8761d1-0db2-4eb8-8757-797eb15b01fe", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 949101, "program_id": 679130, "athlete_id": 111962, "athlete_full_name": "Sofia Rodriguez Moreno", "athlete_slug": "sofia-rodriguez-moreno", "athlete_profile_image": "fotos/sofia-rodriguez-moreno_111962.jpg", "athlete_yob": 2001, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/111962/sofia-rodriguez-moreno", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/a849c84d-b652-432f-a214-ead4e4e5c3f0", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 949100, "program_id": 679130, "athlete_id": 124609, "athlete_full_name": "Ana Maria Valentina Torres Gomez", "athlete_slug": "ana-maria-valentina-torres-gomez", "athlete_profile_image": "fotos/ana-maria-valentina-torres-gomez_124609.jpg", "athlete_yob": 2001, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/124609/ana-maria-valentina-torres-gomez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/aef6d4d2-f0a3-46d5-8eac-c4631943bf9f", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 949099, "program_id": 679130, "athlete_id": 80813, "athlete_full_name": "Rosa Maria Tapia Vidal", "athlete_slug": "rosa-maria-tapia-vidal", "athlete_profile_image": "fotos/rosa-maria-tapia-vidal_80813.jpg", "athlete_yob": 1997, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/80813/rosa-maria-tapia-vidal", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/fef6abae-b0c2-4db6-9455-2f3ffc97353f", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 948923, "program_id": 679130, "athlete_id": 131272, "athlete_full_name": "Valentina Alvarez Valencia", "athlete_slug": "valentina_alvarez_valencia", "athlete_profile_image": "fotos/valentina_alvarez_valencia_131272.jpg", "athlete_yob": 2000, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/131272/valentina-alvarez-valencia", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/ea83ef1a-e405-4aaa-8e43-a6054ce17460", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 948775, "program_id": 679130, "athlete_id": 132250, "athlete_full_name": "Ava Snyder", "athlete_slug": "ava_snyder", "athlete_profile_image": null, "athlete_yob": 2002, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/132250/ava-snyder", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 947521, "program_id": 679130, "athlete_id": 191988, "athlete_full_name": "Caroline Theil", "athlete_slug": "caroline-theil", "athlete_profile_image": null, "athlete_yob": 1999, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/191988/caroline-theil", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 946764, "program_id": 679130, "athlete_id": 175732, "athlete_full_name": "Julia Maria Alcala Rosales", "athlete_slug": "julia-maria-alcala-rosales", "athlete_profile_image": null, "athlete_yob": 2001, "athlete_noc": "HON", "athlete_flag_circle": "banderas/HON.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175732/julia-maria-alcala-rosales", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8c09ac51-8a2c-4d7a-bc73-ed38981d0742"}, {"entry_id": 946627, "program_id": 679130, "athlete_id": 55742, "athlete_full_name": "Macarena Salazar", "athlete_slug": "macarena_salazar", "athlete_profile_image": "fotos/macarena_salazar_55742.jpg", "athlete_yob": 1995, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/55742/macarena-salazar", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/9155d074-2eca-4bc0-b634-9c1c80552046", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 946379, "program_id": 679130, "athlete_id": 190635, "athlete_full_name": "Eleanor Beveridge", "athlete_slug": "eleanor-beveridge", "athlete_profile_image": null, "athlete_yob": 2000, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/190635/eleanor-beveridge", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 900070, "program_id": 679130, "athlete_id": 112653, "athlete_full_name": "Gabrielle Lemes", "athlete_slug": "gabrielle-lemes", "athlete_profile_image": null, "athlete_yob": 2002, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/112653/gabrielle-lemes", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900069, "program_id": 679130, "athlete_id": 112651, "athlete_full_name": "Giovanna Lacerda", "athlete_slug": "giovanna-lacerda", "athlete_profile_image": "fotos/giovanna-lacerda_112651.jpg", "athlete_yob": 2002, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/112651/giovanna-lacerda", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/041d0f79-bba0-4c56-9874-33fc4ce73c87", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900068, "program_id": 679130, "athlete_id": 81882, "athlete_full_name": "Vittoria Lopes", "athlete_slug": "vittoria-lopes", "athlete_profile_image": "fotos/vittoria-lopes_81882.jpg", "athlete_yob": 1996, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/81882/vittoria-lopes", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/c66d538b-9934-4400-9a77-b5ee64707faf", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900067, "program_id": 679130, "athlete_id": 125061, "athlete_full_name": "Djenyfer Arnold", "athlete_slug": "djenyfer-arnold", "athlete_profile_image": "fotos/djenyfer-arnold_125061.jpg", "athlete_yob": 1993, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/125061/djenyfer-arnold", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/15253448-1146-4bff-bab7-c201dba36ae8", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 895629, "program_id": 679130, "athlete_id": 6150, "athlete_full_name": "Barbara Riveros", "athlete_slug": "barbara-riveros", "athlete_profile_image": "fotos/barbara-riveros_6150.jpg", "athlete_yob": 1987, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/6150/barbara-riveros", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/25a4f5cd-5998-45c0-9989-7ef82bae0496", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 893661, "program_id": 679130, "athlete_id": 112658, "athlete_full_name": "Daniela Moya Chamorro", "athlete_slug": "daniela-moya-chamorro", "athlete_profile_image": null, "athlete_yob": 2002, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/112658/daniela-moya-chamorro", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": [{"entry_id": 949104, "program_id": 679130, "athlete_id": 158926, "athlete_full_name": "Luisa Daniela Baca Vargas", "athlete_slug": "luisa_daniela_baca_vargas", "athlete_profile_image": "fotos/luisa_daniela_baca_vargas_158926.jpg", "athlete_yob": 2001, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/158926/luisa-daniela-baca-vargas", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": "https://cms.triathlon.org/assets/8063f313-c54c-49e4-be68-3441f4ea5b4e", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 952950, "program_id": 679130, "athlete_id": 132421, "athlete_full_name": "Anahi Alvarez Corral", "athlete_slug": "anahi-alvarez-corral", "athlete_profile_image": "fotos/anahi-alvarez-corral_132421.jpg", "athlete_yob": 2001, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/132421/anahi-alvarez-corral", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": "https://cms.triathlon.org/assets/32eefe58-09e6-40b6-86de-2ce3ce868098", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 953152, "program_id": 679130, "athlete_id": 124359, "athlete_full_name": "Mercedes Romero Orozco", "athlete_slug": "mercedes-romero-orozco", "athlete_profile_image": "fotos/mercedes-romero-orozco_124359.jpg", "athlete_yob": 2002, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/124359/mercedes-romero-orozco", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": "https://cms.triathlon.org/assets/f594f9c8-c7d0-42e3-97c1-64a43162f784", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 953864, "program_id": 679130, "athlete_id": 123552, "athlete_full_name": "Cecilia Sayuri Ramirez Alavez", "athlete_slug": "cecilia-sayuri-ramirez-alavez", "athlete_profile_image": "fotos/cecilia-sayuri-ramirez-alavez_123552.jpg", "athlete_yob": 2000, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/123552/cecilia-sayuri-ramirez-alavez", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": "https://cms.triathlon.org/assets/6a9bc649-79fc-4c7e-bdad-c3a40dfcdbec", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 957065, "program_id": 679130, "athlete_id": 187397, "athlete_full_name": "Lia Chrisley Campusano Collado", "athlete_slug": "lia-chrisley-campusano-collado", "athlete_profile_image": null, "athlete_yob": 2006, "athlete_noc": "DOM", "athlete_flag_circle": "banderas/DOM.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/187397/lia-chrisley-campusano-collado", "start_num": null, "wait_pos": null, "notes": "Entered late 16/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/90e7f006-a09f-4c4b-b19d-c6fddcfc19fa"}, {"entry_id": 957115, "program_id": 679130, "athlete_id": 143473, "athlete_full_name": "Marlen Alejandra Abigail Aguilar Bolaños", "athlete_slug": "marlen-alejandra-abigail-aguilar-bolanos", "athlete_profile_image": "fotos/marlen-alejandra-abigail-aguilar-bolanos_143473.jpg", "athlete_yob": 2002, "athlete_noc": "GUA", "athlete_flag_circle": "banderas/GUA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/143473/marlen-alejandra-abigail-aguilar-bolanos", "start_num": null, "wait_pos": null, "notes": "Entered late 16/06", "athlete_profile_image_original": "https://cms.triathlon.org/assets/c47013da-7fff-43f3-b939-959a5295d045", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/27a9f5a4-5a44-497e-8f4b-92fbdc093a3d"}]}}, {"program_id": 679131, "name": "U23 Men", "gender": "male", "date": "2026-07-04", "details": {"prog_id": 679131, "event_id": 195267, "prog_name": "U23 Men", "is_race": true, "prog_date": "2026-07-04", "prog_date_utc": "2026-07-04", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "male", "prog_min_age": 18, "prog_max_age": 23, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 952151, "program_id": 679131, "athlete_id": 172565, "athlete_full_name": "Tiago Muñoz", "athlete_slug": "tiago-munoz", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/172565/tiago-munoz", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 955518, "program_id": 679131, "athlete_id": 143435, "athlete_full_name": "Oliver Batista", "athlete_slug": "oliver-batista", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "PAN", "athlete_flag_circle": "banderas/PAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/143435/oliver-batista", "start_num": null, "wait_pos": null, "notes": "Entered late 05/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/5f19a72e-6b0a-4080-87fe-ad0f4e2a6824"}, {"entry_id": 954855, "program_id": 679131, "athlete_id": 166820, "athlete_full_name": "Dixon Hernandez", "athlete_slug": "dixon-hernandez", "athlete_profile_image": "fotos/dixon-hernandez_166820.jpg", "athlete_yob": 2006, "athlete_noc": "VEN", "athlete_flag_circle": "banderas/VEN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/166820/dixon-hernandez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/1da1af0a-2df9-49fa-9b08-ba3ba9bc1d61", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/0c8160fd-8277-4761-98f4-ecfc875dd828"}, {"entry_id": 954854, "program_id": 679131, "athlete_id": 168853, "athlete_full_name": "Cristopher Alexander Cardenas Jimenez", "athlete_slug": "cristopher-alexander-cardenas-jimenez", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "VEN", "athlete_flag_circle": "banderas/VEN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/168853/cristopher-alexander-cardenas-jimenez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/0c8160fd-8277-4761-98f4-ecfc875dd828"}, {"entry_id": 954853, "program_id": 679131, "athlete_id": 195067, "athlete_full_name": "Cristian Torrealba", "athlete_slug": "cristian-torrealba", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "VEN", "athlete_flag_circle": "banderas/VEN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195067/cristian-torrealba", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/0c8160fd-8277-4761-98f4-ecfc875dd828"}, {"entry_id": 954819, "program_id": 679131, "athlete_id": 132998, "athlete_full_name": "David Vega Campoverde", "athlete_slug": "david-vega-campoverde", "athlete_profile_image": null, "athlete_yob": 2004, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/132998/david-vega-campoverde", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 954782, "program_id": 679131, "athlete_id": 168804, "athlete_full_name": "Marcos Alejandro Fernández González", "athlete_slug": "marcos-alejandro-fernandez-gonzalez", "athlete_profile_image": null, "athlete_yob": 2004, "athlete_noc": "CUB", "athlete_flag_circle": "banderas/CUB.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/168804/marcos-alejandro-fernandez-gonzalez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8d53277f-e4aa-412d-9518-ab1b83741efa"}, {"entry_id": 954041, "program_id": 679131, "athlete_id": 172101, "athlete_full_name": "Braxton Legg", "athlete_slug": "braxton-legg", "athlete_profile_image": "fotos/braxton-legg_172101.png", "athlete_yob": 2005, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/172101/braxton-legg", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/949c970e-074f-44be-a60a-1cf7c7a94a56", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 954039, "program_id": 679131, "athlete_id": 171947, "athlete_full_name": "Sullivan Middaugh", "athlete_slug": "sullivan-middaugh", "athlete_profile_image": "fotos/sullivan-middaugh_171947.jpg", "athlete_yob": 2004, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/171947/sullivan-middaugh", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/56e6465b-8beb-4446-a41b-a82eb9f92d7f", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 954009, "program_id": 679131, "athlete_id": 162443, "athlete_full_name": "João Vitor Mazorca", "athlete_slug": "joao-vitor-mazorca", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/162443/joao-vitor-mazorca", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 953744, "program_id": 679131, "athlete_id": 178178, "athlete_full_name": "Blake Bullard", "athlete_slug": "blake-bullard", "athlete_profile_image": "fotos/blake-bullard_178178.png", "athlete_yob": 2006, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/178178/blake-bullard", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/d35b2106-43fa-4169-b5c4-60bc3640aef0", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 953305, "program_id": 679131, "athlete_id": 165255, "athlete_full_name": "Thomas Castañeda Maldonado", "athlete_slug": "thomas-castaneda-maldonado", "athlete_profile_image": null, "athlete_yob": 2004, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/165255/thomas-castaneda-maldonado", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 953187, "program_id": 679131, "athlete_id": 190835, "athlete_full_name": "Porter Middaugh", "athlete_slug": "porter-middaugh", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/190835/porter-middaugh", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 952953, "program_id": 679131, "athlete_id": 165196, "athlete_full_name": "Alfredo Miguel Rodríguez Figueroa", "athlete_slug": "alfredo-miguel-rodriguez-figueroa", "athlete_profile_image": "fotos/alfredo-miguel-rodriguez-figueroa_165196.jpg", "athlete_yob": 2005, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/165196/alfredo-miguel-rodriguez-figueroa", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/1e701172-0c99-4f9a-ac72-670eb83479b2", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 952780, "program_id": 679131, "athlete_id": 144208, "athlete_full_name": "Mathis Beaulieu", "athlete_slug": "mathis-beaulieu", "athlete_profile_image": "fotos/mathis-beaulieu_144208.jpg", "athlete_yob": 2004, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/144208/mathis-beaulieu", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/0ccf952a-44ec-4542-a27a-cbe20ce8a02c", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 892253, "program_id": 679131, "athlete_id": 187279, "athlete_full_name": "Jacobo Sánchez Cano", "athlete_slug": "jacobo_sanchez_cano", "athlete_profile_image": null, "athlete_yob": 2006, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/187279/jacobo-sanchez-cano", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 952002, "program_id": 679131, "athlete_id": 169545, "athlete_full_name": "Alejandro Villota", "athlete_slug": "alejandro-villota", "athlete_profile_image": null, "athlete_yob": 2006, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/169545/alejandro-villota", "start_num": null, "wait_pos": null, "notes": "Exceeds National  quota of 4", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 951986, "program_id": 679131, "athlete_id": 162612, "athlete_full_name": "Nicolas Gomez", "athlete_slug": "nicolas-gomez", "athlete_profile_image": null, "athlete_yob": 2004, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/162612/nicolas-gomez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 951877, "program_id": 679131, "athlete_id": 165278, "athlete_full_name": "Osvaldo Darell Zuñiga Fierro", "athlete_slug": "osvaldo-darell-zuniga-fierro", "athlete_profile_image": "fotos/osvaldo-darell-zuniga-fierro_165278.jpg", "athlete_yob": 2005, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/165278/osvaldo-darell-zuniga-fierro", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/2cf8abc0-0778-40f9-8a41-db7a0baef434", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 949111, "program_id": 679131, "athlete_id": 142895, "athlete_full_name": "Nicolas Probert Vargas", "athlete_slug": "nicolas_probert_vargas", "athlete_profile_image": "fotos/nicolas_probert_vargas_142895.jpg", "athlete_yob": 2003, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/142895/nicolas-probert-vargas", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/0e6b3155-9b72-499b-bf60-357ea52eee75", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 948925, "program_id": 679131, "athlete_id": 187312, "athlete_full_name": "David Alejandro Vásquez Ramos", "athlete_slug": "david_alejandro_vasquez_ramos", "athlete_profile_image": null, "athlete_yob": 2006, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/187312/david-alejandro-vasquez-ramos", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 900957, "program_id": 679131, "athlete_id": 132947, "athlete_full_name": "Andres Gras", "athlete_slug": "andres-gras", "athlete_profile_image": "fotos/andres-gras_132947.jpg", "athlete_yob": 2004, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/132947/andres-gras", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/2d3bfb3d-dfcc-4eaf-9021-df70af860914", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 900056, "program_id": 679131, "athlete_id": 162320, "athlete_full_name": "Vinicius Avi Santana", "athlete_slug": "vinicius-avi-santana", "athlete_profile_image": "fotos/vinicius-avi-santana_162320.jpg", "athlete_yob": 2005, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/162320/vinicius-avi-santana", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/9de41480-217a-472b-a7e7-5d76e2c62fbb", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 899775, "program_id": 679131, "athlete_id": 163071, "athlete_full_name": "Bautista Arbizu", "athlete_slug": "bautista-arbizu", "athlete_profile_image": "fotos/bautista-arbizu_163071.jpg", "athlete_yob": 2005, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/163071/bautista-arbizu", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/e24a5452-ac26-4bdb-b64e-8a6b07b4f55e", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 899675, "program_id": 679131, "athlete_id": 132187, "athlete_full_name": "Nicholas Pilgrim", "athlete_slug": "nicholas-pilgrim", "athlete_profile_image": null, "athlete_yob": 2003, "athlete_noc": "BER", "athlete_flag_circle": "banderas/BER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/132187/nicholas-pilgrim", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f63e3d99-01be-4fd7-b687-345ca1b12e9c"}, {"entry_id": 898227, "program_id": 679131, "athlete_id": 172264, "athlete_full_name": "Hayden Woodrow", "athlete_slug": "hayden-woodrow", "athlete_profile_image": null, "athlete_yob": 2003, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/172264/hayden-woodrow", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 897860, "program_id": 679131, "athlete_id": 175112, "athlete_full_name": "Daniel Epp", "athlete_slug": "daniel-epp", "athlete_profile_image": null, "athlete_yob": 2004, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175112/daniel-epp", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 896809, "program_id": 679131, "athlete_id": 143420, "athlete_full_name": "Blake Harris", "athlete_slug": "blake_harris", "athlete_profile_image": "fotos/blake_harris_143420.jpg", "athlete_yob": 2004, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/143420/blake-harris", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/d4280c00-bac9-4f76-b2b7-097a82e53bbb", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 895590, "program_id": 679131, "athlete_id": 166876, "athlete_full_name": "Daniel Ubilla Sabada", "athlete_slug": "daniel-ubilla-sabada", "athlete_profile_image": null, "athlete_yob": 2006, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/166876/daniel-ubilla-sabada", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 895589, "program_id": 679131, "athlete_id": 166574, "athlete_full_name": "Ignacio Flores Arana", "athlete_slug": "ignacio-flores-arana", "athlete_profile_image": null, "athlete_yob": 2006, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/166574/ignacio-flores-arana", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": [{"entry_id": 946870, "program_id": 679131, "athlete_id": 180821, "athlete_full_name": "Nicholas Andres Miller Herrera", "athlete_slug": "nicholas_andres_miller_herrera", "athlete_profile_image": null, "athlete_yob": 2006, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/180821/nicholas-andres-miller-herrera", "start_num": null, "wait_pos": 10, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 953661, "program_id": 679131, "athlete_id": 165290, "athlete_full_name": "Cole Jamieson ", "athlete_slug": "cole-jamieson", "athlete_profile_image": null, "athlete_yob": 2004, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/165290/cole-jamieson", "start_num": null, "wait_pos": 9, "notes": "Exceeds National  quota of 4", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 955527, "program_id": 679131, "athlete_id": 139574, "athlete_full_name": "Valentino Agnelli", "athlete_slug": "valentino-agnelli", "athlete_profile_image": null, "athlete_yob": 2003, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/139574/valentino-agnelli", "start_num": null, "wait_pos": 11, "notes": "Entered late 05/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 956107, "program_id": 679131, "athlete_id": 186870, "athlete_full_name": "Santiago Boxler", "athlete_slug": "santiago-boxler", "athlete_profile_image": null, "athlete_yob": 2004, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186870/santiago-boxler", "start_num": null, "wait_pos": 13, "notes": "Exceeds National  quota of 4", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 956359, "program_id": 679131, "athlete_id": 123751, "athlete_full_name": "Arturo Salinas", "athlete_slug": "arturo-salinas", "athlete_profile_image": "fotos/arturo-salinas_123751.jpg", "athlete_yob": 2003, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/123751/arturo-salinas", "start_num": null, "wait_pos": 15, "notes": "Entered late 12/06", "athlete_profile_image_original": "https://cms.triathlon.org/assets/07d7b1d7-5a9a-48d0-a31c-82260fba00e0", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 957288, "program_id": 679131, "athlete_id": 132432, "athlete_full_name": "Jorge Raul Cabinal Gramajo", "athlete_slug": "jorge-raul-cabinal-gramajo", "athlete_profile_image": null, "athlete_yob": 2003, "athlete_noc": "GUA", "athlete_flag_circle": "banderas/GUA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/132432/jorge-raul-cabinal-gramajo", "start_num": null, "wait_pos": null, "notes": "Entered late 16/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/27a9f5a4-5a44-497e-8f4b-92fbdc093a3d"}]}}, {"program_id": 679132, "name": "U23 Women", "gender": "female", "date": "2026-07-04", "details": {"prog_id": 679132, "event_id": 195267, "prog_name": "U23 Women", "is_race": true, "prog_date": "2026-07-04", "prog_date_utc": "2026-07-04", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "female", "prog_min_age": 18, "prog_max_age": 23, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 952110, "program_id": 679132, "athlete_id": 133000, "athlete_full_name": "Maria De Los Angeles Bonilla Garcia", "athlete_slug": "maria-de-los-angeles-bonilla-garcia", "athlete_profile_image": null, "athlete_yob": 2004, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/133000/maria-de-los-angeles-bonilla-garcia", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 956358, "program_id": 679132, "athlete_id": 175017, "athlete_full_name": "Carla Larrabeiti Jefferson", "athlete_slug": "carla-larrabeiti-jefferson", "athlete_profile_image": null, "athlete_yob": 2003, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175017/carla-larrabeiti-jefferson", "start_num": null, "wait_pos": null, "notes": "Entered late 12/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 956326, "program_id": 679132, "athlete_id": 179171, "athlete_full_name": "Rebecca Jansen", "athlete_slug": "rebecca-jansen", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "ARU", "athlete_flag_circle": "banderas/ARU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/179171/rebecca-jansen", "start_num": null, "wait_pos": null, "notes": "Entered late 11/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/bf4c38ba-b114-4a73-bf37-4e444683347a"}, {"entry_id": 955531, "program_id": 679132, "athlete_id": 186200, "athlete_full_name": "Joy Gill", "athlete_slug": "joy-gill", "athlete_profile_image": "fotos/joy-gill_186200.jpg", "athlete_yob": 2003, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186200/joy-gill", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/1cb0fa54-1f03-495d-910e-aee29b346d6c", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 955477, "program_id": 679132, "athlete_id": 189514, "athlete_full_name": "Kelly Wetteland", "athlete_slug": "kelly-wetteland", "athlete_profile_image": "fotos/kelly-wetteland_189514.jpg", "athlete_yob": 2004, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/189514/kelly-wetteland", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/8b4f1281-c5c9-4222-a80b-af8dbdf5c996", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 954851, "program_id": 679132, "athlete_id": 166829, "athlete_full_name": "Yaniuska Mared Jimenez Arriechi", "athlete_slug": "yaniuska-mared-jimenez-arriechi", "athlete_profile_image": null, "athlete_yob": 2006, "athlete_noc": "VEN", "athlete_flag_circle": "banderas/VEN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/166829/yaniuska-mared-jimenez-arriechi", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/0c8160fd-8277-4761-98f4-ecfc875dd828"}, {"entry_id": 954773, "program_id": 679132, "athlete_id": 163488, "athlete_full_name": "Isabel Rodriguez Silverio", "athlete_slug": "isabel-rodriguez-silverio", "athlete_profile_image": null, "athlete_yob": 2003, "athlete_noc": "CUB", "athlete_flag_circle": "banderas/CUB.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/163488/isabel-rodriguez-silverio", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8d53277f-e4aa-412d-9518-ab1b83741efa"}, {"entry_id": 954125, "program_id": 679132, "athlete_id": 166822, "athlete_full_name": "Sofia De Rosas", "athlete_slug": "sofia-de-rosas", "athlete_profile_image": "fotos/sofia-de-rosas_166822.jpg", "athlete_yob": 2005, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/166822/sofia-de-rosas", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/c7194bc3-bfbd-44e5-9723-130c93771406", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 954046, "program_id": 679132, "athlete_id": 165400, "athlete_full_name": "Sidney Clement", "athlete_slug": "sidney-clement", "athlete_profile_image": "fotos/sidney-clement_165400.png", "athlete_yob": 2005, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/165400/sidney-clement", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/4ad491df-fe98-44b3-aff2-95e778965b08", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 954004, "program_id": 679132, "athlete_id": 143514, "athlete_full_name": "Zoe Adam", "athlete_slug": "zoe-adam", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "PUR", "athlete_flag_circle": "banderas/PUR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/143514/zoe-adam", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c92129ea-68f5-4522-847f-0481514f68be"}, {"entry_id": 952781, "program_id": 679132, "athlete_id": 175113, "athlete_full_name": "Alexandra Campbell", "athlete_slug": "alexandra-campbell", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175113/alexandra-campbell", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 952628, "program_id": 679132, "athlete_id": 186552, "athlete_full_name": "Ellison Wolfe", "athlete_slug": "ellison-wolfe", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186552/ellison-wolfe", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 952589, "program_id": 679132, "athlete_id": 180776, "athlete_full_name": "María Emilia Vargas", "athlete_slug": "maria-emilia-vargas", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/180776/maria-emilia-vargas", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 896512, "program_id": 679132, "athlete_id": 141319, "athlete_full_name": "Dominga Elena Jacome Espinoza", "athlete_slug": "dominga-elena-jacome-espinoza", "athlete_profile_image": "fotos/dominga-elena-jacome-espinoza_141319.jpg", "athlete_yob": 2005, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/141319/dominga-elena-jacome-espinoza", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/bd5377d5-bfa8-4500-89f4-e56fd8223286", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 950990, "program_id": 679132, "athlete_id": 198391, "athlete_full_name": "Ángel Rubí Pérez Santos", "athlete_slug": "angel-rubi-perez-santos", "athlete_profile_image": null, "athlete_yob": 2003, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/198391/angel-rubi-perez-santos", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 950490, "program_id": 679132, "athlete_id": 196864, "athlete_full_name": "Eliana Portillo Laflamme", "athlete_slug": "eliana-portillo-laflamme", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "ESA", "athlete_flag_circle": "banderas/ESA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/196864/eliana-portillo-laflamme", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/96baef4a-4a18-43b3-a4f6-086b07432075"}, {"entry_id": 949322, "program_id": 679132, "athlete_id": 143348, "athlete_full_name": "Molly Lakustiak", "athlete_slug": "molly-lakustiak", "athlete_profile_image": "fotos/molly-lakustiak_143348.jpg", "athlete_yob": 2004, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/143348/molly-lakustiak", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/c2ef917f-9b8c-4436-a5c5-15a1f01d1789", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 949103, "program_id": 679132, "athlete_id": 135626, "athlete_full_name": "Marcela Alvarez Solis", "athlete_slug": "marcela_alvarez_solis", "athlete_profile_image": "fotos/marcela_alvarez_solis_135626.jpg", "athlete_yob": 2003, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/135626/marcela-alvarez-solis", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/68fec7c4-5e65-4033-948e-8979523f36bb", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 948945, "program_id": 679132, "athlete_id": 165195, "athlete_full_name": "Jimena Renata De La Peña Schott", "athlete_slug": "jimena-renata-de-la-pena-schott", "athlete_profile_image": "fotos/jimena-renata-de-la-pena-schott_165195.jpg", "athlete_yob": 2006, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/165195/jimena-renata-de-la-pena-schott", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/86ffacef-0231-4876-a3a0-94f6e1a84ab6", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 947999, "program_id": 679132, "athlete_id": 165243, "athlete_full_name": "Shelby Lajeunesse", "athlete_slug": "shelby_lajeunesse", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/165243/shelby-lajeunesse", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 946763, "program_id": 679132, "athlete_id": 175731, "athlete_full_name": "Camila Victoria Alcala Rosales", "athlete_slug": "camila-victoria-alcala-rosales", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "HON", "athlete_flag_circle": "banderas/HON.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175731/camila-victoria-alcala-rosales", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8c09ac51-8a2c-4d7a-bc73-ed38981d0742"}, {"entry_id": 900075, "program_id": 679132, "athlete_id": 132926, "athlete_full_name": "Amanda Moro", "athlete_slug": "amanda-moro", "athlete_profile_image": "fotos/amanda-moro_132926.jpg", "athlete_yob": 2004, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/132926/amanda-moro", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/a2f9c060-3f31-4c7b-a84c-2b0333a91f5b", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900074, "program_id": 679132, "athlete_id": 187081, "athlete_full_name": "Gabriela Machado Penteado", "athlete_slug": "gabriela-machado-penteado", "athlete_profile_image": null, "athlete_yob": 2006, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/187081/gabriela-machado-penteado", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900073, "program_id": 679132, "athlete_id": 141306, "athlete_full_name": "Sofia Gelati", "athlete_slug": "sofia-gelati", "athlete_profile_image": null, "athlete_yob": 2003, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/141306/sofia-gelati", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900066, "program_id": 679132, "athlete_id": 168244, "athlete_full_name": "Julia Visgueiro", "athlete_slug": "julia-visgueiro", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/168244/julia-visgueiro", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 896513, "program_id": 679132, "athlete_id": 132954, "athlete_full_name": "Rafaela Capó", "athlete_slug": "rafaela-capo", "athlete_profile_image": null, "athlete_yob": 2004, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/132954/rafaela-capo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": [{"entry_id": 957289, "program_id": 679132, "athlete_id": 143556, "athlete_full_name": "Bivian Andrea Luisita Diaz Fuentes", "athlete_slug": "bivian-andrea-luisita-diaz-fuentes", "athlete_profile_image": null, "athlete_yob": 2005, "athlete_noc": "GUA", "athlete_flag_circle": "banderas/GUA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/143556/bivian-andrea-luisita-diaz-fuentes", "start_num": null, "wait_pos": null, "notes": "Entered late 16/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/27a9f5a4-5a44-497e-8f4b-92fbdc093a3d"}]}}, {"program_id": 679133, "name": "Junior Men", "gender": "male", "date": "2026-07-04", "details": {"prog_id": 679133, "event_id": 195267, "prog_name": "Junior Men", "is_race": true, "prog_date": "2026-07-04", "prog_date_utc": "2026-07-04", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "male", "prog_min_age": 16, "prog_max_age": 19, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 953839, "program_id": 679133, "athlete_id": 179358, "athlete_full_name": "Antonio Alejandro Soria Mesa", "athlete_slug": "antonio-alejandro-soria-mesa", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/179358/antonio-alejandro-soria-mesa", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 952442, "program_id": 679133, "athlete_id": 186043, "athlete_full_name": "Jackson Langley", "athlete_slug": "jackson-langley", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "BER", "athlete_flag_circle": "banderas/BER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186043/jackson-langley", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f63e3d99-01be-4fd7-b687-345ca1b12e9c"}, {"entry_id": 952952, "program_id": 679133, "athlete_id": 182429, "athlete_full_name": "Raziel Geovanni Muñoz Tun", "athlete_slug": "raziel-geovanni-munoz-tun", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/182429/raziel-geovanni-munoz-tun", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 952954, "program_id": 679133, "athlete_id": 201858, "athlete_full_name": "Florian Muñoz", "athlete_slug": "florian-munoz", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201858/florian-munoz", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 952956, "program_id": 679133, "athlete_id": 192637, "athlete_full_name": "Matteo Somma", "athlete_slug": "matteo-somma", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/192637/matteo-somma", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 953153, "program_id": 679133, "athlete_id": 182430, "athlete_full_name": "Jesus Daniel Hernández Bobadilla", "athlete_slug": "jesus-daniel-hernandez-bobadilla", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/182430/jesus-daniel-hernandez-bobadilla", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 953171, "program_id": 679133, "athlete_id": 195658, "athlete_full_name": "Eduardo Staniaski Gonçalves", "athlete_slug": "eduardo-staniaski-goncalves", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195658/eduardo-staniaski-goncalves", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 953179, "program_id": 679133, "athlete_id": 195925, "athlete_full_name": "Eduardo Andres Carretero", "athlete_slug": "eduardo-andres-carretero", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "PUR", "athlete_flag_circle": "banderas/PUR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195925/eduardo-andres-carretero", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c92129ea-68f5-4522-847f-0481514f68be"}, {"entry_id": 953180, "program_id": 679133, "athlete_id": 195926, "athlete_full_name": "Santiago Fernandez", "athlete_slug": "santiago-fernandez", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "PUR", "athlete_flag_circle": "banderas/PUR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195926/santiago-fernandez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c92129ea-68f5-4522-847f-0481514f68be"}, {"entry_id": 953186, "program_id": 679133, "athlete_id": 197327, "athlete_full_name": "Graham Hummel", "athlete_slug": "graham-hummel", "athlete_profile_image": "fotos/graham-hummel_197327.jpg", "athlete_yob": 2009, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/197327/graham-hummel", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/511ab4b8-6755-4add-85c3-81758d3adc94", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 953343, "program_id": 679133, "athlete_id": 199693, "athlete_full_name": "Nathanael Hamilton", "athlete_slug": "nathanael-hamilton", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/199693/nathanael-hamilton", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 953344, "program_id": 679133, "athlete_id": 195141, "athlete_full_name": "Elliot Hamilton", "athlete_slug": "elliot-hamilton", "athlete_profile_image": "fotos/elliot-hamilton_195141.jpg", "athlete_yob": 2007, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195141/elliot-hamilton", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": "https://cms.triathlon.org/assets/617098c7-adaf-4d32-a15f-c6460c95c672", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 952108, "program_id": 679133, "athlete_id": 201888, "athlete_full_name": "Jonathan Calderón", "athlete_slug": "jonathan-calderon", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201888/jonathan-calderon", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 953904, "program_id": 679133, "athlete_id": 194461, "athlete_full_name": "Olivier Houle", "athlete_slug": "olivier-houle", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/194461/olivier-houle", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 953906, "program_id": 679133, "athlete_id": 202731, "athlete_full_name": "Sebastian Damian", "athlete_slug": "sebastian-damian", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202731/sebastian-damian", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 953907, "program_id": 679133, "athlete_id": 196925, "athlete_full_name": "Caden Hubers", "athlete_slug": "caden-hubers", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/196925/caden-hubers", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 954798, "program_id": 679133, "athlete_id": 186213, "athlete_full_name": "Gerald Rojas Carvajal", "athlete_slug": "gerald-rojas-carvajal", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "CRC", "athlete_flag_circle": "banderas/CRC.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186213/gerald-rojas-carvajal", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/addc5f8b-a19f-400c-a94c-fbd2674f2070"}, {"entry_id": 954799, "program_id": 679133, "athlete_id": 197342, "athlete_full_name": "Sergio Campos Hernandez", "athlete_slug": "sergio-campos-hernandez", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CRC", "athlete_flag_circle": "banderas/CRC.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/197342/sergio-campos-hernandez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/addc5f8b-a19f-400c-a94c-fbd2674f2070"}, {"entry_id": 954818, "program_id": 679133, "athlete_id": 179213, "athlete_full_name": "Nicolas Alejandro Calvopiña Castellano", "athlete_slug": "nicolas-alejandro-calvopina-castellano", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/179213/nicolas-alejandro-calvopina-castellano", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 954856, "program_id": 679133, "athlete_id": 187550, "athlete_full_name": "Aaron Jesus Hernández Morales", "athlete_slug": "aaron-jesus-hernandez-morales", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "VEN", "athlete_flag_circle": "banderas/VEN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/187550/aaron-jesus-hernandez-morales", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/0c8160fd-8277-4761-98f4-ecfc875dd828"}, {"entry_id": 954857, "program_id": 679133, "athlete_id": 175269, "athlete_full_name": "Juan Carlos David Peralta Perozo", "athlete_slug": "juan-carlos-david-peralta-perozo", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "VEN", "athlete_flag_circle": "banderas/VEN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175269/juan-carlos-david-peralta-perozo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/0c8160fd-8277-4761-98f4-ecfc875dd828"}, {"entry_id": 954931, "program_id": 679133, "athlete_id": 216376, "athlete_full_name": "Jérôme Côté", "athlete_slug": "jerome-cote", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216376/jerome-cote", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 955509, "program_id": 679133, "athlete_id": 201192, "athlete_full_name": "Gaspar Reyes", "athlete_slug": "gaspar-reyes", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201192/gaspar-reyes", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 955626, "program_id": 679133, "athlete_id": 201568, "athlete_full_name": "Jean Pool Jack Ali Tito", "athlete_slug": "jean-pool-jack-ali-tito", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "BOL", "athlete_flag_circle": "banderas/BOL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201568/jean-pool-jack-ali-tito", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/30fafab4-f975-4b11-a6f5-5e0f23af3586"}, {"entry_id": 946871, "program_id": 679133, "athlete_id": 202628, "athlete_full_name": "Gael Gonzalez Vasquez", "athlete_slug": "gael-gonzalez-vasquez", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202628/gael-gonzalez-vasquez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 895591, "program_id": 679133, "athlete_id": 175433, "athlete_full_name": "Sebastian Zurob", "athlete_slug": "sebastian-zurob", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175433/sebastian-zurob", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 896376, "program_id": 679133, "athlete_id": 188568, "athlete_full_name": "Ignacio Ernesto Braga Giménez", "athlete_slug": "ignacio_braga", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/188568/ignacio-braga", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 896690, "program_id": 679133, "athlete_id": 181758, "athlete_full_name": "Luke McIntyre", "athlete_slug": "luke_mcintyre", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "BAR", "athlete_flag_circle": "banderas/BAR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/181758/luke-mcintyre", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f12587d9-4bbc-408b-9392-3813ee60799c"}, {"entry_id": 896691, "program_id": 679133, "athlete_id": 185895, "athlete_full_name": "Oliver Hayward", "athlete_slug": "oliver_hayward", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "BER", "athlete_flag_circle": "banderas/BER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/185895/oliver-hayward", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f63e3d99-01be-4fd7-b687-345ca1b12e9c"}, {"entry_id": 896808, "program_id": 679133, "athlete_id": 189854, "athlete_full_name": "Robi Racine", "athlete_slug": "robi_racine", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/189854/robi-racine", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 900060, "program_id": 679133, "athlete_id": 202398, "athlete_full_name": "Henrique Domingues", "athlete_slug": "henrique-domingues", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202398/henrique-domingues", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900061, "program_id": 679133, "athlete_id": 195654, "athlete_full_name": "Athur Pereira Morer", "athlete_slug": "", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195654/athur-pereira-morer", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 901705, "program_id": 679133, "athlete_id": 186992, "athlete_full_name": "Raimundo Vicente San Martín Naranjo", "athlete_slug": "raimundo_vicente_san_martin_naranjo", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186992/raimundo-vicente-san-martin-naranjo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 901706, "program_id": 679133, "athlete_id": 195699, "athlete_full_name": "Enrique Pau", "athlete_slug": "", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195699/enrique-pau", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 901782, "program_id": 679133, "athlete_id": 186781, "athlete_full_name": "Mateo Silva González", "athlete_slug": "mateo_silva_gonzalez", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186781/mateo-silva-gonzalez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 946380, "program_id": 679133, "athlete_id": 202990, "athlete_full_name": "Walter Steffen", "athlete_slug": "walter-steffen", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202990/walter-steffen", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 894020, "program_id": 679133, "athlete_id": 202366, "athlete_full_name": "Garrett Gehringer", "athlete_slug": "garrett-gehringer", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202366/garrett-gehringer", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 948497, "program_id": 679133, "athlete_id": 167923, "athlete_full_name": "Leandro Alfonso Martinez", "athlete_slug": "leandro_martinez", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "URU", "athlete_flag_circle": "banderas/URU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/167923/leandro-martinez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/87f61897-2665-4b32-8c7c-b25eb3bcb90a"}, {"entry_id": 948784, "program_id": 679133, "athlete_id": 178173, "athlete_full_name": "Diego Alessandro Sanchez Felix", "athlete_slug": "diego_alessandro_sanchez_felix", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/178173/diego-alessandro-sanchez-felix", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 949113, "program_id": 679133, "athlete_id": 195375, "athlete_full_name": "Alessandro Diego Cortez Delgado", "athlete_slug": "", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195375/alessandro-diego-cortez-delgado", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 951458, "program_id": 679133, "athlete_id": 201097, "athlete_full_name": "Agustín Wendler Kossmann", "athlete_slug": "agustin-wendler-kossmann", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201097/agustin-wendler-kossmann", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 951633, "program_id": 679133, "athlete_id": 195932, "athlete_full_name": "Santino Calderón Lucoratolo", "athlete_slug": "santino-calderon-lucoratolo", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195932/santino-calderon-lucoratolo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 951879, "program_id": 679133, "athlete_id": 182427, "athlete_full_name": "Luis Miguel Chávez Sanchez", "athlete_slug": "luis-miguel-chavez-sanchez", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/182427/luis-miguel-chavez-sanchez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 951987, "program_id": 679133, "athlete_id": 187315, "athlete_full_name": "Jesus David Salazar Severino", "athlete_slug": "jesus-david-salazar-severino", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/187315/jesus-david-salazar-severino", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 952074, "program_id": 679133, "athlete_id": 178041, "athlete_full_name": "Thomas Francisco Chica Perez", "athlete_slug": "thomas-francisco-chica-perez", "athlete_profile_image": "fotos/thomas-francisco-chica-perez_178041.jpg", "athlete_yob": 2007, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/178041/thomas-francisco-chica-perez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/2fc4e1df-d452-4efc-b9fa-a24470a3f246", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 952075, "program_id": 679133, "athlete_id": 178038, "athlete_full_name": "Jhon Matias Tuesta Castro", "athlete_slug": "jhon-matias-tuesta-castro", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/178038/jhon-matias-tuesta-castro", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 952102, "program_id": 679133, "athlete_id": 179357, "athlete_full_name": "Angel Julian Vilema Cobos", "athlete_slug": "angel-julian-vilema-cobos", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/179357/angel-julian-vilema-cobos", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}]}, "wait_list": {"team": false, "entries": [{"entry_id": 946872, "program_id": 679133, "athlete_id": 202441, "athlete_full_name": "Matthew Leatherbee", "athlete_slug": "matthew-leatherbee", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202441/matthew-leatherbee", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 6", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 947515, "program_id": 679133, "athlete_id": 175527, "athlete_full_name": "Wills Gillis", "athlete_slug": "wills_gillis", "athlete_profile_image": "fotos/wills_gillis_175527.jpg", "athlete_yob": 2007, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175527/wills-gillis", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 6", "athlete_profile_image_original": "https://cms.triathlon.org/assets/ddbce793-8b45-4115-b665-a046030845fe", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 950809, "program_id": 679133, "athlete_id": 179232, "athlete_full_name": "Pablo Joel Calderon Garcia", "athlete_slug": "pablo-joel-calderon-garcia", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/179232/pablo-joel-calderon-garcia", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 951880, "program_id": 679133, "athlete_id": 186287, "athlete_full_name": "Alejandro Pérez Monterd", "athlete_slug": "alejandro-perez-monterd", "athlete_profile_image": "fotos/alejandro-perez-monterd_186287.jpg", "athlete_yob": 2008, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186287/alejandro-perez-monterd", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": "https://cms.triathlon.org/assets/de6df64b-8767-458c-b1e4-221aec680811", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 951990, "program_id": 679133, "athlete_id": 179228, "athlete_full_name": "Emiliano Magno Vargas Carrasco", "athlete_slug": "emiliano-magno-vargas-carrasco", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/179228/emiliano-magno-vargas-carrasco", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 952951, "program_id": 679133, "athlete_id": 182432, "athlete_full_name": "Yael Alejandro Rangel Rivera", "athlete_slug": "yael-alejandro-rangel-rivera", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/182432/yael-alejandro-rangel-rivera", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 953188, "program_id": 679133, "athlete_id": 202893, "athlete_full_name": "Brice Allen", "athlete_slug": "brice-allen", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202893/brice-allen", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 6", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 953653, "program_id": 679133, "athlete_id": 186628, "athlete_full_name": "Juan Marcos Aristizabal Ortiz", "athlete_slug": "juan-marcos-aristizabal-ortiz", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186628/juan-marcos-aristizabal-ortiz", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 6", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 953654, "program_id": 679133, "athlete_id": 202424, "athlete_full_name": "Gregorio Garcia Huidobro", "athlete_slug": "gregorio-garcia-huidobro", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202424/gregorio-garcia-huidobro", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 6", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 955573, "program_id": 679133, "athlete_id": 216778, "athlete_full_name": "Leonardo Zurita Hernández", "athlete_slug": "leonardo-zurita-hernandez", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216778/leonardo-zurita-hernandez", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 956132, "program_id": 679133, "athlete_id": 186991, "athlete_full_name": "Maximiliano Bobadilla", "athlete_slug": "maximiliano-bobadilla", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186991/maximiliano-bobadilla", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 6", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 957108, "program_id": 679133, "athlete_id": 216837, "athlete_full_name": "Fabricio Samuel Mamani Gomez", "athlete_slug": "fabricio-samuel-mamani-gomez", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "BOL", "athlete_flag_circle": "banderas/BOL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216837/fabricio-samuel-mamani-gomez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/30fafab4-f975-4b11-a6f5-5e0f23af3586"}, {"entry_id": 957291, "program_id": 679133, "athlete_id": 188675, "athlete_full_name": "Ángel David Ernesto Aguilar Bolaños", "athlete_slug": "angel-david-ernesto-aguilar-bolanos", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "GUA", "athlete_flag_circle": "banderas/GUA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/188675/angel-david-ernesto-aguilar-bolanos", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/27a9f5a4-5a44-497e-8f4b-92fbdc093a3d"}, {"entry_id": 957492, "program_id": 679133, "athlete_id": 186492, "athlete_full_name": "Paolo Farnetano", "athlete_slug": "paolo-farnetano", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "VEN", "athlete_flag_circle": "banderas/VEN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186492/paolo-farnetano", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/0c8160fd-8277-4761-98f4-ecfc875dd828"}]}}, {"program_id": 679134, "name": "Junior Women", "gender": "female", "date": "2026-07-04", "details": {"prog_id": 679134, "event_id": 195267, "prog_name": "Junior Women", "is_race": true, "prog_date": "2026-07-04", "prog_date_utc": "2026-07-04", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "female", "prog_min_age": 16, "prog_max_age": 19, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 954791, "program_id": 679134, "athlete_id": 166489, "athlete_full_name": "Maria Clara Abreu Borges Cunha", "athlete_slug": "maria-clara-abreu-borges-cunha", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/166489/maria-clara-abreu-borges-cunha", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 953871, "program_id": 679134, "athlete_id": 195154, "athlete_full_name": "Rylan Lonergan", "athlete_slug": "rylan-lonergan", "athlete_profile_image": "fotos/rylan-lonergan_195154.jpg", "athlete_yob": 2008, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195154/rylan-lonergan", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/0c78a52a-7a6c-4dc0-ac06-2d38fedf10da", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 953881, "program_id": 679134, "athlete_id": 201106, "athlete_full_name": "Guadalupe Valverde", "athlete_slug": "guadalupe-valverde", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201106/guadalupe-valverde", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 953902, "program_id": 679134, "athlete_id": 194463, "athlete_full_name": "Sara Champoux", "athlete_slug": "sara-champoux", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/194463/sara-champoux", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 953903, "program_id": 679134, "athlete_id": 190929, "athlete_full_name": "Brooke Rousselle", "athlete_slug": "brooke-rousselle", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/190929/brooke-rousselle", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 954043, "program_id": 679134, "athlete_id": 196896, "athlete_full_name": "Maya Mensen", "athlete_slug": "maya-mensen", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/196896/maya-mensen", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 954044, "program_id": 679134, "athlete_id": 216639, "athlete_full_name": "Senna Chan Carusone", "athlete_slug": "senna-chan-carusone", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216639/senna-chan-carusone", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 954045, "program_id": 679134, "athlete_id": 194464, "athlete_full_name": "Jeanne Gadbois", "athlete_slug": "jeanne-gadbois", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/194464/jeanne-gadbois", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 954268, "program_id": 679134, "athlete_id": 216533, "athlete_full_name": "Maëlly Lamontagne", "athlete_slug": "maelly-lamontagne", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216533/maelly-lamontagne", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 954298, "program_id": 679134, "athlete_id": 201773, "athlete_full_name": "Valeria Canizales Vizcarra", "athlete_slug": "valeria-canizales-vizcarra", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201773/valeria-canizales-vizcarra", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 953178, "program_id": 679134, "athlete_id": 195930, "athlete_full_name": "Alejandra Isabel Rodriguez", "athlete_slug": "alejandra-isabel-rodriguez", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "PUR", "athlete_flag_circle": "banderas/PUR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195930/alejandra-isabel-rodriguez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c92129ea-68f5-4522-847f-0481514f68be"}, {"entry_id": 954800, "program_id": 679134, "athlete_id": 178154, "athlete_full_name": "Valeria Arce Núñez", "athlete_slug": "valeria-arce-nunez", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "CRC", "athlete_flag_circle": "banderas/CRC.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/178154/valeria-arce-nunez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/addc5f8b-a19f-400c-a94c-fbd2674f2070"}, {"entry_id": 954801, "program_id": 679134, "athlete_id": 195373, "athlete_full_name": "Victoria Arce Nuñez", "athlete_slug": "victoria-arce-nunez", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CRC", "athlete_flag_circle": "banderas/CRC.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195373/victoria-arce-nunez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/addc5f8b-a19f-400c-a94c-fbd2674f2070"}, {"entry_id": 954802, "program_id": 679134, "athlete_id": 202621, "athlete_full_name": "María Paula Navarro Chaverri", "athlete_slug": "maria-paula-navarro-chaverri", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "CRC", "athlete_flag_circle": "banderas/CRC.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202621/maria-paula-navarro-chaverri", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/addc5f8b-a19f-400c-a94c-fbd2674f2070"}, {"entry_id": 954822, "program_id": 679134, "athlete_id": 178131, "athlete_full_name": "Melany Pesantez Cumbicus", "athlete_slug": "melany-pesantez-cumbicus", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/178131/melany-pesantez-cumbicus", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 954838, "program_id": 679134, "athlete_id": 202286, "athlete_full_name": "Federica Carletto", "athlete_slug": "federica-carletto", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202286/federica-carletto", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 954852, "program_id": 679134, "athlete_id": 202029, "athlete_full_name": "María Lourdes Peralta Perozo", "athlete_slug": "maria-lourdes-peralta-perozo", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "VEN", "athlete_flag_circle": "banderas/VEN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202029/maria-lourdes-peralta-perozo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/0c8160fd-8277-4761-98f4-ecfc875dd828"}, {"entry_id": 955512, "program_id": 679134, "athlete_id": 200898, "athlete_full_name": "Ana Isabella Quingatuña Agudelo", "athlete_slug": "ana-isabella-quingatuna-agudelo", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/200898/ana-isabella-quingatuna-agudelo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 955812, "program_id": 679134, "athlete_id": 195692, "athlete_full_name": "Carla Cabrera Chamorro", "athlete_slug": "carla-cabrera-chamorro", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195692/carla-cabrera-chamorro", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956104, "program_id": 679134, "athlete_id": 201713, "athlete_full_name": "Emma Scliar", "athlete_slug": "emma-scliar", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201713/emma-scliar", "start_num": null, "wait_pos": null, "notes": "Entered late 10/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 949114, "program_id": 679134, "athlete_id": 180037, "athlete_full_name": "Regina Michel Camacho", "athlete_slug": "regina_michel_camacho", "athlete_profile_image": "fotos/regina_michel_camacho_180037.jpg", "athlete_yob": 2007, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/180037/regina-michel-camacho", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/028a3ed2-66f7-4870-adca-9274880d27c9", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 900062, "program_id": 679134, "athlete_id": 202457, "athlete_full_name": "Gabriele Amabiele Reis", "athlete_slug": "gabriele-amabiele-reis", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202457/gabriele-amabiele-reis", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 900063, "program_id": 679134, "athlete_id": 187082, "athlete_full_name": "Maria Luiza Simão de Oliveira", "athlete_slug": "maria-luiza-simao-de-oliveira", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/187082/maria-luiza-simao-de-oliveira", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 901708, "program_id": 679134, "athlete_id": 195704, "athlete_full_name": "Pascalle Ahumada Inostroza", "athlete_slug": "", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195704/pascalle-ahumada-inostroza", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 946874, "program_id": 679134, "athlete_id": 175548, "athlete_full_name": "Emilia Dabadie Zambrano", "athlete_slug": "emilia-dabadie-zambrano", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175548/emilia-dabadie-zambrano", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 946875, "program_id": 679134, "athlete_id": 195695, "athlete_full_name": "Rafaela Duran Schade", "athlete_slug": "", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195695/rafaela-duran-schade", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 946876, "program_id": 679134, "athlete_id": 195696, "athlete_full_name": "Martina Baez Salazar", "athlete_slug": "", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195696/martina-baez-salazar", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 947528, "program_id": 679134, "athlete_id": 175522, "athlete_full_name": "Jenna Gilhooly", "athlete_slug": "jenna_gilhooly", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175522/jenna-gilhooly", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}, {"entry_id": 948287, "program_id": 679134, "athlete_id": 183878, "athlete_full_name": "Francisca Antonia Espinoza Pereira", "athlete_slug": "francisca_antonia_espinoza_pereira", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/183878/francisca-antonia-espinoza-pereira", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 948498, "program_id": 679134, "athlete_id": 167924, "athlete_full_name": "Jimena Martinez", "athlete_slug": "jimena_martinez", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "URU", "athlete_flag_circle": "banderas/URU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/167924/jimena-martinez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/87f61897-2665-4b32-8c7c-b25eb3bcb90a"}, {"entry_id": 896793, "program_id": 679134, "athlete_id": 184984, "athlete_full_name": "Alexis Lashley", "athlete_slug": "alexis_lashley", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "BAR", "athlete_flag_circle": "banderas/BAR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/184984/alexis-lashley", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f12587d9-4bbc-408b-9392-3813ee60799c"}, {"entry_id": 950733, "program_id": 679134, "athlete_id": 199898, "athlete_full_name": "Hannia Nicole Diaz Castro", "athlete_slug": "hannia-nicole-diaz-castro", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/199898/hannia-nicole-diaz-castro", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 950988, "program_id": 679134, "athlete_id": 202556, "athlete_full_name": "Argelia Pérez Olivera", "athlete_slug": "argelia-perez-olivera", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202556/argelia-perez-olivera", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 950989, "program_id": 679134, "athlete_id": 202505, "athlete_full_name": "Ivanna Gabriela Villatoro Sandoval", "athlete_slug": "ivanna-gabriela-villatoro-sandoval", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202505/ivanna-gabriela-villatoro-sandoval", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 951663, "program_id": 679134, "athlete_id": 186282, "athlete_full_name": "Rebeca Sofia Rivero Franco", "athlete_slug": "rebeca-sofia-rivero-franco", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186282/rebeca-sofia-rivero-franco", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 952100, "program_id": 679134, "athlete_id": 178036, "athlete_full_name": "Juana Marcela Barzallo Ortiz", "athlete_slug": "juana-marcela-barzallo-ortiz", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/178036/juana-marcela-barzallo-ortiz", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 952613, "program_id": 679134, "athlete_id": 201764, "athlete_full_name": "Greta Buntalyk caviglia", "athlete_slug": "greta-buntalyk-caviglia", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201764/greta-buntalyk-caviglia", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 953175, "program_id": 679134, "athlete_id": 186664, "athlete_full_name": "Isabella Fernandez", "athlete_slug": "isabella-fernandez", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "PUR", "athlete_flag_circle": "banderas/PUR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186664/isabella-fernandez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c92129ea-68f5-4522-847f-0481514f68be"}, {"entry_id": 953176, "program_id": 679134, "athlete_id": 186610, "athlete_full_name": "Valentina Sofia Negron", "athlete_slug": "valentina-sofia-negron", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "PUR", "athlete_flag_circle": "banderas/PUR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186610/valentina-sofia-negron", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c92129ea-68f5-4522-847f-0481514f68be"}]}, "wait_list": {"team": false, "entries": [{"entry_id": 895731, "program_id": 679134, "athlete_id": 202420, "athlete_full_name": "Javiera Cerda Sanhueza", "athlete_slug": "javiera-cerda-sanhueza", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202420/javiera-cerda-sanhueza", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 6", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 953897, "program_id": 679134, "athlete_id": 194465, "athlete_full_name": "Sarah-Maude Levesque", "athlete_slug": "sarah-maude-levesque", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "CAN", "athlete_flag_circle": "banderas/CAN.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/194465/sarah-maude-levesque", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 6", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168"}, {"entry_id": 953908, "program_id": 679134, "athlete_id": 196857, "athlete_full_name": "María José Nuñez Bautista", "athlete_slug": "maria-jose-nunez-bautista", "athlete_profile_image": null, "athlete_yob": 2007, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/196857/maria-jose-nunez-bautista", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 6", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 956793, "program_id": 679134, "athlete_id": 187192, "athlete_full_name": "Regina Belen Leaño Alconz", "athlete_slug": "regina-belen-leano-alconz", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "BOL", "athlete_flag_circle": "banderas/BOL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/187192/regina-belen-leano-alconz", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/30fafab4-f975-4b11-a6f5-5e0f23af3586"}, {"entry_id": 957062, "program_id": 679134, "athlete_id": 190847, "athlete_full_name": "Nashla Pujols", "athlete_slug": "nashla-pujols", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "DOM", "athlete_flag_circle": "banderas/DOM.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/190847/nashla-pujols", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/90e7f006-a09f-4c4b-b19d-c6fddcfc19fa"}, {"entry_id": 957063, "program_id": 679134, "athlete_id": 190891, "athlete_full_name": "Arisleidy Nashaly Pujols De Jesus", "athlete_slug": "arisleidy-nashaly-pujols-de-jesus", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "DOM", "athlete_flag_circle": "banderas/DOM.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/190891/arisleidy-nashaly-pujols-de-jesus", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/90e7f006-a09f-4c4b-b19d-c6fddcfc19fa"}, {"entry_id": 957516, "program_id": 679134, "athlete_id": 195158, "athlete_full_name": "Sarah Gilhooly", "athlete_slug": "sarah-gilhooly", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "USA", "athlete_flag_circle": "banderas/USA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195158/sarah-gilhooly", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94"}]}}, {"program_id": 679135, "name": "Youth Men", "gender": "male", "date": "2026-07-05", "details": {"prog_id": 679135, "event_id": 195267, "prog_name": "Youth Men", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "male", "prog_min_age": 15, "prog_max_age": 17, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 951632, "program_id": 679135, "athlete_id": 195932, "athlete_full_name": "Santino Calderón Lucoratolo", "athlete_slug": "santino-calderon-lucoratolo", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195932/santino-calderon-lucoratolo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 956286, "program_id": 679135, "athlete_id": 216866, "athlete_full_name": "Esteban Gabriel Aguirre Jara", "athlete_slug": "esteban-gabriel-aguirre-jara", "athlete_profile_image": null, "athlete_yob": 0, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216866/esteban-gabriel-aguirre-jara", "start_num": null, "wait_pos": null, "notes": "Entered late 11/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 955989, "program_id": 679135, "athlete_id": 189804, "athlete_full_name": "Martin Guevara Mejia", "athlete_slug": "martin-guevara-mejia", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/189804/martin-guevara-mejia", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 955959, "program_id": 679135, "athlete_id": 216488, "athlete_full_name": "Jhonatan Sebastian Tuesta Castro", "athlete_slug": "jhonatan-sebastian-tuesta-castro", "athlete_profile_image": null, "athlete_yob": 2011, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216488/jhonatan-sebastian-tuesta-castro", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 955511, "program_id": 679135, "athlete_id": 202989, "athlete_full_name": "Gabriel Alejandro Lloay Vinueza", "athlete_slug": "gabriel-alejandro-lloay-vinueza", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202989/gabriel-alejandro-lloay-vinueza", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 955510, "program_id": 679135, "athlete_id": 216803, "athlete_full_name": "Joseph Lloay", "athlete_slug": "joseph-lloay", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216803/joseph-lloay", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 954839, "program_id": 679135, "athlete_id": 201097, "athlete_full_name": "Agustín Wendler Kossmann", "athlete_slug": "agustin-wendler-kossmann", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201097/agustin-wendler-kossmann", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 954244, "program_id": 679135, "athlete_id": 195727, "athlete_full_name": "Juan Pablo Rubio", "athlete_slug": "juan-pablo-rubio", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195727/juan-pablo-rubio", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 954243, "program_id": 679135, "athlete_id": 195728, "athlete_full_name": "Cristobal Rubio", "athlete_slug": "cristobal-rubio", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195728/cristobal-rubio", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 953882, "program_id": 679135, "athlete_id": 195729, "athlete_full_name": "Joaquín Valverde", "athlete_slug": "joaquin-valverde", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195729/joaquin-valverde", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 953183, "program_id": 679135, "athlete_id": 195927, "athlete_full_name": "Davidzael Estrada", "athlete_slug": "davidzael-estrada", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "PUR", "athlete_flag_circle": "banderas/PUR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195927/davidzael-estrada", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c92129ea-68f5-4522-847f-0481514f68be"}, {"entry_id": 953172, "program_id": 679135, "athlete_id": 195658, "athlete_full_name": "Eduardo Staniaski Gonçalves", "athlete_slug": "eduardo-staniaski-goncalves", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195658/eduardo-staniaski-goncalves", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 952955, "program_id": 679135, "athlete_id": 201858, "athlete_full_name": "Florian Muñoz", "athlete_slug": "florian-munoz", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201858/florian-munoz", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 952099, "program_id": 679135, "athlete_id": 202727, "athlete_full_name": "Pablo Saavedra", "athlete_slug": "pablo-saavedra", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202727/pablo-saavedra", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 951664, "program_id": 679135, "athlete_id": 202651, "athlete_full_name": "Arturo Busto Zellek", "athlete_slug": "arturo-busto-zellek", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "MEX", "athlete_flag_circle": "banderas/MEX.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202651/arturo-busto-zellek", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d"}, {"entry_id": 895733, "program_id": 679135, "athlete_id": 202426, "athlete_full_name": "Antonio Conejeros Faundez", "athlete_slug": "antonio-conejeros-faundez", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202426/antonio-conejeros-faundez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 951385, "program_id": 679135, "athlete_id": 186219, "athlete_full_name": "Omar alejandro Pizarro ruiz", "athlete_slug": "omar-alejandro-pizarro-ruiz", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186219/omar-alejandro-pizarro-ruiz", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 951384, "program_id": 679135, "athlete_id": 187288, "athlete_full_name": "Anderson Humberto Pantoja Velapatiño", "athlete_slug": "anderson-humberto-pantoja-velapatino", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/187288/anderson-humberto-pantoja-velapatino", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 951383, "program_id": 679135, "athlete_id": 202631, "athlete_full_name": "Sebastian Jesus Paredes Bravo", "athlete_slug": "sebastian-jesus-paredes-bravo", "athlete_profile_image": null, "athlete_yob": 2011, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202631/sebastian-jesus-paredes-bravo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 950712, "program_id": 679135, "athlete_id": 197850, "athlete_full_name": "Jerónimo Vargas Moreno", "athlete_slug": "jeronimo-vargas-moreno", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/197850/jeronimo-vargas-moreno", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 950711, "program_id": 679135, "athlete_id": 197631, "athlete_full_name": "Alejandro Velez Torres", "athlete_slug": "alejandro-velez-torres", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/197631/alejandro-velez-torres", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}, {"entry_id": 949032, "program_id": 679135, "athlete_id": 195657, "athlete_full_name": "Alejandro Juanuk", "athlete_slug": "", "athlete_profile_image": "fotos/athlete_195657.jpg", "athlete_yob": 2009, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195657/alejandro-juanuk", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/381e4bf5-3f95-4198-9033-583f233d2643", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 948914, "program_id": 679135, "athlete_id": 195689, "athlete_full_name": "Jose Valli Madain", "athlete_slug": "", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195689/jose-valli-madain", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 948913, "program_id": 679135, "athlete_id": 202440, "athlete_full_name": "Diego Holloway", "athlete_slug": "diego-holloway", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202440/diego-holloway", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 948911, "program_id": 679135, "athlete_id": 195690, "athlete_full_name": "Agustin Parada Segura", "athlete_slug": "", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195690/agustin-parada-segura", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 948781, "program_id": 679135, "athlete_id": 187285, "athlete_full_name": "Arturo Maximiliano Peching San Roman", "athlete_slug": "arturo_maximiliano_peching_san_roman", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/187285/arturo-maximiliano-peching-san-roman", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 948496, "program_id": 679135, "athlete_id": 195686, "athlete_full_name": "Elias Medina Paolucci", "athlete_slug": "", "athlete_profile_image": "fotos/athlete_195686.png", "athlete_yob": 2010, "athlete_noc": "URU", "athlete_flag_circle": "banderas/URU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195686/elias-medina-paolucci", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": "https://cms.triathlon.org/assets/b28edba6-85f8-43d8-bfa4-4cd9c157f6e0", "athlete_flag_circle_original": "https://cms.triathlon.org/assets/87f61897-2665-4b32-8c7c-b25eb3bcb90a"}, {"entry_id": 948175, "program_id": 679135, "athlete_id": 202434, "athlete_full_name": "Henrique Vieira Karuta", "athlete_slug": "henrique-vieira-karuta", "athlete_profile_image": null, "athlete_yob": 2011, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202434/henrique-vieira-karuta", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 902133, "program_id": 679135, "athlete_id": 187094, "athlete_full_name": "Sergio Maza Krause", "athlete_slug": "sergio_maza_krause", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/187094/sergio-maza-krause", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 896794, "program_id": 679135, "athlete_id": 184974, "athlete_full_name": "Zindzele Renwick-Williams", "athlete_slug": "zindzele_renwick_williams", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "BAR", "athlete_flag_circle": "banderas/BAR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/184974/zindzele-renwick-williams", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f12587d9-4bbc-408b-9392-3813ee60799c"}]}, "wait_list": {"team": false, "entries": [{"entry_id": 948910, "program_id": 679135, "athlete_id": 202428, "athlete_full_name": "Iker Gaspar Gonzalez Vasquez", "athlete_slug": "iker-gaspar-gonzalez-vasquez", "athlete_profile_image": null, "athlete_yob": 2011, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202428/iker-gaspar-gonzalez-vasquez", "start_num": null, "wait_pos": null, "notes": "Exceeds National Quota of 6", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956131, "program_id": 679135, "athlete_id": 186991, "athlete_full_name": "Maximiliano Bobadilla", "athlete_slug": "maximiliano-bobadilla", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/186991/maximiliano-bobadilla", "start_num": null, "wait_pos": null, "notes": "Exceeds National Quota of 6", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956791, "program_id": 679135, "athlete_id": 216839, "athlete_full_name": "Rafael Alejandro España Mendez", "athlete_slug": "rafael-alejandro-espana-mendez", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "BOL", "athlete_flag_circle": "banderas/BOL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216839/rafael-alejandro-espana-mendez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/30fafab4-f975-4b11-a6f5-5e0f23af3586"}, {"entry_id": 956792, "program_id": 679135, "athlete_id": 202028, "athlete_full_name": "Jose Manuel Mamani Flores", "athlete_slug": "jose-manuel-mamani-flores", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "BOL", "athlete_flag_circle": "banderas/BOL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202028/jose-manuel-mamani-flores", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/30fafab4-f975-4b11-a6f5-5e0f23af3586"}, {"entry_id": 957110, "program_id": 679135, "athlete_id": 216837, "athlete_full_name": "Fabricio Samuel Mamani Gomez", "athlete_slug": "fabricio-samuel-mamani-gomez", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "BOL", "athlete_flag_circle": "banderas/BOL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216837/fabricio-samuel-mamani-gomez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/30fafab4-f975-4b11-a6f5-5e0f23af3586"}]}}, {"program_id": 679136, "name": "Youth Women", "gender": "female", "date": "2026-07-05", "details": {"prog_id": 679136, "event_id": 195267, "prog_name": "Youth Women", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "female", "prog_min_age": 15, "prog_max_age": 17, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 952064, "program_id": 679136, "athlete_id": 195901, "athlete_full_name": "Manuela Ortega Arteaga", "athlete_slug": "manuela-ortega-arteaga", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195901/manuela-ortega-arteaga", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 956105, "program_id": 679136, "athlete_id": 201713, "athlete_full_name": "Emma Scliar", "athlete_slug": "emma-scliar", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201713/emma-scliar", "start_num": null, "wait_pos": null, "notes": "Entered late 10/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 955625, "program_id": 679136, "athlete_id": 201987, "athlete_full_name": "Angeles Valentina Hidalgo Quinteros", "athlete_slug": "angeles-valentina-hidalgo-quinteros", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "BOL", "athlete_flag_circle": "banderas/BOL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201987/angeles-valentina-hidalgo-quinteros", "start_num": null, "wait_pos": null, "notes": "Entered late 07/06", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/30fafab4-f975-4b11-a6f5-5e0f23af3586"}, {"entry_id": 955507, "program_id": 679136, "athlete_id": 216489, "athlete_full_name": "Emilia Adamaris Tintin Salas", "athlete_slug": "emilia-adamaris-tintin-salas", "athlete_profile_image": null, "athlete_yob": 2011, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216489/emilia-adamaris-tintin-salas", "start_num": null, "wait_pos": null, "notes": "Exceeds National quota of 4", "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 954837, "program_id": 679136, "athlete_id": 202286, "athlete_full_name": "Federica Carletto", "athlete_slug": "federica-carletto", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202286/federica-carletto", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 953182, "program_id": 679136, "athlete_id": 202783, "athlete_full_name": "Mia Isabella Kelly", "athlete_slug": "mia-isabella-kelly", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "PUR", "athlete_flag_circle": "banderas/PUR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202783/mia-isabella-kelly", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c92129ea-68f5-4522-847f-0481514f68be"}, {"entry_id": 953181, "program_id": 679136, "athlete_id": 195929, "athlete_full_name": "Paula sofia Rivera", "athlete_slug": "paula-sofia-rivera", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "PUR", "athlete_flag_circle": "banderas/PUR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195929/paula-sofia-rivera", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/c92129ea-68f5-4522-847f-0481514f68be"}, {"entry_id": 952614, "program_id": 679136, "athlete_id": 201764, "athlete_full_name": "Greta Buntalyk caviglia", "athlete_slug": "greta-buntalyk-caviglia", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201764/greta-buntalyk-caviglia", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}, {"entry_id": 952107, "program_id": 679136, "athlete_id": 195902, "athlete_full_name": "Domenica Tintin Salas", "athlete_slug": "domenica-tintin-salas", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195902/domenica-tintin-salas", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 952067, "program_id": 679136, "athlete_id": 195684, "athlete_full_name": "María Alejandra Proaño Guerrero", "athlete_slug": "maria-alejandra-proano-guerrero", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195684/maria-alejandra-proano-guerrero", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 952065, "program_id": 679136, "athlete_id": 201010, "athlete_full_name": "Renata Valentina Oña Paredes", "athlete_slug": "renata-valentina-ona-paredes", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "ECU", "athlete_flag_circle": "banderas/ECU.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201010/renata-valentina-ona-paredes", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f"}, {"entry_id": 895734, "program_id": 679136, "athlete_id": 202425, "athlete_full_name": "Javiera Urra Conejeros", "athlete_slug": "javiera-urra-conejeros", "athlete_profile_image": null, "athlete_yob": 2011, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202425/javiera-urra-conejeros", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 948932, "program_id": 679136, "athlete_id": 202435, "athlete_full_name": "Antonelli Kirchner", "athlete_slug": "antonelli-kirchner", "athlete_profile_image": null, "athlete_yob": 2011, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202435/antonelli-kirchner", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 948917, "program_id": 679136, "athlete_id": 202423, "athlete_full_name": "Florencia Peña", "athlete_slug": "florencia-pena", "athlete_profile_image": null, "athlete_yob": 2011, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202423/florencia-pena", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 948916, "program_id": 679136, "athlete_id": 195697, "athlete_full_name": "Maria Victoria Urrutia Cifuentes", "athlete_slug": "", "athlete_profile_image": null, "athlete_yob": 2009, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/195697/maria-victoria-urrutia-cifuentes", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 948915, "program_id": 679136, "athlete_id": 202427, "athlete_full_name": "Maite Bengoechea", "athlete_slug": "maite-bengoechea", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202427/maite-bengoechea", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 948783, "program_id": 679136, "athlete_id": 202545, "athlete_full_name": "Rafaela Gomez de la torre Suarez", "athlete_slug": "rafaela-gomez-de-la-torre", "athlete_profile_image": null, "athlete_yob": 2011, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202545/rafaela-gomez-de-la-torre", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 948782, "program_id": 679136, "athlete_id": 201625, "athlete_full_name": "Gilie Giraldo del Carpio", "athlete_slug": "gilie-giraldo-del-carpio", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "PER", "athlete_flag_circle": "banderas/PER.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/201625/gilie-giraldo-del-carpio", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/aedba00d-8cdd-4550-b4c5-b69e04e4eb6f"}, {"entry_id": 902136, "program_id": 679136, "athlete_id": 202443, "athlete_full_name": "Agustina Ignacia Millahual Moreno", "athlete_slug": "agustina-ignacia-millahual-moreno", "athlete_profile_image": null, "athlete_yob": 2011, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202443/agustina-ignacia-millahual-moreno", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 901709, "program_id": 679136, "athlete_id": 202442, "athlete_full_name": "Magdalena Chamorro", "athlete_slug": "magdalena-chamorro", "athlete_profile_image": null, "athlete_yob": 2011, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202442/magdalena-chamorro", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 896388, "program_id": 679136, "athlete_id": 184982, "athlete_full_name": "Laila McIntyre", "athlete_slug": "laila_mcintyre", "athlete_profile_image": null, "athlete_yob": 2011, "athlete_noc": "BAR", "athlete_flag_circle": "banderas/BAR.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/184982/laila-mcintyre", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f12587d9-4bbc-408b-9392-3813ee60799c"}]}, "wait_list": {"team": false, "entries": [{"entry_id": 957292, "program_id": 679136, "athlete_id": 193810, "athlete_full_name": "Angie Sofía López Sánchez", "athlete_slug": "angie-sofia-lopez-sanchez", "athlete_profile_image": null, "athlete_yob": 2010, "athlete_noc": "GUA", "athlete_flag_circle": "banderas/GUA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/193810/angie-sofia-lopez-sanchez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/27a9f5a4-5a44-497e-8f4b-92fbdc093a3d"}]}}, {"program_id": 679317, "name": "Mixed Relay", "gender": "mixed", "date": "2026-07-05", "details": {"prog_id": 679317, "event_id": 195267, "prog_name": "Mixed Relay", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "mixed", "prog_min_age": null, "prog_max_age": null, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": true, "live_timing_enabled": false}, "start_list": {"team": true, "entries": [{"entry_id": 897477, "program_id": 679317, "team_id": 126785, "team_title": "Team I United States", "team_noc": "USA", "team_flag_circle": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 897478, "program_id": 679317, "team_id": 126958, "team_title": "Team II United States", "team_noc": "USA", "team_flag_circle": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 900076, "program_id": 679317, "team_id": 126775, "team_title": "Team I Brazil", "team_noc": "BRA", "team_flag_circle": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 900077, "program_id": 679317, "team_id": 126948, "team_title": "Team II Brazil", "team_noc": "BRA", "team_flag_circle": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 948507, "program_id": 679317, "team_id": 126773, "team_title": "Team I Canada", "team_noc": "CAN", "team_flag_circle": "https://cms.triathlon.org/assets/9c815286-2883-4fb9-999f-4dde18b5e168", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 952000, "program_id": 679317, "team_id": 126809, "team_title": "Team I Colombia", "team_noc": "COL", "team_flag_circle": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 953736, "program_id": 679317, "team_id": 126781, "team_title": "Team I Mexico", "team_noc": "MEX", "team_flag_circle": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 953737, "program_id": 679317, "team_id": 126954, "team_title": "Team II Mexico", "team_noc": "MEX", "team_flag_circle": "https://cms.triathlon.org/assets/3942e657-0458-42e2-9ba5-715fc23efc0d", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 954847, "program_id": 679317, "team_id": 126793, "team_title": "Team I Venezuela", "team_noc": "VEN", "team_flag_circle": "https://cms.triathlon.org/assets/0c8160fd-8277-4761-98f4-ecfc875dd828", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 955494, "program_id": 679317, "team_id": 126816, "team_title": "Team I Chile", "team_noc": "CHI", "team_flag_circle": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 955501, "program_id": 679317, "team_id": 126989, "team_title": "Team II Chile", "team_noc": "CHI", "team_flag_circle": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 955515, "program_id": 679317, "team_id": 126790, "team_title": "Team I Argentina", "team_noc": "ARG", "team_flag_circle": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 955516, "program_id": 679317, "team_id": 126963, "team_title": "Team II Argentina", "team_noc": "ARG", "team_flag_circle": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 955628, "program_id": 679317, "team_id": 126803, "team_title": "Team I Costa Rica", "team_noc": "CRC", "team_flag_circle": "https://cms.triathlon.org/assets/addc5f8b-a19f-400c-a94c-fbd2674f2070", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}]}, "wait_list": {"team": true, "entries": [{"entry_id": 900078, "program_id": 679317, "team_id": 135032, "team_title": "Team III Brazil", "team_noc": "BRA", "team_flag_circle": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 954036, "program_id": 679317, "team_id": 127165, "team_title": "Team III United States", "team_noc": "USA", "team_flag_circle": "https://cms.triathlon.org/assets/c2674903-f97f-4490-a93e-284160d7cb94", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 957055, "program_id": 679317, "team_id": 126823, "team_title": "Team I Ecuador", "team_noc": "ECU", "team_flag_circle": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}, {"entry_id": 957056, "program_id": 679317, "team_id": 126996, "team_title": "Team II Ecuador", "team_noc": "ECU", "team_flag_circle": "https://cms.triathlon.org/assets/e8339442-d22d-4e37-943f-5c4113a7876f", "start_num": null, "wait_pos": null, "team_members": [], "athlete_profile_image_original": null, "athlete_profile_image": null, "athlete_flag_circle_original": null, "athlete_flag_circle": null}]}}, {"program_id": 679168, "name": "25-29 Female AG", "gender": "female", "date": "2026-07-05", "details": {"prog_id": 679168, "event_id": 195267, "prog_name": "25-29 Female AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "female", "prog_min_age": 25, "prog_max_age": 29, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 956416, "program_id": 679168, "athlete_id": 216871, "athlete_full_name": "Katia Cáceres Marín", "athlete_slug": "katia-caceres-marin", "athlete_profile_image": null, "athlete_yob": 1999, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216871/katia-caceres-marin", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956417, "program_id": 679168, "athlete_id": 216872, "athlete_full_name": "Katarina Salopek", "athlete_slug": "katarina-salopek", "athlete_profile_image": null, "athlete_yob": 1997, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216872/katarina-salopek", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679169, "name": "30-34 Female AG", "gender": "female", "date": "2026-07-05", "details": {"prog_id": 679169, "event_id": 195267, "prog_name": "30-34 Female AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "female", "prog_min_age": 30, "prog_max_age": 34, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 947394, "program_id": 679169, "athlete_id": 216037, "athlete_full_name": "Nathaly Motti", "athlete_slug": "nathaly-motti", "athlete_profile_image": null, "athlete_yob": 1996, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216037/nathaly-motti", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 948946, "program_id": 679169, "athlete_id": 216226, "athlete_full_name": "Fabíola Lorena Ferreira Reccanello", "athlete_slug": "fabiola-lorena-ferreira-reccanello", "athlete_profile_image": null, "athlete_yob": 1992, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216226/fabiola-lorena-ferreira-reccanello", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 956418, "program_id": 679169, "athlete_id": 216873, "athlete_full_name": "Gabriela Correia", "athlete_slug": "gabriela-correia", "athlete_profile_image": null, "athlete_yob": 1996, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216873/gabriela-correia", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 956419, "program_id": 679169, "athlete_id": 216874, "athlete_full_name": "Catalina Jael Araya Paredes", "athlete_slug": "catalina-jael-araya-paredes", "athlete_profile_image": null, "athlete_yob": 1993, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216874/catalina-jael-araya-paredes", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956420, "program_id": 679169, "athlete_id": 196545, "athlete_full_name": "Josefa Maria De La Victoria Quiroga Gonzalez", "athlete_slug": "josefa-maria-de-la-victoria-quiroga-gonzalez", "athlete_profile_image": null, "athlete_yob": 1993, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/196545/josefa-maria-de-la-victoria-quiroga-gonzalez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956421, "program_id": 679169, "athlete_id": 216875, "athlete_full_name": "Fernanda Tapia Santander", "athlete_slug": "fernanda-tapia-santander", "athlete_profile_image": null, "athlete_yob": 1993, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216875/fernanda-tapia-santander", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679170, "name": "35-39 Female AG", "gender": "female", "date": "2026-07-05", "details": {"prog_id": 679170, "event_id": 195267, "prog_name": "35-39 Female AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "female", "prog_min_age": 35, "prog_max_age": 39, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 947395, "program_id": 679170, "athlete_id": 216038, "athlete_full_name": "Rebeka Calixto", "athlete_slug": "rebeka-calixto", "athlete_profile_image": null, "athlete_yob": 1987, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216038/rebeka-calixto", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 956422, "program_id": 679170, "athlete_id": 216876, "athlete_full_name": "Francisca Yévenes", "athlete_slug": "francisca-yevenes", "athlete_profile_image": null, "athlete_yob": 1990, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216876/francisca-yevenes", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956423, "program_id": 679170, "athlete_id": 216877, "athlete_full_name": "Valeria Cofre", "athlete_slug": "valeria-cofre", "athlete_profile_image": null, "athlete_yob": 1989, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216877/valeria-cofre", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956424, "program_id": 679170, "athlete_id": 216878, "athlete_full_name": "Nicolle López Pfeng", "athlete_slug": "nicolle-lopez-pfeng", "athlete_profile_image": null, "athlete_yob": 1987, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216878/nicolle-lopez-pfeng", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679171, "name": "40-44 Female AG", "gender": "female", "date": "2026-07-05", "details": {"prog_id": 679171, "event_id": 195267, "prog_name": "40-44 Female AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "female", "prog_min_age": 40, "prog_max_age": 44, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 948947, "program_id": 679171, "athlete_id": 216227, "athlete_full_name": "Bianca Alberge Lombardi", "athlete_slug": "bianca-alberge-lombardi", "athlete_profile_image": null, "athlete_yob": 1986, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216227/bianca-alberge-lombardi", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 948948, "program_id": 679171, "athlete_id": 216228, "athlete_full_name": "Camila Karim Nakase Yamasato", "athlete_slug": "camila-karim-nakase-yamasato", "athlete_profile_image": null, "athlete_yob": 1982, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216228/camila-karim-nakase-yamasato", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 956425, "program_id": 679171, "athlete_id": 216879, "athlete_full_name": "Loreto Herrera Courbis", "athlete_slug": "loreto-herrera-courbis", "athlete_profile_image": null, "athlete_yob": 1982, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216879/loreto-herrera-courbis", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679159, "name": "50-54 Female AG", "gender": "female", "date": "2026-07-05", "details": {"prog_id": 679159, "event_id": 195267, "prog_name": "50-54 Female AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "female", "prog_min_age": 50, "prog_max_age": 54, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 956426, "program_id": 679159, "athlete_id": 216880, "athlete_full_name": "Susana Zapata", "athlete_slug": "susana-zapata", "athlete_profile_image": null, "athlete_yob": 1972, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216880/susana-zapata", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679160, "name": "55-59 Female AG", "gender": "female", "date": "2026-07-05", "details": {"prog_id": 679160, "event_id": 195267, "prog_name": "55-59 Female AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "female", "prog_min_age": 55, "prog_max_age": 59, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 956427, "program_id": 679160, "athlete_id": 216881, "athlete_full_name": "Laura Araya", "athlete_slug": "laura-araya", "athlete_profile_image": null, "athlete_yob": 1970, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216881/laura-araya", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679137, "name": "18-19 Open AG", "gender": "mixed", "date": "2026-07-05", "details": {"prog_id": 679137, "event_id": 195267, "prog_name": "18-19 Open AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "mixed", "prog_min_age": 18, "prog_max_age": 19, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 955691, "program_id": 679137, "athlete_id": 202828, "athlete_full_name": "Ciro Calice", "athlete_slug": "ciro-calice", "athlete_profile_image": null, "athlete_yob": 2008, "athlete_noc": "ARG", "athlete_flag_circle": "banderas/ARG.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/202828/ciro-calice", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/8cb6c7e5-e104-4937-8a41-8bccacfdc529"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679154, "name": "25-29 Open AG", "gender": "mixed", "date": "2026-07-05", "details": {"prog_id": 679154, "event_id": 195267, "prog_name": "25-29 Open AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "mixed", "prog_min_age": 25, "prog_max_age": 29, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 948949, "program_id": 679154, "athlete_id": 216229, "athlete_full_name": "Bernardo Cançado", "athlete_slug": "bernardo-cancado", "athlete_profile_image": null, "athlete_yob": 2001, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216229/bernardo-cancado", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 956428, "program_id": 679154, "athlete_id": 110175, "athlete_full_name": "Christian Mondaca Vergara", "athlete_slug": "christian-mondaca-vergara", "athlete_profile_image": null, "athlete_yob": 2000, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/110175/christian-mondaca-vergara", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679140, "name": "30-34 Open AG", "gender": "mixed", "date": "2026-07-05", "details": {"prog_id": 679140, "event_id": 195267, "prog_name": "30-34 Open AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "mixed", "prog_min_age": 30, "prog_max_age": 34, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 956429, "program_id": 679140, "athlete_id": 216882, "athlete_full_name": "Patricio Flores", "athlete_slug": "patricio-flores", "athlete_profile_image": null, "athlete_yob": 1996, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216882/patricio-flores", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956430, "program_id": 679140, "athlete_id": 197523, "athlete_full_name": "Ricardo Javier Bruna Cortes", "athlete_slug": "ricardo-javier-bruna-cortes", "athlete_profile_image": null, "athlete_yob": 1992, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/197523/ricardo-javier-bruna-cortes", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679156, "name": "35-39 Open AG", "gender": "mixed", "date": "2026-07-05", "details": {"prog_id": 679156, "event_id": 195267, "prog_name": "35-39 Open AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "mixed", "prog_min_age": 35, "prog_max_age": 39, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 947396, "program_id": 679156, "athlete_id": 216039, "athlete_full_name": "Antonio Agrelli Neto", "athlete_slug": "antonio-agrelli-neto", "athlete_profile_image": null, "athlete_yob": 1987, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216039/antonio-agrelli-neto", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 956431, "program_id": 679156, "athlete_id": 216883, "athlete_full_name": "Rodrigo Esquivel Johnson", "athlete_slug": "rodrigo-esquivel-johnson", "athlete_profile_image": null, "athlete_yob": 1991, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216883/rodrigo-esquivel-johnson", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956432, "program_id": 679156, "athlete_id": 216884, "athlete_full_name": "Thomas Gattoni", "athlete_slug": "thomas-gattoni", "athlete_profile_image": null, "athlete_yob": 1990, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216884/thomas-gattoni", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956433, "program_id": 679156, "athlete_id": 216885, "athlete_full_name": "Matías Hernandez", "athlete_slug": "matias-hernandez", "athlete_profile_image": null, "athlete_yob": 1990, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216885/matias-hernandez", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956434, "program_id": 679156, "athlete_id": 216886, "athlete_full_name": "Sebastian Saldivia", "athlete_slug": "sebastian-saldivia", "athlete_profile_image": null, "athlete_yob": 1990, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216886/sebastian-saldivia", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956435, "program_id": 679156, "athlete_id": 216887, "athlete_full_name": "Eber Lutz", "athlete_slug": "eber-lutz", "athlete_profile_image": null, "athlete_yob": 1988, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216887/eber-lutz", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956436, "program_id": 679156, "athlete_id": 216888, "athlete_full_name": "Carlos Amigo", "athlete_slug": "carlos-amigo", "athlete_profile_image": null, "athlete_yob": 1987, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216888/carlos-amigo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956437, "program_id": 679156, "athlete_id": 216889, "athlete_full_name": "Carlos Amigo", "athlete_slug": "carlos-amigo", "athlete_profile_image": null, "athlete_yob": 1987, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216889/carlos-amigo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956438, "program_id": 679156, "athlete_id": 197529, "athlete_full_name": "Ignacio Soto Leyton", "athlete_slug": "ignacio-soto-leyton", "athlete_profile_image": null, "athlete_yob": 1987, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/197529/ignacio-soto-leyton", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679142, "name": "40-44 Open AG", "gender": "mixed", "date": "2026-07-05", "details": {"prog_id": 679142, "event_id": 195267, "prog_name": "40-44 Open AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "mixed", "prog_min_age": 40, "prog_max_age": 44, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 947397, "program_id": 679142, "athlete_id": 216040, "athlete_full_name": "Ericson Faria Pessanha Neto", "athlete_slug": "ericson-faria-pessanha-neto", "athlete_profile_image": null, "athlete_yob": 1982, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216040/ericson-faria-pessanha-neto", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 947398, "program_id": 679142, "athlete_id": 216041, "athlete_full_name": "Rafael Obrzut", "athlete_slug": "rafael-obrzut", "athlete_profile_image": null, "athlete_yob": 1985, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216041/rafael-obrzut", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 947399, "program_id": 679142, "athlete_id": 216042, "athlete_full_name": "Esteban Toloza", "athlete_slug": "esteban-toloza", "athlete_profile_image": null, "athlete_yob": 1986, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216042/esteban-toloza", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956439, "program_id": 679142, "athlete_id": 216890, "athlete_full_name": "Jose francisco Balmaceda tapia", "athlete_slug": "jose-francisco-balmaceda-tapia", "athlete_profile_image": null, "athlete_yob": 1986, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216890/jose-francisco-balmaceda-tapia", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956440, "program_id": 679142, "athlete_id": 216891, "athlete_full_name": "Gustavo Aravena", "athlete_slug": "gustavo-aravena", "athlete_profile_image": null, "athlete_yob": 1984, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216891/gustavo-aravena", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956441, "program_id": 679142, "athlete_id": 216892, "athlete_full_name": "Jonathan Concha Guajardo", "athlete_slug": "jonathan-concha-guajardo", "athlete_profile_image": null, "athlete_yob": 1984, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216892/jonathan-concha-guajardo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956442, "program_id": 679142, "athlete_id": 196578, "athlete_full_name": "Pablo González Villegas", "athlete_slug": "pablo-gonzalez-villegas", "athlete_profile_image": null, "athlete_yob": 1984, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/196578/pablo-gonzalez-villegas", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956443, "program_id": 679142, "athlete_id": 216893, "athlete_full_name": "Gustavo Ortega Díaz", "athlete_slug": "gustavo-ortega-diaz", "athlete_profile_image": null, "athlete_yob": 1984, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216893/gustavo-ortega-diaz", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956444, "program_id": 679142, "athlete_id": 216894, "athlete_full_name": "José Rossi", "athlete_slug": "jose-rossi", "athlete_profile_image": null, "athlete_yob": 1984, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216894/jose-rossi", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956445, "program_id": 679142, "athlete_id": 216895, "athlete_full_name": "Renato Bahamondes", "athlete_slug": "renato-bahamondes", "athlete_profile_image": null, "athlete_yob": 1982, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216895/renato-bahamondes", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956446, "program_id": 679142, "athlete_id": 216896, "athlete_full_name": "Hector Cifuentes", "athlete_slug": "hector-cifuentes", "athlete_profile_image": null, "athlete_yob": 1982, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216896/hector-cifuentes", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956447, "program_id": 679142, "athlete_id": 216897, "athlete_full_name": "Luis Alberto Guevara Araya", "athlete_slug": "luis-alberto-guevara-araya", "athlete_profile_image": null, "athlete_yob": 1982, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216897/luis-alberto-guevara-araya", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679143, "name": "45-49 Open AG", "gender": "mixed", "date": "2026-07-05", "details": {"prog_id": 679143, "event_id": 195267, "prog_name": "45-49 Open AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "mixed", "prog_min_age": 45, "prog_max_age": 49, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 955690, "program_id": 679143, "athlete_id": 216844, "athlete_full_name": "Dennys Marcel Sanches Martins", "athlete_slug": "dennys-marcel-sanches-martins", "athlete_profile_image": null, "athlete_yob": 1980, "athlete_noc": "BRA", "athlete_flag_circle": "banderas/BRA.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216844/dennys-marcel-sanches-martins", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/f9a4314a-4606-4ef2-9b3f-1069893fe451"}, {"entry_id": 956448, "program_id": 679143, "athlete_id": 75752, "athlete_full_name": "Claudio Montejo Soler", "athlete_slug": "claudio-montejo-soler", "athlete_profile_image": null, "athlete_yob": 1980, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/75752/claudio-montejo-soler", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956449, "program_id": 679143, "athlete_id": 119868, "athlete_full_name": "Cristian Aspillaga Hurtado", "athlete_slug": "cristian-aspillaga-hurtado", "athlete_profile_image": null, "athlete_yob": 1979, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/119868/cristian-aspillaga-hurtado", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956450, "program_id": 679143, "athlete_id": 216898, "athlete_full_name": "Enrique León", "athlete_slug": "enrique-leon", "athlete_profile_image": null, "athlete_yob": 1979, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216898/enrique-leon", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956451, "program_id": 679143, "athlete_id": 216899, "athlete_full_name": "Oscar Benavides", "athlete_slug": "oscar-benavides", "athlete_profile_image": null, "athlete_yob": 1978, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216899/oscar-benavides", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956452, "program_id": 679143, "athlete_id": 196420, "athlete_full_name": "Leonardo Bobadilla", "athlete_slug": "leonardo-bobadilla", "athlete_profile_image": null, "athlete_yob": 1978, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/196420/leonardo-bobadilla", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956453, "program_id": 679143, "athlete_id": 198053, "athlete_full_name": "Rodrigo Caceres Sanhueza", "athlete_slug": "rodrigo-caceres-sanhueza", "athlete_profile_image": null, "athlete_yob": 1978, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/198053/rodrigo-caceres-sanhueza", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956454, "program_id": 679143, "athlete_id": 134234, "athlete_full_name": "Rodrigo Pineda", "athlete_slug": "rodrigo-pineda", "athlete_profile_image": null, "athlete_yob": 1977, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/134234/rodrigo-pineda", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679144, "name": "50-54 Open AG", "gender": "mixed", "date": "2026-07-05", "details": {"prog_id": 679144, "event_id": 195267, "prog_name": "50-54 Open AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "mixed", "prog_min_age": 50, "prog_max_age": 54, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 956455, "program_id": 679144, "athlete_id": 134302, "athlete_full_name": "Nelson Sepúlveda", "athlete_slug": "nelson-sepulveda", "athlete_profile_image": null, "athlete_yob": 1973, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/134302/nelson-sepulveda", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956456, "program_id": 679144, "athlete_id": 197541, "athlete_full_name": "Marcel Andre Zebil Strange", "athlete_slug": "marcel-andre-zebil-strange", "athlete_profile_image": null, "athlete_yob": 1972, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/197541/marcel-andre-zebil-strange", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679145, "name": "55-59 Open AG", "gender": "mixed", "date": "2026-07-05", "details": {"prog_id": 679145, "event_id": 195267, "prog_name": "55-59 Open AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "mixed", "prog_min_age": 55, "prog_max_age": 59, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 956457, "program_id": 679145, "athlete_id": 175302, "athlete_full_name": "Felipe Rojas Andrade", "athlete_slug": "felipe-rojas-andrade", "athlete_profile_image": null, "athlete_yob": 1970, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175302/felipe-rojas-andrade", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956458, "program_id": 679145, "athlete_id": 216900, "athlete_full_name": "Alex Castillo", "athlete_slug": "alex-castillo", "athlete_profile_image": null, "athlete_yob": 1968, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216900/alex-castillo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956459, "program_id": 679145, "athlete_id": 175304, "athlete_full_name": "Vicencio Antezana Pardo", "athlete_slug": "vicencio-antezana-pardo", "athlete_profile_image": null, "athlete_yob": 1967, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/175304/vicencio-antezana-pardo", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}, {"entry_id": 956460, "program_id": 679145, "athlete_id": 216901, "athlete_full_name": "Marcelo Román", "athlete_slug": "marcelo-roman", "athlete_profile_image": null, "athlete_yob": 1971, "athlete_noc": "CHI", "athlete_flag_circle": "banderas/CHI.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/216901/marcelo-roman", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/a6622a94-803d-4f89-969c-89d49f0b1236"}]}, "wait_list": {"team": false, "entries": []}}, {"program_id": 679148, "name": "70-74 Open AG", "gender": "mixed", "date": "2026-07-05", "details": {"prog_id": 679148, "event_id": 195267, "prog_name": "70-74 Open AG", "is_race": true, "prog_date": "2026-07-05", "prog_date_utc": "2026-07-05", "prog_time": null, "prog_time_utc": null, "prog_timezone_name": "America/Santiago", "prog_timezone_offset": "UTC-04:00", "prog_gender": "mixed", "prog_min_age": 70, "prog_max_age": 74, "prog_distance_category": null, "prog_distances": [], "prog_notes": null, "results": false, "team": false, "live_timing_enabled": false}, "start_list": {"team": false, "entries": [{"entry_id": 948950, "program_id": 679148, "athlete_id": 86632, "athlete_full_name": "Pedro Vizcaya-Guarin", "athlete_slug": "pedro_vizcaya_guarin", "athlete_profile_image": null, "athlete_yob": 1955, "athlete_noc": "COL", "athlete_flag_circle": "banderas/COL.svg", "athlete_listing": "https://www.triathlon.org/athletes/profile/86632/pedro-vizcaya-guarin", "start_num": null, "wait_pos": null, "notes": null, "athlete_profile_image_original": null, "athlete_flag_circle_original": "https://cms.triathlon.org/assets/cea4af5e-1298-41db-bba7-1dd8d541e26c"}]}, "wait_list": {"team": false, "entries": []}}]};
        const RUTAS_DATA = {"type": "FeatureCollection", "features": [{"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[-70.41016625352196, -23.67232761229798], [-70.409278741367, -23.67182425794568], [-70.40931177932299, -23.67179236011825], [-70.40936413651562, -23.67176815735264], [-70.4094141266843, -23.67177045309292], [-70.4094723354266, -23.6717743774661], [-70.40951644720283, -23.67176774895048], [-70.40956154905612, -23.67175742795526], [-70.4096350314425, -23.67176826913093], [-70.40970688532603, -23.67180196155478], [-70.41029548517986, -23.67215838964704], [-70.41016625352196, -23.67232761229798]]]}, "properties": {"name": "recovery", "description": ""}}, {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-70.41004869233323, -23.67216258947198]}, "properties": {"name": "Recovery", "description": ""}}, {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[-70.4105018935295, -23.67218952822724], [-70.41012769208436, -23.67196988893237], [-70.41016902982369, -23.67190343595371], [-70.4103458892262, -23.671877400057], [-70.41058926398107, -23.6720894958235], [-70.4105018935295, -23.67218952822724]]]}, "properties": {"name": "operation", "description": ""}}, {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-70.41047697355285, -23.67210400244112]}, "properties": {"name": "Operation", "description": ""}}, {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[-70.4091333074335, -23.67069694344567], [-70.4090689852567, -23.66918192037109], [-70.4096623487956, -23.66918105424364], [-70.40958204791121, -23.66794539965021], [-70.40876967181795, -23.66801175289123], [-70.40886031496298, -23.66918110468255], [-70.40889563549479, -23.67072852258053]]}, "properties": {"name": "swim_elite", "description": ""}}, {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[-70.40891000342349, -23.67070702129473], [-70.40886259041022, -23.66914066430875], [-70.40881166626158, -23.6685704553637], [-70.40877960325194, -23.6679918776385], [-70.41157415604852, -23.66789534534022], [-70.4126985587613, -23.66789621792155], [-70.41334891289353, -23.66790153857611], [-70.41316773732703, -23.66919367529314], [-70.40905580916463, -23.66917716654983], [-70.40911846824172, -23.67070029086966]]}, "properties": {"name": "swim_ag", "description": ""}}, {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[-70.40912541465484, -23.67073221247929], [-70.4086834440435, -23.67073039292475]]}, "properties": {"name": "start line", "description": ""}}, {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[-70.40763032197056, -23.67075355532173], [-70.4075263333349, -23.67075491497364], [-70.40745197136506, -23.67075829316495], [-70.40739729540519, -23.67079948086977], [-70.4074041701428, -23.67086143749478], [-70.4074552694834, -23.67095446561068], [-70.40754752978519, -23.6710454287794], [-70.40764783370774, -23.67110673364632], [-70.40794200281199, -23.67129321512677], [-70.40809431200863, -23.67137395322152], [-70.40823323047368, -23.6714526572371], [-70.40858550456778, -23.67164669447127], [-70.40894319260126, -23.67184535353373], [-70.40914451859946, -23.67196542376826], [-70.40957819125563, -23.6722225852394], [-70.40962605409338, -23.67223993467557], [-70.40969696937285, -23.67225166803269], [-70.40976028114135, -23.67226553730731], [-70.40984001133565, -23.67230006658586], [-70.40995901141977, -23.67236212777202], [-70.41013464192245, -23.6724650690667], [-70.4102981707267, -23.67255873123653], [-70.41041899044436, -23.67263828411334], [-70.41052438782862, -23.67272480452007], [-70.41071107265628, -23.67294934905716], [-70.4110265446683, -23.67339767784433], [-70.4113480125536, -23.6738595578908], [-70.41155909389799, -23.67418537884778], [-70.41176424823806, -23.67464192225565], [-70.41208736570593, -23.67557387700442], [-70.4124196597744, -23.67655962723883], [-70.41270081059118, -23.67735595785123], [-70.41296402701276, -23.67815133858947], [-70.41324203819985, -23.67909654476471], [-70.41338562004658, -23.67959135699524], [-70.41358204805421, -23.68026948106235], [-70.41364503913421, -23.6804885133968], [-70.41368701576174, -23.68065403561967], [-70.41369599403218, -23.68076194398435], [-70.41369002176738, -23.680850229706], [-70.41367758480693, -23.68091232374902], [-70.41368160585561, -23.68097912883975], [-70.41369647103203, -23.68106197301824], [-70.41373657401269, -23.68120010680292], [-70.41390115826475, -23.68175848885332], [-70.41403823877585, -23.68202287797359], [-70.41414157375047, -23.68216535232698], [-70.417350564493, -23.68551116944427], [-70.41808802134948, -23.68629288618756], [-70.41853791327395, -23.68676295067686], [-70.41871125707668, -23.68697040657166], [-70.41900883343946, -23.68731152754404], [-70.41917127846249, -23.68754093188718], [-70.41934096977121, -23.68781401436736], [-70.41948761385427, -23.68804753704681], [-70.41963322999746, -23.68833526003975], [-70.41976301381767, -23.68861167915238], [-70.41984601983475, -23.68884048083944], [-70.42000737342306, -23.68928083687913], [-70.42012202103021, -23.68963378811481], [-70.42025005915816, -23.69000082909132], [-70.42033781484768, -23.6902810922766], [-70.42050456110036, -23.69081521032255], [-70.42053867952463, -23.69091135250999], [-70.42054877489755, -23.69092560677643], [-70.42058191086687, -23.69093437394995], [-70.42060673796226, -23.69093367500453], [-70.42062623140819, -23.6909282490414], [-70.42063609999533, -23.69091576306855], [-70.42064046515877, -23.69089104574737], [-70.42063543595012, -23.69086558194766], [-70.42057187017812, -23.69068428010841], [-70.4204971975171, -23.69046943416381], [-70.42043107764664, -23.69027744737439], [-70.4203505813491, -23.69004369264092], [-70.42021832533864, -23.68966474032608], [-70.42012513814375, -23.68936089026356], [-70.41997159130433, -23.6889054944046], [-70.41988938369036, -23.68866754687276], [-70.41976201123654, -23.6883576159713], [-70.41962355332873, -23.68805800109392], [-70.41952222884319, -23.68786429685484], [-70.41931317349744, -23.68753993203797], [-70.41913760462982, -23.68728686941604], [-70.41898394463595, -23.68709437399246], [-70.41882149309652, -23.686903412882], [-70.41861758400978, -23.68668804050495], [-70.41816113152979, -23.68620466268628], [-70.41655647715919, -23.68451253759559], [-70.41521521542907, -23.68312888079819], [-70.4142530979131, -23.68208380605113], [-70.4141569800459, -23.68196059271134], [-70.41407450285004, -23.68181302228664], [-70.41398915801797, -23.68158073261213], [-70.41390647389059, -23.68133656529895], [-70.41365800595085, -23.68037580149108], [-70.41343529635812, -23.67958201407309], [-70.41300905918273, -23.67814398555897], [-70.41270816627332, -23.67723401274831], [-70.41239494417098, -23.67634518874836], [-70.41222645905411, -23.67583852157836], [-70.41182495140791, -23.67466022540609], [-70.41168829179087, -23.67434875466546], [-70.41160323602564, -23.67415337415328], [-70.41139570349597, -23.67382270561928], [-70.41104963789238, -23.67335152246583], [-70.41075276152016, -23.67292315025098], [-70.4106768112587, -23.67282067160813], [-70.41057797042468, -23.67271768998476], [-70.41049442141367, -23.67264701846115], [-70.41042186739524, -23.67259145408201], [-70.4102997311472, -23.67250609679913], [-70.41016050117638, -23.67241770769331], [-70.40999793838314, -23.6723194954515], [-70.40963408000219, -23.67211470120037], [-70.40920599180471, -23.6718738502785], [-70.40878001391583, -23.67160251447891], [-70.40870728726796, -23.67154626694917], [-70.40862094161824, -23.67146105850058], [-70.40855752812537, -23.67139884233936], [-70.40848653745967, -23.67132543135131], [-70.40832859060231, -23.67116900261501], [-70.40824321735016, -23.67108176795808], [-70.4081267862271, -23.67096521006749], [-70.4080429664697, -23.67089530133589], [-70.40797026222621, -23.67083664634596], [-70.40790276545444, -23.67080888232986], [-70.4078299588768, -23.67077964310815], [-70.40771978724096, -23.67076064157875], [-70.40763032197056, -23.67075355532173]]}, "properties": {"name": "bike", "description": ""}}, {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[-70.40932162782521, -23.671305489567], [-70.40882806056747, -23.67132893452316], [-70.40859539765158, -23.67124276041983], [-70.408397265795, -23.67108808800979], [-70.40817123119325, -23.67085311726174], [-70.40804229241705, -23.67076189860535], [-70.40794271281652, -23.67070557997213], [-70.40785526919056, -23.67071284126582], [-70.40775534624342, -23.67071204711005], [-70.40767711502411, -23.67068817342969], [-70.40756325059691, -23.67063174650228], [-70.40747249070968, -23.67056241720666], [-70.4074162145267, -23.67050043803655], [-70.40737250797851, -23.67044296264073], [-70.4073195495922, -23.67033263554202], [-70.40703965434669, -23.66956086914314], [-70.4069258047475, -23.66927300509036], [-70.40671081945504, -23.66877565375715], [-70.40656720463835, -23.66844374266231], [-70.40624618054426, -23.66772843876745], [-70.40603747907326, -23.66731873151968], [-70.40597404388488, -23.66719654745982], [-70.40549384681496, -23.66625076110439], [-70.40539925782004, -23.66606124607781], [-70.40533943201008, -23.66593976975954], [-70.40524540383188, -23.66581145885112], [-70.4051535989873, -23.6656977365197], [-70.40502530260474, -23.66555828255391], [-70.40486585271928, -23.66542194334475], [-70.40432173468722, -23.66500076543401], [-70.40416510324071, -23.66487778084224], [-70.40404959436856, -23.66478057644142], [-70.40397039911578, -23.66470058296314], [-70.40391526166086, -23.6646217759798], [-70.40387618783198, -23.66454524622679], [-70.40385703787786, -23.66447498078492], [-70.40382556910934, -23.66420972518432], [-70.40379749666278, -23.66371300035868], [-70.40379691642299, -23.66363305193985], [-70.40380348139004, -23.66262179162196], [-70.40380073752299, -23.66261293502829], [-70.40379333743965, -23.66260606924899], [-70.40378315198419, -23.66260553693114], [-70.40377702338438, -23.66260962456537], [-70.40377292706, -23.66262010600211], [-70.40379131416005, -23.66399122727407], [-70.40381508317958, -23.66440723368671], [-70.40384552604131, -23.66451182963695], [-70.40386644990448, -23.66457411296656], [-70.40389792278927, -23.66463422681916], [-70.40394637716113, -23.66470623989068], [-70.40400653173565, -23.66477583582328], [-70.40411794025783, -23.664870731465], [-70.40498047881489, -23.66554754097742], [-70.40507056142432, -23.66563337350751], [-70.40515230046041, -23.66572903746098], [-70.40530958553086, -23.66594400654507], [-70.40551439059038, -23.66635852723226], [-70.40621943439704, -23.66772569370063], [-70.40631287261262, -23.66794328709841], [-70.40679011896813, -23.66904195865295], [-70.40701528954293, -23.66956361383642], [-70.40710274216079, -23.66981539807009], [-70.40731736484943, -23.67042397543102], [-70.40736515570501, -23.67050202912267], [-70.40742821719896, -23.67057654304014], [-70.40754168193199, -23.67066106036311], [-70.4076483196272, -23.67071535735109], [-70.40776256185384, -23.67074981823142], [-70.40790281673544, -23.67080842575319], [-70.40811351927059, -23.67095285893767], [-70.40856260286571, -23.67140248412195], [-70.40869500476138, -23.67152570564046], [-70.40877989993366, -23.67158958733693], [-70.40890698807738, -23.67166642080819], [-70.40917801341202, -23.67184310288707], [-70.40924153873203, -23.67179857823665], [-70.40927356905614, -23.67172652671384], [-70.4092646570594, -23.67166412764967], [-70.40930211170587, -23.67156717202495], [-70.40939023122556, -23.67149561239719], [-70.40939852605875, -23.67143761403363], [-70.40939895949946, -23.6713844953443], [-70.40937307702208, -23.67133220869506], [-70.40932162782521, -23.671305489567]]}, "properties": {"name": "run", "description": ""}}, {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[-70.4094007919826, -23.67138709712774], [-70.40956967665551, -23.67151101646671], [-70.40963121572852, -23.67157779621548], [-70.40969058212565, -23.67166484686682], [-70.4097192973453, -23.67171506930168], [-70.40976211749394, -23.67175970052995], [-70.40979572909292, -23.67179134069436], [-70.40982646751453, -23.67182711925997], [-70.4098518241221, -23.67184224164197], [-70.40987489602524, -23.67185873393257], [-70.40990338671435, -23.67187509256115], [-70.41001176609355, -23.67193787347577]]}, "properties": {"name": "run_to_finish", "description": ""}}, {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[-70.40981631973041, -23.671858738062], [-70.4097700094852, -23.67183246502335], [-70.40972376066162, -23.67180332236888], [-70.4096628082929, -23.6717197904289], [-70.40957822658208, -23.67159339886481], [-70.40950981159948, -23.67151844449235], [-70.40943960193727, -23.67146356740511], [-70.40941048855188, -23.67144452173862], [-70.40941549839579, -23.67137266306543], [-70.4094599056503, -23.67140870208977], [-70.4095616664965, -23.671476376656], [-70.40964723857948, -23.67157135955539], [-70.40973443648313, -23.67169410412902], [-70.40979077230928, -23.67176568902534], [-70.40981409706197, -23.67179087526036], [-70.40985159081512, -23.67181599031244], [-70.41017788576889, -23.67201268804521], [-70.410150141217, -23.67205641503293], [-70.40981631973041, -23.671858738062]]]}, "properties": {"name": "finish", "description": ""}}, {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-70.41005209148749, -23.67190669193265]}, "properties": {"name": "Finish line", "description": ""}}, {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[-70.40999641120423, -23.67196154119497], [-70.41003380197422, -23.67191828991966]]}, "properties": {"name": "finish line", "description": ""}}, {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-70.41014394410674, -23.67201352216792]}, "properties": {"name": "Finish area", "description": ""}}, {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-70.40970701061329, -23.67169451641564]}, "properties": {"name": "Finish path", "description": ""}}, {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[-70.41010424965934, -23.67235824898599], [-70.41008019265162, -23.67239440674032], [-70.40997966016234, -23.67233713952601], [-70.40991925767675, -23.67230369797245], [-70.40984709149956, -23.67226595596695], [-70.40962782788172, -23.67214211646384], [-70.40929771147165, -23.6719552004325], [-70.4093258033392, -23.67191502672478], [-70.40966256698627, -23.67210169426045], [-70.40987219145107, -23.67222270649077], [-70.41010424965934, -23.67235824898599]]]}, "properties": {"name": "elite_TZ", "description": ""}}, {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-70.40974570030212, -23.67217106050527]}, "properties": {"name": "Elite TZ", "description": ""}}, {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[-70.40879807098351, -23.67126275487106], [-70.40877961097546, -23.67129983543165], [-70.40860583540243, -23.67123719333694], [-70.40839135918118, -23.67106125273645], [-70.40816062703485, -23.67082810607817], [-70.40800364878442, -23.67071550557597], [-70.40803521730841, -23.6706769801256], [-70.4081657792604, -23.67078049242317], [-70.40839315559612, -23.67099467936615], [-70.40849791518367, -23.67109460771669], [-70.4084982253724, -23.67109347550973], [-70.40861891185565, -23.67118774365386], [-70.40879807098351, -23.67126275487106]]]}, "properties": {"name": "TZ_age groups", "description": ""}}, {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-70.40842838780365, -23.67106958478875]}, "properties": {"name": "AGroups TZ", "description": ""}}, {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[-70.40944929594738, -23.67119229472211], [-70.40919113342507, -23.67122802447584], [-70.40903006193763, -23.67124159046956], [-70.40888208409805, -23.67124602375306], [-70.4088781535794, -23.67124600954162], [-70.40882665167732, -23.67124339842557], [-70.40877615721396, -23.67124207557186], [-70.40869827081266, -23.67121783024972], [-70.40862354259085, -23.671184864601], [-70.40842523764854, -23.67102522861728], [-70.40828198148445, -23.67088920777956], [-70.40821738075812, -23.67082848730806], [-70.40803767951354, -23.67067662164295], [-70.40799334626078, -23.67072105626603], [-70.4079341883499, -23.67068172211373]]}, "properties": {"name": "fence1", "description": ""}}, {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[-70.4100792475606, -23.67202432514373], [-70.40997017799415, -23.67195662759841], [-70.40982229546154, -23.67186791823262], [-70.40972116220189, -23.67181385365889], [-70.40963866293457, -23.67177822077262], [-70.4095780593572, -23.67176270545256], [-70.40951484413382, -23.67177045932262], [-70.40947030651073, -23.67177197375426], [-70.40942533941838, -23.67177094567831], [-70.40938370544815, -23.67177151009172], [-70.40934099727681, -23.67178505080981], [-70.40930710278322, -23.67180517343817], [-70.4092818785921, -23.67182766088594], [-70.40962456964523, -23.67202129249207], [-70.40986088970618, -23.67215119444727], [-70.41016242456496, -23.67232290183613], [-70.41029927144396, -23.67215689555039], [-70.41014664420811, -23.67206664987184], [-70.41018719117687, -23.67200994658813], [-70.41050365133442, -23.6721912880385], [-70.41058489437138, -23.67208941805886], [-70.4103432761545, -23.67187627250058], [-70.41017747069709, -23.67190129374854], [-70.41012042261204, -23.67197253651789], [-70.4098444655688, -23.67180810480278], [-70.40974420745319, -23.6716935810988], [-70.4096413179063, -23.6715445008854], [-70.40952887668183, -23.67144373105634], [-70.4095739221134, -23.6713761407414], [-70.40959292762581, -23.67130847755307], [-70.40959840895121, -23.67121613373634], [-70.40959932915283, -23.67112951458502]]}, "properties": {"name": "fence2", "description": ""}}, {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[-70.41008567796479, -23.67240933788977], [-70.40999404326001, -23.67235276484169], [-70.40990189469622, -23.67230112957165], [-70.40983153117828, -23.67226648354054], [-70.40977826495022, -23.67225045470079], [-70.40969096050658, -23.67222602749084], [-70.40962928698148, -23.67221112369222], [-70.40959850295849, -23.67219619341294], [-70.4095027489592, -23.67214127061654], [-70.40939098065925, -23.67207538864587], [-70.40920359340488, -23.67195930861625], [-70.40913554083306, -23.6719159282218]]}, "properties": {"name": "fence3", "description": ""}}, {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[-70.40792028016844, -23.67071583068197], [-70.40798065393054, -23.67074625475087], [-70.40804690420643, -23.67078880076814], [-70.40804654531793, -23.67078419652428], [-70.40812079956414, -23.67084072614354], [-70.40819107866433, -23.67090500407141], [-70.40826633168587, -23.67098035425178], [-70.40836581459854, -23.67108337395777], [-70.4084608040982, -23.67116888932678], [-70.40855146358537, -23.67123535119681], [-70.40864137468904, -23.67128554226433], [-70.40874164154656, -23.67133106216341], [-70.40879961056771, -23.67135121053442], [-70.40883595045891, -23.67136412172008], [-70.40887980472412, -23.67137239237557], [-70.40926440193381, -23.67133441571281], [-70.40930447858189, -23.67133549432408], [-70.40935222695839, -23.67134863867771], [-70.40937707866121, -23.67137531721328], [-70.40937932851031, -23.67140241155158], [-70.40937720894642, -23.67144345059841], [-70.40934976065633, -23.67149528974277], [-70.40928083094435, -23.67153923751848], [-70.40925253566779, -23.67156893813188], [-70.4092451476666, -23.6715863768299], [-70.40923339081387, -23.67163220073698], [-70.4092282640821, -23.6716684515722], [-70.40923206288359, -23.67171285927163], [-70.40922971010235, -23.67175850370484], [-70.40922038321446, -23.67178543699396]]}, "properties": {"name": "fence5", "description": ""}}, {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[-70.4091663684865, -23.67067746584355], [-70.40916801987134, -23.67075781564485], [-70.40959615541958, -23.67112649241212]]}, "properties": {"name": "fence6", "description": ""}}, {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[-70.40863162951916, -23.67064502508799], [-70.4086400382611, -23.67078059873429], [-70.40911365769448, -23.67078059540485], [-70.40943307655125, -23.67106817784331], [-70.40945128621304, -23.67119607095917]]}, "properties": {"name": "fence7", "description": ""}}]};
        const TRANSLATIONS = {
  "es": {
    "welcome": "¡Bienvenidos!",
    "tapToStart": "Toca la pantalla para comenzar",
    "infoBtn": "Información del Evento",
    "infoDesc": "Circuitos, cronograma, alojamiento y guía oficial",
    "regBtn": "Acreditación de Atletas",
    "regDesc": "Confirma tu inscripción, realiza pagos y obtén tu código",
    "backBtn": "Volver",
    "homeBtn": "Inicio",
    "lang": "Idioma",
    "sponsors": "Sponsors Oficiales",
    "tabMap": "Mapa de Rutas",
    "tabSchedule": "Cronograma",
    "tabGuide": "Guía del Atleta",
    "tabAthletes": "Lista de Atletas",
    "mapTitle": "Circuitos Interactivos",
    "mapDesc": "Selecciona las disciplinas para visualizar sus rutas en el mapa.",
    "mapSwim": "Natación",
    "mapBike": "Ciclismo",
    "mapRun": "Trote",
    "mapZones": "Zonas / Meta",
    "friday": "Viernes 3 de Julio",
    "saturday": "Sábado 4 de Julio",
    "sunday": "Domingo 5 de Julio",
    "guideLocation": "Ubicación y Clima",
    "guideTravel": "Hospedaje y Viaje",
    "guideCosts": "Inscripción y Costos",
    "guideRules": "Reglamento Técnico",
    "catSelect": "Selecciona una Categoría",
    "searchPlaceholder": "Buscar por nombre, apellido...",
    "searchBtn": "Buscar",
    "startList": "Lista de Largada",
    "waitList": "Lista de Espera",
    "yob": "Año de nac.:",
    "noc": "País:",
    "noAthletes": "No se encontraron atletas",
    "regTitle": "Acreditación",
    "regStep1": "Paso 1: Selecciona tu Categoría",
    "regStep2": "Paso 2: Busca tu Nombre",
    "regStep3": "Paso 3: Confirmación de Identidad",
    "registerConfirm": "Confirmar Registro",
    "keyboardClear": "Borrar todo",
    "keyboardSpace": "Espacio",
    "natOk": "Atleta Nacional (Chile)",
    "natDesc": "Tu inscripción está validada. Debes retirar tu pulsera de seguridad en el módulo de acreditación y luego retirar tu kit de competencia.",
    "intReq": "Atleta Internacional",
    "intDesc": "Para atletas internacionales el costo de inscripción es de $50 USD. Por favor, realiza el pago a continuación.",
    "payBtn": "Pagar $50 USD",
    "posConnecting": "Conectando con la terminal...",
    "posInsert": "Por favor, inserte su tarjeta en el lector POS",
    "posProcessing": "Procesando pago...",
    "posApproved": "¡Pago Aprobado con Éxito!",
    "regSuccess": "¡Registro Completado con Éxito!",
    "ticketCode": "Código de Retiro:",
    "ticketInstructions": "Escanea el código QR para descargar tu comprobante de acreditación oficial en PDF directamente en tu teléfono.",
    "finishBtn": "Volver al Inicio",
    "returningHome": "Registro exitoso.",
    "waitlistWarning": "Atleta en Lista de Espera. Debes ser validado por la organización antes de la acreditación.",
    "searchPrompt": "Escribe tu nombre o apellido..."
  },
  "en": {
    "welcome": "Welcome!",
    "tapToStart": "Tap the screen to start",
    "infoBtn": "Event Information",
    "infoDesc": "Routes, schedule, accommodation and official guide",
    "regBtn": "Athlete Accreditation",
    "regDesc": "Confirm registration, make payments and get your code",
    "backBtn": "Back",
    "homeBtn": "Home",
    "lang": "Language",
    "sponsors": "Official Sponsors",
    "tabMap": "Route Map",
    "tabSchedule": "Schedule",
    "tabGuide": "Athlete Guide",
    "tabAthletes": "Official Start List",
    "mapTitle": "Interactive Routes",
    "mapDesc": "Select disciplines to view their routes on the map.",
    "mapSwim": "Swim",
    "mapBike": "Bike",
    "mapRun": "Run",
    "mapZones": "Transition & Finish",
    "friday": "Friday, July 3rd",
    "saturday": "Saturday, July 4th",
    "sunday": "Sunday, July 5th",
    "guideLocation": "Location & Weather",
    "guideTravel": "Lodging & Travel",
    "guideCosts": "Registration & Fees",
    "guideRules": "Technical Rules",
    "catSelect": "Select a Category",
    "searchPlaceholder": "Search by name...",
    "searchBtn": "Search",
    "startList": "Start List",
    "waitList": "Wait List",
    "yob": "YOB:",
    "noc": "Country:",
    "noAthletes": "No athletes found",
    "regTitle": "Accreditation",
    "regStep1": "Step 1: Select Category",
    "regStep2": "Step 2: Search Your Name",
    "regStep3": "Step 3: Confirm Identity",
    "registerConfirm": "Confirm Registration",
    "keyboardClear": "Clear all",
    "keyboardSpace": "Space",
    "natOk": "National Athlete (Chile)",
    "natDesc": "Your registration is validated. You must collect your security wristband first, then retrieve your race kit.",
    "intReq": "International Athlete",
    "intDesc": "For international athletes, the registration fee is $50 USD. Please proceed with payment below.",
    "payBtn": "Pay $50 USD",
    "posConnecting": "Connecting to terminal...",
    "posInsert": "Please insert your card into the POS reader",
    "posProcessing": "Processing payment...",
    "posApproved": "Payment Approved Successfully!",
    "regSuccess": "Registration Completed Successfully!",
    "ticketCode": "Withdrawal Code:",
    "ticketInstructions": "Scan this QR code to download your official PDF accreditation receipt directly to your phone.",
    "finishBtn": "Back to Home",
    "returningHome": "Registration successful.",
    "waitlistWarning": "Athlete on Waitlist. You must be validated by the organization before accreditation.",
    "searchPrompt": "Type your name or last name..."
  },
  "pt": {
    "welcome": "Bem-vindo!",
    "tapToStart": "Toque na tela para iniciar",
    "infoBtn": "Informações do Evento",
    "infoDesc": "Percursos, cronograma, hospedagem e guia oficial",
    "regBtn": "Credenciamento de Atletas",
    "regDesc": "Confirme sua inscrição, faça pagamentos e obtenha seu código",
    "backBtn": "Voltar",
    "homeBtn": "Início",
    "lang": "Idioma",
    "sponsors": "Patrocinadores Oficiais",
    "tabMap": "Mapa de Rotas",
    "tabSchedule": "Cronograma",
    "tabGuide": "Guia do Atleta",
    "tabAthletes": "Lista de Partida",
    "mapTitle": "Percursos Interativos",
    "mapDesc": "Selecione as disciplinas para visualizar as rotas no mapa.",
    "mapSwim": "Natação",
    "mapBike": "Ciclismo",
    "mapRun": "Corrida",
    "mapZones": "Zonas de Transição / Chegada",
    "friday": "Sexta, 3 de Julho",
    "saturday": "Sábado, 4 de Julho",
    "sunday": "Domingo, 5 de Julho",
    "guideLocation": "Localização & Clima",
    "guideTravel": "Hospedagem & Transporte",
    "guideCosts": "Inscrição & Custos",
    "guideRules": "Regras Técnicas",
    "catSelect": "Selecione uma Categoria",
    "searchPlaceholder": "Buscar por nome...",
    "searchBtn": "Buscar",
    "startList": "Lista de Largada",
    "waitList": "Lista de Espera",
    "yob": "Ano de nasc.:",
    "noc": "País:",
    "noAthletes": "Nenhum atleta encontrado",
    "regTitle": "Credenciamento",
    "regStep1": "Passo 1: Selecione a Categoria",
    "regStep2": "Passo 2: Busque seu Nome",
    "regStep3": "Passo 3: Confirmação de Identidade",
    "registerConfirm": "Confirmar Registro",
    "keyboardClear": "Limpar tudo",
    "keyboardSpace": "Espaço",
    "natOk": "Atleta Nacional (Chile)",
    "natDesc": "Sua inscrição está validada. Você deve retirar sua pulseira de segurança e depois retirar seu kit de competição.",
    "intReq": "Atleta Internacional",
    "intDesc": "Para atletas internacionais o custo de inscrição é de $50 USD. Por favor, realize o pagamento abaixo.",
    "payBtn": "Pagar $50 USD",
    "posConnecting": "Conectando com o terminal...",
    "posInsert": "Por favor, insira seu cartão no leitor POS",
    "posProcessing": "Processando pagamento...",
    "posApproved": "Pagamento Aprovado com Sucesso!",
    "regSuccess": "Registro Concluído com Sucesso!",
    "ticketCode": "Código de Retirada:",
    "ticketInstructions": "Aproxime seu telefone para escanear o código QR e baixar seu recibo em PDF directamente no celular.",
    "finishBtn": "Voltar ao Início",
    "returningHome": "Registro com sucesso.",
    "waitlistWarning": "Atleta na Lista de Espera. Você deve ser validado pela organização antes do credenciamento.",
    "searchPrompt": "Digite seu nome ou sobrenome..."
  }
};
    </script>
    
    <!-- APP JAVASCRIPT -->
    <script>
        let currentLanguage = 'es';
        let activeInfoTab = 'guide'; // Default tab to Guide instead of Map!
        let activeGuideSubTab = 'loc';
        let map = null;
        let mapLayers = {
            swim: null,
            bike: null,
            run: null,
            zones: null
        };
        let activeLayers = {
            swim: true,
            bike: true,
            run: true,
            zones: false
        };
        let currentMapType = 'street';
        let streetTileLayer = null;
        let satelliteTileLayer = null;
        let hasFitBounds = false;

        // Registration State variables
        let selectedCategory = null;
        let selectedAthlete = null;
        let registrationCode = "";
        
        // Active category for start lists
        let selectedStartListsCategory = null;

        // Init App
        window.addEventListener('load', () => {
            try { changeLanguage('es'); } catch(e) { console.error("Error changeLanguage:", e); }
            try { initMap(); } catch(e) { console.error("Error initMap:", e); }
            try { initStartListsCategoriesGrid(); } catch(e) { console.error("Error initStartListsCategoriesGrid:", e); }
            try { initScreensaver(); } catch(e) { console.error("Error initScreensaver:", e); }
        });

        function initScreensaver() {
            let inactivityTimer = null;
            let screensaverVisible = true;
            const TIMEOUT_MS = 60000; // 60 seconds of inactivity
            const screensaver = document.getElementById('screensaver');

            function showScreensaver() {
                if (screensaverVisible) return;
                screensaverVisible = true;
                screensaver.style.transition = 'transform 0.85s cubic-bezier(0.4, 0, 0.2, 1)';
                screensaver.style.transform = 'translateY(0)';
                screensaver.style.pointerEvents = 'all';
                // Reset state
                returnToHome();
                cancelRegistration();
                closeAthleteModal();
                closeImageModal();
            }

            function dismissScreensaver() {
                if (!screensaverVisible) return;
                screensaver.style.transition = 'transform 0.85s cubic-bezier(0.4, 0, 0.2, 1)';
                screensaver.style.transform = 'translateY(-100%)';
                screensaver.style.pointerEvents = 'none';
                screensaverVisible = false;
                resetTimer();
            }

            function resetTimer() {
                clearTimeout(inactivityTimer);
                if (!screensaverVisible) {
                    inactivityTimer = setTimeout(showScreensaver, TIMEOUT_MS);
                }
            }

            document.addEventListener('click', (e) => {
                if (screensaverVisible) {
                    e.stopPropagation();
                    dismissScreensaver();
                } else {
                    resetTimer();
                }
            }, true);

            document.addEventListener('touchstart', (e) => {
                if (screensaverVisible) {
                    e.stopPropagation();
                    dismissScreensaver();
                } else {
                    resetTimer();
                }
            }, { passive: true, capture: true });

            ['mousemove', 'keydown', 'scroll'].forEach(evt => {
                document.addEventListener(evt, () => {
                    if (!screensaverVisible) resetTimer();
                });
            });
        }

        // Image modal expander popup functions
        function openImageModal(src, caption) {
            const modal = document.getElementById('image-modal');
            document.getElementById('modal-img').src = src;
            document.getElementById('modal-caption').innerText = caption || "";
            modal.classList.remove('hidden');
        }

        function closeImageModal() {
            document.getElementById('image-modal').classList.add('hidden');
        }

        // Athlete detail modal popup functions
        function openAthleteModal(entry) {
            const modal = document.getElementById('athlete-modal');
            document.getElementById('ath-modal-category').innerText = selectedStartListsCategory ? selectedStartListsCategory.name : "";
            document.getElementById('ath-modal-name').innerText = entry.athlete_full_name;
            document.getElementById('ath-modal-yob').innerText = entry.athlete_yob;
            document.getElementById('ath-modal-noc').innerText = entry.athlete_noc;
            
            const flagImg = document.getElementById('ath-modal-flag');
            if (entry.athlete_flag_circle) {
                flagImg.src = entry.athlete_flag_circle;
                flagImg.style.display = 'inline-block';
            } else {
                flagImg.style.display = 'none';
            }
            
            const statusEl = document.getElementById('ath-modal-status');
            if (entry.isWait) {
                statusEl.innerText = "WAIT LIST";
                statusEl.className = "text-xs font-black uppercase px-2.5 py-1.5 mt-0.5 rounded-none bg-amber-100 text-amber-700 border border-amber-200";
            } else {
                statusEl.innerText = "START LIST";
                statusEl.className = "text-xs font-black uppercase px-2.5 py-1.5 mt-0.5 rounded-none bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30";
            }
            
            const photoImg = document.getElementById('ath-modal-photo');
            const localPhoto = entry.athlete_profile_image;
            const placeholder = 'https://cms.triathlon.org/assets/avatar-placeholder.png';
            
            photoImg.src = localPhoto || placeholder;
            photoImg.onerror = function() {
                this.src = placeholder;
            };
            
            modal.classList.remove('hidden');
        }

        function closeAthleteModal(e) {
            if (e) e.stopPropagation();
            document.getElementById('athlete-modal').classList.add('hidden');
        }

        // Translate UI
        function changeLanguage(lang) {
            currentLanguage = lang;
            
            // Toggle language buttons style
            ['es', 'en', 'pt'].forEach(l => {
                const btn = document.getElementById('btn-lang-' + l);
                if (btn) {
                    if (l === lang) {
                        btn.className = "flex items-center gap-2 px-4 py-2.5 text-sm font-black transition-all bg-white text-brand-navy rounded-none shadow-sm";
                    } else {
                        btn.className = "flex items-center gap-2 px-4 py-2.5 text-sm font-black transition-all text-white hover:bg-white/25 rounded-none";
                    }
                }
            });

            const dict = TRANSLATIONS[lang];

            // Safe helpers
            function setElementText(id, text) {
                const el = document.getElementById(id);
                if (el) el.innerText = text;
            }
            function setElementHTML(id, html) {
                const el = document.getElementById(id);
                if (el) el.innerHTML = html;
            }
            function setElementPlaceholder(id, placeholder) {
                const el = document.getElementById(id);
                if (el) el.placeholder = placeholder;
            }
            
            // Main labels
            setElementText('lbl-tap-to-start', dict.tapToStart);
            setElementHTML('home-title', (lang === 'es' ? "Campeonato Panamericano de Triatlón" : lang === 'en' ? "Americas Triathlon Championships" : "Campeonato Pan-Americano de Triatlo"));
            
            setElementText('home-info-title', dict.infoBtn);
            setElementText('home-info-desc', dict.infoDesc);
            setElementText('home-reg-title', dict.regBtn);
            setElementText('home-reg-desc', dict.regDesc);
            setElementText('home-sponsors-lbl', dict.sponsors);

            // Info Tabs Sidebar
            setElementText('sidebar-info-title', dict.infoBtn);
            setElementText('lbl-tab-map', dict.tabMap);
            setElementText('lbl-tab-schedule', dict.tabSchedule);
            setElementText('lbl-tab-guide', dict.tabGuide);
            setElementText('lbl-tab-athletes', dict.tabAthletes);
            setElementText('lbl-back-home', dict.backBtn);

            // Map header
            setElementText('map-header-title', dict.mapTitle);
            setElementText('map-header-desc', dict.mapDesc);
            setElementText('lbl-map-swim', dict.mapSwim);
            setElementText('lbl-map-bike', dict.mapBike);
            setElementText('lbl-map-run', dict.mapRun);
            setElementText('lbl-map-zones', dict.mapZones);

            // Schedule Header
            setElementText('schedule-header-title', dict.tabSchedule);
            setElementText('schedule-header-desc', (lang === 'es' ? "Horarios y actividades oficiales programadas." : lang === 'en' ? "Official scheduled times and activities." : "Horários e atividades oficiais programadas."));
            setElementText('sch-day1-title', dict.friday);
            setElementText('sch-day2-title', dict.saturday);
            setElementText('sch-day3-title', dict.sunday);

            // Guide Tabs
            setElementText('guide-header-title', dict.tabGuide);
            setElementText('guide-header-desc', (lang === 'es' ? "Información relevante de logística, alojamiento y normativas oficiales." : lang === 'en' ? "Relevant logistics, lodging, and regulations information." : "Informações relevantes sobre logística, hospedagem e normas."));
            setElementText('guide-subbtn-loc', dict.guideLocation);
            setElementText('guide-subbtn-travel', dict.guideTravel);
            setElementText('guide-subbtn-costs', dict.guideCosts);
            setElementText('guide-subbtn-rules', dict.guideRules);

            // Guide contents
            setElementText('lbl-loc-title', (lang === 'es' ? "Ubicación - Antofagasta" : lang === 'en' ? "Location - Antofagasta" : "Localização - Antofagasta"));
            setElementText('lbl-climate-title', (lang === 'es' ? "Clima en Julio" : lang === 'en' ? "Weather in July" : "Clima em Julho"));
            setElementText('lbl-hotel-title', (lang === 'es' ? "Hotel Oficial" : lang === 'en' ? "Official Hotel" : "Hotel Oficial"));
            setElementText('lbl-transport-title', (lang === 'es' ? "Transporte y Viaje" : lang === 'en' ? "Travel & Transportation" : "Transporte & Viagem"));
            setElementText('lbl-costs-title', (lang === 'es' ? "Costos de Inscripción (USD)" : lang === 'en' ? "Registration Fees (USD)" : "Custos de Inscrição (USD)"));
            setElementText('lbl-benefits-title', (lang === 'es' ? "¿Qué incluye la inscripción?" : lang === 'en' ? "What does registration include?" : "O que a inscrição inclui?"));
            setElementText('lbl-rules-bikes', (lang === 'es' ? "Bicicletas Permitidas (Grupos de Edad)" : lang === 'en' ? "Allowed Bikes (Age Group)" : "Bicicletas Permitidas (Grupos de Idade)"));
            setElementText('lbl-rules-helmets', (lang === 'es' ? "Cascos y Uniformes" : lang === 'en' ? "Helmets & Uniforms" : "Capacetes & Uniformes"));

            // Translate map type button
            const mapTypeBtn = document.getElementById('map-type-btn');
            if (mapTypeBtn) {
                if (currentMapType === 'street') {
                    mapTypeBtn.innerHTML = \`<i class="fa-solid fa-earth-americas"></i> <span>\${lang === 'es' ? "Vista Satélite" : lang === 'en' ? "Satellite View" : "Vista Satélite"}</span>\`;
                } else {
                    mapTypeBtn.innerHTML = \`<i class="fa-solid fa-map"></i> <span>\${lang === 'es' ? "Vista Mapa" : lang === 'en' ? "Street Map" : "Vista Mapa"}</span>\`;
                }
            }

            // Athletes Tab
            setElementText('athletes-header-title', dict.tabAthletes);
            setElementText('athletes-header-desc', dict.catSelect);
            setElementText('btn-back-cats', (lang === 'es' ? "Cambiar Categoría" : lang === 'en' ? "Change Category" : "Mudar Categoria"));

            // Registration screen labels
            setElementText('sidebar-reg-title', (lang === 'es' ? "Acreditación" : lang === 'en' ? "Accreditation" : "Credenciamento"));
            setElementText('ind-step1', (lang === 'es' ? "Categoría" : lang === 'en' ? "Category" : "Categoria"));
            setElementText('ind-step2', (lang === 'es' ? "Buscar" : lang === 'en' ? "Search" : "Buscar"));
            setElementText('ind-step3', (lang === 'es' ? "Confirmar" : lang === 'en' ? "Confirm" : "Confirmar"));
            setElementText('lbl-cancel-reg', (lang === 'es' ? "Cancelar" : lang === 'en' ? "Cancel" : "Cancelar"));
            
            setElementText('step1-header-title', dict.regStep1);
            setElementText('step1-header-desc', (lang === 'es' ? "Toca sobre tu categoría deportiva para continuar con la acreditación." : lang === 'en' ? "Tap on your category to proceed with accreditation." : "Toque na sua categoria para continuar com o credenciamento."));
            
            setElementText('step2-header-title', dict.regStep2);
            setElementText('step2-header-desc', (lang === 'es' ? "Busca tu nombre en la lista." : lang === 'en' ? "Search your name in the list." : "Busque seu nome na lista."));
            
            setElementText('lbl-change-cat', dict.backBtn);
            setElementPlaceholder('reg-search-input', dict.searchPlaceholder);

            setElementText('step3-header-title', dict.regStep3);
            setElementText('step3-header-desc', (lang === 'es' ? "Verifica que tus datos y categoría estén correctos." : lang === 'en' ? "Verify that your data and category are correct." : "Verifique se seus dados e categoría están corretos."));
            
            setElementText('lbl-change-athlete', dict.backBtn);

            setElementText('pos-title', (lang === 'es' ? "Pago de Inscripción" : lang === 'en' ? "Registration Payment" : "Pagamento de Inscrição"));
            setElementText('pos-desc', (lang === 'es' ? "Monto total a transferir por inscripción extranjera." : lang === 'en' ? "Total amount to pay for international registration." : "Valor total a pagar por inscrição internacional."));
            setElementText('btn-pay-pos', (lang === 'es' ? "PAGAR $50 USD" : lang === 'en' ? "PAY $50 USD" : "PAGAR $50 USD"));

            setElementText('pos-sim-title', (lang === 'es' ? "Procesando..." : lang === 'en' ? "Processing..." : "Processando..."));
            setElementText('pos-sim-step', dict.posConnecting);
            setElementText('pos-sim-instruction', dict.posInsert);

            setElementText('success-title', (lang === 'es' ? "¡Registro Exitoso!" : lang === 'en' ? "Registration Successful!" : "Registro com Sucesso!"));
            setElementText('success-desc', (lang === 'es' ? "Has completado el proceso de acreditación del evento." : lang === 'en' ? "You have completed the event accreditation process." : "Você concluuiu o proceso de credenciamento do evento."));
            setElementText('lbl-receipt-code', dict.ticketCode);
            setElementText('lbl-receipt-instr', dict.ticketInstructions);
            setElementText('btn-success-finish', dict.finishBtn);
            setElementText('lbl-receipt-noc-text', (lang === 'es' ? "País:" : lang === 'en' ? "Country:" : "País:"));

            // Re-render components with translations
            renderStartListsCategoriesGrid();
            renderCategoriesGrid();
            renderAllKeyboards();
            if (selectedAthlete) {
                renderConfirmDetails();
            }
        }

        // Open Screen helper
        function changeScreen(screenId) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('screen-' + screenId).classList.add('active');
        }

        function returnToHome() {
            changeScreen('home');
            backToCategoriesGrid();
        }

        function openInfoScreenWithTab(tabId) {
            changeScreen('info');
            showInfoTab(tabId);
        }

        function openInfoScreen() {
            openInfoScreenWithTab(activeInfoTab);
        }

        function showInfoTab(tabId) {
            activeInfoTab = tabId;
            document.querySelectorAll('.info-tab').forEach(t => t.classList.add('hidden'));
            document.getElementById('info-tab-' + tabId).classList.remove('hidden');

            // Style top horizontal buttons
            ['map', 'schedule', 'guide', 'athletes'].forEach(t => {
                const btn = document.getElementById('tab-btn-' + t);
                if (t === tabId) {
                    btn.className = "px-6 py-4 font-black text-base transition-all rounded-none bg-brand-cyan text-white shadow-sm flex items-center gap-2";
                } else {
                    btn.className = "px-6 py-4 font-black text-base transition-all rounded-none text-gray-600 hover:bg-gray-100 hover:text-brand-cyan flex items-center gap-2";
                }
            });

            if (tabId === 'map' && map) {
                setTimeout(() => {
                    map.invalidateSize();
                    if (!hasFitBounds) {
                        fitMapToRoutes();
                        hasFitBounds = true;
                    }
                }, 100);
            }
        }

        function showGuideSubTab(subTabId) {
            activeGuideSubTab = subTabId;
            document.querySelectorAll('.guide-subtab').forEach(t => t.classList.add('hidden'));
            document.getElementById('guide-sub-' + subTabId).classList.remove('hidden');

            // Style buttons
            ['loc', 'travel', 'costs', 'rules'].forEach(t => {
                const btn = document.getElementById('guide-subbtn-' + t);
                if (t === subTabId) {
                    btn.className = "px-6 py-4 border-b-4 border-brand-cyan text-brand-cyan font-bold text-base rounded-none";
                } else {
                    btn.className = "px-6 py-4 text-gray-500 hover:text-brand-cyan font-bold text-base rounded-none";
                }
            });
        }

        // --- MAP LOGIC ---
        function initMap() {
            if (typeof L === 'undefined') {
                console.warn("Leaflet L is not defined. Map is disabled.");
                return;
            }
            const centerLatLng = [-23.67677, -70.41221]; // Antofagasta Center
            map = L.map('map', {
                center: centerLatLng,
                zoom: 14,
                zoomControl: true,
                attributionControl: true
            });

            streetTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CARTO',
                maxZoom: 20
            });
            streetTileLayer.addTo(map);

            satelliteTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                maxZoom: 19
            });

            parseGeoJSONFeatures();
        }

        function toggleMapType() {
            if (!map) return;
            const btn = document.getElementById('map-type-btn');
            if (currentMapType === 'street') {
                map.removeLayer(streetTileLayer);
                satelliteTileLayer.addTo(map);
                currentMapType = 'satellite';
                if (btn) {
                    btn.innerHTML = \`<i class="fa-solid fa-map"></i> <span>\${currentLanguage === 'es' ? "Vista Mapa" : currentLanguage === 'en' ? "Street Map" : "Vista Mapa"}</span>\`;
                }
            } else {
                map.removeLayer(satelliteTileLayer);
                streetTileLayer.addTo(map);
                currentMapType = 'street';
                if (btn) {
                    btn.innerHTML = \`<i class="fa-solid fa-earth-americas"></i> <span>\${currentLanguage === 'es' ? "Vista Satélite" : currentLanguage === 'en' ? "Satellite View" : "Vista Satélite"}</span>\`;
                }
            }
        }

        function parseGeoJSONFeatures() {
            if (typeof L === 'undefined' || !map) return;
            const styles = {
                swim: { color: '#19ACB1', weight: 6, opacity: 0.9 }, // Turquesa
                bike: { color: '#D67E46', weight: 5, opacity: 0.9 }, // Terracota
                run: { color: '#2C9A67', weight: 5, opacity: 0.9 },  // Green
                zone: { color: '#19ACB1', fillColor: '#19ACB1', fillOpacity: 0.15, weight: 2, opacity: 0.7 }
            };

            mapLayers.swim = L.layerGroup().addTo(map);
            mapLayers.bike = L.layerGroup().addTo(map);
            mapLayers.run = L.layerGroup().addTo(map);
            mapLayers.zones = L.layerGroup(); // Start deselected: do not add to map!

            L.geoJSON(RUTAS_DATA, {
                style: function (feature) {
                    const name = (feature.properties && feature.properties.name) ? feature.properties.name.toLowerCase() : "";
                    if (name.includes('swim')) {
                        return styles.swim;
                    } else if (name.includes('bike')) {
                        return styles.bike;
                    } else if (name.includes('run')) {
                        return styles.run;
                    } else {
                        return styles.zone;
                    }
                },
                onEachFeature: function (feature, layer) {
                    if (feature.properties && feature.properties.name) {
                        layer.bindPopup("<strong class='text-brand-navy font-bold text-sm'>" + feature.properties.name + "</strong><br><span class='text-xs text-gray-600'>" + (feature.properties.description || "") + "</span>");
                    }

                    const name = (feature.properties && feature.properties.name) ? feature.properties.name.toLowerCase() : "";
                    if (name.includes('swim')) {
                        mapLayers.swim.addLayer(layer);
                    } else if (name.includes('bike')) {
                        mapLayers.bike.addLayer(layer);
                    } else if (name.includes('run')) {
                        mapLayers.run.addLayer(layer);
                    } else {
                        mapLayers.zones.addLayer(layer);
                    }
                }
            });

        }

        function fitMapToRoutes() {
            if (!map || !mapLayers) return;
            const activeGeoLayers = [];
            if (activeLayers.swim && mapLayers.swim) mapLayers.swim.eachLayer(layer => activeGeoLayers.push(layer));
            if (activeLayers.bike && mapLayers.bike) mapLayers.bike.eachLayer(layer => activeGeoLayers.push(layer));
            if (activeLayers.run && mapLayers.run) mapLayers.run.eachLayer(layer => activeGeoLayers.push(layer));
            if (activeLayers.zones && mapLayers.zones) mapLayers.zones.eachLayer(layer => activeGeoLayers.push(layer));
            
            if (activeGeoLayers.length > 0) {
                const featureGroup = L.featureGroup(activeGeoLayers);
                map.fitBounds(featureGroup.getBounds(), { padding: [50, 50] });
            }
        }

        function toggleMapLayer(layerKey) {
            if (!map || !mapLayers[layerKey]) return;
            activeLayers[layerKey] = !activeLayers[layerKey];
            const btn = document.getElementById('layer-btn-' + layerKey);
            
            if (activeLayers[layerKey]) {
                map.addLayer(mapLayers[layerKey]);
                if (layerKey === 'swim') btn.className = "px-5 py-2.5 rounded-none text-sm font-bold flex items-center gap-2 bg-brand-cyan/25 text-brand-cyan border border-brand-cyan/30";
                if (layerKey === 'bike') btn.className = "px-5 py-2.5 rounded-none text-sm font-bold flex items-center gap-2 bg-brand-orange/20 text-brand-orange border border-brand-orange/30";
                if (layerKey === 'run') btn.className = "px-5 py-2.5 rounded-none text-sm font-bold flex items-center gap-2 bg-brand-green/20 text-brand-green border border-brand-green/30";
                if (layerKey === 'zones') btn.className = "px-5 py-2.5 rounded-none text-sm font-bold flex items-center gap-2 bg-gray-200 text-gray-700 border border-gray-300";
            } else {
                map.removeLayer(mapLayers[layerKey]);
                btn.className = "px-5 py-2.5 rounded-none text-sm font-bold flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-400";
            }
        }

        // --- ATHLETES START LISTS GRID (BUTTONS PER CATEGORY) ---
        function initStartListsCategoriesGrid() {
            renderStartListsCategoriesGrid();
        }

        function renderStartListsCategoriesGrid() {
            const container = document.getElementById('athletes-categories-buttons-list');
            container.innerHTML = "";
            
            PARTICIPANTES_DATA.start_lists.forEach((list, index) => {
                const totalAthletes = (list.start_list.entries || []).length + ((list.wait_list ? list.wait_list.entries : []) || []).length;
                
                const card = document.createElement('button');
                card.onclick = () => selectStartListsCategory(list);
                card.className = "bg-gray-50 border-2 border-gray-200 p-6 rounded-none flex flex-col justify-center items-center gap-2 text-center hover:border-brand-cyan transition-all active:scale-95 shadow-sm min-h-[140px]";
                card.innerHTML = \`
                    <div class="w-12 h-12 bg-brand-cyan/10 border border-brand-cyan/30 rounded-none flex items-center justify-center">
                        <i class="fa-solid fa-person-running text-brand-cyan text-xl"></i>
                    </div>
                    <span class="font-extrabold text-brand-navy text-base leading-snug">\${list.name}</span>
                    <span class="text-xs text-gray-400 font-black uppercase tracking-wider">\${totalAthletes} Atletas</span>
                \`;
                container.appendChild(card);
            });
        }

        function selectStartListsCategory(list) {
            selectedStartListsCategory = list;
            
            // Show list page, hide grid page
            document.getElementById('athletes-categories-grid-page').classList.add('hidden');
            document.getElementById('athletes-list-page').classList.remove('hidden');
            
            // Set title
            document.getElementById('athletes-category-title').innerText = list.name;
            
            // Render the actual athletes
            renderStartListsAthletes(list);
        }

        function backToCategoriesGrid() {
            document.getElementById('athletes-list-page').classList.add('hidden');
            document.getElementById('athletes-categories-grid-page').classList.remove('hidden');
            selectedStartListsCategory = null;
        }

        // High-performance Start List rendering with image async decoding and lazy loading
        function renderStartListsAthletes(list) {
            const container = document.getElementById('athletes-scroll-list');
            container.innerHTML = "";

            const startEntries = list.start_list.entries || [];
            const waitEntries = (list.wait_list ? list.wait_list.entries : []) || [];
            
            const allEntries = [];
            startEntries.forEach(e => allEntries.push({ ...e, isWait: false }));
            waitEntries.forEach(e => allEntries.push({ ...e, isWait: true }));

            const dict = TRANSLATIONS[currentLanguage];

            if (allEntries.length === 0) {
                container.innerHTML = \`<div class='text-center py-16 text-gray-400 font-extrabold text-base'>\${dict.noAthletes}</div>\`;
                return;
            }

            allEntries.forEach(entry => {
                const row = document.createElement('div');
                row.dataset.search = (entry.athlete_full_name + " " + entry.athlete_noc).toLowerCase();
                row.className = "athlete-row-item bg-white border-2 border-gray-200 rounded-none p-4 flex items-center justify-between shadow-sm hover:border-brand-cyan transition-all cursor-pointer";
                row.onclick = () => openAthleteModal(entry);
                
                const flagSrc = entry.athlete_flag_circle || "banderas/unknown.svg";
                const photoSrc = entry.athlete_profile_image;

                // Profile photo circular with loading="lazy" and decoding="async" to prevent UI lags
                const photoHTML = photoSrc ? \`
                    <div class="w-14 h-14 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex-shrink-0">
                        <img src="\${photoSrc}" alt="\${entry.athlete_full_name}" class="w-full h-full object-cover" decoding="async" loading="lazy" onerror="this.src='https://cms.triathlon.org/assets/avatar-placeholder.png'">
                    </div>
                \` : \`
                    <div class="w-14 h-14 rounded-full bg-[#E5E7EB] border-2 border-gray-300 flex items-center justify-center text-gray-400 flex-shrink-0">
                        <i class="fa-solid fa-user text-xl"></i>
                    </div>
                \`;

                row.innerHTML = \`
                    <div class="flex items-center gap-4">
                        \${photoHTML}
                        <div class="flex flex-col gap-0.5">
                            <span class="font-extrabold text-base text-brand-navy leading-none">\${entry.athlete_full_name}</span>
                            <div class="flex items-center gap-2 mt-1">
                                <img src="\${flagSrc}" alt="\${entry.athlete_noc}" class="h-4 w-auto object-contain border border-gray-100" onerror="this.style.display='none'">
                                <span class="text-xs text-gray-500 font-bold">\${entry.athlete_noc}</span>
                                <span class="text-xs text-gray-300">|</span>
                                <span class="text-xs text-gray-400 font-bold">\${dict.yob} \${entry.athlete_yob}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        \${entry.isWait ? \`
                            <span class="text-xs uppercase font-black px-3.5 py-1.5 rounded-none bg-amber-100 text-amber-700 border border-amber-200">WAIT (Pos. \${entry.wait_pos || '-'})</span>
                        \` : \`
                            <span class="text-xs uppercase font-black px-3.5 py-1.5 rounded-none bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">START LIST</span>
                        \`}
                    </div>
                \`;
                container.appendChild(row);
            });
        }




        // ==================== ACREDITACIÓN / REGISTRATION FLOW ====================
        function openRegisterScreen() {
            changeScreen('register');
            goToStep(1);
        }

        function cancelRegistration() {
            returnToHome();
            selectedCategory = null;
            selectedAthlete = null;
            registrationCode = "";
            document.getElementById('reg-search-input').value = "";
        }

        function goToStep(stepNum) {
            // Hide all steps
            document.querySelectorAll('.reg-step').forEach(s => s.classList.add('hidden'));
            
            // Reset indicators style
            ['1', '2', '3'].forEach(num => {
                const ind = document.getElementById('step-ind-' + num);
                if (num === String(stepNum)) {
                    ind.className = "flex items-center gap-3 border-l-4 border-brand-cyan pl-3 text-brand-navy font-extrabold";
                    ind.querySelector('span').className = "w-9 h-9 bg-brand-cyan flex items-center justify-center text-sm text-white rounded-none font-black shadow-sm";
                } else {
                    ind.className = "flex items-center gap-3 border-l-4 border-gray-200 pl-3 text-gray-400 font-extrabold";
                    ind.querySelector('span').className = "w-9 h-9 bg-gray-100 border border-gray-200 flex items-center justify-center text-sm text-gray-500 rounded-none font-black";
                }
            });

            if (stepNum === 1) {
                document.getElementById('reg-step-category').classList.remove('hidden');
                renderCategoriesGrid();
            } else if (stepNum === 2) {
                document.getElementById('reg-step-search').classList.remove('hidden');
                document.getElementById('reg-search-input').value = "";
                renderRegistrationAthletesList();
                renderKeyboard();
            } else if (stepNum === 3) {
                document.getElementById('reg-step-confirm').classList.remove('hidden');
                renderConfirmDetails();
            }
        }

        // Render Registration Categories Grid (Only active ones!)
        function renderCategoriesGrid() {
            const grid = document.getElementById('reg-categories-grid');
            grid.innerHTML = "";

            PARTICIPANTES_DATA.start_lists.forEach(list => {
                const gridCard = document.createElement('button');
                gridCard.onclick = () => {
                    selectedCategory = list;
                    goToStep(2);
                };
                gridCard.className = "bg-gray-50 border-2 border-gray-200 p-8 rounded-none flex flex-col justify-center items-center gap-3 text-center hover:border-brand-cyan transition-all active:scale-95 shadow-sm min-h-[160px]";
                gridCard.innerHTML = \`
                    <div class="w-14 h-14 bg-brand-cyan/10 border border-brand-cyan/30 rounded-none flex items-center justify-center">
                        <i class="fa-solid fa-person-running text-brand-cyan text-2xl"></i>
                    </div>
                    <span class="font-extrabold text-brand-navy text-lg leading-snug">\${list.name}</span>
                \`;
                grid.appendChild(gridCard);
            });
        }

        // Pre-render list of ALL athletes in selected category for Step 2
        function renderRegistrationAthletesList() {
            const container = document.getElementById('reg-search-results');
            container.innerHTML = "";

            if (!selectedCategory) return;

            const startList = selectedCategory.start_list.entries || [];
            const waitList = selectedCategory.wait_list ? (selectedCategory.wait_list.entries || []) : [];
            
            const allEntries = [];
            startList.forEach(e => allEntries.push({ ...e, isWait: false }));
            waitList.forEach(e => allEntries.push({ ...e, isWait: true }));

            const dict = TRANSLATIONS[currentLanguage];

            if (allEntries.length === 0) {
                container.innerHTML = \`<div class='text-center py-16 text-gray-400 font-extrabold text-base'>\${dict.noAthletes}</div>\`;
                return;
            }

            allEntries.forEach(entry => {
                const card = document.createElement('button');
                card.dataset.search = (entry.athlete_full_name + " " + entry.athlete_noc).toLowerCase();
                card.className = "reg-athlete-row-item w-full text-left bg-white border-2 border-gray-200 rounded-none p-4 flex items-center justify-between hover:border-brand-cyan transition-all shadow-sm active:scale-95";
                card.onclick = () => {
                    selectedAthlete = entry;
                    goToStep(3);
                };

                const photoSrc = entry.athlete_profile_image;
                
                // Profile photo circular with loading="lazy" and decoding="async" to prevent UI lags
                const photoHTML = photoSrc ? \`
                    <div class="w-12 h-12 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
                        <img src="\${photoSrc}" alt="\${entry.athlete_full_name}" class="w-full h-full object-cover" decoding="async" loading="lazy" onerror="this.src='https://cms.triathlon.org/assets/avatar-placeholder.png'">
                    </div>
                \` : \`
                    <div class="w-12 h-12 rounded-full bg-[#E5E7EB] border border-gray-300 flex items-center justify-center text-gray-400 flex-shrink-0">
                        <i class="fa-solid fa-user text-base"></i>
                    </div>
                \`;

                const flagSrc = entry.athlete_flag_circle || "banderas/unknown.svg";

                card.innerHTML = \`
                    <div class="flex items-center gap-4">
                        \${photoHTML}
                        <div class="flex flex-col">
                            <span class="font-extrabold text-base text-brand-navy leading-tight">\${entry.athlete_full_name}</span>
                            <div class="flex items-center gap-2 mt-1">
                                <img src="\${flagSrc}" alt="\${entry.athlete_noc}" class="h-4 w-auto object-contain border border-gray-100" onerror="this.style.display='none'">
                                <span class="text-xs text-gray-500 font-bold">\${entry.athlete_noc}</span>
                                <span class="text-xs text-gray-300">|</span>
                                <span class="text-xs text-gray-400 font-bold">\${dict.yob} \${entry.athlete_yob}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        \${entry.isWait ? \`
                            <span class="text-xs uppercase font-black px-3.5 py-1.5 rounded-none bg-amber-100 text-amber-700 border border-amber-200">WAIT</span>
                        \` : \`
                            <span class="text-xs uppercase font-black px-3.5 py-1.5 rounded-none bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">START</span>
                        \`}
                    </div>
                \`;
                container.appendChild(card);
            });
        }

        function filterRegisterAthletes() {
            const query = document.getElementById('reg-search-input').value.toLowerCase().trim();
            const rows = document.querySelectorAll('.reg-athlete-row-item');
            
            rows.forEach(row => {
                if (!query || row.dataset.search.includes(query)) {
                    row.classList.remove('hidden');
                } else {
                    row.classList.add('hidden');
                }
            });
        }

        // Virtual Keyboard layout (Full Width)
        function renderKeyboard(containerId = 'keyboard-container', inputId = 'reg-search-input', onInputCallback = filterRegisterAthletes) {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = "";

            const rows = [
                ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
                ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
            ];

            const dict = TRANSLATIONS[currentLanguage];

            rows.forEach((row, i) => {
                const rowDiv = document.createElement('div');
                rowDiv.className = "flex justify-center gap-3 w-full";
                
                row.forEach(key => {
                    const btn = document.createElement('button');
                    btn.className = "key-btn flex-grow py-5 text-2xl font-black bg-white border-2 border-gray-200 rounded-none text-brand-navy transition-all shadow-sm hover:border-brand-cyan active:bg-brand-cyan active:text-white";
                    
                    if (key === 'DEL') {
                        btn.className += " px-8 bg-red-50 text-red-600 border-red-200";
                        btn.innerHTML = "<i class='fa-solid fa-delete-left'></i>";
                        btn.onclick = () => {
                            const input = document.getElementById(inputId);
                            if (input) {
                                input.value = input.value.slice(0, -1);
                                if (onInputCallback) onInputCallback();
                            }
                        };
                    } else {
                        btn.innerText = key;
                        btn.onclick = () => {
                            const input = document.getElementById(inputId);
                            if (input) {
                                input.value += key;
                                if (onInputCallback) onInputCallback();
                            }
                        };
                    }
                    rowDiv.appendChild(btn);
                });
                container.appendChild(rowDiv);
            });

            // Bottom space/clear row
            const spaceRow = document.createElement('div');
            spaceRow.className = "flex gap-3 w-full justify-center";
            
            const spaceBtn = document.createElement('button');
            spaceBtn.className = "key-btn flex-grow py-6 text-xl font-black bg-white border-2 border-gray-200 rounded-none text-gray-700 active:bg-brand-cyan active:text-white";
            spaceBtn.innerText = dict.keyboardSpace;
            spaceBtn.onclick = () => {
                const input = document.getElementById(inputId);
                if (input) {
                    input.value += " ";
                    if (onInputCallback) onInputCallback();
                }
            };
            
            const clearBtn = document.createElement('button');
            clearBtn.className = "key-btn px-14 py-6 text-xl font-black bg-gray-100 border-2 border-gray-200 rounded-none text-gray-500 active:bg-brand-cyan active:text-white";
            clearBtn.innerText = dict.keyboardClear;
            clearBtn.onclick = () => {
                const input = document.getElementById(inputId);
                if (input) {
                    input.value = "";
                    if (onInputCallback) onInputCallback();
                }
            };

            spaceRow.appendChild(clearBtn);
            spaceRow.appendChild(spaceBtn);
            container.appendChild(spaceRow);
        }

        function renderAllKeyboards() {
            renderKeyboard('keyboard-container', 'reg-search-input', filterRegisterAthletes);
        }

        // STEP 3: Confirm Details
        function renderConfirmDetails() {
            const container = document.getElementById('confirm-details-container');
            container.innerHTML = "";

            if (!selectedAthlete) return;

            const flagSrc = selectedAthlete.athlete_flag_circle || "banderas/unknown.svg";
            const photoSrc = selectedAthlete.athlete_profile_image;
            const isChi = selectedAthlete.athlete_noc === 'CHI';

            const dict = TRANSLATIONS[currentLanguage];

            // Circular photo or fallback silhouette avatar
            const photoHTML = photoSrc ? \`
                <div class="w-36 h-36 rounded-full overflow-hidden border-4 border-brand-cyan shadow-md bg-gray-100 mb-6 flex-shrink-0">
                    <img src="\${photoSrc}" alt="\${selectedAthlete.athlete_full_name}" class="w-full h-full object-cover" onerror="this.src='https://cms.triathlon.org/assets/avatar-placeholder.png'">
                </div>
            \` : \`
                <div class="w-36 h-36 rounded-full bg-[#E5E7EB] border-4 border-gray-300 flex items-center justify-center text-gray-400 mb-6 flex-shrink-0 shadow-inner">
                    <i class="fa-solid fa-user text-6xl"></i>
                </div>
            \`;

            container.innerHTML = \`
                <div class="bg-gray-50 border border-gray-200 p-10 rounded-none flex flex-col items-center md:w-1/3 shadow-sm">
                    \${photoHTML}
                    <span class="bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30 text-xs font-black px-4 py-1.5 rounded-none mb-3 uppercase tracking-wider">
                        \${selectedCategory.name}
                    </span>
                    <h3 class="text-3xl font-extrabold text-brand-navy text-center leading-snug">\${selectedAthlete.athlete_full_name}</h3>
                </div>

                <div class="flex flex-col w-full md:w-2/3 gap-6">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-white border border-gray-200 rounded-none p-5 flex flex-col items-center text-center shadow-sm">
                            <span class="text-xs text-gray-500 uppercase font-black mb-2">\${dict.yob}</span>
                            <span class="text-xl font-black text-brand-navy">\${selectedAthlete.athlete_yob}</span>
                        </div>
                        <div class="bg-white border border-gray-200 rounded-none p-5 flex flex-col items-center text-center shadow-sm">
                            <span class="text-xs text-gray-500 uppercase font-black mb-2">\${dict.noc}</span>
                            <div class="flex items-center gap-2">
                                <img src="\${flagSrc}" alt="\${selectedAthlete.athlete_noc}" class="h-4 w-auto object-contain border border-gray-200" onerror="this.style.display='none'">
                                <span class="text-xl font-black text-brand-navy">\${selectedAthlete.athlete_noc}</span>
                            </div>
                        </div>
                        <div class="border-2 rounded-none p-5 flex flex-col items-center text-center shadow-sm \${isChi ? 'bg-emerald-50 border-brand-green/30' : 'bg-amber-50 border-brand-orange/30'}">
                            <span class="text-xs uppercase font-black mb-2 \${isChi ? 'text-brand-green' : 'text-brand-orange'}">
                                \${isChi ? dict.natOk : dict.intReq}
                            </span>
                            <span class="text-xl font-black \${isChi ? 'text-brand-green' : 'text-brand-orange'}">
                                \${isChi ? '$0 USD' : '$50 USD'}
                            </span>
                        </div>
                    </div>

                    \${selectedAthlete.wait_pos ? \`
                        <div class="bg-amber-100 border border-amber-200 p-4 rounded-none flex items-center gap-3">
                            <i class="fa-solid fa-circle-exclamation text-amber-600 text-lg"></i>
                            <span class="text-xs text-amber-700 font-semibold">\${dict.waitlistWarning}</span>
                        </div>
                    \` : ''}

                    <p class="text-gray-500 text-base leading-relaxed text-center md:text-left">
                        \${isChi ? dict.natDesc : dict.intDesc}
                    </p>

                    <div class="flex gap-4 mt-2">
                        <button onclick="goToStep(2)" class="flex-1 bg-gray-100 border border-gray-200 font-bold py-4 rounded-none text-lg text-gray-700 hover:bg-gray-200 active:scale-95 transition-all">
                            \${dict.backBtn}
                        </button>
                        <button onclick="processCheckout()" class="flex-[2] bg-brand-cyan text-white font-extrabold py-4 rounded-none text-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all">
                            <i class="fa-solid fa-clipboard-check"></i> \${dict.registerConfirm}
                        </button>
                    </div>
                </div>
            \`;
        }

        // STEP 4: Checkout handler
        function processCheckout() {
            const isChi = selectedAthlete.athlete_noc === 'CHI';
            if (isChi) {
                generateReceiptCode();
                goToReceipt();
            } else {
                document.querySelectorAll('.reg-step').forEach(s => s.classList.add('hidden'));
                document.getElementById('reg-step-checkout').classList.remove('hidden');
            }
        }

        // Alphanumeric code generation: 1 letter + 2 numbers of 2 digits (e.g. "A-25")
        function generateReceiptCode() {
            const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const randomLetter = letters.charAt(Math.floor(Math.random() * letters.length));
            const num = Math.floor(Math.random() * 90) + 10;
            registrationCode = \`\${randomLetter}-\${num}\`;
        }

        // Simulated POS checkout
        function startPOSSimulation() {
            document.querySelectorAll('.reg-step').forEach(s => s.classList.add('hidden'));
            document.getElementById('reg-step-processing').classList.remove('hidden');
            
            const stepText = document.getElementById('pos-sim-step');
            const instrText = document.getElementById('pos-sim-instruction');
            const dict = TRANSLATIONS[currentLanguage];

            setTimeout(() => {
                stepText.innerText = dict.posInsert;
                instrText.innerText = (currentLanguage === 'es' ? "Detectando tarjeta en lector..." : currentLanguage === 'en' ? "Detecting card in reader..." : "Detectando cartão no leitor...");
                
                setTimeout(() => {
                    stepText.innerText = dict.posProcessing;
                    instrText.innerText = (currentLanguage === 'es' ? "Solicitando autorización bancaria..." : currentLanguage === 'en' ? "Requesting bank authorization..." : "Solicitando autorização bancária...");
                    
                    setTimeout(() => {
                        stepText.innerText = dict.posApproved;
                        instrText.className = "text-sm text-brand-green font-bold";
                        instrText.innerHTML = "<i class='fa-solid fa-circle-check mr-1.5'></i>" + (currentLanguage === 'es' ? "Transacción autorizada con éxito." : currentLanguage === 'en' ? "Transaction authorized successfully." : "Transação autorizada com sucesso.");
                        
                        setTimeout(() => {
                            generateReceiptCode();
                            goToReceipt();
                        }, 1500);
                    }, 2000);
                }, 2000);
            }, 2000);
        }

        // STEP 5: Receipt (points to PDF receipt on server)
        function goToReceipt() {
            document.querySelectorAll('.reg-step').forEach(s => s.classList.add('hidden'));
            document.getElementById('reg-step-success').classList.remove('hidden');

            document.getElementById('receipt-name').innerText = selectedAthlete.athlete_full_name;
            document.getElementById('receipt-noc').innerText = selectedAthlete.athlete_noc;
            document.getElementById('receipt-category').innerText = selectedCategory.name;
            
            const isChi = selectedAthlete.athlete_noc === 'CHI';
            const dict = TRANSLATIONS[currentLanguage];
            document.getElementById('receipt-status').innerText = isChi ? (currentLanguage === 'es' ? 'Validado' : currentLanguage === 'en' ? 'Validated' : 'Validado') : (currentLanguage === 'es' ? 'Aprobado' : currentLanguage === 'en' ? 'Approved' : 'Aprovado');
            document.getElementById('receipt-status').className = isChi ? 'text-xs text-brand-cyan font-bold bg-brand-cyan/10 border border-brand-cyan/20 px-2.5 py-0.5 rounded-none' : 'text-xs text-brand-green font-bold bg-brand-green/10 border border-brand-green/20 px-2.5 py-0.5 rounded-none';

            document.getElementById('receipt-code').innerText = registrationCode;
            
            // Set QR code link - points to PDF confirmation download link on server
            const qrUrl = \`https://triatlonantofagasta.cl/descargar_comprobante.php?codigo=\${registrationCode}&nombre=\${encodeURIComponent(selectedAthlete.athlete_full_name)}&noc=\${selectedAthlete.athlete_noc}&cat=\${encodeURIComponent(selectedCategory.name)}\`;
            const qrData = encodeURIComponent(qrUrl);
            document.getElementById('receipt-qr').src = \`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=\${qrData}&color=081225\`;

            const photoContainer = document.getElementById('receipt-photo-container');
            photoContainer.innerHTML = "";
            if (selectedAthlete.athlete_profile_image) {
                const img = document.createElement('img');
                img.src = selectedAthlete.athlete_profile_image;
                img.className = "w-full h-full object-cover";
                img.onerror = function() { this.src = 'https://cms.triathlon.org/assets/avatar-placeholder.png'; };
                photoContainer.appendChild(img);
            } else {
                photoContainer.innerHTML = \`<i class="fa-solid fa-user text-4xl text-gray-400"></i>\`;
            }
        }

        function finishRegistration() {
            cancelRegistration();
        }
    </script>
<!-- KIMOS Agent Bridge protocol — inyectado por build.py antes de </body>.
     Script clásico: comparte el entorno léxico global con el script del kiosco
     (PARTICIPANTES_DATA, selectedCategory, selectedAthlete, changeScreen,
     goToStep, etc.). Expone el flujo del tótem a un agente autorizado. -->
<script>
(function () {
  function norm(v) {
    return String(v == null ? '' : v).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }
  function activeScreen() {
    var el = null;
    try { el = document.querySelector('.screen.active'); } catch (e) {}
    return el ? el.id.replace(/^screen-/, '') : null;
  }
  function categorias() {
    try { return (PARTICIPANTES_DATA.start_lists || []).map(function (l) { return l.name; }); }
    catch (e) { return []; }
  }
  function entriesDe(list) {
    if (!list) return [];
    var out = [];
    try {
      (list.start_list && list.start_list.entries || []).forEach(function (e) { out.push(e); });
      (list.wait_list && list.wait_list.entries || []).forEach(function (e) { out.push(e); });
    } catch (e) {}
    return out;
  }
  function currentState() {
    var sc = (typeof selectedCategory !== 'undefined' && selectedCategory) ? selectedCategory : null;
    var sa = (typeof selectedAthlete !== 'undefined' && selectedAthlete) ? selectedAthlete : null;
    return {
      screen: activeScreen(),
      idioma: (typeof currentLanguage !== 'undefined') ? currentLanguage : 'es',
      categoria: sc ? sc.name : null,
      atleta: sa ? sa.athlete_full_name : null,
      atletaPais: sa ? sa.athlete_noc : null,
      codigo: (typeof registrationCode !== 'undefined' && registrationCode) ? registrationCode : null,
      categorias: categorias(),
    };
  }
  function send(type, extra) {
    var msg = { __kimosTotem: true, type: type, state: currentState() };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) msg[k] = extra[k];
    try { parent.postMessage(msg, '*'); } catch (e) {}
  }
  function dismissSaver() {
    try { if (typeof dismissScreensaver === 'function') dismissScreensaver(); } catch (e) {}
  }

  // Reenviar STATE en cada cambio de pantalla / paso (también toques manuales).
  try {
    if (typeof changeScreen === 'function') {
      var _cs = changeScreen;
      changeScreen = function (s) { _cs(s); send('STATE'); };
    }
    if (typeof goToStep === 'function') {
      var _gs = goToStep;
      goToStep = function (n) { _gs(n); send('STATE'); };
    }
  } catch (e) {}

  function handleCmd(cmd, args) {
    args = args || {};
    dismissSaver();
    switch (cmd) {
      case 'OPEN_REGISTER':
        openRegisterScreen();
        return { ok: true, message: 'Pantalla de inscripción abierta. Selecciona una categoría con SELECT_CATEGORY.' };
      case 'OPEN_INFO':
        openInfoScreenWithTab(args.tab || (typeof activeInfoTab !== 'undefined' ? activeInfoTab : 'athletes'));
        return { ok: true, message: 'Pantalla de información abierta (tab: ' + (args.tab || 'athletes') + ').' };
      case 'RETURN_HOME':
        returnToHome();
        return { ok: true, message: 'Volviendo al inicio.' };
      case 'CHANGE_LANGUAGE': {
        var lang = norm(args.lang || args.idioma);
        if (['es', 'en', 'pt'].indexOf(lang) < 0) return { ok: false, message: 'Idioma no soportado (usa es, en o pt).' };
        changeLanguage(lang);
        return { ok: true, message: 'Idioma cambiado a ' + lang + '.' };
      }
      case 'SELECT_CATEGORY': {
        var q = norm(args.categoria || args.category || args.name);
        if (!q) return { ok: false, message: 'Falta el nombre de la categoría.' };
        var list = (PARTICIPANTES_DATA.start_lists || []).find(function (l) { return norm(l.name) === q; })
                || (PARTICIPANTES_DATA.start_lists || []).find(function (l) { return norm(l.name).indexOf(q) >= 0; });
        if (!list) return { ok: false, message: 'Categoría no encontrada. Disponibles: ' + categorias().join(', ') };
        if (activeScreen() !== 'register') openRegisterScreen();
        selectedCategory = list;
        goToStep(2);
        return { ok: true, message: 'Categoría "' + list.name + '" seleccionada (' + entriesDe(list).length + ' atletas). Usa SELECT_ATHLETE { nombre }.' };
      }
      case 'SEARCH_ATHLETE': {
        var inp = document.getElementById('reg-search-input');
        if (!inp) return { ok: false, message: 'Primero abre la inscripción y elige una categoría.' };
        inp.value = String(args.texto || args.query || '');
        if (typeof filterRegisterAthletes === 'function') filterRegisterAthletes();
        return { ok: true, message: 'Filtrando atletas por "' + inp.value + '".' };
      }
      case 'SELECT_ATHLETE': {
        if (typeof selectedCategory === 'undefined' || !selectedCategory) return { ok: false, message: 'Selecciona primero una categoría con SELECT_CATEGORY.' };
        var qn = norm(args.nombre || args.name || args.atleta);
        var noc = norm(args.pais || args.noc);
        if (!qn && !noc) return { ok: false, message: 'Falta el nombre del atleta.' };
        var list2 = entriesDe(selectedCategory);
        var found = list2.find(function (e) { return qn && norm(e.athlete_full_name) === qn; })
                 || list2.find(function (e) { return qn && norm(e.athlete_full_name).indexOf(qn) >= 0; })
                 || list2.find(function (e) { return noc && norm(e.athlete_noc) === noc; });
        if (!found) return { ok: false, message: 'Atleta no encontrado en "' + selectedCategory.name + '".' };
        selectedAthlete = found;
        goToStep(3);
        return { ok: true, message: 'Atleta seleccionado: ' + found.athlete_full_name + ' (' + found.athlete_noc + '). Usa CONFIRM para continuar.' };
      }
      case 'CONFIRM': {
        if (typeof selectedAthlete === 'undefined' || !selectedAthlete) return { ok: false, message: 'Selecciona un atleta antes de confirmar.' };
        processCheckout();
        var s = currentState();
        if (s.codigo) return { ok: true, message: 'Inscripción validada (sin pago). Código: ' + s.codigo + '.' };
        return { ok: true, message: 'Atleta no nacional: requiere pago. Usa PAY para simular el pago con tarjeta.' };
      }
      case 'PAY': {
        if (activeScreen() !== 'register') return { ok: false, message: 'No hay un pago en curso.' };
        startPOSSimulation();
        return { ok: true, message: 'Procesando pago en el POS… al aprobarse se genera el código y el recibo.' };
      }
      case 'FINISH':
        finishRegistration();
        return { ok: true, message: 'Inscripción finalizada. Tótem reiniciado.' };
      default:
        return { ok: false, message: 'Comando no soportado: ' + cmd };
    }
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.__kimosCmd !== true) return;
    var res;
    try { res = handleCmd(d.cmd, d.args); } catch (err) { res = { ok: false, message: String(err) }; }
    send('CMD_RESULT', { id: d.id, ok: res.ok, message: res.message });
  });

  function ready() { send('READY'); }
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(ready, 0);
  else document.addEventListener('DOMContentLoaded', ready);
})();
</script>

</body>
</html>
`;

const APP_ID = 'triatlon-antofagasta';
const APP_LABEL = 'Triatlón Antofagasta';
const APP_DESC =
  'Kiosco del Americas Triathlon Championships Antofagasta 2026: inscripción de ' +
  'atletas por categoría (atletas nacionales se validan sin costo; extranjeros pagan), ' +
  'información del evento y atletas. Controlable por un agente autorizado.';

const TOOLS = [
  { name: 'OPEN_REGISTER', description: 'Abre la pantalla de inscripción (paso 1: categorías).', inputSchema: { type: 'object', properties: {} } },
  { name: 'OPEN_INFO', description: 'Abre la pantalla de información en una pestaña.', inputSchema: { type: 'object', properties: { tab: { type: 'string', enum: ['athletes', 'guide', 'map', 'schedule'] } } } },
  { name: 'RETURN_HOME', description: 'Vuelve a la pantalla de inicio.', inputSchema: { type: 'object', properties: {} } },
  { name: 'CHANGE_LANGUAGE', description: 'Cambia el idioma del kiosco.', inputSchema: { type: 'object', properties: { lang: { type: 'string', enum: ['es', 'en', 'pt'] } }, required: ['lang'] } },
  { name: 'SELECT_CATEGORY', description: 'Selecciona una categoría de la inscripción por nombre y avanza a elegir atleta.', inputSchema: { type: 'object', properties: { categoria: { type: 'string' } }, required: ['categoria'] } },
  { name: 'SEARCH_ATHLETE', description: 'Filtra la lista de atletas de la categoría por texto.', inputSchema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] } },
  { name: 'SELECT_ATHLETE', description: 'Selecciona un atleta por nombre (o país) y avanza a confirmar.', inputSchema: { type: 'object', properties: { nombre: { type: 'string' }, pais: { type: 'string' } } } },
  { name: 'CONFIRM', description: 'Confirma la inscripción del atleta (nacional: valida sin costo; extranjero: pasa a pago).', inputSchema: { type: 'object', properties: {} } },
  { name: 'PAY', description: 'Simula el pago con tarjeta en el POS (para atletas extranjeros).', inputSchema: { type: 'object', properties: {} } },
  { name: 'FINISH', description: 'Finaliza la inscripción y reinicia el kiosco.', inputSchema: { type: 'object', properties: {} } },
];

export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host debe exponer React.');
  }

  let frameWindow = null;
  let lastState = { screen: 'home', idioma: 'es', categoria: null, atleta: null, codigo: null, categorias: [] };
  let seq = 0;
  const pending = new Map();
  let unregisterAgent = null;

  function onMessage(e) {
    const d = e && e.data;
    if (!d || d.__kimosTotem !== true) return;
    if (d.state) lastState = d.state;
    if (d.type === 'CMD_RESULT' && d.id != null && pending.has(d.id)) {
      const resolve = pending.get(d.id);
      pending.delete(d.id);
      resolve({ success: !!d.ok, message: d.message });
    }
  }
  window.addEventListener('message', onMessage);

  function sendCmd(cmd, args) {
    if (!frameWindow) return Promise.resolve({ success: false, error: 'El kiosco aún no termina de cargar.' });
    const id = 'cmd-' + ++seq;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      try { frameWindow.postMessage({ __kimosCmd: true, id: id, cmd: cmd, args: args || {} }, '*'); }
      catch (err) { pending.delete(id); resolve({ success: false, error: String(err) }); return; }
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); resolve({ success: false, error: 'Tiempo de espera agotado esperando al kiosco.' }); }
      }, 8000);
    });
  }

  if (shell && shell.agent && typeof shell.agent.register === 'function') {
    unregisterAgent = shell.agent.register({
      label: APP_LABEL,
      description: APP_DESC,
      tools: TOOLS,
      getSnapshot: () => ({
        pantalla: lastState.screen,
        idioma: lastState.idioma,
        categoria: lastState.categoria,
        atleta: lastState.atleta,
        codigo: lastState.codigo,
        categorias: lastState.categorias,
        instrucciones: 'Flujo de inscripción: OPEN_REGISTER → SELECT_CATEGORY { categoria } → ' +
          'SELECT_ATHLETE { nombre } → CONFIRM → (PAY si el atleta no es nacional). ' +
          'Informa siempre al usuario el resultado (categoría, atleta, código de recibo).',
      }),
      dispatchAction: async (action) => {
        const type = (action && action.type) || '';
        const p = (action && action.payload) || {};
        switch (type) {
          case 'OPEN_REGISTER': return sendCmd('OPEN_REGISTER', {});
          case 'OPEN_INFO': return sendCmd('OPEN_INFO', { tab: p.tab });
          case 'RETURN_HOME': return sendCmd('RETURN_HOME', {});
          case 'CHANGE_LANGUAGE': return sendCmd('CHANGE_LANGUAGE', { lang: p.lang });
          case 'SELECT_CATEGORY': return sendCmd('SELECT_CATEGORY', { categoria: p.categoria });
          case 'SEARCH_ATHLETE': return sendCmd('SEARCH_ATHLETE', { texto: p.texto });
          case 'SELECT_ATHLETE': return sendCmd('SELECT_ATHLETE', { nombre: p.nombre, pais: p.pais });
          case 'CONFIRM': return sendCmd('CONFIRM', {});
          case 'PAY': return sendCmd('PAY', {});
          case 'FINISH': return sendCmd('FINISH', {});
          default: return { success: false, error: 'Acción no soportada: ' + type };
        }
      },
    });
  } else {
    console.warn('[triatlon-antofagasta] shell.agent no disponible: la app no será controlable por agente.');
  }

  function Component() {
    return React.createElement('iframe', {
      title: APP_LABEL,
      srcDoc: TOTEM_HTML,
      sandbox: 'allow-scripts allow-forms allow-modals allow-popups',
      style: { width: '100%', height: '100%', border: '0', display: 'block', background: '#fff' },
      ref: (el) => {
        if (el) {
          frameWindow = el.contentWindow;
          el.addEventListener('load', () => { frameWindow = el.contentWindow; });
        }
      },
    });
  }

  return {
    Component,
    unmount() {
      window.removeEventListener('message', onMessage);
      pending.clear();
      if (typeof unregisterAgent === 'function') { try { unregisterAgent(); } catch (e) { /* noop */ } }
    },
  };
}
