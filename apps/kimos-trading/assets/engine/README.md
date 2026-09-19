# Geminis Core — el motor de ejecución

Esta carpeta es la mitad de KIMOS Trading que no puede vivir en el navegador.

## Por qué existe

La app de KIMOS corre dentro de una ventana del escritorio, en el navegador de
una persona. Eso significa dos cosas que no se pueden negociar:

1. **No hay dónde guardar una clave de trading.** Cualquier cosa que llegue al
   bundle llega al navegador, y de ahí a las herramientas de desarrollo, a una
   extensión o a un volcado de memoria.
2. **No hay IP fija.** Binance restringe a *solo lectura* las claves HMAC sin
   lista blanca de IP, y para habilitar trading exige restricción de IP o una
   clave autogenerada Ed25519/RSA. Un portátil que cambia de wifi no puede
   cumplir eso.

Así que la app decide y este proceso ejecuta. La app **no tiene ni un campo**
donde pegar una clave: no es un olvido.

```
   KIMOS Trading (navegador)              Geminis Core (tu VPS, IP fija)
   ───────────────────────────            ──────────────────────────────
   política, límites, aprobaciones  ──►   lee /definition
   backtest, tributario, bitácora   ◄──   POST /submit/{canal}
   NO tiene claves                        tiene las claves y firma
```

## Qué necesitas antes de empezar

- Un VPS con **IP fija** (Ubuntu 22.04 o 24.04) en una región con baja latencia
  medida hacia Binance.
- Una cuenta de Binance **dedicada**, con llave de seguridad física (FIDO2),
  código antiphishing y lista blanca de direcciones de retiro.
- Tu IP fija de administración, para el cortafuegos.
- El identificador de instancia y el token que muestra la pestaña **Puente** de
  la app.

## Instalación

```bash
# En el VPS, como root:
bash install_vps.sh TU.IP.FIJA.DE.ADMIN
```

El instalador crea un usuario de sistema sin shell, un entorno virtual de
Python, una clave Ed25519 en `/etc/geminis/`, un cortafuegos que solo deja
entrar SSH desde tu IP, y la unidad de systemd con reinicio automático.

Después:

1. Edita `/etc/geminis/geminis.env` con lo que muestra la pestaña Puente.
2. Sube `/etc/geminis/ed25519.pub` a Binance → API Management → clave
   autogenerada. **Permisos: lectura y trading spot. Nunca retiro.**
   Restricción de IP: la del VPS.
3. `systemctl start geminis && journalctl -u geminis -f`
4. En la app, pestaña Puente: comprueba que llegue el latido y que el token
   salga como «verificado».

## Las claves

| Clave | Permisos | Para qué | Dónde vive |
|---|---|---|---|
| K1 lectura | Solo lectura | Panel, contabilidad, auditoría | Gestor de secretos |
| K2 scalping | Lectura + spot | Motor scalping | `/etc/geminis/`, modo 640 |
| K3 day | Lectura + spot | Motor day trading | `/etc/geminis/`, modo 640 |
| K4 swing | Lectura + spot | Motor swing | `/etc/geminis/`, modo 640 |
| Retiros | **No se crea nunca** | — | — |

Todas Ed25519, con lista blanca de la IP del VPS, **rotación cada 90 días** y
revocación inmediata ante cualquier alerta. Sin permisos de margen ni futuros.

Los retiros se hacen a mano en Binance, con 2FA. Este motor no puede retirar, y
el día que una clave se filtre eso es lo único que va a importar.

## Cómo se habla con la cabina

**Lee la política** (sin autenticación, es contenido público que la app publica
a propósito):

```
GET {KIMOS_BASE}/api/public/app/{KIMOS_INSTANCE}/definition/version   → { "v": "..." }
GET {KIMOS_BASE}/api/public/app/{KIMOS_INSTANCE}/definition?v=...     → { "data": {...} }
```

El faro de versión pesa unos 40 bytes y tiene caché de 5 segundos: el motor lo
consulta en cada ciclo y solo descarga la política entera cuando cambió.

**Reporta lo que pasa:**

```
POST {KIMOS_BASE}/api/public/app/{KIMOS_INSTANCE}/submit/{canal}
Content-Type: application/json

{ "tipo": "latido", "token": "...", "rev": "17", "payload": "{...json...}" }
```

Canales: `latido`, `propuesta`, `ejecucion`, `alerta`.

### Los tres límites del gateway que hay que respetar

| Límite | Valor | Consecuencia de pasarse |
|---|---|---|
| Envíos | 8 cada 5 minutos por IP e instancia | 429: se pierden eventos |
| Tamaño | 32 KB por envío, 5.000 caracteres por campo | 413 o truncado |
| Forma | Solo pares clave → texto plano, sin objetos anidados | Los campos anidados se descartan |

Por eso el detalle viaja como JSON **dentro** del campo `payload`, y el latido
va cada 60 segundos: cinco de los ocho envíos, dejando holgura para propuestas,
ejecuciones y alertas.

### El token no es autenticación

El gateway público acepta envíos de cualquiera que conozca el identificador de
instancia. El `token` compartido sirve para que la cabina distinga lo que manda
tu motor de lo que manda cualquier otro, y **la app lo dice así**: un envío sin
token o con token distinto se muestra igual, marcado como no verificado.

La seguridad real está en otro sitio: nada se ejecuta por el hecho de llegar.
En Modo Asesor una persona aprueba, y el motor —que sí está autenticado contra
Binance— vuelve a pasar la propuesta por su propio agente de riesgo antes de
enviar nada.

## El agente de riesgo está dos veces, a propósito

`evaluar_riesgo()` en `geminis_core.py` es el espejo de `evaluarRiesgo()` en el
bundle de la app: mismos límites, mismos códigos, mismo orden. No es
duplicación por descuido:

- La cabina lo necesita para poder decir **por qué** una propuesta se rechaza,
  sin preguntarle al VPS.
- El motor lo necesita porque la cabina es un cliente y **ningún cliente
  decide**: lo que llega por el gateway es dato no confiable.

Si algún día los dos dejan de dar la misma respuesta a la misma propuesta, hay
un error, y el motor se detiene en vez de adivinar cuál de los dos tiene razón.

## Lo que este motor de referencia todavía no es

Es honesto decirlo, porque la hoja de ruta depende de ello:

- **El estratega es uno solo y simple** (retroceso a la EMA 21 en tendencia con
  confirmación de vela). Los setups del documento maestro se portan aquí
  *después* de que el backtest de la cabina los apruebe. Un setup que no pasó el
  backtest no se pone aquí.
- **No hay WebSocket todavía.** El motor pide velas por REST en cada ciclo, lo
  que basta para swing y day trading. Scalping necesita el stream de mercado y
  el *user data stream*, y con eso el presupuesto de latencia de 200 ms. Es la
  fase 6, y es la última por una razón.
- **No hay TimescaleDB.** Hace falta cuando se ingiere histórico para backtests
  largos y reconciliación con series. Mientras el backtest corra en la cabina
  sobre las 1.000 velas que entrega Binance por llamada, no se necesita.
- **El P&L por motor todavía no se calcula aquí.** `estado_actual()` devuelve
  ceros, así que los límites de pérdida diaria y de exposición **no están
  frenando nada** hasta que se conecte el *user data stream* y se lleve el
  libro de posiciones. Esto es lo primero que hay que completar antes de
  apuntar el motor a producción, y por eso está escrito aquí y no en una nota
  al pie.

## Operación

```bash
systemctl status geminis          # ¿está vivo?
journalctl -u geminis -f          # qué está haciendo
systemctl restart geminis         # tras editar el .env
```

**Una vez al mes, en Testnet: prueba el botón de pánico.** Un botón de pánico
que nadie probó no es un botón de pánico.

## Descargo

Operar criptoactivos puede hacer perder todo el capital. El estudio de Chague,
De-Losso y Giovannetti (SSRN 3423101) siguió a operadores intradía durante más
de 300 días: el 97% perdió dinero. Esto es una implementación de referencia
para la fase de paper trading, no asesoría financiera, y no garantiza ningún
resultado.
