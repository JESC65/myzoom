# Decisiones

Solo lo que afecta contratos, seguridad, costos o comportamiento visible. Formato: contexto, alternativas, decisión, consecuencias.

## D-001 · 2026-11-19 · Lo confirmado en la documentación oficial
- **Contexto:** `developers.cloudflare.com` estaba bloqueado por la red del contenedor (403 del proxy, ver INC-001). La sección 0 permite usar los tipos del paquete instalado. Fuentes usadas, todas oficiales de Cloudflare: `@cloudflare/realtimekit` 2.1.0, `@cloudflare/realtimekit-react` 2.1.0, `@cloudflare/realtimekit-react-ui` 2.1.0 (y `@cloudflare/realtimekit-ui` 2.1.0), el SDK REST oficial `cloudflare` 7.3.0 (`resources/realtime-kit/*.d.ts`) y `wrangler` 4.165.0 (`config-schema.json`).
- **Confirmado:**
  - Paquetes: `@cloudflare/realtimekit-react` (`useRealtimeKitClient`, `RealtimeKitProvider`) y `@cloudflare/realtimekit-react-ui` (`RtkMeeting`, `useLanguage`, `defaultLanguage`, tipo `LangDict`). Licencia Apache-2.0 en el SDK; el UI Kit no declara licencia en `package.json` (permitido por la sección 6 como SDK de Cloudflare).
  - Inicialización: `initMeeting({ authToken, defaults: { audio, video } })` (`ClientOptions.defaults: DefaultOptions` en `realtimekit/dist/index.d.ts`).
  - `RtkMeeting`: propiedades `meeting`, `showSetupScreen`, `t`, `mode` (`'fixed' | 'fill'`), `leaveOnUnmount`, `config`, `loadConfigFromPreset`… Con `showSetupScreen=false` el componente llama a `meeting.join()` solo (`rtk-meeting.js`, líneas 238–250).
  - Idioma: `useLanguage(lang?: Partial<LangDict>) => RtkI18n`; no hay paquete en español. Diccionario base exportado como `defaultLanguage` (430 claves).
  - Salida: evento `meeting.self` `roomLeft` con `state: 'kicked' | 'ended' | 'left' | 'rejected' | 'connected-meeting' | 'disconnected' | 'failed' | 'stageLeft'`.
  - API REST (base `https://api.cloudflare.com/client/v4/accounts/{account_id}/realtime/kit/{app_id}`): `POST /meetings/{meeting_id}/participants` con `custom_participant_id`, `preset_name`, `name`, `picture`; respuesta `{ success, data: { id, token, custom_participant_id, preset_name, name, … } }` → **la credencial viene en `data.token`**, no en `authToken`. `GET /meetings/{id}` → `data.status: 'ACTIVE' | 'INACTIVE'`, `data.title`. `POST /meetings` con `title`. `GET /presets?page_no&per_page` → `data[].name`.
  - Wrangler: `keep_vars` (boolean: conserva las variables del panel al desplegar), `assets.directory`, `assets.binding`, `assets.not_found_handling: "single-page-application"`, `assets.run_worker_first: true | string[]`.
- **Difiere o no se pudo confirmar:** `expires_on` no figura en los tipos del SDK REST (ver D-002). El nombre exacto del permiso del token («Realtime Admin») y los nombres de pantallas del panel no se pudieron leer: `docs/DESPLIEGUE.md` lo dice y describe qué buscar. Los presets por defecto se tomaron como `group_call_host` y `group_call_participant` (nombres conocidos de RealtimeKit), confirmables en Diagnóstico.

## D-002 · 2026-11-19 · `expires_on` en «Agregar participante»
- **Contexto:** el encargo (citando el FAQ) pide `expires_on = EVENT_CLOSES_AT`; los tipos oficiales del SDK REST no listan ese campo.
- **Alternativas:** no enviarlo (se pierde el vencimiento); enviarlo siempre (si la API lo rechaza, nadie entra el sábado); enviarlo y, solo si Cloudflare responde 4xx mencionando `expires_on`, repetir una vez sin él.
- **Decisión:** la tercera. No es un reintento por error de red: es una petición distinta y se registra con `console.error` sin datos.
- **Consecuencias:** prueba `rtk.test.ts` «falls back to no expires_on…». En la primera llamada real (DESPLIEGUE paso 7) se verá en los registros si ocurre. La ventana horaria del servidor sigue impidiendo emitir credenciales fuera del evento.

## D-003 · 2026-11-19 · Pruebas del Worker con `node --test` en lugar de Vitest
- **Contexto:** Javier pidió ejecutar las pruebas con `node --test` sin depender de paquetes externos. Node ≥ 22.18 ejecuta TypeScript directamente (eliminación de tipos).
- **Decisión:** `npm test` = `node --test "tests/worker/**/*.test.ts"`; sin Vitest (una dependencia menos). El código usa solo sintaxis borrable (`erasableSyntaxOnly`) e importaciones con extensión `.ts` (`allowImportingTsExtensions`), que Vite y Wrangler aceptan.
- **Consecuencias:** requiere Node 22.18+ (documentado en README). La tabla 14.1 se cubre igual.

## D-004 · 2026-11-19 · Contrato congelado y ruta adicional `GET /api/anfitrion/sesion`
- **Contexto:** al recargar `/anfitrion`, la pantalla debe saber si la cookie (HttpOnly) sigue vigente sin pedir el diagnóstico completo (que llama a Cloudflare) ni emitir credenciales.
- **Decisión:** se agrega `GET /api/anfitrion/sesion` → `{ ok: true }` o `401`. `src/shared/contracts.ts` queda congelado desde el cierre de la Fase 1.
- **Consecuencias:** pruebas en `routes.test.ts` (401 sin cookie, con cookie alterada, con clave cambiada).

## D-005 · 2026-11-19 · Sin pantalla de preparación del UI Kit
- **Contexto:** el invitado ya escribió nombre y ciudad; la pantalla de preparación vuelve a pedir el nombre y puede solicitar permisos.
- **Decisión:** `showSetupScreen={false}` para invitado y anfitrión; se entra directo con `defaults` (invitado: audio y video apagados; anfitrión: encendidos, D-015).
- **Consecuencias:** negar permisos no impide entrar. Paso en `docs/ENSAYO.md` (entrar como oyente sin dar permisos).

## D-006 · 2026-11-19 · Sonido bloqueado: se usa el del UI Kit
- **Contexto:** sección 5.1. El UI Kit trae su propio aviso (`rtk-participants-audio`, claves `audio_playback*`) que reintenta la reproducción con un toque.
- **Decisión:** no construir botón propio; traducir las claves a «Toca aquí para activar el sonido» / «Activar el sonido».
- **Consecuencias:** comprobar en iPhone y Android reales (ENSAYO). Si no apareciera, está anotado como riesgo en VERIFICACION.

## D-007 · 2026-11-19 · Cookie `__Host-` también en modo ensayo local
- **Contexto:** la sección 4.5 permitía una variante si Chromium no aceptaba `__Host-` + `Secure` en `http://localhost`.
- **Comprobación:** Chromium 1243 (Playwright 1.63) acepta `__Host-x=1; Secure` en `http://localhost` y `http://127.0.0.1` (prueba manual con un servidor mínimo, 2026-11-19).
- **Decisión:** una sola cookie para todos los modos; sin variante.

## D-008 · 2026-11-19 · Cabecera `X-MyZoom-Mock-Preset` solo en modo ensayo
- **Contexto:** el paso 5 de la sección 13 exige comprobar «en la API simulada» qué preset recibió un intento de escalar, y el Worker no guarda estado.
- **Decisión:** en modo ensayo, `/api/entrar` y `/api/anfitrion/credencial` devuelven el preset usado en esa cabecera. En modo real no existe.

## D-009 · 2026-11-19 · Política de seguridad de contenido (CSP) abierta para medios
- **Contexto:** RealtimeKit elige servidores de medios y sockets en tiempo de ejecución; no se pudo leer la lista oficial de dominios.
- **Decisión:** `connect-src 'self' https: wss:`, `img-src … https:`, `media-src 'self' blob: mediastream: https:`, `worker-src 'self' blob:`, `script-src 'self' 'wasm-unsafe-eval' blob:`, fuentes de Google y `rtk-assets.realtime.cloudflare.com` (hallados en el paquete); `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`. Sin `unsafe-eval` (el paquete no usa `eval`).
- **Consecuencias:** si la primera llamada real muestra errores CSP en la consola, ampliar la directiva concreta (`src/worker/security.ts`) y registrar aquí.

## D-010 · 2026-11-19 · Sin límite de intentos (429) para la clave del anfitrión
- **Contexto:** sección 4.5: solo si existe sin almacenamiento propio. El enlace de límites de Workers necesita configuración adicional que no se pudo verificar.
- **Decisión:** no construirlo. Riesgo mitigado por la clave larga: se recomienda **20 o más caracteres** en DESPLIEGUE.

## D-011 · 2026-11-19 · Ventana horaria también para el anfitrión, pero no para entrar al panel
- **Decisión:** `/api/anfitrion/credencial` respeta la ventana (como el invitado). El acceso al panel y al diagnóstico funciona siempre: la cookie vence en `EVENT_CLOSES_AT` o, si esa fecha falta o ya pasó, en 6 horas, para poder corregir la configuración. Una cookie que dure más allá del `EVENT_CLOSES_AT` vigente se rechaza.

## D-012 · 2026-11-19 · Arnés de pruebas de pantalla
- **Decisión:** Playwright corre contra `tests/e2e/server.mjs`, que ejecuta el **módulo real del Worker** con un `ASSETS` emulado sobre `dist/client` y rutas de control `/__test/*` (nunca se despliega). El paso 1 (demo) se prueba aparte con `wrangler dev` real (`demo.spec.ts`).
- **Consecuencias:** pruebas rápidas y deterministas; `wrangler dev` probado igualmente.

## D-013 · 2026-11-19 · Dependencias y versiones
- Producción: `react`/`react-dom` 19.3.1, `@cloudflare/realtimekit-react` 2.1.0, `@cloudflare/realtimekit-react-ui` 2.1.0.
- Desarrollo: `vite` 8.3.8, `@vitejs/plugin-react` 6.3.0, `wrangler` 4.165.0, `typescript` **5.9.3** (no 7.x: el compilador nuevo es demasiado reciente para esta entrega), `@types/*`, `@playwright/test` **1.63.0** (coincide con el Chromium preinstalado) con `overrides.playwright-core = 1.63.0` para que `@axe-core/playwright` 4.14.0 no traiga otra copia.
- **Sin** el plugin de Cloudflare para Vite: Wrangler empaqueta el Worker y Vite solo compila el cliente. Menos piezas.
- Licencias revisadas con `npm run notices`: todas permisivas o SDK de Cloudflare.

## D-014 · 2026-11-19 · Limpieza de nombre y ciudad
- Se quitan caracteres de control, marcas de dirección bidi y los signos `<` y `>`; se normaliza a NFC y se colapsan espacios. Los emojis se aceptan y cuentan como un carácter.

## D-015 · 2026-11-19 · La laptop del salón entra con cámara y micrófono encendidos
- El invitado entra con todo apagado (sección 5.1). El anfitrión es la cámara y el micrófono del salón, por eso entra con ambos encendidos; puede apagarlos desde la barra del UI Kit.

## D-016 · 2026-11-19 · Contexto de esta construcción
- **Contexto:** el código se construyó en el contenedor de un Proyecto de Claude (sin acceso a GitHub ni a la documentación de Cloudflare), por pedido de Javier, en una sola sesión que cubrió las Fases 0 a 3.
- **Decisión:** commits por fase (no uno por tarea) y sin push; Javier sube el repositorio. `docs/PREFLIGHT.md` quedó con ❌ por falta de GitHub: la primera sesión de Claude Code sobre `JESC65/myzoom` debe ejecutar `node scripts/preflight.mjs --push`.
- **Consecuencias:** `docs/VERIFICACION.md` lista qué falta verificar en esa sesión corta.

## D-017 · 2026-11-19 · Aviso de respaldo dentro de la sala enlaza a «/»
- **Decisión:** el aviso «Nos cambiamos de sala…» apunta a `/`, que el Worker redirige (302) a `FALLBACK_URL`. Así `/api/estado` solo dice `respaldo: true` y nunca expone la URL; quien tenía el formulario abierto la recibe en el 409.

## D-018 · 2026-11-19 · Un corte transitorio no saca a nadie de la sala (hallazgo H1 de la auditoría)
- **Contexto:** el SDK emite `roomLeft {state:"disconnected"}` en cada microcorte y luego reconecta solo (`roomJoined {reconnected:true}`); el estado final tras agotar reintentos es `failed`. El propio `RtkMeeting` ignora `disconnected`.
- **Decisión:** `src/client/roomState.ts` trata como finales solo `left`, `ended`, `kicked`, `rejected` y `failed`. Durante el corte se ve el aviso de reconexión del UI Kit.
- **Consecuencias:** prueba `room-state.test.ts`; paso de corte de wifi en `docs/ENSAYO.md`.

## D-019 · 2026-11-19 · Formato de `expires_on`
- Se envía el mismo instante que `EVENT_CLOSES_AT`, normalizado a ISO 8601 en UTC (`2026-11-22T11:00:00.000Z`), no el texto literal con desfase. Si se aplica el respaldo de D-002, esa credencial no lleva vencimiento propio; la ventana del Worker sigue impidiendo emitir credenciales fuera del horario.

## Después del sábado (fuera de alcance ahora)
- Límite de intentos para la clave con el enlace de límites de Workers (D-010).
- Lista cerrada de dominios en la CSP, cuando se conozcan los de RealtimeKit (D-009).
