/**
 * app-contract.mjs — el contrato de una app de KIMOS, en un solo sitio.
 *
 * Lo que vive aquí es lo que `pack.mjs` (empaquetar) y `check-app.mjs`
 * (revisar) tienen que decidir igual: qué permisos existen, qué es un
 * `dataSchema` válido y cómo se llama una app. Estaba duplicado en los dos
 * y esa clase de duplicado no avisa cuando se desincroniza: el empaquetador
 * acepta algo que el revisor marca como error, o al revés, y quien escribe
 * una app recibe dos respuestas distintas a la misma pregunta.
 *
 * Sin dependencias, a propósito: el pack para creadores lo lleva tal cual y
 * un tercero no debe tener que instalar nada para validar su app.
 *
 * Ver APP-SPEC.md §7.
 */

export const ALLOWED_PERMISSIONS = new Set([
  'instance.read', 'instance.write', 'agent.control', 'public.read', 'public.submit',
  // Recursos compartidos de plataforma (APP-SPEC §7.d, §7.e y §7.f).
  'records.link',   // identidades compartidas entre apps (shell.records)
  'files.write',    // subir archivos con ruta gestionada por el host (shell.files)
  'brand.read',     // marca del tenant: logos, razón social, colores (shell.brand)
]);

/**
 * Permisos parametrizados: `data.read:{templateId}` / `data.write:{templateId}`,
 * o `*`. Lecturas y escrituras en datos de OTRA app vía `shell.data`,
 * consentidas por el superadmin al instalar. La escritura además exige que la
 * app dueña publique un `dataSchema` (APP-SPEC §7.c): eso lo comprueba el
 * backend en cada llamada, no el empaquetador.
 */
export const PARAM_PERMISSION_RE = /^data\.(read|write):(\*|[a-z0-9][a-z0-9.\-]{0,60})$/;

export const permissionAllowed = (p) => ALLOWED_PERMISSIONS.has(p) || PARAM_PERMISSION_RE.test(p);

export const PERMISSIONS_HELP =
  `Permitidos: ${[...ALLOWED_PERMISSIONS].join(', ')} o data.read:{templateId} / data.write:{templateId}.`;

export const APP_ID_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/;
export const VERSION_RE = /^\d+(\.\d+){0,2}([-.][0-9A-Za-z-]+)*$/;

/**
 * Campos que gestiona la plataforma. Declararlos en un `dataSchema` no los
 * habilita, así que declararlos es señal de un malentendido y se avisa.
 */
export const RESERVED_FIELDS = new Set([
  'id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy',
  'createdByApp', 'updatedByApp', 'recordRef',
]);

/** Identidades que la plataforma reconoce (APP-SPEC §7.d). */
export const RECORD_TYPES = new Set(['account', 'contact', 'product', 'opportunity', 'project']);

/**
 * Revisa el `dataSchema` de un manifest. Devuelve la lista de problemas
 * (vacía si está bien). No lanza: quien llama decide si es fatal —el
 * empaquetador sí, el revisor no— y así los dos dicen lo mismo.
 */
export function validateDataSchema(schema) {
  const problemas = [];
  if (schema === undefined) return problemas;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return ['`dataSchema` debe ser un objeto (ver APP-SPEC §7.c).'];
  }
  const fields = schema.fields;
  if (!Array.isArray(fields) || fields.length === 0) {
    return ['`dataSchema.fields` debe ser una lista con al menos un campo.'];
  }
  const claves = new Set();
  for (const f of fields) {
    const key = f && typeof f === 'object' ? String(f.key || '').trim() : '';
    if (!key) { problemas.push('Cada campo de `dataSchema.fields` necesita una `key`.'); continue; }
    if (RESERVED_FIELDS.has(key)) {
      problemas.push(`\`dataSchema\` declara '${key}', que gestiona la plataforma: no se puede escribir desde otra app.`);
      continue;
    }
    if (claves.has(key)) { problemas.push(`\`dataSchema\` declara '${key}' dos veces.`); continue; }
    claves.add(key);
  }
  const rt = String(schema.recordType || '').trim();
  if (rt && !RECORD_TYPES.has(rt)) {
    problemas.push(`\`dataSchema.recordType\` = '${rt}' no existe. Tipos: ${[...RECORD_TYPES].join(', ')} (APP-SPEC §7.d).`);
  }
  const nk = schema.naturalKeys;
  if (nk !== undefined && !Array.isArray(nk)) {
    problemas.push('`dataSchema.naturalKeys` debe ser una lista.');
  } else {
    for (const k of nk || []) {
      if (!claves.has(String(k))) {
        problemas.push(`\`dataSchema.naturalKeys\` menciona '${k}', que no está entre los campos declarados.`);
      }
    }
  }
  return problemas;
}

/** Problemas del manifest que impiden empaquetar. Vacío = se puede. */
export function validateManifest(manifest) {
  const problemas = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest.json debe ser un objeto.'];

  const id = String(manifest.id || '').trim();
  if (!APP_ID_RE.test(id)) {
    problemas.push("`id` inválido (minúsculas/dígitos/. _ -; recomendado namespacing 'org.app').");
  }
  const version = String(manifest.version || '').trim();
  if (!VERSION_RE.test(version)) problemas.push('`version` inválida (usa SemVer, p.ej. 1.0.0).');

  const perms = manifest.permissions;
  if (!Array.isArray(perms)) {
    problemas.push('`permissions` debe ser una lista. ' + PERMISSIONS_HELP);
  } else {
    for (const p of perms) {
      if (!permissionAllowed(p)) problemas.push(`Permiso no válido: '${p}'. ` + PERMISSIONS_HELP);
    }
  }
  problemas.push(...validateDataSchema(manifest.dataSchema));
  return problemas;
}
