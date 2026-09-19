"""El OCO del motor: la protección tiene que salir bien a la primera.

Se comprueba el mapeo al endpoint vigente (`POST /api/v3/orderList/oco`), que
cada pata quede del lado correcto del precio, y que el reintento con el
endpoint anterior ocurra SOLO cuando la queja es de la ruta o de los
parámetros — nunca ante un error real, donde repetir la orden sería peor que
fallar. También que recvWindow se quede dentro del máximo del contrato.

    python3 test/test-motor-oco.py
"""
import os
import sys

# Sin bytecode: un __pycache__ dentro de assets/ acabaría dentro del .kapp del
# siguiente empaquetado, y CI compara el .kapp versionado con el que produce el
# empaquetador. Una prueba no puede cambiar lo que se publica.
sys.dont_write_bytecode = True

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "engine"))

import geminis_core as gc  # noqa: E402

fails = []


def check(label, cond):
    print(("  ok    " if cond else "  FAIL  ") + label)
    if not cond:
        fails.append(label)


def binance_de_prueba(respuestas):
    """Un Binance que no habla con nadie: anota lo que habría mandado."""
    cli = object.__new__(gc.Binance)
    cli.cfg = gc.Config(kimos_base="https://k", instancia="i", token="t")
    cli.base = gc.BASES["testnet"]
    cli.llamadas = []

    def _pedir(metodo, ruta, params=None, firmado=False, peso=1):
        cli.llamadas.append((metodo, ruta, dict(params or {})))
        r = respuestas.pop(0) if respuestas else {"orderListId": 1}
        if isinstance(r, Exception):
            raise r
        return r

    cli._pedir = _pedir
    return cli


ARGS = dict(symbol="BTCUSDT", quantity="0.01", price="70000",
            stopPrice="66000", stopLimitPrice="65900",
            listClientOrderId="OCO-abc")

# ── El endpoint vigente, y cada pata de su lado ──────────────────────────────
cli = binance_de_prueba([])
cli.enviar_oco(side="SELL", **ARGS)
metodo, ruta, p = cli.llamadas[0]
check("usa el endpoint vigente", (metodo, ruta) == ("POST", "/api/v3/orderList/oco"))
check("SELL: el objetivo va arriba como LIMIT_MAKER",
      p["aboveType"] == "LIMIT_MAKER" and p["abovePrice"] == "70000")
check("SELL: el stop va abajo como STOP_LOSS_LIMIT",
      p["belowType"] == "STOP_LOSS_LIMIT" and p["belowStopPrice"] == "66000"
      and p["belowPrice"] == "65900" and p["belowTimeInForce"] == "GTC")
check("lleva el identificador de la lista", p["listClientOrderId"] == "OCO-abc")
check("no se cuela ningún parámetro del endpoint viejo",
      not {"stopLimitPrice", "stopLimitTimeInForce"} & set(p))

cli = binance_de_prueba([])
cli.enviar_oco(side="BUY", **ARGS)
_, _, p = cli.llamadas[0]
check("BUY: el stop va arriba", p["aboveType"] == "STOP_LOSS_LIMIT" and p["aboveStopPrice"] == "66000")
check("BUY: el objetivo va abajo", p["belowType"] == "LIMIT_MAKER" and p["belowPrice"] == "70000")

# ── El reintento: solo ante una queja de ruta o de parámetros ────────────────
cli = binance_de_prueba([gc.ErrorBinance(-1102, "Mandatory parameter was not sent"), {"orderListId": 9}])
res = cli.enviar_oco(side="SELL", **ARGS)
check("si el endpoint vigente no se entiende, reintenta con el anterior",
      len(cli.llamadas) == 2 and cli.llamadas[1][1] == "/api/v3/order/oco")
check("el reintento manda los parámetros del endpoint anterior",
      cli.llamadas[1][2]["stopLimitPrice"] == "65900"
      and cli.llamadas[1][2]["stopPrice"] == "66000"
      and "aboveType" not in cli.llamadas[1][2])
check("devuelve lo que respondió el reintento", res == {"orderListId": 9})

for codigo, motivo in ((-2010, "fondos insuficientes"), (-1013, "filtros del símbolo"), (-1121, "símbolo inválido")):
    cli = binance_de_prueba([gc.ErrorBinance(codigo, motivo), {"orderListId": 2}])
    try:
        cli.enviar_oco(side="SELL", **ARGS)
        ok = False
    except gc.ErrorBinance as err:
        ok = err.codigo == codigo and len(cli.llamadas) == 1
    check(f"un error real ({motivo}) no se reintenta: sube tal cual", ok)

# ── recvWindow dentro del contrato ───────────────────────────────────────────
base = {"KIMOS_BASE": "https://k", "KIMOS_INSTANCE": "i"}
for valor, esperado, label in (("999999", 60000, "por encima del máximo se recorta a 60000"),
                               ("0", 1, "un cero no deja el motor sin ventana"),
                               ("5000", 5000, "un valor normal se respeta")):
    previo = dict(os.environ)
    os.environ.update(base, BINANCE_RECV_WINDOW=valor)
    try:
        cfg = gc.Config.desde_entorno()
    finally:
        os.environ.clear()
        os.environ.update(previo)
    check(f"recvWindow: {label}", cfg.recv_window == esperado)

print()
if fails:
    print(f"{len(fails)} FAIL")
    sys.exit(1)
print("todo ok")
