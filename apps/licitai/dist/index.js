// src/react-shim.ts
var R = globalThis.React;
if (!R) {
  throw new Error("KIMOS: globalThis.React no est\xE1 disponible en el host.");
}
var react_shim_default = R;
var useState = R.useState;
var useEffect = R.useEffect;
var useMemo = R.useMemo;
var useCallback = R.useCallback;
var useRef = R.useRef;
var Fragment = R.Fragment;
var createElement = R.createElement;

// src/api.ts
var DEFAULT_API = "https://licitai-api-334947263282.southamerica-west1.run.app/api/v1";
var ApiError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function makeApi(base, tokens) {
  const root = base.replace(/\/+$/, "");
  let current = tokens;
  const authHeaders = () => current ? { Authorization: `Bearer ${current.access}` } : {};
  async function req(path, init) {
    const r = await fetch(`${root}${path}`, {
      ...init,
      headers: { ...init?.headers || {}, ...authHeaders() }
    });
    if (r.status === 401) throw new ApiError(401, "Sesi\xF3n expirada.");
    if (!r.ok) {
      let msg = `Error ${r.status}.`;
      if (r.status === 402)
        msg = "Disponible en el plan con Automatizaciones (Enterprise).";
      else if (r.status === 403) msg = "No tienes permiso para esta acci\xF3n.";
      try {
        const b = await r.json();
        if (typeof b.detail === "string") msg = b.detail;
      } catch {
      }
      throw new ApiError(r.status, msg);
    }
    return await r.json();
  }
  const jsonPost = (body) => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return {
    root,
    get tokens() {
      return current;
    },
    async login(email, password) {
      const body = new URLSearchParams({ username: email, password });
      const r = await fetch(`${root}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
      if (!r.ok) throw new ApiError(r.status, "Email o contrase\xF1a incorrectos.");
      const d = await r.json();
      current = { access: d.access_token, refresh: d.refresh_token };
      return current;
    },
    // Puente de identidad v1: renueva la sesión sin pedir clave. Devuelve los
    // tokens nuevos (para re-persistirlos) o null si el refresh ya no vale.
    async refresh(refreshToken) {
      try {
        const r = await fetch(`${root}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        if (!r.ok) return null;
        const d = await r.json();
        current = { access: d.access_token, refresh: d.refresh_token };
        return current;
      } catch {
        return null;
      }
    },
    async search(q) {
      const qs = new URLSearchParams({ limit: "20" });
      if (q.trim()) qs.set("q", q.trim());
      return req(`/licitaciones?${qs}`);
    },
    async detalle(codigo) {
      return req(`/licitaciones/${encodeURIComponent(codigo)}`);
    },
    async matches() {
      return req(`/matches`);
    },
    async chat(messages) {
      return req(`/agent/chat`, jsonPost({ messages }));
    },
    async applications() {
      return req(`/applications`);
    },
    async prepare(codigo) {
      return req(`/applications/prepare`, jsonPost({ codigo }));
    },
    async approveApplication(id) {
      return req(`/applications/${id}/approve`, jsonPost({}));
    },
    async rejectApplication(id, notas) {
      return req(`/applications/${id}/reject`, jsonPost({ notas }));
    },
    // Bases/anexos atados a una licitación: se indexan en el motor (escaneo de
    // seguridad + extracción) y el agente de postulación de esa licitación los usa.
    async basesFor(codigo) {
      return req(`/knowledge/licitacion/${encodeURIComponent(codigo)}`);
    },
    async uploadBases(file, codigo) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("codigo", codigo);
      const r = await fetch(`${root}/knowledge/upload`, {
        method: "POST",
        headers: authHeaders(),
        // sin Content-Type: el navegador fija el boundary
        body: fd
      });
      if (r.status === 401) throw new ApiError(401, "Sesi\xF3n expirada.");
      if (!r.ok) {
        let msg = `Error ${r.status}.`;
        try {
          const b = await r.json();
          if (typeof b.detail === "string") msg = b.detail;
          else if (b.detail?.message) {
            const f = Array.isArray(b.detail.findings) ? " " + b.detail.findings.join(" \xB7 ") : "";
            msg = b.detail.message + f;
          }
        } catch {
        }
        throw new ApiError(r.status, msg);
      }
      return await r.json();
    }
  };
}

// src/App.tsx
var TABS = [
  { id: "buscar", label: "Buscar" },
  { id: "matches", label: "Matches" },
  { id: "postulaciones", label: "Postulaciones" },
  { id: "chat", label: "Chat IA" }
];
function App(props) {
  const { shell, api, tokens, onTokens, brandName, version } = props;
  const [view, setView] = react_shim_default.useState({ tab: "buscar", codigo: null });
  const onExpired = react_shim_default.useCallback(() => {
    onTokens(null);
    shell.notify({ level: "warn", text: "Tu sesi\xF3n expir\xF3, ingresa de nuevo." });
  }, [onTokens, shell]);
  return /* @__PURE__ */ react_shim_default.createElement("div", { className: "kimos-licitai" }, /* @__PURE__ */ react_shim_default.createElement("header", { className: "kl-header" }, /* @__PURE__ */ react_shim_default.createElement("span", { className: "kl-logo", "aria-hidden": true }, "\u{1F4D1}"), /* @__PURE__ */ react_shim_default.createElement("h1", { className: "kl-title" }, "LicitAI"), brandName ? /* @__PURE__ */ react_shim_default.createElement("span", { className: "kl-brand" }, "\xB7 ", brandName) : null, /* @__PURE__ */ react_shim_default.createElement("span", { className: "kl-ver" }, "v", version), /* @__PURE__ */ react_shim_default.createElement("span", { className: "kl-spacer" }), tokens ? /* @__PURE__ */ react_shim_default.createElement(react_shim_default.Fragment, null, /* @__PURE__ */ react_shim_default.createElement("nav", { className: "kl-nav" }, TABS.map((t) => /* @__PURE__ */ react_shim_default.createElement(
    "button",
    {
      key: t.id,
      className: "kl-tab" + (view.tab === t.id && !view.codigo ? " kl-on" : ""),
      onClick: () => setView({ tab: t.id, codigo: null })
    },
    t.label
  ))), /* @__PURE__ */ react_shim_default.createElement("button", { className: "kl-btn kl-ghost", onClick: () => onTokens(null) }, "Salir")) : null), /* @__PURE__ */ react_shim_default.createElement("main", { className: "kl-main" }, !tokens ? /* @__PURE__ */ react_shim_default.createElement(Login, { api, shell, onTokens }) : view.codigo ? /* @__PURE__ */ react_shim_default.createElement(
    Detalle,
    {
      api,
      shell,
      codigo: view.codigo,
      onExpired,
      onBack: () => setView({ ...view, codigo: null }),
      onPrepared: () => setView({ tab: "postulaciones", codigo: null })
    }
  ) : view.tab === "buscar" ? /* @__PURE__ */ react_shim_default.createElement(Buscar, { api, onExpired, onOpen: (c) => setView({ tab: "buscar", codigo: c }) }) : view.tab === "matches" ? /* @__PURE__ */ react_shim_default.createElement(Matches, { api, onExpired, onOpen: (c) => setView({ tab: "matches", codigo: c }) }) : view.tab === "postulaciones" ? /* @__PURE__ */ react_shim_default.createElement(Postulaciones, { api, shell, onExpired }) : /* @__PURE__ */ react_shim_default.createElement(Chat, { api, onExpired })));
}
function fmtFecha(f, conHora = false) {
  if (!f) return "\u2014";
  const d = new Date(f);
  return conHora ? d.toLocaleString("es-CL") : d.toLocaleDateString("es-CL");
}
function fmtMonto(n) {
  if (n == null) return "No informado";
  return "$" + Math.round(n).toLocaleString("es-CL");
}
function semaforo(fechaCierre) {
  if (!fechaCierre) return { label: "Sin fecha de cierre", cls: "kl-sem-none" };
  const d = Math.ceil((new Date(fechaCierre).getTime() - Date.now()) / 864e5);
  if (d < 0) return { label: "Recepci\xF3n cerrada", cls: "kl-sem-none" };
  if (d <= 2) return { label: d === 0 ? "Cierra hoy" : `Cierra en ${d} d\xEDa(s) \xB7 urgente`, cls: "kl-sem-red" };
  if (d <= 7) return { label: `Cierra pronto \xB7 ${d} d\xEDas`, cls: "kl-sem-amber" };
  return { label: `Abierta \xB7 ${d} d\xEDas`, cls: "kl-sem-green" };
}
function handleErr(err, onExpired, set) {
  if (err instanceof ApiError && err.status === 401) return onExpired();
  set(err instanceof Error ? err.message : "Error inesperado.");
}
async function linkRecords(shell, d) {
  if (!shell.records || !d) return;
  try {
    const opp = await shell.records.findOrCreate("opportunity", {
      keys: { code: d.codigo_externo },
      label: d.nombre
    });
    await shell.records.link(opp.ref, { instanceId: shell.app.instanceId, kind: "licitacion" });
    if (d.organismo) {
      const acc = await shell.records.findOrCreate("account", {
        keys: { name: d.organismo },
        label: d.organismo
      });
      await shell.records.link(acc.ref, { instanceId: shell.app.instanceId, kind: "organismo" });
    }
  } catch {
  }
}
function Login(props) {
  const { api, shell, onTokens } = props;
  const [email, setEmail] = react_shim_default.useState("");
  const [password, setPassword] = react_shim_default.useState("");
  const [busy, setBusy] = react_shim_default.useState(false);
  const [error, setError] = react_shim_default.useState(null);
  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onTokens(await api.login(email, password));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo conectar al motor LicitAI.";
      setError(msg);
      shell.notify({ level: "error", text: msg });
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ react_shim_default.createElement("form", { className: "kl-card kl-login", onSubmit: submit }, /* @__PURE__ */ react_shim_default.createElement("h2", { className: "kl-h2" }, "Ingresar"), /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-muted" }, "Con\xE9ctate al motor LicitAI con tu cuenta de la plataforma."), error ? /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-error" }, error) : null, /* @__PURE__ */ react_shim_default.createElement(
    "input",
    {
      className: "kl-input",
      type: "email",
      placeholder: "Email",
      value: email,
      onChange: (e) => setEmail(e.target.value),
      required: true
    }
  ), /* @__PURE__ */ react_shim_default.createElement(
    "input",
    {
      className: "kl-input",
      type: "password",
      placeholder: "Contrase\xF1a",
      value: password,
      onChange: (e) => setPassword(e.target.value),
      required: true
    }
  ), /* @__PURE__ */ react_shim_default.createElement("button", { className: "kl-btn kl-primary", type: "submit", disabled: busy }, busy ? "Ingresando\u2026" : "Ingresar"));
}
function ItemRow(props) {
  const { it, onOpen, extra } = props;
  const sem = semaforo(it.fecha_cierre);
  return /* @__PURE__ */ react_shim_default.createElement("li", { className: "kl-item", onClick: () => onOpen(it.codigo_externo) }, /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-item-name" }, it.nombre), /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-item-meta" }, /* @__PURE__ */ react_shim_default.createElement("span", { className: "kl-code" }, it.codigo_externo), it.organismo ? /* @__PURE__ */ react_shim_default.createElement("span", null, " \xB7 ", it.organismo) : null, extra ? /* @__PURE__ */ react_shim_default.createElement("span", null, " \xB7 ", extra) : null), /* @__PURE__ */ react_shim_default.createElement("span", { className: "kl-chip " + sem.cls }, sem.label));
}
function Buscar(props) {
  const { api, onExpired, onOpen } = props;
  const [q, setQ] = react_shim_default.useState("");
  const [items, setItems] = react_shim_default.useState([]);
  const [total, setTotal] = react_shim_default.useState(null);
  const [busy, setBusy] = react_shim_default.useState(false);
  const [error, setError] = react_shim_default.useState(null);
  async function run(e) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const page = await api.search(q);
      setItems(page.items);
      setTotal(page.total);
    } catch (err) {
      handleErr(err, onExpired, setError);
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ react_shim_default.createElement("div", null, /* @__PURE__ */ react_shim_default.createElement("form", { className: "kl-searchbar", onSubmit: run }, /* @__PURE__ */ react_shim_default.createElement(
    "input",
    {
      className: "kl-input",
      type: "search",
      placeholder: "Buscar licitaciones (ej: conservaci\xF3n vial, t\xF3tem, salud\u2026)",
      value: q,
      onChange: (e) => setQ(e.target.value)
    }
  ), /* @__PURE__ */ react_shim_default.createElement("button", { className: "kl-btn kl-primary", type: "submit", disabled: busy }, busy ? "Buscando\u2026" : "Buscar")), error ? /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-error" }, error) : null, total != null ? /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-muted" }, total, " resultado(s) en el cat\xE1logo.") : null, /* @__PURE__ */ react_shim_default.createElement("ul", { className: "kl-list" }, items.map((it) => /* @__PURE__ */ react_shim_default.createElement(ItemRow, { key: it.codigo_externo, it, onOpen }))));
}
function Matches(props) {
  const { api, onExpired, onOpen } = props;
  const [rows, setRows] = react_shim_default.useState(null);
  const [error, setError] = react_shim_default.useState(null);
  react_shim_default.useEffect(() => {
    api.matches().then(setRows).catch((err) => handleErr(err, onExpired, setError));
  }, [api, onExpired]);
  if (error) return /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-error" }, error);
  if (rows == null) return /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-muted" }, "Cargando matches\u2026");
  if (rows.length === 0)
    return /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-muted" }, "A\xFAn no hay matches. Configura keywords en tu conexi\xF3n de fuente.");
  return /* @__PURE__ */ react_shim_default.createElement("ul", { className: "kl-list" }, rows.map((m) => /* @__PURE__ */ react_shim_default.createElement(
    ItemRow,
    {
      key: m.id,
      it: m.licitacion,
      onOpen,
      extra: `relevancia ${m.score}${m.matched_keywords ? " \xB7 " + m.matched_keywords : ""}`
    }
  )));
}
function Dato(props) {
  if (props.children == null || props.children === "" || props.children === "\u2014") return null;
  return /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-dato" }, /* @__PURE__ */ react_shim_default.createElement("dt", null, props.label), /* @__PURE__ */ react_shim_default.createElement("dd", null, props.children));
}
function Detalle(props) {
  const { api, shell, codigo, onExpired, onBack, onPrepared } = props;
  const [d, setD] = react_shim_default.useState(null);
  const [error, setError] = react_shim_default.useState(null);
  const [preparing, setPreparing] = react_shim_default.useState(false);
  react_shim_default.useEffect(() => {
    setD(null);
    setError(null);
    api.detalle(codigo).then(setD).catch((err) => handleErr(err, onExpired, setError));
  }, [api, codigo, onExpired]);
  async function prepare() {
    setPreparing(true);
    try {
      await api.prepare(codigo);
      await linkRecords(shell, d);
      shell.notify({ level: "success", text: "Borrador de postulaci\xF3n creado para revisi\xF3n." });
      onPrepared();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onExpired();
      shell.notify({
        level: "error",
        text: err instanceof Error ? err.message : "No se pudo preparar la postulaci\xF3n."
      });
    } finally {
      setPreparing(false);
    }
  }
  return /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-detalle" }, /* @__PURE__ */ react_shim_default.createElement("button", { className: "kl-btn kl-ghost kl-back", onClick: onBack }, "\u2190 Volver"), error ? /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-error" }, error) : null, !d && !error ? /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-muted" }, "Cargando ficha\u2026") : null, d ? /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-card" }, /* @__PURE__ */ react_shim_default.createElement("h2", { className: "kl-h2" }, d.nombre), /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-muted" }, d.organismo ?? "\u2014", " \xB7 ", /* @__PURE__ */ react_shim_default.createElement("span", { className: "kl-code" }, d.codigo_externo)), /* @__PURE__ */ react_shim_default.createElement("span", { className: "kl-chip " + semaforo(d.fecha_cierre).cls }, semaforo(d.fecha_cierre).label), /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-actions" }, /* @__PURE__ */ react_shim_default.createElement("button", { className: "kl-btn kl-primary", onClick: prepare, disabled: preparing }, preparing ? "Preparando\u2026" : "\u{1F916} Preparar postulaci\xF3n con IA")), /* @__PURE__ */ react_shim_default.createElement("dl", { className: "kl-grid" }, /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Tipo" }, d.tipo_nombre || d.tipo || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Convocatoria" }, d.tipo_convocatoria || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Estado" }, d.estado || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Presupuesto" }, fmtMonto(d.monto_estimado), d.moneda ? " " + d.moneda : ""), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Financiamiento" }, d.financiamiento || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Tipo de pago" }, d.tipo_pago || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Duraci\xF3n del contrato" }, d.duracion_contrato || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Direcci\xF3n de entrega" }, d.direccion_entrega || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Etapas de apertura" }, d.etapas || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Subcontrataci\xF3n" }, d.subcontratacion || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Toma de raz\xF3n" }, d.toma_razon || "\u2014")), d.comprador ? /* @__PURE__ */ react_shim_default.createElement("section", { className: "kl-sec" }, /* @__PURE__ */ react_shim_default.createElement("h3", { className: "kl-h3" }, "\u{1F3DB}\uFE0F Organismo demandante"), /* @__PURE__ */ react_shim_default.createElement("dl", { className: "kl-grid" }, /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Organismo" }, d.comprador.organismo || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Unidad" }, d.comprador.unidad || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Direcci\xF3n" }, d.comprador.direccion || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Comuna / Regi\xF3n" }, [d.comprador.comuna, d.comprador.region].filter(Boolean).join(" \xB7 ") || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Contacto" }, d.comprador.contacto ? d.comprador.contacto + (d.comprador.cargo ? ` (${d.comprador.cargo})` : "") : "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Tel\xE9fono" }, d.comprador.telefono || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Correo" }, d.comprador.correo || "\u2014"))) : null, d.cronograma.length > 0 ? /* @__PURE__ */ react_shim_default.createElement("section", { className: "kl-sec" }, /* @__PURE__ */ react_shim_default.createElement("h3", { className: "kl-h3" }, "\u{1F4C5} Cronograma"), /* @__PURE__ */ react_shim_default.createElement("ul", { className: "kl-crono" }, d.cronograma.map((h) => /* @__PURE__ */ react_shim_default.createElement("li", { key: h.etiqueta }, /* @__PURE__ */ react_shim_default.createElement("span", null, h.etiqueta), /* @__PURE__ */ react_shim_default.createElement("span", { className: "kl-muted" }, fmtFecha(h.fecha, true)))))) : null, d.items.length > 0 ? /* @__PURE__ */ react_shim_default.createElement("section", { className: "kl-sec" }, /* @__PURE__ */ react_shim_default.createElement("h3", { className: "kl-h3" }, "\u{1F4E6} Productos y especificaciones t\xE9cnicas"), /* @__PURE__ */ react_shim_default.createElement("ul", { className: "kl-items" }, d.items.map((it, i) => /* @__PURE__ */ react_shim_default.createElement("li", { key: i }, /* @__PURE__ */ react_shim_default.createElement("strong", null, it.nombre || "\u2014"), it.cantidad != null ? ` \xB7 ${it.cantidad} ${it.unidad || ""}` : "", it.descripcion ? /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-muted" }, it.descripcion) : null)))) : null, d.garantias || d.garantia_fiel_cumplimiento ? /* @__PURE__ */ react_shim_default.createElement("section", { className: "kl-sec" }, /* @__PURE__ */ react_shim_default.createElement("h3", { className: "kl-h3" }, "\u{1F512} Garant\xEDas"), /* @__PURE__ */ react_shim_default.createElement("dl", { className: "kl-grid" }, /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Seriedad de la oferta" }, d.garantias || "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Fiel cumplimiento" }, d.garantia_fiel_cumplimiento || "\u2014"))) : null, d.adjudicacion ? /* @__PURE__ */ react_shim_default.createElement("section", { className: "kl-sec" }, /* @__PURE__ */ react_shim_default.createElement("h3", { className: "kl-h3" }, "\u{1F3C6} Adjudicaci\xF3n"), /* @__PURE__ */ react_shim_default.createElement("dl", { className: "kl-grid" }, /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Fecha" }, fmtFecha(d.adjudicacion.fecha)), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "N\xB0 de oferentes" }, d.adjudicacion.numero_oferentes ?? "\u2014"), /* @__PURE__ */ react_shim_default.createElement(Dato, { label: "Acta" }, d.adjudicacion.url_acta ? /* @__PURE__ */ react_shim_default.createElement("a", { href: d.adjudicacion.url_acta, target: "_blank", rel: "noopener noreferrer" }, "Ver acta \u2197") : "\u2014"))) : null, d.descripcion ? /* @__PURE__ */ react_shim_default.createElement("section", { className: "kl-sec" }, /* @__PURE__ */ react_shim_default.createElement("h3", { className: "kl-h3" }, "\u{1F4CB} Objeto y bases"), /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-desc" }, d.descripcion), d.justificacion_monto ? /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-muted" }, "Justificaci\xF3n del monto: ", d.justificacion_monto) : null) : null, /* @__PURE__ */ react_shim_default.createElement(Bases, { api, shell, codigo, onExpired })) : null);
}
function Bases(props) {
  const { api, shell, codigo, onExpired } = props;
  const [docs, setDocs] = react_shim_default.useState(null);
  const [busy, setBusy] = react_shim_default.useState(false);
  const [msg, setMsg] = react_shim_default.useState(null);
  const load = react_shim_default.useCallback(() => {
    api.basesFor(codigo).then(setDocs).catch((err) => {
      if (err instanceof ApiError && err.status === 401) onExpired();
      else setDocs([]);
    });
  }, [api, codigo, onExpired]);
  react_shim_default.useEffect(load, [load]);
  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.uploadBases(file, codigo);
      if (shell.files) {
        try {
          await shell.files.upload(file, { folder: `bases/${codigo}`, maxMB: 15 });
        } catch {
        }
      }
      setMsg({ ok: true, text: `"${r.title}" adjuntada (${r.chars} caracteres indexados).` });
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onExpired();
      setMsg({ ok: false, text: err instanceof Error ? err.message : "No se pudo subir." });
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ react_shim_default.createElement("section", { className: "kl-sec" }, /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-bases-head" }, /* @__PURE__ */ react_shim_default.createElement("h3", { className: "kl-h3" }, "\u{1F4CE} Bases y documentos"), /* @__PURE__ */ react_shim_default.createElement("label", { className: "kl-btn kl-primary kl-upload" + (busy ? " kl-dis" : "") }, busy ? "Analizando\u2026" : "Adjuntar bases", /* @__PURE__ */ react_shim_default.createElement("input", { type: "file", hidden: true, disabled: busy, onChange: onFile }))), /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-muted" }, "Se escanean por seguridad y el agente de postulaci\xF3n las usa (requisitos, especificaciones, multas)."), msg ? /* @__PURE__ */ react_shim_default.createElement("p", { className: msg.ok ? "kl-muted" : "kl-error" }, (msg.ok ? "\u2705 " : "\u{1F6E1}\uFE0F ") + msg.text) : null, docs && docs.length > 0 ? /* @__PURE__ */ react_shim_default.createElement("ul", { className: "kl-items" }, docs.map((x) => /* @__PURE__ */ react_shim_default.createElement("li", { key: x.id }, "\u{1F4C4} ", x.title.replace(`Bases ${codigo} \xB7 `, "")))) : docs ? /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-muted" }, "A\xFAn no hay documentos adjuntos.") : null);
}
var SECCIONES = [
  { key: "resumen", label: "Resumen de la oportunidad" },
  { key: "analisis_requisitos", label: "An\xE1lisis de requisitos" },
  { key: "propuesta_tecnica", label: "Propuesta t\xE9cnica" },
  { key: "propuesta_economica", label: "Propuesta econ\xF3mica" },
  { key: "documentos_requeridos", label: "Documentos requeridos" },
  { key: "observaciones", label: "Observaciones" }
];
function Postulaciones(props) {
  const { api, shell, onExpired } = props;
  const [rows, setRows] = react_shim_default.useState(null);
  const [error, setError] = react_shim_default.useState(null);
  const [busy, setBusy] = react_shim_default.useState(null);
  const load = react_shim_default.useCallback(() => {
    setRows(null);
    setError(null);
    api.applications().then(setRows).catch((err) => handleErr(err, onExpired, setError));
  }, [api, onExpired]);
  react_shim_default.useEffect(load, [load]);
  async function decide(app, approve) {
    setBusy(app.id);
    try {
      if (approve) await api.approveApplication(app.id);
      else await api.rejectApplication(app.id, (typeof prompt === "function" ? prompt("Motivo del rechazo (opcional):") : "") || null);
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onExpired();
      shell.notify({ level: "error", text: err instanceof Error ? err.message : "Error." });
    } finally {
      setBusy(null);
    }
  }
  if (error) return /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-error" }, error);
  if (rows == null) return /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-muted" }, "Cargando postulaciones\u2026");
  if (rows.length === 0)
    return /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-muted" }, 'A\xFAn no hay postulaciones. Abre una licitaci\xF3n y usa "\u{1F916} Preparar postulaci\xF3n con IA".');
  return /* @__PURE__ */ react_shim_default.createElement("div", null, rows.map((a) => /* @__PURE__ */ react_shim_default.createElement(PostCard, { key: a.id, app: a, busy: busy === a.id, onDecide: decide })));
}
function PostCard(props) {
  const { app, busy, onDecide } = props;
  const [open, setOpen] = react_shim_default.useState(app.estado === "EN_REVISION");
  const cls = app.estado === "APROBADA" ? "kl-sem-green" : app.estado === "RECHAZADA" ? "kl-sem-red" : "kl-sem-amber";
  return /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-card kl-post" }, /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-post-head", onClick: () => setOpen(!open) }, /* @__PURE__ */ react_shim_default.createElement("div", null, /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-item-name" }, app.titulo), /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-item-meta" }, /* @__PURE__ */ react_shim_default.createElement("span", { className: "kl-code" }, app.codigo_externo))), /* @__PURE__ */ react_shim_default.createElement("span", { className: "kl-chip " + cls }, app.estado.replace("_", " "))), open ? /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-post-body" }, !app.grounded ? /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-muted" }, "\u26A0 Borrador sin respaldo documental: agrega capacidades/experiencia o adjunta las bases.") : null, SECCIONES.map((s) => {
    const v = app.draft[s.key];
    if (v == null || v === "") return null;
    return /* @__PURE__ */ react_shim_default.createElement("div", { key: s.key, className: "kl-post-sec" }, /* @__PURE__ */ react_shim_default.createElement("h4", null, s.label), Array.isArray(v) ? /* @__PURE__ */ react_shim_default.createElement("ul", null, v.map((x, i) => /* @__PURE__ */ react_shim_default.createElement("li", { key: i }, String(x)))) : /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-desc" }, String(v)));
  }), app.notas_revision ? /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-post-sec" }, /* @__PURE__ */ react_shim_default.createElement("h4", null, "Motivo del rechazo"), /* @__PURE__ */ react_shim_default.createElement("p", null, app.notas_revision)) : null, app.estado === "EN_REVISION" ? /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-actions" }, /* @__PURE__ */ react_shim_default.createElement("button", { className: "kl-btn kl-primary", disabled: busy, onClick: () => onDecide(app, true) }, "Aprobar"), /* @__PURE__ */ react_shim_default.createElement("button", { className: "kl-btn kl-ghost", disabled: busy, onClick: () => onDecide(app, false) }, "Rechazar")) : null) : null);
}
function Chat(props) {
  const { api, onExpired } = props;
  const [messages, setMessages] = react_shim_default.useState([]);
  const [input, setInput] = react_shim_default.useState("");
  const [busy, setBusy] = react_shim_default.useState(false);
  const [sources, setSources] = react_shim_default.useState([]);
  const [error, setError] = react_shim_default.useState(null);
  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    setSources([]);
    try {
      const res = await api.chat(next);
      setMessages([...next, { role: "assistant", content: res.answer }]);
      setSources(res.sources);
    } catch (err) {
      handleErr(err, onExpired, setError);
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-chat" }, /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-muted" }, "Pregunta al agente IA. Responde solo con base en el conocimiento cargado (documentos y bases)."), /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-chat-log" }, messages.map((m, i) => /* @__PURE__ */ react_shim_default.createElement("div", { key: i, className: "kl-msg " + (m.role === "user" ? "kl-msg-user" : "kl-msg-bot") }, m.content)), busy ? /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-msg kl-msg-bot kl-muted" }, "Pensando\u2026") : null), sources.length > 0 ? /* @__PURE__ */ react_shim_default.createElement("div", { className: "kl-sources" }, /* @__PURE__ */ react_shim_default.createElement("span", { className: "kl-muted" }, "Fuentes:"), sources.map((s, i) => /* @__PURE__ */ react_shim_default.createElement("span", { key: i, className: "kl-chip", title: s.ref }, s.title))) : null, error ? /* @__PURE__ */ react_shim_default.createElement("p", { className: "kl-error" }, error) : null, /* @__PURE__ */ react_shim_default.createElement("form", { className: "kl-searchbar", onSubmit: send }, /* @__PURE__ */ react_shim_default.createElement(
    "input",
    {
      className: "kl-input",
      placeholder: "Escribe tu pregunta\u2026",
      value: input,
      onChange: (e) => setInput(e.target.value)
    }
  ), /* @__PURE__ */ react_shim_default.createElement("button", { className: "kl-btn kl-primary", type: "submit", disabled: busy }, "Enviar")));
}

// src/mount.tsx
var APP_VERSION = "0.4.0";
function mount(shell) {
  let saved = {};
  const ready = Promise.resolve(shell.loadData()).then((d) => {
    saved = d || {};
  });
  shell.window?.setTitle?.("LicitAI");
  function Component() {
    const [booted, setBooted] = react_shim_default.useState(false);
    const [apiUrl, setApiUrl] = react_shim_default.useState(DEFAULT_API);
    const [tokens, setTokens] = react_shim_default.useState(null);
    const [brandName, setBrandName] = react_shim_default.useState(null);
    react_shim_default.useEffect(() => {
      let alive = true;
      const cfgGet = shell.config?.get?.() ?? Promise.resolve({});
      const brandGet = shell.brand?.current?.() ?? Promise.resolve(null);
      Promise.all([ready, cfgGet, brandGet]).then(async ([, cfg, brand]) => {
        if (!alive) return;
        const url = (cfg?.apiUrl || DEFAULT_API).replace(/\/+$/, "");
        setApiUrl(url);
        if (brand) setBrandName(brand.legalName || brand.name || null);
        const stored = saved.tokens;
        if (stored?.refresh) {
          const fresh = await makeApi(url, null).refresh(stored.refresh);
          if (alive && fresh) {
            setTokens(fresh);
            saved = { ...saved, tokens: fresh };
            shell.saveData(saved);
          }
        }
        if (alive) setBooted(true);
      });
      return () => {
        alive = false;
      };
    }, []);
    const api = react_shim_default.useMemo(() => makeApi(apiUrl, tokens), [apiUrl, tokens]);
    const onTokens = (t) => {
      setTokens(t);
      saved = { ...saved, tokens: t };
      shell.saveData(saved);
    };
    if (!booted) {
      return /* @__PURE__ */ react_shim_default.createElement("div", { className: "kimos-licitai kl-center" }, /* @__PURE__ */ react_shim_default.createElement("span", { className: "kl-muted" }, "Cargando\u2026"));
    }
    return /* @__PURE__ */ react_shim_default.createElement(
      App,
      {
        shell,
        api,
        tokens,
        onTokens,
        brandName,
        version: APP_VERSION
      }
    );
  }
  return {
    Component,
    unmount() {
    }
  };
}
export default mount;
