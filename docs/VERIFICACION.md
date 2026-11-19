# Verificación

Evidencia de lo ejecutado. Entorno: contenedor Linux de un Proyecto de Claude, Node 22.23.5, npm 10.9.9, Chromium 1243 (Playwright 1.63.0). Fecha: 2026-11-19 (hora de Lima). Sin claves de Cloudflare, sin red hacia `developers.cloudflare.com` ni `api.cloudflare.com`.

**«Pasa en modo ensayo» no equivale a «funciona con RealtimeKit», ni «pasa en Chromium» equivale a «probado en un iPhone».**

## Ejecutado aquí, en verde

| Área (tabla 14.1) | Comando | Resultado | Archivos de prueba |
|---|---|---|---|
| Tipos + revisión estática | `npm run check` | ✅ sin errores | `tsconfig.json`, `scripts/check-static.mjs` |
| Roles, secretos, ventana, API RealtimeKit, respaldo, entradas, diagnóstico, idioma | `npm test` (`node --test`) | ✅ **134/134** | `tests/worker/*.test.ts` |
| Compilación | `npm run build` | ✅ `dist/client` | — |
| `dist/` sin secretos sintéticos | `npm run test:dist` | ✅ 2/2 | `tests/compilado/secretos.test.mjs` |
| Escenario 13 (pasos 1 a 10) | `npm run test:e2e` | ✅ **16/16** | `tests/e2e/escenario.spec.ts`, `demo.spec.ts` |
| Accesibilidad AA, botones ≥ 48 px, texto ≥ 18 px, 360 px y 1280 px | `npm run test:a11y` | ✅ **10/10** | `tests/e2e/a11y.spec.ts` |
| Herramientas del kit | `npm run test:kit` | ✅ 15/15 | `tests/kit/` |
| Demo | `npm run demo` | ✅ arranca `wrangler dev` (workerd) e imprime direcciones, código y clave | `demo.spec.ts` |
| Licencias | `npm run notices` | ✅ 25 paquetes de producción, 0 a revisar | `THIRD_PARTY_NOTICES.md` |
| Clon limpio | `git clone` → `npm ci` → check → test → build → test:dist → test:e2e → test:a11y | ✅ (ver final) | — |

Detalle por área de la tabla 14.1:

- **Roles:** 11 intentos de escalar (`preset_name`, `preset`, `presetName`, `role`, `rol`, `isHost` booleano y texto, objeto anidado, arreglo, `custom_participant_id`, `clave`), claves duplicadas en JSON crudo y cookie de anfitrión en `/api/entrar`: siempre `PRESET_GUEST` y `guest-…`. Sin cookie, con firma alterada, vencida, de otra clave, con otro nombre o que excede `EVENT_CLOSES_AT`: `401`.
- **Secretos:** `safeEqual` hace dos SHA-256 aun con longitudes distintas y se usa en el código y en la clave (espía sobre `crypto.subtle.digest`); mínimos 12 y 6; `dist/` limpio; registros sin token, clave, código, nombres ni token de RealtimeKit.
- **Ventana:** un minuto antes de abrir (403), al abrir (200), un minuto antes de cerrar (200), al cerrar (403); `expires_on = EVENT_CLOSES_AT`; mensajes con hora de Lima.
- **API RealtimeKit:** ruta, cabeceras y cuerpo de las 4 operaciones contra fixtures con la forma del SDK oficial; un reintento tras 1 s ante 5xx y ante error de red; ninguno ante 400, 401, 403, 404, 409, 422 y 429; corte a los 10 s con relojes simulados; errores en español; ensayo sin red; `MOCK_RTK` distinto de `"true"` siempre llama a la API.
- **Respaldo:** URL inválida ignorada; 302 sin código ni consulta y con `no-store`; 409 con `respaldo`; anfitrión no redirigido; aviso dentro de la sala en menos de 70 s (reloj acelerado de Playwright).
- **Entradas:** vacíos, largos (61/51), solo controles, no texto, HTML, bidi, emojis (60 cuentan como 60), > 2 KB declarado y en flujo (413), tipo distinto de JSON (415), `Origin` ajeno (403), JSON inválido (400).
- **Diagnóstico:** cada variable ausente tiene su fila con «qué hacer»; ningún secreto en la respuesta (solo el enlace de invitación); 401/403 → «el token no tiene el permiso correcto»; preset inexistente lista los existentes; reunión INACTIVA o inexistente; ENSAYO en rojo fuera de localhost; «Crear la reunión» solo con `RTK_MEETING_ID` vacío (409 si no).
- **Idioma:** las 236 claves de `es.ts` existen en `defaultLanguage` del UI Kit 2.1.0 instalado.

## Auditoría (sección 14.3)

- **Perspectivas 2 y 3:** revisión independiente con un subagente general en modelo Opus siguiendo `.claude/agents/auditor-independiente.md` (el subagente del kit no se carga en un Proyecto de Claude). Una ronda.
  - **H1 · importante · corregido:** un corte transitorio (`roomLeft: disconnected`) sacaba a la persona de la sala y cancelaba la reconexión del SDK. Corrección: solo `failed` y los estados finales (D-018); prueba `room-state.test.ts`.
  - **H2 · riesgo por probar:** si Cloudflare rechaza `expires_on` con otro mensaje, las entradas fallarían con 502 y el diagnóstico seguiría verde. Cubierto en ENSAYO filas 1 y 15 y DESPLIEGUE paso 7.
  - **H3 · riesgo por probar:** CSP y diálogo de sonido solo se ejercitan con el SDK real. ENSAYO filas 2, 3 y 16.
  - **H4 · menor:** formato de `expires_on` normalizado a UTC (D-019).
  - **H5 · menor:** sin límite de intentos de la clave, riesgo anotado (D-010).
  - Veredicto tras la corrección: sin hallazgos críticos ni importantes abiertos; H2 y H3 se confirman en el ensayo real.
- **Perspectiva 1 (alcance):** todo lo de 3.1 existe; nada de 3.2 (lo vigila `check-static.mjs`).
- **Perspectiva 4 (operación):** DESPLIEGUE, ENSAYO y OPERACION_SABADO escritos para seguirse sin ayuda; ESTADO permite retomar.
- **Complejidad retirada:** variante de cookie para localhost (D-007); plugin de Cloudflare para Vite y Vitest no se usan (D-003, D-013).

## No ejecutado aquí (sección 3.3)

| Qué | Por qué | Quién y cómo |
|---|---|---|
| Llamada real entre dos redes y emisión real de credenciales | Sin claves ni red a Cloudflare | Javier · DESPLIEGUE paso 7, ENSAYO 1 y 15 |
| `RtkMeeting` real (sala, barra, chat, fijar, CSP, sonido bloqueado) | El modo ensayo muestra «Sala de ensayo» | Javier · ENSAYO 2–4, 13, 16 |
| Sonido en iPhone y Android físicos | Sin dispositivos | ENSAYO 2–4 |
| Navegador interno de WhatsApp real | Solo se simuló el agente de usuario | ENSAYO 5 |
| HDMI, eco del salón | Sin hardware | ENSAYO 10–12 |
| ~20 conexiones simultáneas | Sin participantes reales | ENSAYO 14 (anotar cifra real) |
| Reconexión tras corte real | Sin red real | ENSAYO 8–9 |
| Lectura de developers.cloudflare.com | Bloqueado (INC-001) | Sesión corta, revisar D-001/D-002 |
| `preflight --push` con GitHub | Sin repositorio remoto | Sesión corta |
| `wrangler deploy` | Prohibido para el agente | Javier · DESPLIEGUE paso 4 |

## Comandos exactos para la sesión corta de Claude Code (con npm y GitHub)

Sesión nueva sobre `JESC65/myzoom`, rama `main`, con `developers.cloudflare.com` en «Allowed domains». Mensaje sugerido:

> «Lee AGENTS.md y docs/ESTADO.md. Ejecuta, cada uno con node scripts/run.mjs --: node scripts/preflight.mjs --push, npm ci, npm run check, npm test, npm run build, npm run test:dist, npm run test:e2e, npm run test:a11y y npm run test:kit. Si developers.cloudflare.com responde, compara D-001 y D-002 de docs/DECISIONES.md con la referencia de Add participant y con el FAQ de RealtimeKit y dime si algo difiere. Anota los resultados en docs/VERIFICACION.md y docs/BITACORA.md, haz commit y push a main, y explícame en palabras simples.»
