# Despliegue de MyZoom en Cloudflare

Para Javier. Cada paso termina con **¿Cómo sé que salió bien?**. Tiempo total: unos 60 minutos la primera vez.

> **Aviso honesto sobre los nombres de pantallas.** La sesión que escribió esto no pudo abrir la documentación de Cloudflare (la red lo bloqueaba). Los nombres de menús son los que Cloudflare usaba a la fecha de corte del modelo. Si en tu panel un botón se llama distinto, busca la palabra clave que va entre comillas (por ejemplo «Realtime», «Variables and Secrets»): el concepto es el mismo.

## 0. Antes de empezar

- Cuenta de Cloudflare (gratuita sirve para empezar) y acceso de administrador.
- El repositorio `JESC65/myzoom` en GitHub con este código.
- Una clave de anfitrión inventada por ti, de **20 o más caracteres** (no hay límite de intentos, D-010). Ejemplo de forma: tres palabras y un número, `limon-campana-81-pizarra`.
- Un código de invitación de 8 a 12 caracteres, sin espacios, por ejemplo `sanantonio81`.

**Costo.** RealtimeKit cobra por minuto de participante. Consumo previsto: *conexiones × minutos* = 21 × 420 = **8 820 minutos de participante** (seis horas de evento y una de ensayo). Revisa la cuota gratuita y el precio vigente en la página de precios de RealtimeKit (developers.cloudflare.com → Realtime → RealtimeKit → Pricing). Esta guía **no afirma** que entre en la cuota gratuita: compruébalo tú.

## 1. Crear el token de API con permiso de RealtimeKit

1. En el panel de Cloudflare, arriba a la derecha, tu perfil → «My Profile» → «API Tokens» → «Create Token».
2. Elige «Create Custom Token».
3. Nombre: `myzoom-realtimekit`.
4. Permisos: «Account» → busca «Realtime» → nivel «Admin» (si ves «Realtime Admin» o «RealtimeKit», elige ese; necesita leer y escribir reuniones y participantes).
5. «Account Resources»: solo tu cuenta. Sin fecha de vencimiento anterior al lunes 23.
6. «Continue to summary» → «Create Token». **Copia el token ahora** (se muestra una sola vez) y guárdalo en un lugar seguro, no en WhatsApp.

**¿Cómo sé que salió bien?** El token aparece en la lista «API Tokens» como activo. Su valor solo lo tienes tú.

## 2. Crear la aplicación de RealtimeKit

1. En el panel, menú izquierdo: «Realtime» → «RealtimeKit».
2. «Create App» (o «Create application»), nombre `MyZoom Promo 81`.
3. Anota el **App ID** que aparece.
4. Anota también tu **Account ID**: está en la página principal de tu cuenta (columna derecha, «Account ID») o en la dirección del navegador (`dash.cloudflare.com/<ACCOUNT_ID>/…`).

**¿Cómo sé que salió bien?** Ves la aplicación en la lista de RealtimeKit con su App ID.

## 3. Revisar los presets (perfiles de permisos)

Dentro de la aplicación → «Presets». Cloudflare crea presets por defecto; normalmente `group_call_host` y `group_call_participant`. MyZoom necesita dos:

| Preset | Para | Debe permitir | No debe permitir |
|---|---|---|---|
| Invitado (por ejemplo `group_call_participant`) | Compañeros remotos | Producir audio y video, chat | Fijar a otros, silenciar a otros, expulsar, sala de espera, compartir pantalla (opcional) |
| Anfitrión (por ejemplo `group_call_host`) | Laptop del salón | Todo lo del invitado + fijar (pin), silenciar a otros, expulsar | Sala de espera |

Busca en cada preset las opciones con nombres parecidos a «Can produce audio/video», «Chat», «Pin participant», «Mute participants», «Kick participants», «Waiting room». **Desactiva la sala de espera** en ambos: si queda activa, los invitados se quedan esperando.

Anota el **nombre exacto** de cada uno (mayúsculas y guiones bajos incluidos).

**¿Cómo sé que salió bien?** En el paso 6, el Diagnóstico mostrará ✅ en «Preset PRESET_GUEST» y «Preset PRESET_HOST». Si pones mal un nombre, te mostrará la lista de los que existen.

## 4. Publicar el Worker

### Opción A (recomendada): Workers Builds conectado a GitHub

1. Panel → «Workers & Pages» → «Create» → «Import a repository» (o «Connect to Git»).
2. Autoriza GitHub y elige `JESC65/myzoom`, rama `main`.
3. Configuración de compilación:
   - Project name: `myzoom`
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/` (vacío)
   - Si pide versión de Node: `22` (también está en `.nvmrc`).
4. «Save and Deploy». La primera compilación tarda 2 a 4 minutos.

**Importante:** desde ahora **cada fusión en `main` publica de nuevo**. Por eso existe el congelamiento (paso 9).

### Opción B: desde tu PC con Windows 11

1. Instala Node.js LTS (nodejs.org) y Git. Abre «Terminal».
2. `git clone https://github.com/JESC65/myzoom.git` y `cd myzoom`
3. `npm ci`
4. `npm run build`
5. `npx wrangler login` (se abre el navegador; acepta).
6. `npx wrangler deploy`

**¿Cómo sé que salió bien?** Al final aparece una dirección `https://myzoom.<tu-subdominio>.workers.dev`. Si abres `…/api/estado` verás algo como `{"abierto":false,…,"modo":"real"}`. Si dice `"modo":"ensayo"`, algo está mal: `MOCK_RTK` debe ser `false` (lo fija `wrangler.jsonc`).

## 5. Cargar secretos y variables

Panel → «Workers & Pages» → `myzoom` → «Settings» → «Variables and Secrets» → «Add».

**Secretos** (tipo «Secret»; no se vuelven a mostrar):

| Nombre | Valor |
|---|---|
| `CF_API_TOKEN` | El token del paso 1 |
| `HOST_SECRET` | Tu clave de anfitrión (20+ caracteres) |
| `INVITE_CODE` | Tu código de invitación (6+ caracteres) |

**Variables** (tipo «Text»):

| Nombre | Valor de ejemplo |
|---|---|
| `CF_ACCOUNT_ID` | Tu Account ID (paso 2) |
| `RTK_APP_ID` | El App ID (paso 2) |
| `RTK_MEETING_ID` | **Déjala sin crear por ahora** (paso 6) |
| `PRESET_GUEST` | `group_call_participant` (el nombre exacto del paso 3) |
| `PRESET_HOST` | `group_call_host` |
| `EVENT_OPENS_AT` | Para el ensayo: `2026-11-20T00:00:00-05:00` |
| `EVENT_CLOSES_AT` | `2026-11-22T06:00:00-05:00` |
| `HOST_DISPLAY_NAME` | `Salón · Promoción 81` (opcional) |

No crees `FALLBACK_URL` todavía. No toques `MOCK_RTK`. Pulsa «Deploy» o «Save» al terminar: cada cambio crea una versión nueva en segundos.

`wrangler.jsonc` tiene `keep_vars: true`: los despliegues desde GitHub **no borran** estas variables. Los secretos nunca se tocan al desplegar.

**¿Cómo sé que salió bien?** `…/api/estado` muestra `"abierto":true` si ya estás dentro de la ventana.

## 6. Diagnóstico y creación de la reunión

1. Abre `https://myzoom.<tu-subdominio>.workers.dev/anfitrion` en Chrome.
2. Escribe la clave → «Entrar como anfitrión» → pestaña **Diagnóstico**.
3. Verás «Reunión ❌ Todavía no hay reunión» y el botón **«Crear la reunión»**. Púlsalo **una sola vez**.
4. Aparece el identificador con el botón «Copiar». Cópialo.
5. En Cloudflare, agrega la variable de texto `RTK_MEETING_ID` con ese valor y guarda.
6. Vuelve al Diagnóstico → «Volver a comprobar».

**¿Cómo sé que salió bien?** Todas las filas en ✅, salvo «Ventana horaria» (⚠️ si aún no abre) y «Modo: real». El enlace de invitación aparece con «Copiar enlace para WhatsApp».

## 7. Primera llamada real entre dos redes

1. Laptop en el wifi de tu casa: `/anfitrion` → pestaña Sala → «Entrar a la sala». Acepta cámara y micrófono.
2. Tu celular **con datos móviles** (wifi apagado): abre el enlace de invitación en Chrome o Safari, escribe nombre y ciudad, «Entrar a la reunión».
3. Comprueba: te ves y te oyes en ambos sentidos al activar el micrófono del celular; el chat funciona; desde la laptop puedes fijar al celular.
4. En el panel de Cloudflare → `myzoom` → «Logs» (o «Observability»), busca líneas `[rtk]`. **No debe haber errores** de `addParticipant`. Si ves `expires_on rejected`, la entrada igual funciona (D-002), pero cuéntalo en la sesión corta.
5. En la laptop, abre las herramientas del navegador (F12) → «Console»: no debe haber errores rojos que digan «Content Security Policy». Si los hay, cópialos para la sesión corta (D-009).

**¿Cómo sé que salió bien?** Audio y video en ambos sentidos entre dos redes distintas, sin errores `[rtk]` ni de CSP.

## 8. Activar y desactivar el respaldo

- **Preparar:** crea una sala en otro servicio (Google Meet, Jitsi, Zoom) y copia su enlace `https://…`.
- **Activar:** en Cloudflare agrega la variable de texto `FALLBACK_URL` con ese enlace y guarda.
- **Rige:** en segundos (espera 1 minuto). Compruébalo: `…/api/estado` dice `"respaldo":true` y el enlace de invitación te lleva a la sala de respaldo.
- **Qué pasa con quien ya estaba dentro:** en menos de un minuto ve el aviso rojo «Nos cambiamos de sala. Toca aquí…». Igual manda por WhatsApp: «Salgan de la sala y vuelvan a abrir el mismo enlace».
- **Desactivar:** borra `FALLBACK_URL` (o déjala vacía) y guarda.
- `/anfitrion` sigue funcionando con el respaldo activo.

## 9. Congelar

**Desde el viernes 20 a las 18:00 (hora de Lima) no se fusiona nada en `main`.** Con Workers Builds, cada fusión publica de nuevo. Si hay que cambiar algo el sábado, solo variables en el panel (respaldo, fechas), nunca código.

## 10. Para el sábado

Cambia `EVENT_OPENS_AT` a la hora real (por ejemplo `2026-11-21T08:00:00-05:00`) después del ensayo, o déjala abierta desde el viernes: no hay riesgo en abrir antes. Revisa el Diagnóstico la mañana del sábado.
