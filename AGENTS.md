# AGENTS.md · MyZoom · Promoción 81

Puerta de entrada para cualquier agente (Claude Code, otro modelo u otra herramienta). Léelo completo antes de tocar nada.

## Propósito

Sala de videollamada web para la reunión de la Promoción 81 (sábado 21 de noviembre de 2026, America/Lima). Un Worker de Cloudflare con Workers Static Assets sirve la API y la app React; el audio y el video son de Cloudflare RealtimeKit con su UI Kit estándar (`RtkMeeting`). Una sala, dos roles, sin base de datos. **Estabilidad del sábado por encima de todo.**

## Estructura

| Ruta | Qué hay |
|---|---|
| `src/shared/` | **Contrato congelado** cliente ↔ Worker (tipos, mensajes, validadores, hora de Lima). Cambiarlo exige entrada en `docs/DECISIONES.md` y pruebas |
| `src/worker/` | `index.ts` rutas · `config.ts` validación de variables · `rtk.ts` API v4 de RealtimeKit + modo ensayo · `security.ts` tiempo constante, cookie HMAC, cabeceras · `time.ts` ventana · `diagnostics.ts` · `http.ts` |
| `src/client/` | `App.tsx` (dos rutas) · `views/` Guest, Host, Diagnostics, Left, Fallback, Room, RealRoom · `i18n/es.ts` · `styles.css` |
| `tests/worker/` | `node --test` + `fixtures/` con la forma documentada de la API |
| `tests/e2e/` | Playwright + axe sobre `server.mjs` (Worker real + assets emulados) y `demo.spec.ts` (wrangler dev real) |
| `tests/compilado/` | `dist/` sin secretos sintéticos |
| `scripts/` | Kit (`preflight`, `run`, `ayuda`, `session-start`) + `demo.mjs`, `notices.mjs`, `check-static.mjs` |
| `docs/` | `ENCARGO.md` (no se edita), `ESTADO.md`, `BITACORA.md`, `TAREAS.md`, `DECISIONES.md`, `VERIFICACION.md`, `INCIDENTES.md`, manuales |

## Comandos

```bash
npm ci                      # instalar (lockfile)
npm run check               # tsc estricto + revisión estática
npm test                    # pruebas del Worker (node --test, Node >= 22.18)
npm run build               # dist/client
npm run test:dist           # dist sin secretos (tras build)
npm run test:e2e            # escenario de aceptación en modo ensayo (tras build)
npm run test:a11y           # axe-core y tamaños mínimos (tras build)
npm run demo                # modo ensayo local con wrangler dev
npm run test:kit            # herramientas del kit
npm run notices             # THIRD_PARTY_NOTICES.md
npm run doctor | ayuda | session:status
```

Todo comando largo pasa por `node scripts/run.mjs -- <comando>` (salida completa en `logs/`, que no se sube).

## Reglas de seguridad (innegociables)

1. El preset de invitado es siempre `PRESET_GUEST`, decidido en el servidor. Ningún campo del cuerpo (`preset_name`, `role`, `isHost`…) cambia eso.
2. `INVITE_CODE` y `HOST_SECRET` se comparan en tiempo constante sobre SHA-256 (`safeEqual`).
3. Cookie `__Host-myzoom_host` = `v1.{exp}.{HMAC-SHA-256}`, `Secure; HttpOnly; SameSite=Strict; Path=/`, vence en `EVENT_CLOSES_AT`.
4. Credenciales solo dentro de la ventana y con `expires_on = EVENT_CLOSES_AT`.
5. `FALLBACK_URL` solo `https://` sin credenciales; el 302 nunca reenvía el código.
6. Ningún secreto en el repositorio, en `dist/`, en el navegador ni en los registros. Nunca registres tokens, claves, códigos ni nombres.
7. No ejecutes `wrangler deploy`, `wrangler login`, `wrangler secret` ni llamadas reales a `api.cloudflare.com`. No pidas claves.

## Fuera de alcance (prohibido, sección 3.2)

Grabación, OBS, ruta para TV, compartir `MediaStream` entre pestañas, selector de dispositivos o medidor de voz propios, cola de manos, «modo en traslado», base de datos/KV/Durable Objects/R2, PWA/service worker, cuentas, varias salas, migración de sesiones, generador de carga. Si algo parece necesario: anótalo en `docs/DECISIONES.md` como «después del sábado».

## Protocolo de reanudación (resumen de la sección 11.3)

1. Lee este archivo, `docs/ESTADO.md`, las tres últimas entradas de `docs/BITACORA.md`, `docs/INCIDENTES.md` abiertos y la fase en curso de `docs/TAREAS.md`.
2. `git fetch origin "+refs/heads/*:refs/remotes/origin/*"`, `git status`, `git log -5 --oneline`, `git branch -a`. Integra ramas de trabajo con `git merge --no-ff` (nunca `rebase`).
3. Si `docs/ESTADO.md` y Git discrepan, manda Git.
4. Si `docs/PREFLIGHT.md` tiene más de 24 h o dice ❌: `node scripts/preflight.mjs --push`.
5. `npm ci`, `npm run check`, `npm test`.
6. Entrada de reanudación en `docs/BITACORA.md` (modelo y herramienta), y sigue con la siguiente tarea respetando la fase tope del mensaje.

## Qué sección del encargo leer

| Tema | Sección de `docs/ENCARGO.md` |
|---|---|
| Variables, secretos, API, rutas, ventana, cookie, respaldo, diagnóstico, ensayo | 4.1 a 4.8 |
| Pantallas, idioma, accesibilidad | 5 |
| Seguridad | 6 |
| Reglas de código y scripts | 7 |
| Manuales de operación | 8 |
| Forma de trabajo, ramas, entorno | 10 |
| Bitácora, fallas, informe de parada | 11 |
| Fases y criterios de salida | 12 |
| Escenario de aceptación | 13 |
| Pruebas obligatorias y auditoría | 14 |

## Congelamiento

Desde el **viernes 20 de noviembre a las 18:00 (Lima)** no se fusiona nada en `main`: si el repositorio está conectado a Workers Builds, cada fusión publica de nuevo.
