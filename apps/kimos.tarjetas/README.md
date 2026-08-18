# Tarjetas Virtuales para KIMOS (`kimos.tarjetas`)

Versión actual: **1.1.0**

Aplicación oficial/instalable para el entorno de trabajo **KIMOS**, diseñada para crear, gestionar y exportar tarjetas de presentación virtuales profesionales en formato de imagen (PNG / JPG) con código QR vCard integrado para escaneo rápido de contactos en smartphones. Las tarjetas se generan desde los **usuarios reales del sistema KIMOS**, con su foto de perfil, correo, cargo y teléfono.

---

## 🪪 Características Principales

- **Usuarios reales del sistema (v1.1.0)**:
  - Pestaña **👥 Usuarios Kimos**: lista los usuarios reales de la organización (`/api/identity/actors` vía `shell.authFetch`), con su foto de perfil, correo, cargo (campo *Cargo* de la app Perfil), teléfono y ubicación.
  - **Generar tarjeta** por usuario o **⚡ Generar tarjetas para todos** de un clic (omite quienes ya tienen tarjeta; deduplicación por usuario y por correo).
  - En instancias nuevas, la primera tarjeta se siembra con el perfil del usuario conectado (`/api/identity/me`) en lugar de datos de ejemplo.
  - **Marca de las tarjetas**: sube el **logo de la marca** y define empresa y sitio web corporativo una sola vez; se aplican automáticamente a cada tarjeta generada (y a todas las existentes con *Aplicar a todas las tarjetas*).

- **Diseño Plano y Profesional**: Perfectamente integrado con el sistema visual y tokens HSL de Kimos (modo Claro y Oscuro automático sin sobreescritura destructiva de estilos).
- **Código QR vCard 3.0 Integrado**:
  - Motor de generación de código QR en JavaScript puro (sin dependencias externas ni llamadas a APIs de terceros).
  - Codificación RFC estándar de vCard (`N`, `FN`, `ORG`, `TITLE`, `TEL`, `EMAIL`, `URL`, `ADR`, `NOTE`, `X-SOCIAL-LINKEDIN`).
  - Compatible con cualquier app de cámara en iOS y Android para guardar el contacto directamente en la agenda.
- **Exportación en Formato Imagen**:
  - Renderizado en alta definición mediante HTML5 Canvas 2D.
  - Opciones de exportación en **PNG** y **JPG** en escalas 1x, 2x (HD) y 3x (Ultra HD para impresión).
  - Botón de **Copiar Imagen** directa al portapapeles (`Clipboard API`).
  - Descarga independiente del archivo de contacto `.vcf` o solo del código QR.
- **Personalización Completa**:
  - **Foto de Persona**: Subida de foto de perfil individual con recorte circular y anillo de acento.
  - **Logo de Empresa**: Carga de logotipo corporativo optimizado.
  - **Formatos**: Horizontal (1050 × 600 px) y Vertical (600 × 950 px).
  - **Paletas de Color Kimos**: Kimos Teal, Slate Ejecutivo, Midnight Dark, Emerald Pro, Royal Indigo, Bicolor y Selector de colores personalizados.
  - **Disposiciones**: Modern Split y Minimal Clean.
- **Gestión Multi-Tarjeta y Persistencia**:
  - `multiInstance: true`: Guarda y carga datos automáticamente con `shell.saveData` / `shell.loadData`.
  - Galería visual para administrar múltiples tarjetas, duplicar, editar o eliminar.
  - Integración con el menú Documentos de Kimos (`shell.documents.onSerialize` y `onLoad`).
- **Control por Agente IA (`agent.control`)**:
  - Permite al asistente de KIMOS crear, listar, actualizar y consultar tarjetas de los integrantes del equipo.

---

## 📦 Estructura del Paquete

```
kimos.tarjetas/
├── manifest.json       # Configuración, permisos (instance.read/write, agent.control)
├── dist/
│   ├── index.js        # Bundle ESM plano (mount, QR generator, Canvas renderer, React UI)
│   └── index.css       # Estilos scoped bajo .kimos-tarjetas con tokens HSL
└── README.md           # Documentación de la app
```

---

## 🚀 Empaquetado e Instalación

### 1. Empaquetar el archivo `.kapp`
Desde la raíz del proyecto:
```bash
node kimos-creator-pack/tools/pack.mjs kimos.tarjetas
```
Esto genera el archivo comprimido instalable: `kimos.tarjetas-1.0.0.kapp`.

### 2. Instalar en KIMOS
1. Inicia sesión en KIMOS como superadministrador.
2. Abre la **Tienda** y selecciona **"Instalar desde archivo"**.
3. Selecciona el archivo `kimos.tarjetas-1.0.0.kapp`.
4. Aprueba los permisos solicitados (`instance.read`, `instance.write`, `agent.control`).
5. ¡La app aparecerá en el lanzador de aplicaciones y en el menú de documentos!

---

## 📋 Versiones y Changelog

| Versión | Cambios |
|---|---|
| **1.1.0** | Publicación en la Tienda oficial. Tarjetas generadas desde los usuarios reales del sistema KIMOS (foto de perfil, correo, cargo, teléfono y ubicación vía `/api/identity`), pestaña 👥 Usuarios Kimos con generación individual y masiva, marca de la colección (logo + empresa + web) aplicada a las tarjetas generadas, siembra de la primera tarjeta con el perfil del usuario conectado, escapado RFC del vCard (QR robusto con comas/puntos y coma), dibujo de foto y logo sin distorsión (cover/contain), y nuevas tools de agente `LIST_USERS`, `CREATE_CARDS_FROM_USERS` y `SET_BRAND`. |
| **1.0.0** | Versión inicial con generador QR vCard 3.0 puro, renderizador Canvas 2D HD, subida de foto y logo, paletas de colores Kimos, galería multi-tarjetas y herramientas de agente IA. |

---

## 🔒 Privacidad y Rendimiento
- Todo el procesamiento de imágenes, vCard y generación QR ocurre **100% en el navegador del usuario**.
- No requiere servidores externos ni bases de datos de terceros.
