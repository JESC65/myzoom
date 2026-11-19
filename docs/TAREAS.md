# Tareas

Estados: `[ ]` pendiente · `[~]` en curso · `[x]` hecha y verificada · `[!]` bloqueada (con incidente).
Commits por fase (D-016): `113d35a` Fase 0 · `287398d` Fase 1 · `497eb50` Fase 2 · Fase 3: ver `git log`.

## Fase 0 · Reconocimiento
Leer: encargo 0, 10, 11, 12 y anexos A, D y E.
- [x] T0.01 Instalar el kit: `.claude/settings.json`, `.claude/agents/`, `.gitignore` desde `config-inicial/` · 113d35a
  - Hecho cuando: los archivos existen y `npm run test:kit` pasa (15/15).
- [x] T0.02 Encargo a `docs/ENCARGO.md`; insignia optimizada en `public/insignia.jpg` (152×192, 8 KB) y `public/favicon.png` · 113d35a
- [x] T0.03 Consulta de fuentes oficiales y D-001 · documentación web bloqueada (INC-001), alternativa aplicada
- [x] T0.04 Archivos de continuidad (AGENTS, CLAUDE, ESTADO, BITACORA, TAREAS, DECISIONES, INCIDENTES, VERIFICACION) · Fase 3

## Fase 1 · Worker, contratos y seguridad
Leer: encargo 4, 6 y la tabla 14.1; D-001 y D-002.
- [x] T1.01 `package.json` con versiones fijadas, lockfile, `tsconfig.json`, `vite.config.ts`, `wrangler.jsonc` (Static Assets, `keep_vars`, `run_worker_first`), `.dev.vars.example`, alias del kit · 287398d
  - Hecho cuando: `npm ci` y `npm run check` en verde.
- [x] T1.02 `src/shared/`: contrato, mensajes, validadores, hora de Lima · 287398d
- [x] T1.03 `config.ts`: validación con problemas en español · 287398d · `config.test.ts`
- [x] T1.04 `time.ts`: ventana y bordes · 287398d · `time.test.ts` (4 bordes)
- [x] T1.05 `security.ts`: `safeEqual` SHA-256, cookie HMAC, cabeceras · 287398d · `security.test.ts`
- [x] T1.06 `rtk.ts`: API v4, 10 s, un reintento, errores en español, ensayo · 287398d · `rtk.test.ts`
- [x] T1.07 `index.ts`: rutas 4.3, entrada de invitado, anfitrión, respaldo 302/409, 404/405 · 287398d · `routes.test.ts`
- [x] T1.08 `diagnostics.ts` y crear reunión · 287398d · `diagnostics.test.ts`
- [x] T1.09 Revisión estática (`scripts/check-static.mjs`) y contrato congelado · 287398d

## Fase 2 · Pantallas, modo ensayo y pruebas de interfaz
Leer: encargo 5, 4.8, 13; contrato `src/shared/contracts.ts`.
- [x] T2.01 `index.html`, `main.tsx`, `App.tsx` (dos rutas), `api.ts`, `storage.ts` · 497eb50
- [x] T2.02 Invitado: cabecera con insignia y ventana, aviso de navegador, formulario, recordar nombre/ciudad, 409, sala, sondeo de 60 s · 497eb50
- [x] T2.03 Sala: `RtkMeeting` con audio/video apagados para invitados, `showSetupScreen=false`, `roomLeft` → «Saliste…», Wake Lock · 497eb50
- [x] T2.04 Anfitrión: clave, pestañas Sala/Diagnóstico, entrar con un toque tras recargar, cerrar sesión · 497eb50
- [x] T2.05 Diagnóstico: ✅ ⚠️ ❌, «Volver a comprobar», «Crear la reunión», «Copiar» · 497eb50
- [x] T2.06 `i18n/es.ts` y su prueba · 497eb50 · `i18n.test.ts`
- [x] T2.07 `styles.css` (≥ 18 px, botones ≥ 48 px, contraste AA, foco visible) · 497eb50
- [x] T2.08 `scripts/demo.mjs` (wrangler dev real) y `scripts/notices.mjs` · 497eb50
- [x] T2.09 Playwright: escenario 13 (pasos 1–10) · 497eb50 · `escenario.spec.ts`, `demo.spec.ts`
- [x] T2.10 axe-core + 360 px + tamaños mínimos · 497eb50 · `a11y.spec.ts`
- [x] T2.11 `dist/` sin secretos sintéticos · 497eb50 · `tests/compilado/secretos.test.mjs`

## Fase 3 · Auditoría, despliegue, ensayo y cierre (lista de verificación)
- [x] Autoauditoría perspectivas 1 (alcance) y 4 (operación)
- [x] Revisión independiente perspectivas 2 y 3 (subagente general con modelo Opus siguiendo `auditor-independiente.md`) y corrección de hallazgos
- [x] `docs/DESPLIEGUE.md`, `docs/ENSAYO.md`, `docs/OPERACION_SABADO.md`
- [x] `README.md` final y `THIRD_PARTY_NOTICES.md`
- [x] Instalación y pruebas desde un clon limpio
- [ ] Sesión corta en Claude Code sobre `JESC65/myzoom`: `preflight --push` y comandos de `docs/VERIFICACION.md` (la hace Javier)
