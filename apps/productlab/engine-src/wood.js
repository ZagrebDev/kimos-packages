/**
 * Proyección triplanar de veta/textura en espacio del objeto.
 *
 * Portado del personalizador 3D (src/lib/woodShader.ts) a three.js vanilla.
 * Ignora las UVs del modelo — los exports de CAD suelen traer mapeo por cara
 * que tilea la textura — y proyecta de forma continua. La luminancia de la
 * veta modula además la rugosidad, así el grano se lee en los reflejos aunque
 * el tinte sea casi negro (madera carbonizada, tela oscura).
 *
 * Sirve para cualquier material con dirección (madera, telas con trama,
 * laminados); para acabados lisos no hace falta.
 */

// Subir al cambiar el código del shader: fuerza re-patch/recompilación.
const WOOD_VERSION = 8;

/**
 * @param material MeshStandardMaterial a parchear
 * @param map      Texture de la veta
 * @param params   { scale, grain, vertical, angle, opacity, plyAxis, plySpacing, bump }
 */
export function applyTriplanar(material, map, params) {
  const p = params || {};
  let wood = material.userData.wood;
  if (wood && material.userData.woodVersion === WOOD_VERSION) {
    wood.map.value = map;
    wood.scale.value = p.scale != null ? p.scale : 1;
    wood.grain.value = p.grain != null ? p.grain : 0;
    wood.vertical.value = p.vertical ? 1 : 0;
    wood.angle.value = p.angle || 0;
    wood.opacity.value = p.opacity != null ? p.opacity : 1;
    wood.plyAxis.value = p.plyAxis || [0, 0, 0];
    wood.plySpacing.value = p.plySpacing || 0.0018;
    wood.bump.value = p.bump != null ? p.bump : 0;
    return;
  }

  wood = material.userData.wood = {
    map: { value: map },
    scale: { value: p.scale != null ? p.scale : 1 },
    grain: { value: p.grain != null ? p.grain : 0 },
    vertical: { value: p.vertical ? 1 : 0 },
    angle: { value: p.angle || 0 },
    opacity: { value: p.opacity != null ? p.opacity : 1 },
    plyAxis: { value: p.plyAxis || [0, 0, 0] },
    plySpacing: { value: p.plySpacing || 0.0018 },
    bump: { value: p.bump != null ? p.bump : 0 },
  };
  material.userData.woodVersion = WOOD_VERSION;
  material.customProgramCacheKey = () => 'triplanar-v' + WOOD_VERSION;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uWoodMap: wood.map,
      uWoodScale: wood.scale,
      uWoodGrain: wood.grain,
      uWoodVertical: wood.vertical,
      uWoodAngle: wood.angle,
      uWoodOpacity: wood.opacity,
      uPlyAxis: wood.plyAxis,
      uPlySpacing: wood.plySpacing,
      uWoodBump: wood.bump,
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWoodPos;\nvarying vec3 vWoodNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWoodPos = position;\nvWoodNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uWoodMap;
        uniform float uWoodScale;
        uniform float uWoodGrain;
        uniform float uWoodVertical;
        uniform float uWoodAngle;
        uniform float uWoodOpacity;
        uniform vec3 uPlyAxis;
        uniform float uPlySpacing;
        uniform float uWoodBump;
        varying vec3 vWoodPos;
        varying vec3 vWoodNormal;
        // La veta de la textura corre a lo largo de la coordenada v. En modelos
        // Y-up, las piezas de pie (patas) quieren la veta a lo largo de Y en sus
        // caras laterales (vertical=1); los tableros la quieren a lo largo.
        vec4 woodTriplanar() {
          vec3 n = abs(normalize(vWoodNormal));
          n = pow(n, vec3(6.0));
          n /= n.x + n.y + n.z;
          vec2 uvX = mix(vWoodPos.yz, vWoodPos.zy, uWoodVertical);
          vec2 uvY = vWoodPos.zx;
          vec2 uvZ = mix(vWoodPos.yx, vWoodPos.xy, uWoodVertical);
          // Inclina la veta de los cantos para que siga el eje de la pieza; el
          // signo de X hace que cada pata rote hacia su propio lado.
          float a = uWoodAngle * sign(vWoodPos.x);
          float ca = cos(a), sa = sin(a);
          uvZ = mat2(ca, -sa, sa, ca) * uvZ;
          vec4 tx = texture2D(uWoodMap, uvX * uWoodScale);
          vec4 ty = texture2D(uWoodMap, uvY * uWoodScale);
          vec4 tz = texture2D(uWoodMap, uvZ * uWoodScale);
          return tx * n.x + ty * n.y + tz * n.z;
        }`)
      .replace('#include <map_fragment>', `{
          // Capitas del terciado: bandas a lo largo del espesor, visibles solo
          // en los cantos (caras perpendiculares al eje de la plancha).
          float ply = 1.0;
          if (dot(uPlyAxis, uPlyAxis) > 0.5) {
            vec3 nrm = normalize(vWoodNormal);
            float edgeMask = 1.0 - smoothstep(0.35, 0.6, abs(dot(nrm, uPlyAxis)));
            float t = fract(dot(vWoodPos, uPlyAxis) / uPlySpacing);
            float band = step(0.5, t);
            float glue = smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.94, t);
            ply = mix(1.0, mix(0.78, 1.06, band) * (0.82 + 0.18 * glue), edgeMask);
          }
          diffuseColor.rgb *= mix(vec3(1.0), woodTriplanar().rgb, uWoodOpacity) * ply;
        }`)
      .replace('#include <roughnessmap_fragment>', `float lum = dot(woodTriplanar().rgb, vec3(0.299, 0.587, 0.114));
        float roughnessFactor = clamp(roughness - (lum - 0.55) * uWoodGrain * uWoodOpacity, 0.05, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // RELIEVE de la veta: micro-normales derivadas de la luminancia de la
        // textura (bump clásico por derivadas de pantalla). Es lo que hace que
        // el grano se LEA en los brillos aunque el tinte sea casi negro — en
        // la madera carbonizada real la veta se ve por el relieve, no por el
        // color. Misma fórmula que bumpmap_pars_fragment (perturbNormalArb).
        if (uWoodBump > 0.0) {
          float woodH = dot(woodTriplanar().rgb, vec3(0.299, 0.587, 0.114))
            * uWoodBump * uWoodOpacity;
          vec3 sX = dFdx(-vViewPosition);
          vec3 sY = dFdy(-vViewPosition);
          vec3 r1 = cross(sY, normal);
          vec3 r2 = cross(normal, sX);
          float det = dot(sX, r1);
          vec3 grad = sign(det) * (dFdx(woodH) * r1 + dFdy(woodH) * r2);
          normal = normalize(abs(det) * normal - grad);
        }`);
  };
  material.needsUpdate = true;
}
