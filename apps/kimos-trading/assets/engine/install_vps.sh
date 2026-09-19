#!/usr/bin/env bash
#
# Instalador de Geminis Core en un VPS Ubuntu 22.04/24.04.
#
# Lo que hace, y por qué cada paso está aquí:
#
#   · Usuario propio sin shell: si el proceso se compromete, no hay sesión
#     que tomar.
#   · Claves fuera del repositorio y con permisos 600: un `git add .`
#     distraído no puede subirlas.
#   · Cortafuegos que solo deja entrar SSH desde TU IP: Binance exige lista
#     blanca de IP para habilitar trading, y la contraparte de eso es que la
#     IP del VPS sea un sitio difícil de tomar.
#   · systemd con reinicio automático: el motor tiene que volver solo.
#
# NO instala base de datos. TimescaleDB hace falta cuando se ingiere y se
# consulta histórico de velas; el motor de referencia trabaja con lo que pide
# a Binance en cada ciclo. Cuando llegue esa fase, el README dice cómo.
#
# Uso:  sudo bash install_vps.sh TU.IP.FIJA.AQUI
set -euo pipefail

IP_ADMIN="${1:-}"
if [[ -z "$IP_ADMIN" ]]; then
  echo "Uso: sudo bash install_vps.sh <tu-ip-fija>" >&2
  echo "La IP es desde dónde te vas a conectar por SSH. Sin eso, el cortafuegos te deja fuera." >&2
  exit 1
fi

echo "==> Paquetes base"
apt-get update -qq
apt-get install -y -qq python3-venv python3-pip ufw

echo "==> Usuario y carpetas"
id -u geminis &>/dev/null || useradd --system --home /opt/geminis --shell /usr/sbin/nologin geminis
install -d -o geminis -g geminis -m 750 /opt/geminis /opt/geminis/estado
install -d -o root -g geminis -m 750 /etc/geminis

echo "==> Entorno de Python"
python3 -m venv /opt/geminis/venv
/opt/geminis/venv/bin/pip install -q --upgrade pip
/opt/geminis/venv/bin/pip install -q -r "$(dirname "$0")/requirements.txt"
install -o geminis -g geminis -m 750 "$(dirname "$0")/geminis_core.py" /opt/geminis/geminis_core.py

echo "==> Configuración"
if [[ ! -f /etc/geminis/geminis.env ]]; then
  cat > /etc/geminis/geminis.env <<'ENV'
# Pega aquí lo que muestra la pestaña Puente de KIMOS Trading.
KIMOS_BASE=https://tu-kimos
KIMOS_INSTANCE=
KIMOS_TOKEN=

# Empieza SIEMPRE en testnet. Pasar a produccion es una decisión de la hoja de
# ruta (fase 4), no un cambio de variable.
BINANCE_ENV=testnet
BINANCE_API_KEY=
# Ed25519 es lo que Binance exige para habilitar trading con IP fija.
BINANCE_PRIVATE_KEY_PATH=/etc/geminis/ed25519.pem
# HMAC solo para probar en Testnet:
# BINANCE_API_SECRET=
BINANCE_RECV_WINDOW=5000
GEMINIS_CICLO_S=15
ENV
  chown root:geminis /etc/geminis/geminis.env
  chmod 640 /etc/geminis/geminis.env
  echo "    Creado /etc/geminis/geminis.env — EDÍTALO antes de arrancar."
else
  echo "    /etc/geminis/geminis.env ya existe: no se toca."
fi

echo "==> Clave Ed25519 (si no existe)"
if [[ ! -f /etc/geminis/ed25519.pem ]]; then
  openssl genpkey -algorithm ed25519 -out /etc/geminis/ed25519.pem
  openssl pkey -in /etc/geminis/ed25519.pem -pubout -out /etc/geminis/ed25519.pub
  chown root:geminis /etc/geminis/ed25519.pem /etc/geminis/ed25519.pub
  chmod 640 /etc/geminis/ed25519.pem
  chmod 644 /etc/geminis/ed25519.pub
  echo "    Clave generada. Sube /etc/geminis/ed25519.pub a Binance para crear la API key."
  echo "    NO habilites permiso de retiro. Restringe por IP a la de este VPS."
fi

echo "==> Cortafuegos"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow from "$IP_ADMIN" to any port 22 proto tcp
ufw --force enable

echo "==> Servicio"
install -m 644 "$(dirname "$0")/geminis.service" /etc/systemd/system/geminis.service
systemctl daemon-reload
systemctl enable geminis

cat <<FIN

Listo. Lo que falta, en este orden:

  1. Edita /etc/geminis/geminis.env con lo que muestra la pestaña Puente.
  2. Sube /etc/geminis/ed25519.pub a Binance → API Management → clave
     autogenerada Ed25519. Permisos: SOLO lectura y trading spot.
     NUNCA retiro. Restricción de IP: la de este VPS.
  3. systemctl start geminis
  4. journalctl -u geminis -f
  5. En KIMOS, pestaña Puente: comprueba que llegue el latido y que el token
     salga como «verificado».

Y una vez al mes, en Testnet: prueba el botón de pánico. Un botón de pánico
que nadie probó no es un botón de pánico.
FIN
