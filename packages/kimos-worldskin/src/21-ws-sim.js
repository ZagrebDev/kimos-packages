
// ═══════════════════════════════════════════════════════════════════════════
// KIMOS WorldSkin · simulación de avatares
//
// Los avatares se mueven de verdad, pero lo que hacen NO es decorativo: sale
// del estado real del flujo de la app. Un agente que está ejecutándose camina
// a su puesto y trabaja; uno bloqueado se planta con un «!»; uno apagado se
// va a la zona común y se sienta.
//
// La simulación es una FUNCIÓN PURA por paso (`wsSimStep`): el bucle de
// animación vive en la UI y solo llama aquí. Así se puede probar sin
// navegador, y pausarla no deja nada a medias.
// ═══════════════════════════════════════════════════════════════════════════

const WS_SPEED = 1.9;          // celdas por segundo
const WS_TICK_MAX = 0.1;       // s: techo del delta, para que un frame perdido
                               // no teletransporte a nadie por medio mapa
const WS_FOOT_BIAS = 0.78;     // dónde caen los pies dentro de su celda

const WS_MOODS = {
  working: { id: 'working', bubble: '', label: 'trabajando' },
  done: { id: 'done', bubble: '✓', label: 'terminado' },
  blocked: { id: 'blocked', bubble: '!', label: 'bloqueado' },
  off: { id: 'off', bubble: '·', label: 'descansando' },
  idle: { id: 'idle', bubble: '', label: 'disponible' },
  human: { id: 'human', bubble: '', label: 'en su puesto' },
};

/** Centro de un área en coordenadas de celda. */
const wsAreaCenter = (a) => ({ x: wsNum(a.x, 0) + wsNum(a.w, 1) / 2, y: wsNum(a.y, 0) + wsNum(a.h, 1) / 2 });

/**
 * Posición de un puesto dentro de su área, repartida en rejilla.
 *
 * `slot` es el número de orden de quien ocupa ese puesto: sin él, dos personas
 * en el mismo puesto se dibujarían exactamente en el mismo píxel y solo se
 * vería a una. Se reparten en corrillo alrededor del puesto.
 */
function wsStationPos(area, stationId, slot) {
  const list = wsArr(area.stations);
  const i = Math.max(0, list.findIndex((s) => s.id === wsS(stationId)));
  const cols = Math.max(1, Math.min(list.length, Math.round(wsNum(area.w, 2))));
  const cx = i % cols;
  const cy = Math.floor(i / cols);
  const rows = Math.max(1, Math.ceil(list.length / cols));
  const aw = wsNum(area.w, 2); const ah = wsNum(area.h, 2);
  // Los pies van en la parte baja de la celda: el avatar se dibuja HACIA
  // ARRIBA desde este punto, y centrado se le saldría la cabeza por el tejado.
  const base = {
    x: wsNum(area.x, 0) + (cx + 0.5) * (aw / cols),
    y: wsNum(area.y, 0) + (cy + WS_FOOT_BIAS) * (ah / rows),
  };
  const k = Math.max(0, wsNum(slot, 0));
  if (k) {
    // Corrillo: radio creciente cada seis, para que un puesto muy poblado no
    // acabe con todo el mundo encima de la pared.
    const ring = Math.floor((k - 1) / 6) + 1;
    const ang = (((k - 1) % 6) / 6) * Math.PI * 2;
    const r = Math.min(0.4 * ring, Math.min(aw, ah) / 2 - 0.12);
    base.x += Math.cos(ang) * r;
    base.y += Math.sin(ang) * r * 0.55;
  }
  return {
    x: wsClamp(base.x, wsNum(area.x, 0) + 0.18, wsNum(area.x, 0) + aw - 0.18),
    y: wsClamp(base.y, wsNum(area.y, 0) + WS_FOOT_BIAS, wsNum(area.y, 0) + ah - 0.08),
  };
}

/**
 * Crea el estado inicial de los avatares. Se vuelve a llamar cuando cambia el
 * mundo: conserva la posición de quien siga existiendo, para que editar un
 * área no haga saltar a todo el personal.
 */
function wsSimInit(world, prev) {
  const before = new Map(wsArr(wsObj(prev).actors).map((a) => [a.id, a]));
  const areas = wsArr(wsObj(world).areas);
  const taken = {};                    // cuántos comparten ya cada puesto
  const actors = wsArr(wsObj(world).staff).map((p) => {
    const area = areas.find((a) => a.id === p.areaId) || areas[0] || null;
    const key = (area ? area.id : '-') + '|' + wsS(p.stationId);
    const slot = taken[key] || 0;
    taken[key] = slot + 1;
    const home = area ? wsStationPos(area, p.stationId, slot) : { x: 1, y: 1 };
    const old = before.get(p.id);
    const seed = wsHash(p.id + p.name);
    return {
      id: p.id, name: p.name, kind: p.kind, role: p.role,
      agentId: p.agentId || null, userId: p.userId || null, isOwner: !!p.isOwner,
      areaId: area ? area.id : '',
      x: old ? old.x : home.x, y: old ? old.y : home.y,
      tx: home.x, ty: home.y,          // destino
      homeX: home.x, homeY: home.y,
      face: old ? old.face : 1,        // 1 derecha, -1 izquierda
      phase: (seed % 1000) / 1000,     // desfase de animación, para que no vayan a la vez
      hue: seed % 360,
      mood: 'idle', wait: (seed % 700) / 1000,
      bubble: '', bubbleT: 0,
    };
  });
  return { actors, t: 0, paused: false };
}

/**
 * Un paso de simulación. `dt` en segundos; `statusOf(agentId)` devuelve el
 * estado del agente en el flujo de la app anfitriona.
 * Devuelve un estado NUEVO (no muta el recibido).
 */
function wsSimStep(sim, world, dt, statusOf) {
  const s0 = wsObj(sim);
  const step = Math.min(WS_TICK_MAX, Math.max(0, wsNum(dt, 0)));
  const areas = wsArr(wsObj(world).areas);
  const plaza = areas.find((a) => a.structure === 'plaza') || null;
  const t = wsNum(s0.t, 0) + step;

  const actors = wsArr(s0.actors).map((a0) => {
    const a = Object.assign({}, a0);
    const st = a.kind === 'ai' && typeof statusOf === 'function' ? wsS(statusOf(a.agentId)) : '';
    // El humor sale del flujo real; si la app no dice nada, la persona
    // simplemente está en su puesto.
    a.mood = a.kind !== 'ai' ? 'human'
      : st === 'done' ? 'done' : st === 'error' || st === 'blocked' ? 'blocked'
        : st === 'off' || st === 'skipped' ? 'off' : st === 'running' ? 'working' : 'idle';

    // A dónde va: apagado → zona común; el resto → su puesto, con pequeños
    // paseos para que la escena esté viva sin ser un caos.
    let goX = a.homeX; let goY = a.homeY;
    if (a.mood === 'off' && plaza) { const c = wsAreaCenter(plaza); goX = c.x; goY = c.y; }
    a.wait = wsNum(a.wait, 0) - step;
    if (a.wait <= 0) {
      a.wait = 2.5 + ((wsHash(a.id + Math.floor(t / 3)) % 400) / 100);
      const wob = ((wsHash(a.id + Math.floor(t / 3) + 'w') % 100) / 100 - 0.5) * 0.9;
      const wob2 = ((wsHash(a.id + Math.floor(t / 3) + 'h') % 100) / 100 - 0.5) * 0.9;
      a.tx = goX + (a.mood === 'working' ? wob * 0.35 : wob);
      a.ty = goY + (a.mood === 'working' ? wob2 * 0.35 : wob2);
    } else if (a.mood === 'off' && plaza) { a.tx = goX; a.ty = goY; }

    const dx = a.tx - a.x; const dy = a.ty - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = WS_SPEED * (a.mood === 'working' ? 1.25 : a.mood === 'off' ? 0.6 : 1);
    if (dist > 0.02) {
      const mv = Math.min(dist, speed * step);
      a.x += (dx / dist) * mv;
      a.y += (dy / dist) * mv;
      if (Math.abs(dx) > 0.02) a.face = dx > 0 ? 1 : -1;
      a.moving = true;
    } else { a.moving = false; }

    const mood = WS_MOODS[a.mood] || WS_MOODS.idle;
    a.bubble = mood.bubble;
    return a;
  });

  return { actors, t, paused: !!s0.paused };
}

/** Un actor «habla»: burbuja temporal. Útil al seleccionarlo o al ejecutarlo. */
function wsSimSay(sim, actorId, text, seconds) {
  const s0 = wsObj(sim);
  return {
    t: wsNum(s0.t, 0), paused: !!s0.paused,
    actors: wsArr(s0.actors).map((a) => (a.id === wsS(actorId)
      ? Object.assign({}, a, { bubble: wsS(text).slice(0, 40), bubbleT: wsNum(seconds, 3) })
      : a)),
  };
}

/** Paleta del avatar, derivada de su id: siempre el mismo aspecto. */
function wsAvatarColors(actor) {
  const a = wsObj(actor);
  const hue = wsNum(a.hue, 200);
  if (a.kind === 'ai') {
    return { body: 'hsl(' + ((hue % 60) + 170) + ' 55% 52%)', head: '#E9F6F7',
      trim: 'hsl(' + ((hue % 60) + 170) + ' 70% 72%)' };
  }
  return { body: 'hsl(' + hue + ' 42% 48%)', head: 'hsl(' + ((hue * 7) % 40 + 20) + ' 45% 74%)',
    trim: 'hsl(' + hue + ' 42% 66%)' };
}
