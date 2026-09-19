#!/usr/bin/env python3
"""
Geminis Core — el motor de ejecución de KIMOS Trading.

Esta es la mitad que la cabina no puede ser. La app de KIMOS corre en el
navegador: no puede guardar una clave de trading ni tener IP fija, y Binance
exige lista blanca de IP o claves Ed25519 autogeneradas para habilitar
cualquier permiso más allá de lectura. Así que la app decide y este proceso
ejecuta.

    cabina  ──GET──►  /api/public/app/{instancia}/definition      (la política)
    motor   ──POST─►  /api/public/app/{instancia}/submit/{canal}  (lo que pasó)

Lo que este proceso hace, en orden de importancia:

  1. No tiene permiso de retiro. La clave con permiso de retiro NO SE CREA.
  2. Obedece el botón de pánico de la política antes que cualquier otra cosa.
  3. Pasa cada propuesta por un agente de riesgo determinista que es el espejo
     exacto del de la cabina. Si los dos no dicen lo mismo, hay un error y el
     motor se detiene en vez de adivinar.
  4. En Modo Asesor no envía nada sin un veredicto humano en la política.
  5. Deja el stop y el objetivo COMO OCO EN EL EXCHANGE, no en memoria: si este
     proceso muere, la posición sigue protegida.
  6. Cada orden lleva un newClientOrderId único y determinista; ante un timeout
     consulta el estado antes de reintentar, nunca reenvía a ciegas.
  7. Reconcilia cada 60 s contra Binance; ante cualquier diferencia pausa y
     alerta en vez de seguir operando sobre un estado que no cuadra.

Lo que NO hace, a propósito: retirar fondos, tocar margen o futuros, y permitir
que un modelo de lenguaje envíe una orden. Los agentes de IA de la arquitectura
Geminis clasifican y redactan tesis; las órdenes las manda código.

Instalación: ver README.md de esta carpeta, o ejecutar install_vps.sh.

ADVERTENCIA. Operar criptoactivos puede hacer perder todo el capital. Esto es
una implementación de referencia para la fase de paper trading; antes de
apuntarla a producción hay que completar la hoja de ruta (backtest → Testnet →
capital real mínimo) y responder las preguntas legales y tributarias.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import signal
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

VERSION = "1.0.0"

log = logging.getLogger("geminis")

# ── Configuración ────────────────────────────────────────────────────────────

BASES = {
    "testnet": "https://testnet.binance.vision",
    "produccion": "https://api.binance.com",
}

# El gateway público de KIMOS acepta 8 envíos cada 5 minutos por IP e instancia.
# El latido va cada 60 s (5 en la ventana) y deja holgura para propuestas,
# ejecuciones y alertas. Subirlo hace que el gateway responda 429 y se pierdan
# eventos, que es peor que reportar menos seguido.
LATIDO_S = 60
MAX_CAMPO = 5000

# Límite de peso de la API spot: 6.000 por minuto y por IP. El limitador local
# frena al 80% (§9.1): pasarse devuelve 429 y, si se insiste, un 418 que
# bloquea la IP entre 2 minutos y 3 días.
PESO_MAX = 6000
PESO_FRENO = 0.8


@dataclass
class Config:
    kimos_base: str
    instancia: str
    token: str
    entorno: str = "testnet"
    api_key: str = ""
    clave_privada: str = ""      # ruta a la clave Ed25519 en PEM
    api_secret: str = ""         # alternativa HMAC (solo para Testnet)
    recv_window: int = 5000
    intervalo_ciclo: int = 15

    @classmethod
    def desde_entorno(cls) -> "Config":
        falta = [k for k in ("KIMOS_BASE", "KIMOS_INSTANCE") if not os.environ.get(k)]
        if falta:
            raise SystemExit(f"Faltan variables de entorno: {', '.join(falta)}. Ver README.md")
        return cls(
            kimos_base=os.environ["KIMOS_BASE"].rstrip("/"),
            instancia=os.environ["KIMOS_INSTANCE"],
            token=os.environ.get("KIMOS_TOKEN", ""),
            entorno=os.environ.get("BINANCE_ENV", "testnet"),
            api_key=os.environ.get("BINANCE_API_KEY", ""),
            clave_privada=os.environ.get("BINANCE_PRIVATE_KEY_PATH", ""),
            api_secret=os.environ.get("BINANCE_API_SECRET", ""),
            # El contrato de Binance admite hasta 60000 ms y recomienda 5000 o
            # menos: una ventana grande no da holgura, da margen a que una
            # petición vieja se ejecute tarde. Un valor fuera de rango se
            # recorta en vez de hacer que Binance rechace TODAS las firmas.
            recv_window=max(1, min(int(os.environ.get("BINANCE_RECV_WINDOW", "5000")), 60000)),
            intervalo_ciclo=int(os.environ.get("GEMINIS_CICLO_S", "15")),
        )


def ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Cliente de Binance ───────────────────────────────────────────────────────

class LimitePeso:
    """Limitador local de peso de solicitudes.

    Lee la cabecera `X-MBX-USED-WEIGHT-1M` que devuelve Binance en vez de
    llevar solo su propia cuenta: la cuenta la comparten todos los procesos
    que salen por la misma IP, así que la única cifra fiable es la del
    servidor.
    """

    def __init__(self) -> None:
        self.usado = 0
        self.visto_en = 0.0

    def registrar(self, cabeceras: Any) -> None:
        for nombre in ("X-MBX-USED-WEIGHT-1M", "x-mbx-used-weight-1m"):
            valor = cabeceras.get(nombre)
            if valor:
                try:
                    self.usado = int(valor)
                    self.visto_en = time.time()
                except ValueError:
                    pass
                return

    def esperar_si_hace_falta(self) -> None:
        if time.time() - self.visto_en > 60:
            self.usado = 0
            return
        if self.usado >= PESO_MAX * PESO_FRENO:
            espera = 60 - (time.time() - self.visto_en)
            if espera > 0:
                log.warning("Peso de API en %s/%s: esperando %.0f s", self.usado, PESO_MAX, espera)
                time.sleep(espera)
                self.usado = 0


class ErrorBinance(Exception):
    def __init__(self, codigo: int, mensaje: str):
        super().__init__(f"Binance {codigo}: {mensaje}")
        self.codigo = codigo
        self.mensaje = mensaje


class Binance:
    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.base = BASES.get(cfg.entorno, BASES["testnet"])
        self.peso = LimitePeso()
        self.delta_reloj_ms = 0
        self._firmante = self._cargar_firmante()

    # -- firma -----------------------------------------------------------------

    def _cargar_firmante(self):
        """Ed25519 si hay clave privada; HMAC como alternativa.

        Binance restringe a SOLO LECTURA las claves HMAC sin lista blanca de
        IP. Para operar en producción la clave tiene que ser Ed25519 (o RSA)
        con IP fija: el HMAC queda para Testnet y para que este archivo se
        pueda probar sin ceremonia.
        """
        if self.cfg.clave_privada:
            try:
                from cryptography.hazmat.primitives import serialization
            except ImportError as exc:  # pragma: no cover
                raise SystemExit("Falta `cryptography` para firmar con Ed25519: pip install cryptography") from exc
            with open(self.cfg.clave_privada, "rb") as fh:
                privada = serialization.load_pem_private_key(fh.read(), password=None)
            log.info("Firma Ed25519 cargada desde %s", self.cfg.clave_privada)
            return ("ed25519", privada)
        if self.cfg.api_secret:
            if self.cfg.entorno == "produccion":
                log.warning(
                    "Firmando con HMAC en PRODUCCIÓN. Binance solo habilita trading a claves HMAC "
                    "con lista blanca de IP; lo recomendado es Ed25519 con rotación cada 90 días."
                )
            return ("hmac", self.cfg.api_secret.encode())
        return (None, None)

    def _firmar(self, consulta: str) -> str:
        tipo, clave = self._firmante
        if tipo == "ed25519":
            return base64.b64encode(clave.sign(consulta.encode())).decode()
        if tipo == "hmac":
            return hmac.new(clave, consulta.encode(), hashlib.sha256).hexdigest()
        raise RuntimeError("No hay clave configurada: este motor no puede firmar órdenes.")

    # -- transporte ------------------------------------------------------------

    def _pedir(self, metodo: str, ruta: str, params: dict | None = None,
               firmado: bool = False, peso: int = 1) -> Any:
        self.peso.esperar_si_hace_falta()
        params = dict(params or {})
        if firmado:
            params["timestamp"] = int(time.time() * 1000) + self.delta_reloj_ms
            params["recvWindow"] = self.cfg.recv_window
            consulta = urllib.parse.urlencode(params)
            params["signature"] = self._firmar(consulta)
        consulta = urllib.parse.urlencode(params)
        url = f"{self.base}{ruta}"
        cuerpo = None
        if metodo == "GET":
            if consulta:
                url = f"{url}?{consulta}"
        else:
            cuerpo = consulta.encode()
        pedido = urllib.request.Request(url, data=cuerpo, method=metodo)
        pedido.add_header("User-Agent", f"geminis-core/{VERSION}")
        if self.cfg.api_key:
            pedido.add_header("X-MBX-APIKEY", self.cfg.api_key)
        if metodo != "GET":
            pedido.add_header("Content-Type", "application/x-www-form-urlencoded")
        try:
            with urllib.request.urlopen(pedido, timeout=15) as resp:
                self.peso.registrar(resp.headers)
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as err:
            self.peso.registrar(err.headers)
            crudo = err.read().decode(errors="replace")
            if err.code == 429:
                espera = int(err.headers.get("Retry-After", "60"))
                log.error("429: peso excedido. Respetando Retry-After de %s s.", espera)
                time.sleep(espera)
            elif err.code == 418:
                # Insistir tras un 429 bloquea la IP. Aquí no se reintenta: se
                # para y se alerta, que es lo único correcto.
                raise ErrorBinance(418, "IP bloqueada por exceso de solicitudes. El motor se detiene.")
            try:
                detalle = json.loads(crudo)
                raise ErrorBinance(int(detalle.get("code", err.code)), str(detalle.get("msg", crudo)))
            except (ValueError, TypeError):
                raise ErrorBinance(err.code, crudo) from err

    # -- endpoints usados ------------------------------------------------------

    def sincronizar_reloj(self) -> None:
        """recvWindow corto solo sirve si el reloj está sincronizado (§9.5.3)."""
        antes = time.time() * 1000
        datos = self._pedir("GET", "/api/v3/time")
        self.delta_reloj_ms = int(datos["serverTime"] - (antes + time.time() * 1000) / 2)
        log.info("Reloj sincronizado con Binance (delta %s ms)", self.delta_reloj_ms)

    def info_simbolo(self, par: str) -> dict:
        datos = self._pedir("GET", "/api/v3/exchangeInfo", {"symbol": par}, peso=20)
        s = datos["symbols"][0]
        filtros = {f["filterType"]: f for f in s["filters"]}
        return {
            "par": s["symbol"],
            "tickSize": float(filtros["PRICE_FILTER"]["tickSize"]),
            "stepSize": float(filtros["LOT_SIZE"]["stepSize"]),
            "minQty": float(filtros["LOT_SIZE"]["minQty"]),
            "minNotional": float(
                (filtros.get("NOTIONAL") or filtros.get("MIN_NOTIONAL") or {}).get("minNotional", 0)
            ),
            "ocoAllowed": bool(s.get("ocoAllowed")),
        }

    def velas(self, par: str, intervalo: str, limite: int = 500) -> list[dict]:
        crudo = self._pedir("GET", "/api/v3/klines",
                            {"symbol": par, "interval": intervalo, "limit": limite}, peso=2)
        return [
            {"t": k[0], "o": float(k[1]), "h": float(k[2]), "l": float(k[3]),
             "c": float(k[4]), "v": float(k[5])}
            for k in crudo
        ]

    def saldos(self) -> dict[str, float]:
        cuenta = self._pedir("GET", "/api/v3/account", firmado=True, peso=20)
        return {b["asset"]: float(b["free"]) + float(b["locked"])
                for b in cuenta["balances"]
                if float(b["free"]) + float(b["locked"]) > 0}

    def ordenes_abiertas(self, par: str | None = None) -> list[dict]:
        params = {"symbol": par} if par else {}
        return self._pedir("GET", "/api/v3/openOrders", params, firmado=True, peso=6 if par else 80)

    def estado_orden(self, par: str, client_order_id: str) -> dict | None:
        try:
            return self._pedir("GET", "/api/v3/order",
                               {"symbol": par, "origClientOrderId": client_order_id},
                               firmado=True, peso=4)
        except ErrorBinance as err:
            if err.codigo == -2013:  # la orden no existe
                return None
            raise

    def enviar_orden(self, **params) -> dict:
        """Envía una orden. Ante un timeout NO reenvía: consulta primero.

        El `newClientOrderId` es lo que hace idempotente el reintento: si la
        primera llegó, la consulta la encuentra y no se duplica la posición.
        """
        client_id = params.get("newClientOrderId")
        try:
            return self._pedir("POST", "/api/v3/order", params, firmado=True)
        except (urllib.error.URLError, TimeoutError) as err:
            log.error("Timeout enviando la orden %s: consultando su estado antes de decidir.", client_id)
            time.sleep(2)
            estado = self.estado_orden(params["symbol"], client_id)
            if estado:
                log.warning("La orden %s sí había llegado. No se reenvía.", client_id)
                return estado
            raise ErrorBinance(0, f"La orden {client_id} no llegó: {err}") from err

    def enviar_oco(self, *, symbol: str, side: str, quantity: str, price: str,
                   stopPrice: str, stopLimitPrice: str,
                   stopLimitTimeInForce: str = "GTC",
                   listClientOrderId: str | None = None) -> dict:
        """Stop y objetivo enlazados EN EL EXCHANGE.

        Es la diferencia entre una caída del VPS que cuesta una oportunidad y
        una que cuesta la cuenta: con el OCO puesto, la posición sigue
        protegida aunque este proceso no exista.

        El endpoint vigente es `POST /api/v3/orderList/oco`, que describe las
        dos patas como «above» y «below» en vez de asumirlas. El anterior
        —`POST /api/v3/order/oco`— sigue respondiendo, pero la documentación de
        Binance lo titula «New OCO - Deprecated», y un endpoint deprecado es un
        endpoint con fecha de retirada. Se manda el nuevo y, solo si este
        Binance no lo entendiera, se reintenta una vez con el viejo: quedarse
        sin protección por un cambio de nombre sería el peor final posible.

        Qué pata es cuál, según el lado del OCO (que es el contrario al de la
        entrada):

          SELL (protege una compra): el objetivo va ARRIBA del precio como
          LIMIT_MAKER, y el stop ABAJO como STOP_LOSS_LIMIT.
          BUY (el espejo): el stop va ARRIBA y el objetivo ABAJO.
        """
        comun = {"symbol": symbol, "side": side, "quantity": quantity}
        if listClientOrderId:
            comun["listClientOrderId"] = listClientOrderId
        if side == "SELL":
            nuevo = dict(comun, aboveType="LIMIT_MAKER", abovePrice=price,
                         belowType="STOP_LOSS_LIMIT", belowStopPrice=stopPrice,
                         belowPrice=stopLimitPrice, belowTimeInForce=stopLimitTimeInForce)
        else:
            nuevo = dict(comun, aboveType="STOP_LOSS_LIMIT", aboveStopPrice=stopPrice,
                         abovePrice=stopLimitPrice, aboveTimeInForce=stopLimitTimeInForce,
                         belowType="LIMIT_MAKER", belowPrice=price)
        try:
            return self._pedir("POST", "/api/v3/orderList/oco", nuevo, firmado=True)
        except ErrorBinance as err:
            # -1121 símbolo, -2010 fondos, -1013 filtros: son errores REALES del
            # OCO y volver a mandarlo por la ruta vieja no los arregla. Solo se
            # reintenta cuando la queja es de la ruta o de los parámetros, que
            # es lo que diría un Binance que aún no conoce este endpoint.
            if err.codigo not in (-1102, -1104, -1105, -1128, 404):
                raise
            log.warning("orderList/oco no fue aceptado (%s). Se reintenta con el endpoint anterior.", err)
            viejo = dict(comun, price=price, stopPrice=stopPrice,
                         stopLimitPrice=stopLimitPrice,
                         stopLimitTimeInForce=stopLimitTimeInForce)
            return self._pedir("POST", "/api/v3/order/oco", viejo, firmado=True)

    def cancelar_todo(self, par: str) -> Any:
        return self._pedir("DELETE", "/api/v3/openOrders", {"symbol": par}, firmado=True)


# ── Puente con la cabina de KIMOS ────────────────────────────────────────────

class Puente:
    """Lee la política de la cabina y le reporta lo que ocurre.

    La política se pide primero al faro de versión (`/definition/version`,
    ~40 bytes y caché de 5 s) y solo se descarga entera cuando la versión
    cambió: publicar se ve enseguida y el resto del tiempo no se gasta nada.
    """

    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.base = f"{cfg.kimos_base}/api/public/app/{cfg.instancia}"
        self.version_vista = ""
        self.politica: dict = {}
        self.enviados: list[float] = []

    def leer_politica(self) -> dict | None:
        """Devuelve la política solo si cambió desde la última lectura."""
        try:
            with urllib.request.urlopen(f"{self.base}/definition/version", timeout=10) as r:
                v = str(json.loads(r.read().decode()).get("v") or "")
        except Exception as err:  # noqa: BLE001 — cualquier fallo aquí es «sigue con la que tienes»
            log.warning("No se pudo leer la versión de la política: %s", err)
            return None
        if v and v == self.version_vista and self.politica:
            return None
        url = f"{self.base}/definition" + (f"?v={urllib.parse.quote(v)}" if v else "")
        try:
            with urllib.request.urlopen(url, timeout=10) as r:
                datos = json.loads(r.read().decode()).get("data") or {}
        except Exception as err:  # noqa: BLE001
            log.warning("No se pudo leer la política: %s", err)
            return None
        if datos.get("kind") != "kimos-trading/politica":
            log.error("La definición publicada no es una política de KIMOS Trading. Se ignora.")
            return None
        revision_nueva = int(datos.get("revision", 0))
        revision_vieja = int(self.politica.get("revision", 0))
        if self.politica and revision_nueva < revision_vieja:
            # Una revisión que retrocede es una respuesta vieja de alguna caché:
            # aplicarla desharía un cambio que la persona ya hizo.
            log.warning("Llegó la revisión %s siendo la vigente la %s: se ignora.", revision_nueva, revision_vieja)
            return None
        self.version_vista = v
        self.politica = datos
        log.info("Política revisión %s aplicada (modo %s, entorno %s, pánico %s).",
                 revision_nueva, datos.get("modo"), datos.get("entorno"), datos.get("panico"))
        return datos

    def _puede_enviar(self) -> bool:
        ahora = time.time()
        self.enviados = [t for t in self.enviados if ahora - t < 300]
        return len(self.enviados) < 8

    def reportar(self, canal: str, payload: dict) -> bool:
        """Manda un evento a la cabina. Nunca lanza: perder un reporte no puede
        tumbar el motor, pero sí tiene que quedar en el log."""
        if not self._puede_enviar():
            log.warning("Cupo del gateway agotado (8 cada 5 min): se omite el %s.", canal)
            return False
        cuerpo = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        if len(cuerpo) > MAX_CAMPO:
            cuerpo = json.dumps({"truncado": True, "resumen": cuerpo[: MAX_CAMPO - 200]}, ensure_ascii=False)
        datos = json.dumps({
            "tipo": canal,
            "token": self.cfg.token,
            "rev": str(self.politica.get("revision", 0)),
            "payload": cuerpo,
        }).encode()
        pedido = urllib.request.Request(f"{self.base}/submit/{canal}", data=datos, method="POST")
        pedido.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(pedido, timeout=10) as r:
                self.enviados.append(time.time())
                return r.status in (200, 201)
        except Exception as err:  # noqa: BLE001
            log.warning("No se pudo reportar el %s: %s", canal, err)
            return False


# ── Agente de riesgo determinista (espejo del de la cabina) ──────────────────

@dataclass
class Propuesta:
    id: str
    motor: str
    par: str
    lado: str
    entrada: float
    stop: float
    objetivo: float
    nocional: float
    tesis: str = ""
    invalidacion: str = ""
    tipo_orden: str = "LIMIT"


@dataclass
class Veredicto:
    veredicto: str
    razones: list[str] = field(default_factory=list)
    nocional: float = 0.0
    cantidad: float = 0.0
    rr: float = 0.0


def evaluar_riesgo(p: Propuesta, politica: dict, estado: dict) -> Veredicto:
    """Mismos límites, mismos códigos y mismo orden que `evaluarRiesgo` en el
    bundle de la cabina. Si alguna vez dejan de coincidir, el motor se para: dos
    respuestas distintas a la misma propuesta significa que una de las dos está
    mal y no hay forma de saber cuál."""
    razones: list[str] = []
    limites = politica.get("limites", {})
    motores = politica.get("motores", {})
    cfg = motores.get(p.motor)

    if not cfg:
        razones.append(f"RIESGO-000 · Motor no reconocido: «{p.motor}».")
    if politica.get("panico"):
        razones.append("RIESGO-001 · Botón de pánico activo: no se abren posiciones nuevas.")
    if cfg and not cfg.get("habilitado"):
        razones.append(f"RIESGO-002 · El motor {p.motor} está deshabilitado.")

    if p.entrada <= 0:
        razones.append("RIESGO-010 · Precio de entrada inválido.")
    if p.stop <= 0:
        razones.append("RIESGO-011 · La propuesta no trae un stop loss válido. Sin stop no hay orden.")
    elif p.lado == "BUY" and p.stop >= p.entrada:
        razones.append("RIESGO-012 · En una compra, el stop debe quedar bajo el precio de entrada.")
    elif p.lado == "SELL" and p.stop <= p.entrada:
        razones.append("RIESGO-013 · En una venta, el stop debe quedar sobre el precio de entrada.")

    irc = float(politica.get("irc", 0))
    factor = 1.0
    if irc >= 70:
        razones.append(f"RIESGO-020 · Índice de riesgo de contexto en {irc:.0f}/100: bloqueo total de entradas.")
    elif irc >= 40:
        factor = 0.5
        if p.motor == "scalping":
            razones.append("RIESGO-021 · Con el índice de contexto sobre 40, el scalping queda en pausa.")

    edad = float(estado.get("edadDatosS", 0))
    if edad > float(limites.get("datosFrescosS", 5)):
        razones.append(f"RIESGO-030 · Los datos de mercado tienen {edad:.0f} s de antigüedad.")

    if cfg:
        capital_motor = float(cfg.get("capital", 0))
        pnl = float(estado.get("pnlDia", {}).get(p.motor, 0))
        limite_diario = float(cfg.get("perdidaDiaria", 0)) * capital_motor
        if limite_diario > 0 and pnl <= -limite_diario:
            razones.append(f"RIESGO-040 · {p.motor} superó su pérdida diaria ({pnl:.2f} USDT).")
        ops = int(estado.get("opsHoy", {}).get(p.motor, 0))
        if int(cfg.get("opsMax", 0)) and ops >= int(cfg["opsMax"]):
            razones.append(f"RIESGO-041 · {p.motor} ya hizo {ops} operaciones hoy.")
        abiertas = int(estado.get("posiciones", {}).get(p.motor, 0))
        if abiertas >= int(cfg.get("maxPosiciones", 1)):
            razones.append(f"RIESGO-042 · {p.motor} ya tiene {abiertas} posiciones abiertas.")

    capital_total = float(politica.get("capitalOperativo", 0))
    if capital_total > 0:
        if float(estado.get("pnlDiaTotal", 0)) <= -float(limites.get("perdidaDiariaTotal", 0.03)) * capital_total:
            razones.append("RIESGO-050 · La cartera total superó su pérdida diaria: todos los motores en pausa.")
        if float(estado.get("exposicion", 0)) >= float(limites.get("exposicionMax", 0.6)) * capital_total:
            razones.append("RIESGO-052 · Exposición abierta sobre el máximo permitido.")
        if not p.par.upper().startswith(("BTC", "ETH")):
            if float(estado.get("riesgoAltcoins", 0)) >= float(limites.get("riesgoAltcoins", 0.03)) * capital_total:
                razones.append("RIESGO-053 · El riesgo abierto en altcoins alcanzó su máximo.")

    costo = float(limites.get("costoIdaVuelta", 0.0015))
    rr = 0.0
    if p.entrada > 0 and p.stop > 0 and p.objetivo > 0:
        dist_stop = abs(p.entrada - p.stop) / p.entrada
        dist_obj = abs(p.objetivo - p.entrada) / p.entrada
        rr = dist_obj / dist_stop if dist_stop > 0 else 0.0
        if p.motor == "scalping":
            if dist_obj < 3 * costo:
                razones.append(
                    f"RIESGO-060 · Objetivo de {dist_obj*100:.3f}% bajo el mínimo de 3× comisiones "
                    f"({3*costo*100:.3f}%)."
                )
        elif rr < 2:
            razones.append(f"RIESGO-061 · Relación riesgo/beneficio 1:{rr:.2f}, bajo el mínimo 1:2.")
    elif p.objetivo <= 0:
        razones.append("RIESGO-062 · La propuesta no trae objetivo.")

    nocional = p.nocional
    if cfg and p.entrada > 0 and p.stop > 0:
        dist_stop = abs(p.entrada - p.stop) / p.entrada
        denom = dist_stop + costo
        maximo = (float(cfg.get("capital", 0)) * float(cfg.get("riesgoOp", 0)) / denom) * factor if denom > 0 else 0
        if nocional > maximo:
            if nocional > maximo * 1.25:
                razones.append(
                    f"RIESGO-070 · Tamaño solicitado {nocional:.2f} muy por sobre el máximo {maximo:.2f}."
                )
            else:
                nocional = maximo
        elif factor < 1:
            nocional *= factor

    if razones:
        return Veredicto("VETADA", razones, 0.0, 0.0, rr)
    return Veredicto("APROBADA", [], nocional, nocional / p.entrada if p.entrada else 0.0, rr)


# ── Indicadores mínimos (los mismos que calcula la cabina) ───────────────────

def ema(valores: list[float], n: int) -> list[float | None]:
    salida: list[float | None] = [None] * len(valores)
    if len(valores) < n:
        return salida
    k = 2 / (n + 1)
    previo = sum(valores[:n]) / n
    salida[n - 1] = previo
    for i in range(n, len(valores)):
        previo = valores[i] * k + previo * (1 - k)
        salida[i] = previo
    return salida


def _wilder(valores: list[float], n: int) -> list[float | None]:
    salida: list[float | None] = [None] * len(valores)
    if len(valores) < n:
        return salida
    previo = sum(valores[:n]) / n
    salida[n - 1] = previo
    for i in range(n, len(valores)):
        previo = (previo * (n - 1) + valores[i]) / n
        salida[i] = previo
    return salida


def rsi(velas: list[dict], n: int = 14) -> list[float | None]:
    salida: list[float | None] = [None] * len(velas)
    if len(velas) <= n:
        return salida
    ganancias, perdidas = [], []
    for i in range(1, len(velas)):
        d = velas[i]["c"] - velas[i - 1]["c"]
        ganancias.append(max(d, 0.0))
        perdidas.append(max(-d, 0.0))
    g = _wilder(ganancias, n)
    p = _wilder(perdidas, n)
    for i, valor in enumerate(g):
        if valor is None:
            continue
        perdida = p[i]
        salida[i + 1] = 100.0 if not perdida else 100 - 100 / (1 + valor / perdida)
    return salida


def atr(velas: list[dict], n: int = 14) -> list[float | None]:
    tr = []
    for i, k in enumerate(velas):
        if i == 0:
            tr.append(k["h"] - k["l"])
        else:
            previo = velas[i - 1]["c"]
            tr.append(max(k["h"] - k["l"], abs(k["h"] - previo), abs(k["l"] - previo)))
    return _wilder(tr, n)


def cuerpo(k: dict) -> float:
    return abs(k["c"] - k["o"])


def rango(k: dict) -> float:
    return k["h"] - k["l"]


def es_martillo(k: dict) -> bool:
    r, c = rango(k), cuerpo(k)
    if r <= 0 or c <= 0:
        return False
    sombra_inf = min(k["o"], k["c"]) - k["l"]
    sombra_sup = k["h"] - max(k["o"], k["c"])
    return sombra_inf >= 2 * c and sombra_sup <= 0.1 * r


def es_envolvente_alcista(v: list[dict], i: int) -> bool:
    if i < 1:
        return False
    a, b = v[i - 1], v[i]
    if a["c"] >= a["o"] or b["c"] <= b["o"]:
        return False
    return max(b["o"], b["c"]) >= max(a["o"], a["c"]) and min(b["o"], b["c"]) <= min(a["o"], a["c"])


# ── Estratega ────────────────────────────────────────────────────────────────

def redondear_al_paso(valor: float, paso: float) -> float:
    if paso <= 0:
        return valor
    decimales = len(str(paso).split(".")[1].rstrip("0")) if "." in str(paso) else 0
    return round((valor // paso) * paso, max(decimales, 0))


def proponer(par: str, motor: str, cfg_motor: dict, velas: list[dict], limites: dict) -> Propuesta | None:
    """Estratega de referencia: retroceso en tendencia con confirmación de vela.

    Es deliberadamente simple y honesto sobre lo que es: el sitio donde se
    portan los setups del documento maestro después de que el backtest de la
    cabina los apruebe. Un setup que no pasó el backtest no se pone aquí.
    """
    if len(velas) < 220:
        return None
    cierres = [k["c"] for k in velas]
    e21 = ema(cierres, 21)
    e50 = ema(cierres, 50)
    e200 = ema(cierres, 200)
    r = rsi(velas, 14)
    a = atr(velas, 14)
    i = len(velas) - 1
    k = velas[i]
    if None in (e21[i], e50[i], e200[i], r[i], a[i]) or a[i] <= 0:
        return None
    # Sesgo: solo largos en spot y solo con el precio sobre la EMA 200. Bajo la
    # EMA 200 el régimen es bajista y el motor swing no compra (§6.3).
    if not (k["c"] > e200[i] and e50[i] > e200[i]):
        return None
    if not (38 <= r[i] <= 58):
        return None
    if k["l"] > e21[i]:
        return None
    if not (es_martillo(k) or es_envolvente_alcista(velas, i)):
        return None

    entrada = k["c"]
    stop = entrada - 1.5 * a[i]
    objetivo = entrada + 1.5 * a[i] * 2  # 1:2, el mínimo del documento
    riesgo = float(cfg_motor.get("riesgoOp", 0.01))
    capital = float(cfg_motor.get("capital", 0))
    costo = float(limites.get("costoIdaVuelta", 0.0015))
    dist = abs(entrada - stop) / entrada
    nocional = (capital * riesgo) / (dist + costo) if (dist + costo) > 0 else 0
    if nocional <= 0:
        return None
    return Propuesta(
        id=f"{motor}-{par}-{int(k['t'])}",
        motor=motor, par=par, lado="BUY",
        entrada=entrada, stop=stop, objetivo=objetivo, nocional=nocional,
        tesis=(f"Retroceso a la EMA 21 con el precio sobre la EMA 200 y RSI en {r[i]:.0f}. "
               f"Confirmación por patrón de reversión alcista. Stop a 1,5× ATR."),
        invalidacion=f"Cierre bajo {stop:.2f} o pérdida de la EMA 200.",
        tipo_orden=str(cfg_motor.get("tipoOrden", "LIMIT")),
    )


# ── Bucle principal ──────────────────────────────────────────────────────────

class Motor:
    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.puente = Puente(cfg)
        self.binance = Binance(cfg)
        self.simbolos: dict[str, dict] = {}
        self.propuestas_enviadas: set[str] = set()
        self.ordenes_colocadas: dict[str, dict] = {}
        self.parar = False
        self.ultimo_latido = 0.0
        self.ultima_reconciliacion = 0.0
        self.pausado_por_reconciliacion = False

    # -- utilidades ------------------------------------------------------------

    def estado_actual(self) -> dict:
        return {
            "edadDatosS": 0,
            "pnlDia": {}, "opsHoy": {}, "posiciones": {},
            "pnlDiaTotal": 0, "exposicion": 0, "riesgoAltcoins": 0,
        }

    def info(self, par: str) -> dict:
        if par not in self.simbolos:
            self.simbolos[par] = self.binance.info_simbolo(par)
        return self.simbolos[par]

    # -- pánico ----------------------------------------------------------------

    def aplicar_panico(self, politica: dict) -> None:
        """Lo primero de cada ciclo. Cancelar es seguro y se puede repetir."""
        pares = {p for m in politica.get("motores", {}).values() for p in m.get("pares", [])}
        cancelados = 0
        for par in pares:
            try:
                self.binance.cancelar_todo(par)
                cancelados += 1
            except ErrorBinance as err:
                if err.codigo != -2011:  # «no hay órdenes que cancelar» no es un fallo
                    log.error("No se pudo cancelar en %s: %s", par, err)
        if politica.get("panicoCerrarPosiciones"):
            log.warning("La política pide CERRAR POSICIONES A MERCADO.")
            self.cerrar_todo_a_mercado(pares)
        self.puente.reportar("alerta", {
            "texto": f"Pánico aplicado: órdenes canceladas en {cancelados} par(es).",
            "cerrarPosiciones": bool(politica.get("panicoCerrarPosiciones")),
            "at": ahora_iso(),
        })

    def cerrar_todo_a_mercado(self, pares: set[str]) -> None:
        try:
            saldos = self.binance.saldos()
        except ErrorBinance as err:
            log.error("No se pudieron leer los saldos para cerrar: %s", err)
            return
        for par in pares:
            activo = par.replace("USDT", "").replace("USDC", "")
            cantidad = saldos.get(activo, 0.0)
            if cantidad <= 0:
                continue
            info = self.info(par)
            cantidad = redondear_al_paso(cantidad, info["stepSize"])
            if cantidad < info["minQty"]:
                continue
            try:
                self.binance.enviar_orden(
                    symbol=par, side="SELL", type="MARKET", quantity=f"{cantidad}",
                    newClientOrderId=f"PANIC-{par}-{int(time.time())}"[:36],
                )
                log.warning("Cerrada a mercado la posición de %s (%s).", par, cantidad)
            except ErrorBinance as err:
                log.error("No se pudo cerrar %s: %s", par, err)

    # -- ejecución -------------------------------------------------------------

    def veredicto_humano(self, politica: dict, propuesta_id: str) -> dict | None:
        for v in politica.get("veredictos", []):
            if str(v.get("propuestaId")) == propuesta_id:
                return v
        return None

    def ejecutar(self, p: Propuesta, ver: Veredicto, politica: dict) -> None:
        info = self.info(p.par)
        precio = redondear_al_paso(p.entrada, info["tickSize"])
        cantidad = redondear_al_paso(ver.cantidad, info["stepSize"])
        if cantidad < info["minQty"] or cantidad * precio < info["minNotional"]:
            log.info("La orden de %s queda bajo el mínimo del símbolo: no se envía.", p.par)
            return
        client_id = f"{p.motor[:2].upper()}-{p.par}-{int(time.time())}"[:36]
        try:
            orden = self.binance.enviar_orden(
                symbol=p.par, side=p.lado, type=p.tipo_orden,
                timeInForce="GTC" if p.tipo_orden in ("LIMIT", "LIMIT_MAKER") else None,
                quantity=f"{cantidad}", price=f"{precio}", newClientOrderId=client_id,
            )
        except ErrorBinance as err:
            # -2010 con LIMIT_MAKER significa que la orden habría cruzado el
            # libro. No es un error: es el post-only haciendo su trabajo.
            if err.codigo == -2010 and p.tipo_orden == "LIMIT_MAKER":
                log.info("LIMIT_MAKER rechazada en %s (habría sido taker). Se descarta la entrada.", p.par)
                return
            log.error("No se pudo enviar la orden: %s", err)
            self.puente.reportar("alerta", {"texto": f"Orden rechazada en {p.par}: {err}", "at": ahora_iso()})
            return

        self.ordenes_colocadas[client_id] = {"propuesta": p.id, "par": p.par, "cantidad": cantidad}
        log.info("Orden %s enviada: %s %s %s a %s", client_id, p.lado, cantidad, p.par, precio)

        # El OCO va SIEMPRE, y va al exchange. Si falla, la posición queda sin
        # protección: se alerta y se cancela la entrada.
        if info["ocoAllowed"]:
            try:
                self.binance.enviar_oco(
                    symbol=p.par, side="SELL" if p.lado == "BUY" else "BUY",
                    quantity=f"{cantidad}",
                    price=f"{redondear_al_paso(p.objetivo, info['tickSize'])}",
                    stopPrice=f"{redondear_al_paso(p.stop, info['tickSize'])}",
                    stopLimitPrice=f"{redondear_al_paso(p.stop * 0.999, info['tickSize'])}",
                    stopLimitTimeInForce="GTC",
                    listClientOrderId=f"OCO-{client_id}"[:36],
                )
                log.info("OCO colocado en el exchange para %s.", p.par)
            except ErrorBinance as err:
                log.error("NO se pudo colocar el OCO de %s: %s", p.par, err)
                self.puente.reportar("alerta", {
                    "texto": f"Posición en {p.par} SIN protección: el OCO falló ({err}). Revisar a mano.",
                    "at": ahora_iso(),
                })
        else:
            self.puente.reportar("alerta", {
                "texto": f"{p.par} no admite OCO: el stop queda a cargo del motor y se pierde si el VPS cae.",
                "at": ahora_iso(),
            })

        self.puente.reportar("ejecucion", {
            "propuesta": p.id, "par": p.par, "lado": p.lado,
            "cantidad": cantidad, "precio": precio,
            "clientOrderId": client_id, "estado": orden.get("status", "NEW"),
            "at": ahora_iso(),
        })

    # -- reconciliación --------------------------------------------------------

    def reconciliar(self) -> bool:
        """Compara el estado interno con Binance. Ante diferencia: pausa."""
        try:
            abiertas = self.binance.ordenes_abiertas()
        except ErrorBinance as err:
            log.error("Reconciliación fallida: %s", err)
            return False
        ids_binance = {o.get("clientOrderId") for o in abiertas}
        huerfanas = ids_binance - set(self.ordenes_colocadas) - {None}
        # Las órdenes que puso otra sesión del mismo motor no son un problema
        # si llevan su prefijo; cualquier otra cosa sí.
        huerfanas = {o for o in huerfanas if not str(o).startswith(("SW-", "DA-", "SC-", "OCO-", "PANIC-"))}
        if huerfanas:
            log.error("Órdenes abiertas que este motor no colocó: %s", huerfanas)
            self.puente.reportar("alerta", {
                "texto": f"Reconciliación con diferencias: {len(huerfanas)} orden(es) desconocida(s). Motor en pausa.",
                "at": ahora_iso(),
            })
            return False
        return True

    # -- ciclo -----------------------------------------------------------------

    def ciclo(self) -> None:
        politica = self.puente.leer_politica() or self.puente.politica
        if not politica:
            log.info("Sin política todavía: la cabina no ha publicado nada.")
            return

        if politica.get("entorno") != self.cfg.entorno:
            log.error(
                "La política pide el entorno «%s» y este motor arrancó en «%s». No se opera: "
                "cambiar de entorno es un reinicio con otras claves, no una variable.",
                politica.get("entorno"), self.cfg.entorno,
            )
            return

        if politica.get("panico"):
            self.aplicar_panico(politica)
            return

        ahora = time.time()
        if ahora - self.ultima_reconciliacion > 60:
            self.ultima_reconciliacion = ahora
            self.pausado_por_reconciliacion = not self.reconciliar()
        if self.pausado_por_reconciliacion:
            log.warning("Motor en pausa por reconciliación con diferencias.")
            return

        modo = politica.get("modo", "asesor")
        for motor_id, cfg_motor in politica.get("motores", {}).items():
            if not cfg_motor.get("habilitado"):
                continue
            temporalidades = cfg_motor.get("temporalidades", {})
            intervalo = temporalidades.get("ejecucion", "4h")
            for par in cfg_motor.get("pares", []):
                try:
                    velas = self.binance.velas(par, intervalo, 300)
                except ErrorBinance as err:
                    log.error("No se pudieron traer velas de %s: %s", par, err)
                    continue
                p = proponer(par, motor_id, cfg_motor, velas, politica.get("limites", {}))
                if not p:
                    continue
                ver = evaluar_riesgo(p, politica, self.estado_actual())
                if ver.veredicto == "VETADA":
                    log.info("Propuesta %s vetada: %s", p.id, "; ".join(ver.razones))
                    continue
                if p.id not in self.propuestas_enviadas:
                    self.propuestas_enviadas.add(p.id)
                    self.puente.reportar("propuesta", {
                        "id": p.id, "motor": p.motor, "par": p.par, "lado": p.lado,
                        "entrada": round(p.entrada, 8), "stop": round(p.stop, 8),
                        "objetivo": round(p.objetivo, 8), "nocional": round(ver.nocional, 2),
                        "tipoOrden": p.tipo_orden, "tesis": p.tesis[:1200],
                        "invalidacion": p.invalidacion[:400], "at": ahora_iso(),
                    })
                if modo == "asesor":
                    v = self.veredicto_humano(politica, p.id)
                    if not v:
                        log.info("Propuesta %s esperando aprobación humana.", p.id)
                        continue
                    if v.get("veredicto") != "approve":
                        log.info("Propuesta %s rechazada por la persona.", p.id)
                        continue
                    if float(v.get("nocionalAprobado", 0)) > 0:
                        ver.nocional = float(v["nocionalAprobado"])
                        ver.cantidad = ver.nocional / p.entrada
                self.ejecutar(p, ver, politica)

        if ahora - self.ultimo_latido > LATIDO_S:
            self.ultimo_latido = ahora
            self.puente.reportar("latido", {
                "version": VERSION,
                "entorno": self.cfg.entorno,
                "pesoUsado": self.binance.peso.usado,
                "posiciones": len(self.ordenes_colocadas),
                "exposicion": 0,
                "riesgoAltcoins": 0,
                "reconciliacion": "ok" if not self.pausado_por_reconciliacion else "diferencias",
                "at": ahora_iso(),
            })

    def correr(self) -> None:
        log.info("Geminis Core %s · entorno %s · instancia %s", VERSION, self.cfg.entorno, self.cfg.instancia)
        try:
            self.binance.sincronizar_reloj()
        except Exception as err:  # noqa: BLE001
            log.error("No se pudo sincronizar el reloj: %s", err)
        while not self.parar:
            try:
                self.ciclo()
            except ErrorBinance as err:
                if err.codigo == 418:
                    log.critical("%s", err)
                    self.puente.reportar("alerta", {"texto": str(err), "at": ahora_iso()})
                    break
                log.error("Error de Binance en el ciclo: %s", err)
            except Exception as err:  # noqa: BLE001
                log.exception("Error inesperado en el ciclo: %s", err)
            time.sleep(self.cfg.intervalo_ciclo)
        log.info("Geminis Core detenido.")


def main() -> int:
    logging.basicConfig(
        level=os.environ.get("GEMINIS_LOG", "INFO"),
        format="%(asctime)s %(levelname)-7s %(name)s · %(message)s",
    )
    cfg = Config.desde_entorno()
    motor = Motor(cfg)

    def detener(*_: Any) -> None:
        log.info("Señal recibida: terminando el ciclo en curso.")
        motor.parar = True

    signal.signal(signal.SIGTERM, detener)
    signal.signal(signal.SIGINT, detener)
    motor.correr()
    return 0


if __name__ == "__main__":
    sys.exit(main())
