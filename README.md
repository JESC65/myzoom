# MyZoom · Promoción 81 · Reunión virtual

Sala de videollamada web pequeña para la reunión de la Promoción 81 del Colegio San Antonio (sábado 21 de noviembre de 2026, hora de Lima). Un único **Cloudflare Worker** sirve la API (`/api/*`) y la aplicación React compilada (Workers Static Assets); el audio y el video son de **Cloudflare RealtimeKit** con su interfaz estándar (`RtkMeeting`).

- **Invitado** (`/?c=CODIGO`): escribe nombre y ciudad, toca un botón y entra con cámara y micrófono apagados.
- **Anfitrión** (`/anfitrion`): la laptop del salón entra con la clave del anfitrión; tiene las pestañas **Sala** y **Diagnóstico**.
- **Ventana horaria**, **respaldo** con `FALLBACK_URL` y **modo ensayo** (`MOCK_RTK=true`) sin Cloudflare.

Las reglas completas están en [`docs/ENCARGO.md`](docs/ENCARGO.md). Cómo publicar: [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md). Cómo ensayar el viernes: [`docs/ENSAYO.md`](docs/ENSAYO.md). La hoja del sábado: [`docs/OPERACION_SABADO.md`](docs/OPERACION_SABADO.md). Dónde va el trabajo: [`docs/ESTADO.md`](docs/ESTADO.md).

## Prerrequisitos

- **Node.js 22.18 o más nuevo** (o 24 LTS). Las pruebas del Worker usan `node --test` con TypeScript directo, que necesita esa versión. `.nvmrc` dice `22`.
- npm 10 o más nuevo y Git.
- Para las pruebas de pantalla: Chromium de Playwright (`npx playwright install chromium` si tu equipo no lo tiene).
- **No** hacen falta claves de Cloudflare para desarrollar ni para probar.

## Arranque en modo ensayo (sin Cloudflare)

```bash
npm ci
npm run demo
```

`npm run demo` compila la aplicación, levanta el Worker local con `wrangler dev` y valores sintéticos, y muestra:

```text
✅ MyZoom en modo ensayo está listo (nada de esto es una sala real).
  Invitado:   http://localhost:8787/?c=ensayo81
  Anfitrión:  http://localhost:8787/anfitrion
  Código de invitación (ensayo): ensayo81
  Clave del anfitrión (ensayo): ensayo-clave-anfitrion-0000
```

En modo ensayo la sala real se reemplaza por un recuadro «Sala de ensayo» con el nombre visible y el rol. Se detiene con `Ctrl + C`. Otro puerto: `npm run demo -- --puerto 8800`.

Para trabajar con tus propios valores de ensayo: copia `.dev.vars.example` a `.dev.vars` (nunca se sube a GitHub) y ejecuta `npm run dev`.

## Pruebas

| Comando | Qué prueba |
|---|---|
| `npm run check` | Tipos de TypeScript estricto + revisión estática propia (`scripts/check-static.mjs`) |
| `npm test` | Worker: seguridad, roles, ventana, cookie, API de RealtimeKit simulada, respaldo, diagnóstico, idioma (`node --test`) |
| `npm run build` | Compila la aplicación en `dist/client` (lo que publica `wrangler deploy`) |
| `npm run test:dist` | Que `dist/` no contenga secretos sintéticos (después de `build`) |
| `npm run test:e2e` | Escenario de aceptación en modo ensayo con Playwright y Chromium (después de `build`) |
| `npm run test:a11y` | axe-core sin violaciones AA, botones ≥ 48 px, texto ≥ 18 px, 360 px sin desplazamiento (después de `build`) |
| `npm run test:kit` | Herramientas del kit |
| `npm run notices` | Regenera `THIRD_PARTY_NOTICES.md` |

Orden recomendado: `npm ci && npm run check && npm test && npm run build && npm run test:dist && npm run test:e2e && npm run test:a11y`.

Herramientas del kit: `npm run doctor` (verificación previa), `npm run ayuda` (reporte para pedir ayuda, sin secretos), `npm run session:status` (dónde quedó el trabajo) y `node scripts/run.mjs -- <comando>` (ejecuta comandos largos con registro en `logs/`).

## Estructura

```text
src/shared/   contrato congelado entre cliente y Worker: tipos, textos de error, validadores, hora de Lima
src/worker/   index.ts (rutas), config.ts, rtk.ts (API v4 de RealtimeKit + ensayo), security.ts, time.ts, diagnostics.ts, http.ts
src/client/   main.tsx, App.tsx, views/ (Guest, Host, Diagnostics, Left, Fallback, Room, RealRoom), i18n/es.ts, styles.css
public/       insignia optimizada y favicon
tests/        worker/ (node --test + fixtures), e2e/ (Playwright + axe), compilado/ (dist sin secretos), kit/
docs/         encargo, estado, bitácora, tareas, decisiones, verificación y manuales de operación
```

## Problemas comunes

| Síntoma | Solución |
|---|---|
| `npm test` dice «Unknown file extension .ts» | Tu Node es anterior a 22.18. Instala Node 22 actualizado o 24 LTS. |
| `npm run test:e2e` dice «Falta dist/client/index.html» | Ejecuta antes `npm run build`. |
| Playwright no encuentra el navegador | `npx playwright install chromium` |
| `npm run demo` dice que el puerto está ocupado | `npm run demo -- --puerto 8800` |
| El diagnóstico dice «ENSAYO en un sitio publicado» | En Cloudflare, `MOCK_RTK` debe ser `false` (lo fija `wrangler.jsonc`). |
| Un invitado no oye en el teléfono | Que abra el enlace en Chrome o Safari, no dentro de WhatsApp, y toque «Activar el sonido» si aparece. |

## Seguridad en una línea

El navegador nunca elige su rol: el preset de invitado se fija en el servidor; ser anfitrión exige la clave, comparada en tiempo constante, y una cookie firmada con HMAC-SHA-256 que vence al cierre del evento. Ningún secreto vive en el repositorio ni en el navegador.
