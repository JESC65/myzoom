# MyZoom · Encargo de construcción de la sala virtual de la Promoción 81

**Versión 1.0 · 19 de noviembre de 2026 · Javier Salazar · Proyecto personal para la reunión del sábado 21 de noviembre**

> **Privado.** Este archivo vive solo en el repositorio privado `JESC65/myzoom`. Nada de su contenido se publica ni se pega en servicios externos. Los compañeros solo ven los textos de interfaz que este encargo ordena mostrar.

Este archivo es un encargo autocontenido para una herramienta de IA que programa con acceso a archivos, terminal y red, como Claude Code en la nube. Dice qué construir, con qué reglas, cómo demostrar que funciona, cómo dejar el trabajo anotado para que otra sesión —u otro modelo— lo retome sin empezar de cero y qué hacer cuando algo falla. Hereda la disciplina de trabajo que funcionó en PromoConnect —herramientas del kit, bitácora, relevos por tramos y auditoría independiente—, pero el producto es pequeño a propósito: **una sala, dos roles y la interfaz estándar de Cloudflare RealtimeKit**. Reemplaza por completo al plan de Gemini del 18 de noviembre y aplica las correcciones de la auditoría del mismo día.

## Cómo usarlo

Esto es el resumen. La preparación completa —cada clic, cómo comprobar que salió bien, qué escribir en cada relevo, cómo publicar en Cloudflare y cómo ensayar— está en la **Guía de preparación** (`MYZOOM_Guia_Preparacion_v1.md`), que se queda contigo y no va al repositorio.

1. **El repositorio.** Crea en GitHub el repositorio privado `JESC65/myzoom`, vacío, y dale acceso a la Claude GitHub App. Sube el contenido del kit (`MYZOOM_Kit_Repositorio_v1.zip`) tal como viene:

   ```text
   MYZOOM_Encargo_Agente_v1.md           ← este archivo, en la raíz (en la Fase 0 pasa a docs/ENCARGO.md)
   README.md
   config-inicial/claude-settings.json   ← permisos, variables y gancho; se instala como .claude/settings.json (anexo D)
   config-inicial/gitignore.txt          ← se instala como .gitignore
   config-inicial/agents/Explore.md      ← subagente de búsqueda, con Haiku; se instala en .claude/agents/
   config-inicial/agents/auditor-independiente.md ← subagente de auditoría, con Opus; se instala en .claude/agents/
   config-inicial/kit-manifest.json      ← la huella SHA-256 de cada archivo del kit
   scripts/preflight.mjs                 ← verificación previa del entorno, sin Docker ni PostgreSQL (anexo E)
   scripts/run.mjs                       ← ejecuta comandos largos sin que la sesión se cuelgue (anexo E)
   scripts/ayuda.mjs                     ← reúne lo necesario para pedir ayuda, sin secretos (anexo E)
   scripts/session-start.mjs             ← muestra dónde quedó el trabajo al abrir cada sesión (anexo E)
   tests/kit/herramientas.test.mjs       ← pruebas de esas cuatro herramientas
   docs/spec/San_Antonio_Insignia.jpeg   ← insignia del colegio para la cabecera
   ```

   El kit no trae archivos cuyo nombre empiece con punto: la subida por la web de GitHub puede rechazarlos, y la verificación previa los instala. No subas el plan de Gemini ni la auditoría: sus decisiones ya están resueltas aquí, y dos fuentes distintas confunden al agente.

2. **El entorno en la nube.** Sirve el mismo entorno `PromoConnect` de claude.ai/code. Solo agrega `developers.cloudflare.com` a **Allowed domains**, para que el agente pueda leer la documentación oficial de RealtimeKit. No hace falta Docker, PostgreSQL ni FFmpeg. **No pongas ninguna clave de Cloudflare en el entorno**: el agente construye y prueba sin ellas; las claves viven solo en Cloudflare.

3. **La verificación previa, con Opus y esfuerzo bajo.** Sesión nueva sobre `JESC65/myzoom`, rama `main`, entorno `PromoConnect`, modelo **Opus**, modo **Auto**; envía `/effort low` y después:

   > «Ejecuta node scripts/preflight.mjs --push y explícame el resultado en palabras simples. Dime también si tienes disponibles los subagentes Explore y auditor-independiente. No empieces el encargo.»

   La primera vez instala la configuración y los subagentes; repite en una sesión nueva hasta que el veredicto de `docs/PREFLIGHT.md` diga ✅ o ⚠️.

4. **La construcción, por tramos.** Cuatro fases en tres tramos cortos. Cada tramo termina con una parada limpia (sección 10.1):

   | Tramo | Fases | Modelo | Esfuerzo | Sesión |
   |---|---|---|---|---|
   | 1a | 0 · Reconocimiento y tareas atómicas | Opus | Alto (`/effort high`) | Nueva |
   | 1b | 1 · Worker, contratos y seguridad | Opus | Alto (`/effort high`) | La misma |
   | 2 | 2 · Pantallas con el UI Kit, modo ensayo y pruebas de interfaz | Sonnet | Alto (`/effort high`) | Nueva |
   | 3 | 3 · Auditoría independiente, despliegue, ensayo y manual del sábado | Opus | Alto (`/effort high`) | Nueva |

   El primer mensaje, en sesión nueva con Opus y `/effort high`:

   > «Lee MYZOOM_Encargo_Agente_v1.md completo, desde INICIO DEL ENCARGO hasta FIN DEL ENCARGO, y ejecútalo desde la Fase 0 hasta cerrar la Fase 0; luego detente con el informe de parada.»

5. **Para retomar**, en una sesión nueva con el modelo y el esfuerzo del tramo:

   > «Lee AGENTS.md y docs/ESTADO.md, sigue el protocolo de reanudación y ejecuta desde la Fase N hasta cerrar la Fase M; luego detente con el informe de parada.»

6. **Si algo falla y el mensaje no se entiende:**

   > «Ejecuta node scripts/ayuda.mjs --push y explícame en palabras simples qué pasó y qué debo hacer.»

## Lo que conviene que sepas

- **Menos funciones, más estabilidad.** El sábado se usa la interfaz estándar de RealtimeKit (`RtkMeeting`), con sus propios controles de cámara, micrófono, participantes, chat, fijar participante y ajustes de dispositivos (`RtkSettings`). Lo propio de MyZoom es poco: la puerta de entrada, la separación de roles en el servidor, la ventana horaria del evento, el enlace de respaldo y una página de diagnóstico. Todo lo demás es del proveedor, que ya está probado por miles de usuarios.
- **Lo que se retiró del plan de Gemini, y por qué.** La grabación con OBS (decisión tuya: no hay tiempo para ensayarla). La ventana especial para la TV que compartía el video entre pestañas (añadía ventanas, recargas y sincronización sin prototipo). El selector propio de dispositivos y el medidor de voz (ya existen en el SDK). La cola propia de manos levantadas y el «modo en traslado» con estado en el servidor (si el UI Kit trae chat y mano levantada, bastan; si no, el chat y la voz del anfitrión bastan). La PWA y R2. Ninguna de esas piezas impide la reunión; todas podían romperla.
- **La credencial se emite al entrar.** El enlace de WhatsApp lleva un código de invitación reutilizable, no un token. Cada vez que alguien entra o recarga la página, el servidor emite una credencial nueva que vence al cierre del evento (`EVENT_CLOSES_AT`). Fuera de la ventana del evento no se emite ninguna. Así no hay token del miércoles que venza el sábado.
- **El respaldo funciona al volver a abrir el enlace.** Si MyZoom falla, defines `FALLBACK_URL` en Cloudflare y el mismo enlace de WhatsApp lleva a la sala de respaldo. Quien ya estaba dentro debe salir y volver a abrir el enlace: así se escribe en el aviso preparado, y así se ensaya el viernes.
- **El agente no tiene claves de Cloudflare.** Construye y prueba con un modo de ensayo (`MOCK_RTK`) que simula la API, y deja un procedimiento de despliegue exacto. La primera llamada real la haces tú, entre dos redes, en cuanto publiques. La página de diagnóstico del anfitrión te dice, en español, si cada variable, la reunión y los perfiles de permisos (presets) están bien.
- **El salón es una sola conexión.** La laptop del salón entra como anfitrión, con su cámara, su micrófono y la salida de audio hacia el televisor por HDMI. Los asistentes locales no se conectan con sus teléfonos a la sala (eso traería eco). Se esperan unas 20 conexiones remotas como máximo, más la del salón.
- **Hay cosas que solo tú puedes hacer:** crear la cuenta y la aplicación de RealtimeKit, el token de API, configurar los presets, publicar el Worker, hacer la primera llamada real, ensayar con el equipo del salón y con varios compañeros, preparar la sala de respaldo y decidir el viernes a las 18:00 qué sistema se usa. El informe final te los lista en orden.
- **Nada se paga ni se publica sin ti.** El agente no crea cuentas, no contrata servicios, no despliega y no sube datos fuera de tu repositorio.

---

# INICIO DEL ENCARGO

## 0. Cómo leer este encargo

- **Debe** significa obligatorio; **puede**, opcional a tu criterio; **no**, prohibido.
- **Orden.** Las secciones 1 a 3 dicen qué se construye; las 4 a 8, cómo debe ser; las 10 a 15, cómo trabajar, cómo dejar rastro y cómo demostrarlo. Los anexos reúnen fuentes, glosario, plantillas, la configuración de Claude Code, las herramientas del kit y el plan de relevos. No hay sección 9: se reservó para mantener la misma numeración que las herramientas del kit esperan (10 a 15).
- **Jerarquía de fuentes.** (1) Este encargo. (2) La documentación oficial de Cloudflare RealtimeKit y Workers (anexo A), para nombres exactos de paquetes, rutas, propiedades y límites. (3) Las decisiones registradas con evidencia en `docs/DECISIONES.md`.
- **Si dos reglas chocan**, prevalecen en este orden: (1) **estabilidad del sábado**: ante la duda, la opción con menos piezas propias; (2) seguridad de acceso y no escalamiento de rol; (3) veracidad: nada se declara sin ejecutar; (4) continuidad del trabajo (sección 11); (5) simplicidad para compañeros de 61 años; (6) todo lo demás.
- **La documentación oficial manda en los detalles.** Donde este encargo nombra un paquete, una propiedad o un campo de la API de RealtimeKit, compruébalo en la fuente oficial antes de usarlo. Si difiere, sigue la fuente, aplica el cambio mínimo y regístralo en `docs/DECISIONES.md`. Nunca inventes una propiedad que no encontraste documentada o en los tipos del paquete instalado.
- **Lo decidido no se pregunta.** Los valores de la sección 2 y el alcance de la sección 3 están resueltos. Ampliar el alcance está prohibido aunque sobre tiempo: si sobra, se usa en pruebas y documentación.
- **Este archivo no se edita.** En la Fase 0, muévelo a `docs/ENCARGO.md` con `git mv`. Si más adelante aparece en la raíz otro archivo de encargo, es una versión nueva que subí yo: compárala con `docs/ENCARGO.md`, muévela a ese lugar con `git mv -f`, aplica lo que cambió y anótalo en `docs/DECISIONES.md`.
- **Idiomas.** Interfaz, mensajes de error y documentación en español del Perú; identificadores, rutas de la API y comentarios de código en inglés breve, con el glosario del anexo B.

## 1. Misión

Eres el ingeniero responsable de entregar una sala de videollamada web pequeña, estable, probada y lista para que yo la publique en Cloudflare Workers.

**Quién pide y para qué.** Soy Javier Salazar, ingeniero electrónico en Lima, Perú. El sábado 21 de noviembre de 2026 la Promoción 81 del Colegio San Antonio se reúne: misa, almuerzo y otras actividades, unas seis horas en total. Algunos compañeros, varios en el extranjero, no podrán asistir y quieren verlo en vivo y, sobre todo, enviar su saludo en vivo. En el salón habrá una laptop conectada por HDMI a un televisor. Las cuentas gratuitas de los servicios comerciales cortan las reuniones grupales; por eso MyZoom.

**El encargo está terminado cuando se cumplen cuatro condiciones:**

1. **Funciona de punta a punta en modo ensayo.** `npm run demo` levanta el sistema local con `MOCK_RTK=true` y deja recorrer la entrada de invitado, la del anfitrión, la ventana horaria, el respaldo y el diagnóstico; y `npm run build` produce lo que `wrangler deploy` publica.
2. **La seguridad está verificada.** Pasan las pruebas de que un invitado no puede obtener el preset de anfitrión de ninguna forma, de la comparación en tiempo constante del código y de la clave, de la cookie del anfitrión, de la ventana horaria y de la redirección de respaldo.
3. **La integración real está preparada y es diagnosticable.** El cliente de la API de RealtimeKit sigue la documentación oficial y está probado contra respuestas simuladas con la forma documentada; la página de diagnóstico dice en español qué falta cuando algo no está configurado.
4. **Todo lo declarado está ejecutado y anotado**, y existen `docs/DESPLIEGUE.md`, `docs/ENSAYO.md` y `docs/OPERACION_SABADO.md`, escritos para que yo los siga sin ayuda. Cualquier sesión retoma desde `docs/ESTADO.md` sin preguntar nada.

### Seis principios

1. **Lo del proveedor antes que lo propio.** Si RealtimeKit ya lo hace, no se reprograma. Cada línea propia es una línea que puede fallar el sábado.
2. **Cero fricción a los 61 años.** El compañero no crea cuenta ni instala nada: abre el enlace de WhatsApp, escribe su nombre y su ciudad, toca un botón grande y está dentro.
3. **El salón protegido por defecto.** Todo invitado entra con cámara y micrófono apagados. Puede escuchar y ver aunque niegue los permisos de cámara y micrófono.
4. **El servidor decide los roles.** El navegador nunca elige su preset. Ser anfitrión exige la clave del anfitrión, comprobada en el servidor.
5. **Siempre hay salida.** Si algo falla, el mismo enlace lleva a la sala de respaldo con un cambio de variable en Cloudflare, sin desplegar código.
6. **Nada declarado sin ejecutar.** Toda prueba corre con `node scripts/run.mjs -- <comando>`, y lo que no se pudo probar aquí se escribe como **no ejecutado**, con quién y cómo debe probarlo.

## 2. Parámetros decididos

| Parámetro | Valor |
|---|---|
| Producto | **MyZoom · Promoción 81** (texto visible: «Promoción 81 · Reunión virtual») |
| Repositorio | `JESC65/myzoom`, privado |
| Plataforma | Un único Worker de Cloudflare con **Workers Static Assets**: la API (`/api/*`) y la aplicación compilada en el mismo origen, configurado con `wrangler.jsonc` |
| Audio y video | **Cloudflare RealtimeKit**, interfaz estándar del UI Kit: `@cloudflare/realtimekit-react` y `@cloudflare/realtimekit-react-ui` (comprueba los nombres en el anexo A) |
| Interfaz | React + TypeScript estricto + Vite. Dos rutas: `/` (invitado) y `/anfitrion` (laptop del salón). Estilos propios solo en las pantallas de entrada y diagnóstico |
| Base de datos | **Ninguna.** Una sola reunión fija (`RTK_MEETING_ID`). El Worker no guarda estado entre peticiones |
| Pruebas | Vitest para la lógica y las rutas del Worker; Playwright con Chromium para las pantallas en modo ensayo; axe-core para accesibilidad de las pantallas propias |
| Navegadores objetivo | Invitados: Chrome y Safari recientes en Android, iPhone y escritorio. Anfitrión: Chrome o Edge en la laptop del salón |
| Capacidad prevista | Hasta 20 invitados remotos simultáneos más la conexión del salón; unas 6 horas el sábado y 1 hora de ensayo el viernes |
| Zona horaria | `America/Lima` (UTC−5, sin horario de verano) para todo texto visible |
| Despliegue | Lo hago yo, desde el panel de Cloudflare conectado a GitHub (Workers Builds) o desde mi PC con `npx wrangler deploy`. El agente deja ambos procedimientos |

## 3. Alcance

### 3.1 Lo que se construye

1. **Entrada de invitado** (`/`): nombre y ciudad, botón grande, sala estándar con cámara y micrófono apagados al entrar.
2. **Entrada del anfitrión** (`/anfitrion`): clave del anfitrión, cookie de sesión hasta el cierre del evento, sala estándar con permisos de anfitrión.
3. **Ventana horaria del evento**: credenciales solo entre `EVENT_OPENS_AT` y `EVENT_CLOSES_AT`, y con vencimiento en `EVENT_CLOSES_AT`.
4. **Respaldo**: con `FALLBACK_URL` definido, la entrada de invitados redirige allí; las rutas del anfitrión siguen funcionando.
5. **Diagnóstico** (dentro de `/anfitrion`): estado de cada variable, de la reunión y de los presets, en español; y, si falta la reunión, un botón para crearla.
6. **Modo ensayo** (`MOCK_RTK=true`): todo lo anterior sin Cloudflare, para las pruebas y para `npm run demo`.
7. **Textos en español** en las pantallas propias y, mediante el mecanismo de idioma del UI Kit, en los textos visibles de la sala.
8. **Documentos de operación**: `docs/DESPLIEGUE.md`, `docs/ENSAYO.md` y `docs/OPERACION_SABADO.md` (sección 8).

### 3.2 Fuera de alcance (prohibido construirlo en esta versión)

Grabación de cualquier tipo; integración con OBS; ventana o ruta especial para la TV; compartir `MediaStream` entre pestañas; selector propio de dispositivos; medidor de voz propio; cola propia de manos levantadas; «modo en traslado» con estado en el servidor; base de datos, KV, Durable Objects o R2; PWA, trabajador de servicio e instalación; cuentas de usuario; varias salas; migración automática de sesiones al respaldo; generador de carga propio. Si una de estas ideas te parece necesaria, anótala en `docs/DECISIONES.md` como «después del sábado» y sigue.

### 3.3 Lo que solo se puede probar fuera de la sesión

Una llamada real entre dos redes; el sonido en iPhone y Android físicos; el navegador interno de WhatsApp; la salida HDMI y el eco del salón; unas 20 conexiones simultáneas; la reconexión tras un corte de red real. Para cada una, `docs/ENSAYO.md` trae los pasos exactos y el resultado esperado. En `docs/VERIFICACION.md` figuran como **no ejecutadas aquí**, con su motivo.

## 4. El Worker (`src/worker/`)

### 4.1 Configuración

Secretos —se definen en Cloudflare como *Secret*, nunca en el repositorio—:

| Nombre | Qué es |
|---|---|
| `CF_API_TOKEN` | Token de API de Cloudflare con el permiso de RealtimeKit (Realtime Admin, según la documentación vigente) |
| `HOST_SECRET` | Clave del anfitrión. Mínimo 12 caracteres; el Worker la rechaza más corta |
| `INVITE_CODE` | Código de invitación que viaja en el enlace de WhatsApp. Mínimo 6 caracteres |

Variables —se definen en Cloudflare como texto; ninguna es secreta—:

| Nombre | Valor por defecto | Qué es |
|---|---|---|
| `CF_ACCOUNT_ID` | — | Identificador de la cuenta de Cloudflare |
| `RTK_APP_ID` | — | Identificador de la aplicación de RealtimeKit |
| `RTK_MEETING_ID` | — | Identificador de la reunión fija; vacío hasta crearla desde el diagnóstico |
| `PRESET_GUEST` | — | Nombre exacto del preset de invitado, leído en el diagnóstico |
| `PRESET_HOST` | — | Nombre exacto del preset de anfitrión, leído en el diagnóstico |
| `EVENT_OPENS_AT` | — | Inicio de la ventana, ISO 8601 con desfase, por ejemplo `2026-11-19T00:00:00-05:00` |
| `EVENT_CLOSES_AT` | — | Cierre de la ventana, por ejemplo `2026-11-22T06:00:00-05:00` |
| `FALLBACK_URL` | vacío | Sala de respaldo, `https://…`; vacío significa sin respaldo activo |
| `HOST_DISPLAY_NAME` | `Salón · Promoción 81` | Nombre con que aparece la laptop del salón |
| `MOCK_RTK` | `false` | `true` solo en `.dev.vars` y en las pruebas |

- Una variable **ausente** y una **vacía** significan lo mismo (el panel de Cloudflare puede no admitir valores vacíos): sin reunión creada, sin respaldo, o el valor por defecto de la tabla.
- `wrangler.jsonc` **no** define estas variables, salvo `MOCK_RTK: "false"`, y debe usar la opción que conserva las variables definidas en el panel al desplegar (`keep_vars`, compruébala en el anexo A): así un despliegue desde GitHub nunca borra lo que configuré en Cloudflare. Registra en `docs/DECISIONES.md` lo que comprobaste.
- `.dev.vars.example` (sin valores reales) documenta todas las anteriores para el modo ensayo; `.dev.vars` está en `.gitignore`.
- Toda la configuración se valida en un solo módulo (`src/worker/config.ts`), que devuelve una lista de problemas en español en lugar de lanzar errores sueltos. Las rutas usan esa validación: si falta algo, responden `503` con un mensaje amable para el invitado y el detalle solo en el diagnóstico.

### 4.2 Contrato con la API de RealtimeKit (`src/worker/rtk.ts`)

Base: `https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/realtime/kit/{RTK_APP_ID}`, con `Authorization: Bearer {CF_API_TOKEN}` y `Content-Type: application/json`. Antes de escribir el cliente, comprueba en la referencia oficial (anexo A) las rutas, los campos y la forma de la respuesta, y guarda en `tests/worker/fixtures/` ejemplos de respuesta con la forma documentada.

| Operación | Petición (comprobar en la fuente) | Uso |
|---|---|---|
| Agregar participante | `POST /meetings/{RTK_MEETING_ID}/participants` con `name`, `preset_name`, `custom_participant_id` y vencimiento `expires_on` | Emitir la credencial (`authToken`) al entrar |
| Ver reunión | `GET /meetings/{RTK_MEETING_ID}` | Diagnóstico: existe y su estado |
| Crear reunión | `POST /meetings` con `title: "Promoción 81 · Reunión virtual"` | Diagnóstico, solo si `RTK_MEETING_ID` está vacío |
| Listar presets | `GET /presets` | Diagnóstico: comprobar que `PRESET_GUEST` y `PRESET_HOST` existen |

- `custom_participant_id`: `guest-<uuid aleatorio>` o `host-<uuid aleatorio>`, generado en el servidor. Nunca un dato personal.
- `expires_on`: siempre `EVENT_CLOSES_AT`. La documentación dice que la vigencia no puede pasar de 100 días y que quien ya está conectado no es expulsado al vencer, pero no puede reconectar con una credencial vencida: por eso el cliente pide una credencial nueva en cada entrada y recarga.
- Cada llamada tiene un límite de 10 segundos y, ante un error de red o un `5xx`, **un** reintento tras 1 segundo. Un `4xx` no se reintenta.
- Los errores de Cloudflare se traducen a mensajes en español y se registran con `console.error` sin el token ni el cuerpo completo de la respuesta.
- En modo ensayo, `rtk.ts` no llama a la red: devuelve `authToken: "mock-<uuid>"` y respuestas simuladas para el diagnóstico.

### 4.3 Rutas

| Ruta | Quién | Qué hace |
|---|---|---|
| `GET /` , `GET /?c=CODIGO` | Invitado | Si `FALLBACK_URL` es una URL `https://` válida: `302` hacia ella, con `Cache-Control: no-store` y **sin** reenviar el código ni la consulta. Si no: sirve la aplicación |
| `GET /anfitrion` | Anfitrión | Sirve la aplicación. Nunca redirige al respaldo |
| `GET /api/estado` | Todos | `{ abierto, abreEn, cierraEn, respaldo: boolean, modo: "real" \| "ensayo" }`. Sin datos sensibles. `no-store` |
| `POST /api/entrar` | Invitado | Recibe `{ nombre, ciudad, codigo }`. Valida y emite la credencial de invitado (sección 4.4) |
| `POST /api/anfitrion/entrar` | Anfitrión | Recibe `{ clave }`. Si coincide, fija la cookie del anfitrión (sección 4.5) y responde `{ ok: true }` |
| `POST /api/anfitrion/credencial` | Anfitrión con cookie | Emite la credencial con `PRESET_HOST` y `HOST_DISPLAY_NAME` |
| `POST /api/anfitrion/salir` | Anfitrión | Borra la cookie |
| `GET /api/anfitrion/diagnostico` | Anfitrión con cookie | Lista de comprobaciones (sección 4.7) |
| `POST /api/anfitrion/crear-reunion` | Anfitrión con cookie | Solo si `RTK_MEETING_ID` está vacío: crea la reunión y devuelve su identificador para copiarlo en Cloudflare |

- Toda respuesta de `/api/*` lleva `Cache-Control: no-store` y `Content-Type: application/json; charset=utf-8`. Los mensajes de error van en un campo `error`, en español.
- Las rutas `POST` aceptan solo `application/json`, cuerpos de hasta 2 KB, y comprueban que la cabecera `Origin`, si viene, sea el propio origen.
- Cualquier otra ruta de la API responde `404` en JSON; cualquier otra ruta de página sirve la aplicación.

### 4.4 Entrada del invitado y ventana horaria (`POST /api/entrar`)

1. Si la hora actual es anterior a `EVENT_OPENS_AT`: `403` con «La reunión todavía no empieza. Se abre el {fecha y hora de Lima}.». Si es posterior a `EVENT_CLOSES_AT`: `403` con «La reunión ya terminó. ¡Gracias por acompañarnos!».
2. `codigo` se compara con `INVITE_CODE` **en tiempo constante** (sobre resúmenes SHA-256 de igual longitud). Si no coincide: `403` con «El enlace no es válido. Pide el enlace actualizado en el grupo de la promoción.».
3. `nombre` (2 a 60 caracteres) y `ciudad` (2 a 50) se recortan, se les quitan caracteres de control y se normalizan a NFC. Si no cumplen: `400` con el campo que falta, en español.
4. **Seguridad innegociable:** el preset es siempre `PRESET_GUEST`. Cualquier campo `preset`, `preset_name`, `role`, `isHost` o similar en el cuerpo se ignora; una prueba lo demuestra.
5. Nombre visible: `"{nombre} · {ciudad}"`.
6. Respuesta: `{ authToken, nombreVisible, modo }`. El token no se registra en ningún lugar del servidor.

### 4.5 La cookie del anfitrión

- Nombre `__Host-myzoom_host`, con `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` y `Expires` igual a `EVENT_CLOSES_AT`. En desarrollo local sobre `http://localhost`, si Chromium no la acepta, usa una variante documentada solo para modo ensayo y regístralo.
- Su valor es `v1.{vencimiento}.{firma}`, con firma HMAC-SHA-256 (Web Crypto) del vencimiento con una clave derivada de `HOST_SECRET`. Cambiar `HOST_SECRET` invalida todas las cookies.
- La clave del anfitrión se compara en tiempo constante. Tras 5 intentos fallidos desde una misma IP en 10 minutos puedes responder `429` usando la capacidad de limitación de Workers si existe sin almacenamiento propio; si no, no lo construyas y anota el riesgo (la clave larga lo mitiga).
- Nunca se guarda la clave en el navegador (`localStorage`, `sessionStorage`) ni en la URL.

### 4.6 Respaldo

- `FALLBACK_URL` se valida: solo `https://`, sin credenciales en la URL. Si es inválida, se ignora y el diagnóstico lo muestra en rojo.
- La redirección se aplica solo a la entrada de invitados (`GET /` con o sin consulta). `/anfitrion` y `/api/anfitrion/*` siguen operando para que yo vea el diagnóstico.
- `POST /api/entrar` con respaldo activo responde `409` con `{ error, respaldo: "<FALLBACK_URL>" }`, y la pantalla del invitado lleva a la persona allí con un botón grande. Esto cubre a quien tenía la página abierta.
- Mientras el invitado está dentro de la sala, la aplicación consulta `GET /api/estado` cada 60 segundos; si aparece el respaldo, muestra un aviso fijo y claro: «Nos cambiamos de sala. Toca aquí para ir a la sala de respaldo.». Es el único sondeo permitido.
- No se migra ninguna sesión. `docs/OPERACION_SABADO.md` incluye el mensaje de WhatsApp listo: «Salgan de la sala y vuelvan a abrir el mismo enlace».

### 4.7 Diagnóstico

`GET /api/anfitrion/diagnostico` devuelve una lista de comprobaciones `{ nombre, estado: "ok" | "aviso" | "falla", detalle, queHacer }`, en español sencillo, sin mostrar valores secretos:

1. Cada secreto y cada variable: presente o ausente; longitud mínima de `HOST_SECRET` e `INVITE_CODE`; fechas válidas y en orden; `FALLBACK_URL` válida o vacía.
2. Modo: «real» u «ENSAYO» (este último en rojo si el origen no es `localhost`: significa que se publicó con `MOCK_RTK=true`).
3. La API de Cloudflare responde con el token (un `401` o `403` se explica como «el token no tiene el permiso correcto»).
4. La reunión existe y su estado; si `RTK_MEETING_ID` está vacío, el botón «Crear la reunión» y, al crearla, el identificador con un botón «Copiar» y la instrucción de pegarlo en Cloudflare.
5. `PRESET_GUEST` y `PRESET_HOST` existen; si no, la lista de nombres de presets que sí existen, para copiar el correcto.
6. Ventana horaria: abierta o cerrada, con las horas en Lima.
7. Enlace de invitación listo para copiar: `https://<este origen>/?c=<INVITE_CODE>`, visible solo para el anfitrión con cookie, con botón «Copiar enlace para WhatsApp».

### 4.8 Modo ensayo

- Con `MOCK_RTK=true`, el Worker no contacta a Cloudflare y la aplicación muestra, en lugar de `RtkMeeting`, un recuadro «Sala de ensayo» con el nombre visible, el rol y un botón «Salir». Así las pruebas recorren todo el flujo sin red.
- `npm run demo` arranca el modo ensayo local con valores sintéticos, imprime las direcciones, el código y la clave de ensayo, y se detiene con un mensaje claro si falta algo. Nunca finge un servicio que no levantó.
- Una prueba demuestra que, con `MOCK_RTK` distinto de `"true"`, `rtk.ts` siempre llama a la API real (simulada con `fetch` interceptado en la prueba).

## 5. Pantallas (`src/client/`)

### 5.1 Invitado (`/`)

- **Cabecera** con la insignia del colegio (`docs/spec/San_Antonio_Insignia.jpeg`, copiada y optimizada a `public/`), «Promoción 81 · Reunión virtual» y una línea con la ventana del evento en hora de Lima.
- **Aviso fijo, siempre visible:** «Si no ves o no oyes, abre este enlace en Chrome o Safari.» Puedes detectar el navegador interno de WhatsApp o Facebook por el agente de usuario para destacar el aviso y ofrecer «Copiar enlace»; la detección es una ayuda, no un requisito.
- **Formulario de un paso:** «Tu nombre y apellido» y «¿Desde qué ciudad nos acompañas?»; botón «Entrar a la reunión». El código se toma de `?c=`. Si falta el código, el mensaje dice que pidan el enlace en el grupo. El nombre y la ciudad se recuerdan en `localStorage` (solo eso) para que volver a entrar sea un toque.
- **Dentro de la sala:** `RtkMeeting` con la reunión inicializada con audio y video **apagados** (opción de valores iniciales del SDK; compruébala). La pantalla de preparación del UI Kit puede mostrarse si deja entrar sin conceder permisos; si exige permisos para entrar, desactívala y regístralo. Negar cámara y micrófono no debe impedir ver y oír.
- **Sonido bloqueado:** si el navegador bloquea la reproducción, debe quedar a la vista una acción para activarlo. Usa la del UI Kit si existe; si no, un botón grande «Toca aquí para activar el sonido» que reintente la reproducción con el gesto de la persona. Comprueba cuál es el caso y anótalo.
- **Al salir o perder la conexión** sin poder recuperarse: pantalla «Saliste de la reunión» con el botón «Volver a entrar», que pide una credencial nueva.
- **Wake Lock** (puede): pedir mantener la pantalla encendida al entrar y al volver a la pestaña, sin bloquear nada si falla.

### 5.2 Anfitrión (`/anfitrion`)

- Sin cookie válida: campo de clave y botón «Entrar como anfitrión». Con cookie: dos pestañas grandes, **Sala** y **Diagnóstico**, y el botón «Cerrar sesión de anfitrión».
- **Sala:** `RtkMeeting` con la credencial de anfitrión. Fijar a un invitado en pantalla, silenciarlo, el panel de participantes, el chat y los ajustes de cámara, micrófono y altavoz son los del UI Kit y del preset. No construyas controles propios.
- Al recargar la página, con la cookie vigente, el anfitrión vuelve a la sala con un solo toque, sin escribir la clave.
- **Diagnóstico:** la lista de la sección 4.7 con ✅ ⚠️ ❌, el botón «Volver a comprobar» y, si corresponde, «Crear la reunión».
- La pantalla debe verse bien en la laptop proyectada en el televisor: el layout del UI Kit a pantalla completa, sin barras propias encima de la sala.

### 5.3 Textos e idioma

- Las pantallas propias, en español, con textos cortos y verbos claros.
- Para la sala, usa el mecanismo de idioma del UI Kit (`useLanguage` con `defaultLanguage` y la propiedad `t`, según la documentación). No hay paquete en español incluido: lee las claves del paquete instalado y traduce **todas** las que aparezcan en la pantalla de preparación, la barra de controles, participantes, chat, ajustes, fijar, silenciar, salir y los avisos de permisos y de conexión. Guarda la traducción en `src/client/i18n/es.ts`. Una prueba comprueba que cada clave traducida existe en `defaultLanguage`.

### 5.4 Accesibilidad mínima

- Texto base de al menos 18 px en las pantallas propias; botones de al menos 48 px de alto; contraste AA; etiquetas en todos los campos; el foco visible.
- axe-core sin violaciones de nivel AA en las pantallas propias (entrada de invitado, entrada de anfitrión, diagnóstico, «Saliste de la reunión», aviso de respaldo). La sala del UI Kit queda fuera de esta prueba: es del proveedor.

## 6. Seguridad

- **Roles decididos en el servidor** (sección 4.4). Las pruebas cubren: cuerpo con `preset_name` del anfitrión, `role: "host"`, `isHost: true`, campos repetidos y valores raros; en todos, la petición a la API simulada lleva `PRESET_GUEST`.
- **Comparaciones en tiempo constante** para `INVITE_CODE` y `HOST_SECRET`, sobre resúmenes de igual longitud.
- **Ningún secreto en el cliente**: el paquete compilado no contiene `CF_API_TOKEN`, `HOST_SECRET` ni `INVITE_CODE`; una prueba busca en `dist/` las cadenas sintéticas de `.dev.vars` del modo prueba y falla si las encuentra.
- **Cabeceras** en las páginas: `Content-Security-Policy` que permita lo que RealtimeKit necesita según su documentación (conexiones, medios y trabajadores) y nada más, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` y `Permissions-Policy` que permita cámara y micrófono solo al propio origen. Si una directiva rompe la sala y no puedes comprobar cuál falta, prefiere una política más abierta documentada a una sala rota, y regístralo.
- **Registros**: sin tokens, sin claves, sin código de invitación y sin nombres completos de invitados.
- **Licencias**: solo dependencias con licencias permisivas (MIT, ISC, BSD, Apache-2.0) o las del SDK de Cloudflare, revisadas al instalarlas; `THIRD_PARTY_NOTICES.md` generado con un script.

## 7. Repositorio y reglas de código

```text
myzoom/
├─ AGENTS.md · CLAUDE.md · README.md · THIRD_PARTY_NOTICES.md
├─ .claude/ · .gitignore · .nvmrc · .dev.vars.example · wrangler.jsonc · package.json · tsconfig*.json · vite.config.ts
├─ config-inicial/          configuración, subagentes y huella del kit (no se borra)
├─ scripts/                 preflight.mjs, run.mjs, ayuda.mjs, session-start.mjs, demo.mjs, notices.mjs
├─ src/
│  ├─ shared/               tipos de las peticiones y respuestas, textos de error, validadores
│  ├─ worker/               index.ts (rutas), config.ts, rtk.ts, security.ts (comparación, cookie, cabeceras), time.ts
│  └─ client/               main.tsx, App.tsx, views/ (Guest, Host, Diagnostics, Left, Fallback), i18n/es.ts, styles.css
├─ public/                  insignia optimizada
├─ tests/                   kit/, worker/ (con fixtures/), e2e/
└─ docs/
   ├─ ENCARGO.md · ESTADO.md · BITACORA.md · TAREAS.md · DECISIONES.md · VERIFICACION.md · INCIDENTES.md
   ├─ PREFLIGHT.md · REPORTE_AYUDA.md · DESPLIEGUE.md · ENSAYO.md · OPERACION_SABADO.md
   └─ spec/                 San_Antonio_Insignia.jpeg
```

- Versiones fijadas y `package-lock.json` en el repositorio. Node: la versión del sistema en la nube para desarrollar; `.nvmrc` con la LTS que la documentación de Wrangler admita.
- `src/shared/` es el **contrato** entre cliente y Worker. Se congela al cerrar la Fase 1: un cambio posterior exige una entrada en `docs/DECISIONES.md` y actualizar sus pruebas.
- Archivos pequeños y legibles. Ninguna abstracción para «el futuro». Comentarios en inglés breve.
- Scripts mínimos de `package.json`: `dev`, `build`, `check` (tipos + análisis estático), `test` (Vitest), `test:e2e` (Playwright en modo ensayo), `test:a11y`, `demo`, `notices`, y los alias del kit: `doctor` (`node scripts/preflight.mjs`), `ayuda` (`node scripts/ayuda.mjs`), `session:status` (`node scripts/session-start.mjs`) y `test:kit` (`node --test tests/kit/`).

## 8. Documentos de operación

Son para mí, en lenguaje de todos los días, con cada clic y con «¿Cómo sé que salió bien?» después de cada paso. Usa los nombres de pantallas del panel de Cloudflare tal como figuran en su documentación vigente; si no puedes confirmarlos, dilo y describe qué buscar.

- **`docs/DESPLIEGUE.md`.** (1) Crear el token de API con el permiso de RealtimeKit. (2) Crear la aplicación de RealtimeKit y anotar su identificador. (3) Revisar los presets por defecto y ajustar el de invitado —producir audio y video, chat, sin fijar ni silenciar a otros, sin expulsar, sin sala de espera— y el de anfitrión —todo lo anterior más fijar, silenciar a otros y expulsar—, nombrando las opciones como las muestra la documentación. (4) Opción A, recomendada: conectar el repositorio en Workers Builds, con los comandos exactos de compilación y despliegue. Opción B: desde mi PC con Windows 11, Node LTS y `npx wrangler deploy`. (5) Cargar secretos y variables. (6) Entrar a `/anfitrion`, abrir el diagnóstico, crear la reunión y pegar su identificador. (7) Primera llamada real entre dos redes. (8) Cómo activar y desactivar el respaldo con `FALLBACK_URL` y cuánto tarda en regir. (9) **Congelar**: desde el viernes a las 18:00 no se fusiona nada en `main`, porque cada fusión publica de nuevo.
- **`docs/ENSAYO.md`.** Lista para el viernes, en este orden: dos redes; iPhone con Safari y Android con Chrome, entrando como oyentes sin dar permisos, luego activando micrófono y cámara para saludar; el enlace abierto desde WhatsApp; un invitado que entra tarde; recarga del anfitrión; corte y vuelta del wifi del salón; la laptop del salón con HDMI conectado, volumen real y el televisor como única salida audible, desconectar y reconectar HDMI; prueba de eco con un invitado hablando y el micrófono del salón abierto y cerrado; fijar a un invitado; el máximo de compañeros reales que se pueda reunir a la misma hora, anotando cuántos fueron —si no se llega a 20, se escribe la cifra real, no «validado para 20»—; y el respaldo con dos personas ya dentro que siguen la instrucción de salir y volver a abrir. Cada fila con «resultado esperado» y una casilla. Al final, la decisión de las 18:00 del viernes: MyZoom o la sala de respaldo.
- **`docs/OPERACION_SABADO.md`.** Una hoja para la laptop del salón: preparación una hora antes (cargador, cable de red si hay, HDMI, volumen, notificaciones del sistema apagadas, suspensión desactivada, una sola pestaña); cómo entrar como anfitrión; cómo fijar al compañero que saluda y cómo soltarlo; el protocolo de eco (si se oye eco mientras habla un invitado, silenciar el micrófono del salón y volver a abrirlo al terminar); qué hacer si la laptop se cuelga (recargar, el anfitrión vuelve con un toque); los mensajes de WhatsApp ya redactados —invitación, «empezamos en 10 minutos», «nos cambiamos de sala: salgan y vuelvan a abrir el mismo enlace»—; cómo activar el respaldo; y una tabla «si pasa esto, haz esto» de no más de diez filas.

## 10. Forma de trabajo

### 10.1 Autonomía

- Trabaja sin interacción. Salvo que el mensaje fije una fase tope, las fases son continuas: tras la Fase 0, escribe un resumen de 15 líneas o menos y sigue en el mismo turno. Terminar el turno detiene la sesión hasta que yo escriba.
- **Modo de ejecución por tramo de fases.** Si el mensaje con que empieza o se retoma la sesión fija una fase tope —«ejecuta desde la Fase N hasta cerrar la Fase M; luego detente», o «continúa desde la Fase N hasta cerrar la Fase M y detente»—, trabaja solo hasta cumplir el criterio de salida de la Fase M (sección 12). Al cumplirlo: guarda todo en GitHub según la sección 10.2; escribe en `docs/ESTADO.md` «Tramo cerrado: Fases N a M» y la fase siguiente; ejecuta el informe de parada (sección 11.8); y termina el turno sin abrir la fase siguiente, aunque te sobren tiempo o contexto. Si al empezar una fase anterior tiene tareas pendientes, termínalas primero y anótalo.
- Resuelve tú los detalles reversibles. Registra en `docs/DECISIONES.md`, con fecha, alternativas y motivo, solo lo que afecte contratos, seguridad, costos o comportamiento visible.
- Pregunta solo si te bloquea un acceso, un permiso, un riesgo de licencia o de seguridad, una acción irreversible o un servicio de pago. Mientras quede trabajo independiente, no preguntes: anótalo en `docs/ESTADO.md`, en «Preguntas para Javier», y pregunta en el informe de parada.
- No uses el modo de planificación ni la herramienta de preguntas con opciones: los dos se quedan esperando mi respuesta.
- **El reloj manda.** Esto se usa el sábado. Si una tarea supera el doble de su estimación, aplica la versión más simple que cumpla el criterio, regístralo y sigue.

### 10.2 Repositorio y ramas

- `main` es la rama de integración y debe estar siempre en verde. Commits pequeños, uno por tarea, con mensajes en español que empiezan por el código de la tarea (`T1.04 …`).
- **Guarda en GitHub al cerrar cada tarea.** La sesión siguiente se abre sobre `main`: lo que no esté ahí, para ella no existe. La verificación previa comprobó si `main` acepta tus envíos (`docs/PREFLIGHT.md`, «Guardar en la rama main»):
  - **Si los acepta**, integra en `main` al cerrar cada tarea —`git push origin HEAD:main` desde tu rama— y empuja también tu rama.
  - **Si no**, empuja tu rama con `git push -u origin HEAD`, anota su nombre exacto en `docs/ESTADO.md` y en la bitácora, y sigue: la sesión siguiente la integrará (sección 11.3).
- Nunca fuerces un push, no borres ramas, no reescribas el historial y no uses etiquetas.
- **Atención al despliegue automático:** si ya conecté el repositorio a Workers Builds, cada push a `main` publica. Por eso `main` debe estar siempre en verde, y por eso desde el viernes a las 18:00 no se empuja a `main` (sección 8).
- No crees archivos en `.github/workflows/`: no hace falta integración continua para esta versión.

### 10.3 Entorno

- **En la nube**: una máquina nueva por sesión, con Node, npm, Git y herramientas comunes; normalmente Chromium y Playwright ya instalados. No hace falta Docker ni PostgreSQL: la verificación previa no los exige.
- La red sigue la lista permitida del entorno. Si una descarga falla por la red, no la rodees: anota el dominio en un incidente y sigue con lo independiente. Una respuesta 403 del proxy con `x-deny-reason: host_not_allowed`, o «CONNECT tunnel failed, response 403», significa exactamente eso.
- **No hay claves de Cloudflare en la sesión, y no las pidas.** No ejecutes `wrangler login`, `wrangler deploy` ni ninguna llamada real a `api.cloudflare.com`. Para la documentación usa `developers.cloudflare.com` (sus páginas tienen versión Markdown agregando `index.md` al final de la ruta) o los tipos del paquete instalado en `node_modules`.
- **Todo comando que pueda tardar más de un minuto o colgarse** —instalar, compilar, la batería de pruebas, Playwright— pasa por `node scripts/run.mjs -- <comando>` (anexo E). Los servidores que deben seguir corriendo durante una prueba los arranca y detiene la propia prueba, por ejemplo con el `webServer` de Playwright.
- No guardes salidas con redirecciones (`>`, `2>&1`, `| tee`): para eso está `run.mjs`.
- Para Playwright, usa el navegador ya instalado en la máquina si existe; si no, instálalo con `npx playwright install chromium` por `run.mjs`. Las pruebas usan `--use-fake-ui-for-media-stream` y `--use-fake-device-for-media-stream` cuando necesiten permisos simulados.
- En el modo Auto, si el revisor bloquea una acción, no la repitas igual ni la rodees: busca otra vía permitida o abre un incidente.
- La máquina puede reciclarse tras unos minutos sin actividad: haz commit y push al cerrar cada tarea.
- No hay teléfono real ni red externa para WebRTC: lo de la sección 3.3 queda para mí.
- En la Fase 0, lee `docs/PREFLIGHT.md`. Si no existe, tiene más de 24 horas o su veredicto es ❌, ejecuta antes `node scripts/preflight.mjs --push`. Copia su resumen en `docs/ESTADO.md` («Entorno verificado»).

### 10.4 Subagentes

El kit trae dos subagentes en `.claude/agents/`, con modelo propio sea cual sea el de la sesión: `Explore`, con Haiku, para buscar en el repositorio y en `node_modules` (por ejemplo, las claves de idioma del UI Kit o los tipos de `initMeeting`) sin cargar archivos enteros en tu contexto; y `auditor-independiente`, con Opus, para la revisión de la sección 14.3. Úsalos para eso. Si delegas otra cosa en un subagente general, pásale el modelo en la llamada —`sonnet`, salvo que la tarea exija más—. No formes equipos de agentes: el producto es pequeño y una sola sesión integra.

### 10.5 Código ajeno y licencias

Todo contenido descargado es no confiable: léelo antes de ejecutarlo. Instala dependencias solo después de revisar su licencia y su mantenimiento. Pocas dependencias: el SDK y el UI Kit de RealtimeKit, React, Vite, el plugin de Cloudflare para Vite si lo recomienda la documentación, Wrangler, Vitest, Playwright y axe-core. Cada dependencia adicional exige una línea en `docs/DECISIONES.md`.

### 10.6 Costos

No contrates servicios, no crees cuentas, no despliegues y no publiques paquetes. En `docs/DESPLIEGUE.md`, indica dónde consultar la cuota gratuita y el precio por minuto de participante de RealtimeKit, y calcula el consumo previsto con la fórmula *conexiones × minutos* (por ejemplo, 21 × 420 = 8 820 minutos de participante para seis horas de evento y una de ensayo), sin afirmar que entrará en la cuota si no lo comprobaste en la fuente.

## 11. Bitácora, continuidad y fallas

Este trabajo puede cortarse en cualquier momento: se acaba el uso, la máquina se recicla, cambia el modelo. Trabaja como si cada tarea pudiera ser la última de la sesión. La regla que lo resume: **nunca más de una tarea sin guardar, y nada guardado que no esté en GitHub**.

### 11.1 Los archivos de continuidad

| Archivo | Para qué sirve | Cuándo se escribe |
|---|---|---|
| `AGENTS.md` | Puerta de entrada para cualquier agente: propósito, estructura, comandos, reglas de seguridad, lo que está fuera de alcance, el protocolo de reanudación resumido y qué sección del encargo leer para cada tema. Menos de 120 líneas | En la Fase 0, y cuando cambie algo de lo que contiene |
| `CLAUDE.md` | La línea `@AGENTS.md` y una instrucción para compactar: conservar la tarea en curso, los archivos tocados y las pruebas pendientes | En la Fase 0 |
| `docs/ESTADO.md` | La foto del momento, en menos de 60 líneas (anexo C) | Al cerrar cada fase, al aparecer un bloqueo y antes de una operación larga |
| `docs/BITACORA.md` | El diario: una entrada por tarea cerrada, por reanudación y por bloqueo. Solo se agrega al final | Al cerrar cada tarea |
| `docs/TAREAS.md` | Las tareas con identificador estable (`T1.04`), criterio de aceptación y estado | Al empezar y al cerrar cada tarea |
| `docs/DECISIONES.md` | Decisiones con fecha, alternativas, motivo y consecuencias | Cuando se toma una |
| `docs/VERIFICACION.md` | La evidencia: qué se probó, con qué comando, en qué entorno y con qué resultado; y lo no ejecutado aquí | Al cerrar cada fase |
| `docs/INCIDENTES.md` | Cada falla que no se resolvió en tres intentos, con una explicación para Javier y los datos técnicos (anexo C). Solo se agrega al final; se cierra cambiando su estado | Cuando una falla supera la sección 11.7, y al resolverla |
| `docs/PREFLIGHT.md` | El resultado de la verificación previa | Lo escribe `scripts/preflight.mjs` |
| `docs/REPORTE_AYUDA.md` | Lo necesario para pedir ayuda, sin secretos | Lo escribe `scripts/ayuda.mjs`, en cada informe de parada |

Estados de `docs/TAREAS.md`: `[ ]` pendiente; `[~]` en curso, con la hora y el agente; `[x]` hecha y verificada, con el commit; `[!]` bloqueada, con su incidente (`INC-NNN`). Una tarea solo se marca `[x]` cuando sus pruebas pasan.

`logs/` guarda la salida completa de cada comando lanzado con `run.mjs`. Es local, nunca entra al repositorio y se pierde con la máquina.

### 11.2 Cadencia

1. **Al tomar una tarea**: márcala `[~]` en `docs/TAREAS.md`, commit (`T1.05 inicio`) y push.
2. **Al cerrarla**: código, pruebas, `[x]` y la entrada de la bitácora en un mismo commit; push según la sección 10.2.
3. **Al cerrar una fase**: reescribe `docs/ESTADO.md`, completa `docs/VERIFICACION.md` y haz push.
4. **Si debes parar a mitad de una tarea**, `main` no se toca: lleva lo hecho a `wip/<tarea>`, empújala y anótala en `docs/ESTADO.md`.
5. **Tareas pequeñas**: cada una cabe en unos 30 minutos, tiene un criterio verificable y al menos una prueba. Si crece, pártela.

### 11.3 Protocolo de reanudación

Lo sigue cualquier sesión que no sea la primera. El gancho de inicio (sección 11.6) ya te mostró lo esencial; si tu herramienta no lo ejecuta, `npm run session:status` muestra lo mismo.

1. Lee `AGENTS.md`, `docs/ESTADO.md`, las tres últimas entradas de `docs/BITACORA.md`, los incidentes abiertos y la fase en curso de `docs/TAREAS.md`. No releas todo el encargo: lee solo la sección de la tarea siguiente.
2. **Trae todo lo que hay en GitHub**: `git fetch origin "+refs/heads/*:refs/remotes/origin/*"` —si `git rev-parse --is-shallow-repository` dice `true`, antes `git fetch --unshallow origin`—, luego `git status`, `git log -5 --oneline` y `git branch -a`. Si el gancho avisó de ramas con commits que tu copia no tiene —sobre todo «REANUDACIÓN DESDE OTRA RAMA EN GITHUB»—, o `docs/ESTADO.md` nombra una rama de trabajo, intégrala en `main` con `git merge --no-ff` —nunca `rebase`—, ejecuta `npm run check` y `npm test`, y guarda según la sección 10.2. Una rama sin `docs/ESTADO.md`, como la de una verificación previa, no es trabajo del encargo: intégrala solo si trae algo útil.
3. **Si `docs/ESTADO.md` y Git discrepan, manda Git**: corrige el estado y anota la discrepancia.
4. Si hay una tarea en `[~]`, revísala primero: termínala o devuélvela a `[ ]` con una nota.
5. Si hay cambios sin commit de una sesión anterior, no los descartes: si las pruebas pasan, commit; si no, a `rescate/<fecha>` y push.
6. Si la sesión anterior se detuvo por el entorno o `docs/PREFLIGHT.md` tiene más de 24 horas, ejecuta `node scripts/preflight.mjs --push` antes de seguir.
7. `npm ci` y `npm run check` para confirmar que `main` está en verde.
8. Escribe una entrada de reanudación en `docs/BITACORA.md`: quién eres —modelo y herramienta—, qué encontraste y qué vas a hacer.
9. Continúa con la siguiente tarea pendiente y respeta la fase tope del mensaje (sección 10.1).

Si en la raíz aparece un archivo de encargo nuevo, aplica antes la sección 0 («Este archivo no se edita»).

### 11.4 Otro modelo, otra herramienta

La continuidad no depende de funciones propias de Claude Code: son archivos Markdown y Git. `AGENTS.md` es el archivo que leen otras herramientas; `CLAUDE.md` lo importa. Cada entrada de la bitácora registra el modelo y la herramienta que la escribió.

### 11.5 Lo que no se guarda

Ni secretos, ni datos personales reales, ni transcripciones de razonamiento, ni salidas de más de cincuenta líneas: se resumen, y el detalle queda en `logs/`. Un incidente lleva como máximo veinte líneas del error.

### 11.6 El gancho de inicio de sesión

`scripts/session-start.mjs` corre al abrir, retomar o compactar una sesión de Claude Code: muestra el inicio de `docs/ESTADO.md`, la última entrada de la bitácora, el veredicto de la última verificación previa, los incidentes abiertos, el estado de Git y las ramas de GitHub con trabajo que tu copia no tiene. Si tu copia no tiene `docs/ESTADO.md` pero una rama sí, avisa «REANUDACIÓN DESDE OTRA RAMA EN GITHUB»: el trabajo ya empezó y no debes rehacer la Fase 0. Nunca falla. Los «Proyectos» de Claude Code no ejecutan los ganchos del repositorio; en ellos, el protocolo se sigue a mano.

### 11.7 Cuando algo falla

Una falla no es una parada. Primero clasifícala:

| Clase | Ejemplos | Qué haces |
|---|---|---|
| Del código | Una prueba que no pasa; un error de tipos | Es tu trabajo: corrígelo |
| Del entorno | Falta un programa; disco lleno | Repáralo y anótalo |
| De la red | 403 del proxy con `host_not_allowed`; un nombre que no resuelve | No lo rodees: incidente con el dominio exacto y sigue con lo independiente |
| De permisos | GitHub rechaza un envío; el modo Auto bloquea una acción | No insistas: vía alternativa (sección 10.2) o incidente |
| De la plataforma | Errores 500 o 529; límite de uso; máquina reciclada | Guarda, anota y sigue en cuanto puedas |
| De la documentación | El SDK no tiene la propiedad que este encargo nombra | Sección 0: sigue la fuente, cambio mínimo, `docs/DECISIONES.md` |

**Diagnostica antes de repetir.** Lee el error completo, formula una causa y cambia algo antes de volver a intentar. Repetir sin cambios vale una sola vez, y solo ante algo pasajero.

**Tres intentos, con tres estrategias distintas, o unos 20 minutos, lo que llegue primero.** Si la falla sigue: registra un incidente al final de `docs/INCIDENTES.md` (anexo C), marca la tarea `[!]`, commit y push, y sigue con la siguiente tarea que no dependa de esa.

**Nunca**, para salir de una falla: marques `[x]` una tarea cuyas pruebas no pasan; desactives, saltes o debilites una prueba; relajes una regla de seguridad; reescribas el historial o borres ramas; inventes una salida; ni repitas en bucle lo que ya falló tres veces.

### 11.8 Informe de parada

Te detienes cuando terminaste, cuando cerraste la fase tope del tramo, cuando no queda nada que no dependa de un incidente abierto, cuando se agota el contexto o cuando yo lo pido. Antes de detenerte, en este orden:

1. Ejecuta `node scripts/ayuda.mjs --push`.
2. Reescribe `docs/ESTADO.md`, con el siguiente paso exacto y las preguntas para mí —y, si cerraste un tramo, «Tramo cerrado: Fases N a M»—; commit y push. Comprueba que el último commit está en GitHub: `git ls-remote origin main` debe mostrar el mismo identificador que `git rev-parse HEAD` si `main` acepta envíos, o tu rama, si no.
3. Escribe en el chat, en no más de quince líneas y sin jerga, el informe con la plantilla del anexo C: qué terminaste, dónde te detuviste y por qué, qué necesitas de mí y la frase exacta con la que se sigue. Si cerraste un tramo, esa frase es el relevo del anexo F; y si `main` no aceptó tus envíos, «Qué necesito de ti» pide fusionar tu rama en `main` antes del relevo.

### 11.9 Las herramientas del kit

| Herramienta | Para qué | Cómo se usa |
|---|---|---|
| `scripts/preflight.mjs` | Verificación previa: kit, configuración, subagentes, sesión, Node, navegador de pruebas, red, GitHub y sistema | `node scripts/preflight.mjs [--push] [--sin-red] [--solo-kit]` → `docs/PREFLIGHT.md` |
| `scripts/run.mjs` | Ejecutar un comando largo sin que se cuelgue, con registro y resumen en español | `node scripts/run.mjs [--nombre X] [--limite S] -- comando` |
| `scripts/ayuda.mjs` | Reunir lo necesario para pedir ayuda, sin secretos | `node scripts/ayuda.mjs [--push]` → `docs/REPORTE_AYUDA.md` |
| `scripts/session-start.mjs` | Mostrar el punto de reanudación al abrir cada sesión | Lo ejecuta el gancho; a mano, `npm run session:status` |

Son Node puro, sin dependencias. Si cambias alguno, ejecuta `node --test tests/kit/` y regístralo en `docs/DECISIONES.md`.

## 12. Fases y criterios de salida

| Fase | Trabajo | Sale cuando |
|---|---|---|
| **0 · Reconocimiento** (≈20 min) | Lectura de `docs/PREFLIGHT.md` y, si hace falta, nueva verificación; lectura de este encargo; `git mv` a `docs/ENCARGO.md`; comprobación de `.claude/settings.json`, `.gitignore` y los subagentes; **consulta de la documentación oficial** (anexo A) para confirmar: paquetes del SDK y del UI Kit, cómo se inicializa la reunión con audio y video apagados, propiedades de `RtkMeeting`, mecanismo de idioma, rutas y campos de la API (agregar participante, reunión, presets), `keep_vars` y la configuración de Workers Static Assets; anota lo confirmado y lo que difiere en `docs/DECISIONES.md`; `AGENTS.md`, `CLAUDE.md`, `docs/ESTADO.md`, `docs/BITACORA.md`, `docs/TAREAS.md` con las Fases 1 y 2 partidas en tareas atómicas —una tarea, un commit, con lo que toca, sus dependencias y su criterio de terminado— y la Fase 3 como lista de verificación; `docs/DECISIONES.md`, `docs/INCIDENTES.md` y `docs/VERIFICACION.md` | Los archivos existen en GitHub; `docs/TAREAS.md` cubre las Fases 1 a 3; `docs/DECISIONES.md` tiene la entrada «D-001 · Lo confirmado en la documentación oficial»; informe de parada en el chat |
| **1 · Worker, contratos y seguridad** (≈60 min) | `package.json` con versiones fijadas, `tsconfig`, `vite.config.ts`, `wrangler.jsonc` con Workers Static Assets y `keep_vars`; `.dev.vars.example`; los alias del kit; `src/shared/` con los tipos y mensajes; `src/worker/` completo: configuración y su validación, cliente RealtimeKit con modo ensayo, rutas de la sección 4.3, ventana horaria, cookie firmada, comparación en tiempo constante, respaldo, diagnóstico y cabeceras; pruebas de Vitest con `fetch` interceptado y respuestas con la forma documentada | `npm run check` y `npm test` en verde, incluidas todas las pruebas de seguridad de la sección 14.1; contratos de `src/shared/` congelados; `docs/TAREAS.md` de la Fase 2 revisado contra ellos |
| **2 · Pantallas, modo ensayo y pruebas de interfaz** (≈90 min) | Entrada de invitado, entrada y pestañas del anfitrión, diagnóstico, «Saliste de la reunión», avisos de respaldo y de sonido; `RtkMeeting` con audio y video apagados para invitados; traducción `es.ts`; `npm run demo`; Playwright en modo ensayo recorriendo el escenario de la sección 13; axe-core en las pantallas propias; prueba de que `dist/` no contiene secretos sintéticos | `npm run build`, `npm run check`, `npm test`, `npm run test:e2e` y `npm run test:a11y` en verde; `npm run demo` arranca y muestra las direcciones |
| **3 · Auditoría, despliegue, ensayo y cierre** (≈45 min) | Revisión con el subagente `auditor-independiente` (sección 14.3); corrección de hallazgos; `docs/DESPLIEGUE.md`, `docs/ENSAYO.md`, `docs/OPERACION_SABADO.md` (sección 8); `README.md` final y `THIRD_PARTY_NOTICES.md`; instalación y pruebas desde un clon limpio | El auditor da «Sin hallazgos críticos ni importantes» o los que quedan están explicados como no corregibles aquí; un clon limpio instala, compila y pasa las pruebas siguiendo el README; informe final en el chat (sección 15) |

**Comandos mínimos:** `npm ci`, `npm run dev`, `npm run build`, `npm run check`, `npm test`, `npm run test:e2e`, `npm run test:a11y`, `npm run demo`, `npm run notices`, `npm run doctor`, `npm run ayuda`, `npm run session:status` y `npm run test:kit`.

## 13. Escenario de aceptación (modo ensayo)

Se ejecuta con Playwright y Chromium sobre `npm run demo` o el `webServer` equivalente. Cada paso deja su evidencia en `docs/VERIFICACION.md`.

1. **Arranque.** Desde un clon limpio, siguiendo solo el README, `npm run demo` levanta el sistema e imprime la dirección del invitado con el código de ensayo y la del anfitrión.
2. **Invitado sin código.** Abrir `/` sin `?c=` muestra el mensaje de pedir el enlace en el grupo.
3. **Invitado con código errado.** Rechazo con el mensaje de enlace no válido.
4. **Invitado correcto.** Con nombre y ciudad entra a la «Sala de ensayo» con rol invitado y nombre «Carlos Prueba · Toronto»; al volver a abrir la página, nombre y ciudad ya están escritos.
5. **Intento de escalar.** Una petición directa a `/api/entrar` con `preset_name` de anfitrión recibe una credencial de invitado (comprobado en la API simulada).
6. **Fuera de horario.** Con la ventana en el futuro y luego en el pasado, la entrada se rechaza con los dos mensajes correctos.
7. **Anfitrión.** Con clave errada, rechazo. Con la correcta, entra; tras recargar, sigue dentro sin escribir la clave; «Cerrar sesión de anfitrión» lo saca.
8. **Diagnóstico.** Muestra modo ensayo, la ventana, los presets simulados y el enlace de invitación con «Copiar».
9. **Reunión por crear.** Con `RTK_MEETING_ID` vacío, el diagnóstico ofrece «Crear la reunión» y, al pulsarlo, muestra el identificador simulado.
10. **Respaldo.** Con `FALLBACK_URL` definido, `/?c=…` redirige sin reenviar el código; un invitado que ya estaba dentro ve el aviso «Nos cambiamos de sala» en menos de 70 segundos (reloj acelerado o intervalo configurable solo en pruebas); `/anfitrion` sigue funcionando.

La sala real de RealtimeKit no se prueba aquí: queda para `docs/ENSAYO.md`.

## 14. Verificación

### 14.1 Pruebas obligatorias

Pertenecen al producto. No las marques como aprobadas por haberlas escrito.

| Área | Casos |
|---|---|
| Roles | Invitado con `preset_name`, `role`, `isHost` y campos duplicados: siempre `PRESET_GUEST`; sin cookie, `/api/anfitrion/credencial` y `/api/anfitrion/diagnostico` responden `401`; cookie con firma alterada, vencida o de otra clave: `401` |
| Secretos | Comparación en tiempo constante (la función se usa en ambos caminos y no hace salida temprana por longitud); longitud mínima de `HOST_SECRET` e `INVITE_CODE`; `dist/` sin secretos sintéticos; registros sin token, clave ni código |
| Ventana horaria | Un minuto antes de abrir, al abrir, un minuto antes de cerrar y al cerrar; `expires_on` igual a `EVENT_CLOSES_AT` en la petición a la API; horas mostradas en Lima |
| API de RealtimeKit | Ruta, cabeceras y cuerpo de cada operación contra la forma documentada; un reintento ante `5xx` o red; ningún reintento ante `4xx`; límite de 10 s; errores traducidos |
| Respaldo | URL inválida ignorada; `302` sin código ni consulta y con `no-store`; `409` en `/api/entrar`; anfitrión no redirigido; aviso dentro de la sala |
| Entradas | Nombre y ciudad vacíos, largos, con caracteres de control, con HTML y con emojis; cuerpo de más de 2 KB; tipo de contenido distinto de JSON; `Origin` ajeno |
| Diagnóstico | Cada falta de configuración produce su fila en español con «qué hacer»; ningún valor secreto en la respuesta; «Crear la reunión» solo con `RTK_MEETING_ID` vacío |
| Idioma | Cada clave de `es.ts` existe en `defaultLanguage` del UI Kit instalado |
| Interfaz | Escenario de la sección 13 completo; axe-core sin violaciones AA en las pantallas propias; pantallas a 360 px de ancho sin desplazamiento horizontal |
| Herramientas del kit | `npm run test:kit` en verde |

### 14.2 Evidencia

- `docs/VERIFICACION.md` registra, por área, el comando, el entorno, el resultado, la fecha y el commit.
- Lo que no pudo ejecutarse aquí (sección 3.3) se escribe como **no ejecutado**, con su motivo y el paso de `docs/ENSAYO.md` que lo cubre.
- «Pasa en modo ensayo» no equivale a «funciona con RealtimeKit», ni «pasa en Chromium» equivale a «probado en un iPhone».

### 14.3 Autoauditoría

En la Fase 3 revisa el trabajo desde cuatro perspectivas:

1. **Alcance:** todo lo de la sección 3.1 existe y nada de la 3.2 se coló.
2. **Seguridad de acceso:** roles, secretos, cookie, ventana horaria, entradas y cabeceras.
3. **Estabilidad del sábado:** qué pieza propia puede fallar durante seis horas —sondeo, reconexión, recarga, credencial vencida, respaldo, configuración incompleta— y qué ve la persona en cada caso.
4. **Operación:** ¿puedo publicar, ensayar y operar siguiendo solo `docs/DESPLIEGUE.md`, `docs/ENSAYO.md` y `docs/OPERACION_SABADO.md`? ¿Podría otra sesión retomar desde `docs/ESTADO.md`?

Cierra con una revisión adversarial de tu propia complejidad: retira lo que no sirva a un requisito.

- **Revisión independiente.** Las perspectivas 2 y 3 las hace el subagente `auditor-independiente` (Opus), aunque la sesión corra en otro modelo. Recibe el encargo y el código, no tu razonamiento, y no escribe código del producto. Si no estuviera disponible, usa un subagente general con el modelo `opus` y las mismas instrucciones, y anótalo.
- Por cada hallazgo: requisito afectado, evidencia reproducible, consecuencia, severidad —crítica, importante o menor—, corrección mínima y su verificación.
- Distingue el defecto comprobado, el riesgo por probar y la preferencia técnica: no conviertas cada mejora deseable en un bloqueo, ni amplíes el alcance para resolver una preferencia.
- Máximo tres rondas. Si quedan defectos importantes, infórmalos y no declares listo el producto.
- Resume en `docs/VERIFICACION.md`, con evidencia y pendientes.

## 15. Entregables y definición de terminado

- El repositorio privado con código, pruebas, `wrangler.jsonc`, `.dev.vars.example` y lockfile.
- `README.md` con prerrequisitos, arranque en modo ensayo, pruebas y solución de problemas comunes; `AGENTS.md`; `CLAUDE.md`.
- En `docs/`: `ENCARGO.md`, `ESTADO.md`, `BITACORA.md`, `TAREAS.md`, `DECISIONES.md`, `VERIFICACION.md`, `INCIDENTES.md`, `PREFLIGHT.md`, `DESPLIEGUE.md`, `ENSAYO.md` y `OPERACION_SABADO.md`.
- `THIRD_PARTY_NOTICES.md`. Ni secretos, ni datos reales, ni dependencias instaladas dentro del repositorio.

**Tu informe final** es breve y separa cuatro grupos: **implementado y verificado**, **implementado sin ejecutar con RealtimeKit real**, **simulado** y **pendiente**. Incluye el último commit en `main`; los incidentes abiertos; los comandos para probar en modo ensayo; lo que me toca hacer, en orden —token, aplicación y presets de RealtimeKit, publicación, secretos y variables, reunión desde el diagnóstico, primera llamada real entre dos redes, ensayo del viernes, sala de respaldo, decisión de las 18:00 y congelamiento de `main`—; y el riesgo principal que queda. No presentes una lista de deseos como software terminado.

## Anexo A · Fuentes oficiales para verificar

Comprueba en ellas los nombres y condiciones vigentes al implementar. Las páginas de `developers.cloudflare.com` tienen versión Markdown agregando `index.md` al final de la ruta.

| Fuente | Para qué |
|---|---|
| [RealtimeKit · Quickstart](https://developers.cloudflare.com/realtime/realtimekit/quickstart/) | Paquetes del SDK y del UI Kit, creación de aplicación, reunión y participante, integración en React |
| [RealtimeKit · FAQ](https://developers.cloudflare.com/realtime/realtimekit/faq/) | Vigencia del token (`expires_on`, máximo 100 días), reconexión con token vencido, estado `INACTIVE` |
| [API · Add participant](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/add_participant/) | Ruta, campos y respuesta exactos |
| [RealtimeKit · Presets](https://developers.cloudflare.com/realtime/realtimekit/concepts/preset/) | Permisos de cada rol y presets por defecto |
| [UI Kit · RtkMeeting](https://developers.cloudflare.com/realtime/realtimekit/humans/ui-kit/api-reference/react/rtkmeeting/) y [RtkSettings](https://developers.cloudflare.com/realtime/realtimekit/humans/ui-kit/api-reference/react/rtksettings/) | Propiedades de la sala y ajustes de dispositivos |
| [UI Kit · Meeting locale](https://developers.cloudflare.com/realtime/realtimekit/humans/ui-kit/meeting-locale/) | `useLanguage`, `defaultLanguage` y la propiedad `t` |
| [RealtimeKit · Gestión de participantes](https://developers.cloudflare.com/realtime/realtimekit/humans/core/manage-participants-in-a-session/) | Fijar (para toda la sesión, uno a la vez), silenciar y expulsar |
| [RealtimeKit · Precios](https://developers.cloudflare.com/realtime/realtimekit/platform/pricing/) | Cuota gratuita y minutos de participante |
| [Workers · Static Assets](https://developers.cloudflare.com/workers/static-assets/) y [Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/) | Servir la aplicación y la API desde un Worker |
| [Wrangler · Configuración](https://developers.cloudflare.com/workers/wrangler/configuration/) | `wrangler.jsonc`, `keep_vars`, variables y secretos |
| [Workers · Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) | Despliegue conectado a GitHub |
| [MDN · HTMLMediaElement.play](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play) y [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) | Sonido bloqueado y pantalla encendida |
| [MDN · Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) | Prefijo `__Host-` y atributos |
| [Claude Code · Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web), [Subagents](https://code.claude.com/docs/en/sub-agents) y [Hooks](https://code.claude.com/docs/en/hooks) | Sesiones, subagentes y el gancho `SessionStart` |

## Anexo B · Glosario para el código

| En pantalla y en este encargo | En el código |
|---|---|
| invitado · anfitrión | `guest` · `host` |
| sala · reunión | `room` (pantalla) · `meeting` (RealtimeKit) |
| credencial | `authToken` |
| código de invitación · clave del anfitrión | `inviteCode` · `hostSecret` |
| ventana del evento · abre · cierra | `eventWindow` · `opensAt` · `closesAt` |
| respaldo | `fallback` |
| diagnóstico · comprobación | `diagnostics` · `check` |
| modo ensayo | `mock` |
| nombre visible | `displayName` |

## Anexo C · Plantillas de los archivos de continuidad

**`docs/ESTADO.md`** —se reescribe completo; menos de 60 líneas—:

```markdown
# Estado del trabajo
_Actualizado: 2026-11-19 14:40 (hora de Lima) · por: <modelo> en <herramienta>_

## Dónde estamos
- Fase 1 · Worker, contratos y seguridad
- Tramo 1b · Fase 1 · Opus, esfuerzo alto · fase tope del mensaje: 1
- Última tarea cerrada: T1.04 Ventana horaria · commit abc1234
- Tarea en curso: T1.05 Cookie del anfitrión · commit def5678
- `main` en abc1234, empujado: sí

## Entorno verificado
- Verificación previa: ⚠️ LISTO, CON AVISOS · 2026-11-19 11:10 · docs/PREFLIGHT.md
- Node 22.x · npm 10.x · Chromium sí
- Rama de esta sesión: claude/… · `main` acepta envíos: sí

## Última corrida de pruebas
- check: verde · test: 58/58 · e2e: pendiente (Fase 2)

## Incidentes abiertos
- Ninguno

## Preguntas para Javier
- Ninguna

## Siguiente paso exacto
1. Terminar T1.05: falta la prueba de cookie vencida.

## Para retomar
git fetch --all · git switch main && git pull · npm ci · npm run check · npm test
```

**Entrada de `docs/BITACORA.md`** —se agrega al final—:

```markdown
## 2026-11-19 14:40 · T1.04 · cerrada
- Agente: <modelo> en <herramienta>
- Hecho: ventana horaria con mensajes en hora de Lima y expires_on = EVENT_CLOSES_AT
- Archivos: src/worker/time.ts, src/worker/index.ts, tests/worker/window.test.ts
- Verificación: npm test -- window → 9/9
- Commit: abc1234 en main, empujado
- Siguiente: T1.05
```

**Líneas de `docs/TAREAS.md`**:

```markdown
## Fase 1 · Worker, contratos y seguridad
Leer: encargo 4, 6 y la tabla 14.1; D-001 en docs/DECISIONES.md.
- [x] T1.04 Ventana horaria (4.4) · abc1234
  - Depende de: T1.02 · Toca: src/worker/time.ts · Hecho cuando: pasan los cuatro bordes de la tabla 14.1
- [~] T1.05 Cookie del anfitrión (4.5) · desde 14:42 · <modelo>
  - Depende de: T1.03 · Toca: src/worker/security.ts · Hecho cuando: firma alterada, vencida y de otra clave dan 401
- [ ] T1.06 Diagnóstico (4.7)
```

**Entrada de `docs/INCIDENTES.md`**:

```markdown
## INC-001 · 2026-11-19 15:20 · No se puede leer la documentación de Cloudflare
- Estado: abierto
- Tarea: T0.03 · Fase 0
- Explicación para Javier: necesito leer la documentación oficial de RealtimeKit y la red del entorno no deja entrar a developers.cloudflare.com. Mientras tanto uso los tipos del paquete instalado. Lo que necesito de ti: en claude.ai/code, en el entorno PromoConnect, agrega `developers.cloudflare.com` a «Allowed domains» y guarda.
- Datos técnicos: curl → «CONNECT tunnel failed, response 403» · intentos: …
- Resolución: —
```

**Informe de parada**, en el chat:

```markdown
**Qué terminé:** …; todo está en `main` (commit abc1234).
**Dónde me detuve y por qué:** …
**Qué necesito de ti:** nada | pasos exactos, uno por línea.
**Cómo seguir:** abre una sesión nueva con Sonnet, envía `/effort high` y escribe: «Lee AGENTS.md y docs/ESTADO.md, sigue el protocolo de reanudación y ejecuta desde la Fase 2 hasta cerrar la Fase 2; luego detente con el informe de parada.»
```

**Entrada de `docs/DECISIONES.md`**:

```markdown
## D-002 · 2026-11-19 · Pantalla de preparación del UI Kit desactivada para invitados
- Contexto: la pantalla de preparación pide permisos antes de entrar (comprobado en …).
- Alternativas: mantenerla; desactivarla y entrar directo con audio y video apagados.
- Decisión: desactivarla; el invitado activa cámara y micrófono desde la barra cuando saluda.
- Consecuencias: prueba de entrada sin permisos; paso en docs/ENSAYO.md.
```

## Anexo D · Configuración de Claude Code

`config-inicial/claude-settings.json` llega con el kit y la verificación previa lo instala como `.claude/settings.json`:

- **Variables**: `BASH_DEFAULT_TIMEOUT_MS=600000` y `BASH_MAX_TIMEOUT_MS=1800000`.
- **Modo**: `acceptEdits`.
- **Permitido sin preguntar**: npm, npx y node; las utilidades de archivos y de texto; Git, salvo lo negado; `curl` y `apt-get`.
- **Negado siempre**: forzar un envío; borrar ramas remotas; `--mirror`; etiquetas; `reset --hard`; `clean -f`; `checkout` o `restore` de todo el árbol; `branch -D`; `filter-branch`; `npm publish` y `npm login`; `wrangler deploy`, `wrangler login` y `wrangler secret`; y `rm -rf` sobre la raíz, la carpeta personal o `.git`.
- **Subagentes** en `.claude/agents/`: `Explore` —`model: haiku`, solo lectura— y `auditor-independiente` —`model: opus`, sin permiso para editar—.
- **Gancho** `SessionStart`: `node "${CLAUDE_PROJECT_DIR:-.}/scripts/session-start.mjs"`, con 30 segundos de límite.

Si necesitas otro permiso, agrégalo con la regla más precisa posible y regístralo en `docs/DECISIONES.md`; nunca quites una regla negada. Un cambio en este archivo rige desde la sesión siguiente.

## Anexo E · Herramientas del kit

Llegan en `scripts/`, su huella está en `config-inicial/kit-manifest.json` y sus pruebas, en `tests/kit/`.

**`preflight.mjs` · verificación previa.** Comprueba: que el kit está completo e intacto, sin otros encargos ni archivos privados (el plan de Gemini, la auditoría, `.env`, `.dev.vars`); la configuración y los dos subagentes, que instala desde `config-inicial/` si faltan —solo con `--push`—; dónde corre la sesión, si el gancho corrió y las variables de entorno, con un aviso si están definidas `CLAUDE_CODE_SUBAGENT_MODEL` o `CLAUDE_CODE_EFFORT_LEVEL`, y otro si aparece alguna clave de Cloudflare en el entorno; Node, npm y Git; si hay un Chromium para Playwright ya instalado; la red hacia npm, nodejs.org, la documentación de Cloudflare y la descarga de Playwright, distinguiendo un bloqueo de la lista permitida, un nombre que no resuelve y una demora; GitHub —lectura, ramas con trabajo pendiente y, con `--push`, escritura en la rama de la sesión y en `main`—; y el sistema: disco, memoria, hora de Lima en español y permiso de escritura. **No exige Docker, PostgreSQL ni FFmpeg.** Escribe `docs/PREFLIGHT.md` con un veredicto —✅ LISTO PARA EMPEZAR, ⚠️ LISTO, CON AVISOS o ❌ NO LISTO— y siempre termina con código 0.

**`run.mjs` · ejecutar sin colgarse.** `node scripts/run.mjs [--nombre X] [--limite segundos] [--cola N] [--todo] -- comando argumentos`. Cierra la entrada del teclado; fija `CI=1` y similares; guarda la salida completa en `logs/` y una línea por ejecución en `logs/ejecuciones.jsonl`. Al vencer el límite —570 segundos por defecto; 0 lo quita— termina el comando y todos sus procesos. Imprime un resumen: ✅ terminó bien; ❌ falló, con las últimas líneas; ⏱️ se detuvo por tiempo; ⌨️ esperaba una respuesta; ❓ el comando no existe. Devuelve el código del comando, 124 si lo detuvo y 127 si no existe.

**`ayuda.mjs` · pedir ayuda.** `node scripts/ayuda.mjs [--push]`. Escribe `docs/REPORTE_AYUDA.md`, de no más de 25 KB, con estado, bitácora, incidentes, fallas recientes, Git y versiones. Antes de escribir quita tokens de GitHub, de Cloudflare y de portador (`Bearer`), claves privadas, contraseñas en direcciones y los valores de variables con nombres como `password`, `secret`, `token`, `key` o `invite_code`. Con `--push`, lo guarda en GitHub.

**`session-start.mjs` · punto de reanudación** (sección 11.6). Deja además la marca `logs/.gancho-inicio.json`, con la que la verificación previa sabe que el gancho corre.

## Anexo F · Plan de relevos

| Tramo | Fases | Modelo | Esfuerzo | Sesión | Termina al cerrar |
|---|---|---|---|---|---|
| 1a | 0 | Opus | Alto (`high`) | Nueva | La Fase 0 |
| 1b | 1 | Opus | Alto (`high`) | La misma | La Fase 1 |
| 2 | 2 | Sonnet | Alto (`high`) | Nueva | La Fase 2 |
| 3 | 3 | Opus | Alto (`high`) | Nueva | El encargo |

**Las frases.** El tramo 1a empieza con la frase de «Cómo usarlo». El 1b, en la misma sesión: «Continúa desde la Fase 1 hasta cerrar la Fase 1 y detente con el informe de parada.» El 2, en sesión nueva: «Lee AGENTS.md y docs/ESTADO.md, sigue el protocolo de reanudación y ejecuta desde la Fase 2 hasta cerrar la Fase 2; luego detente con el informe de parada.» El 3, en sesión nueva: «Lee AGENTS.md y docs/ESTADO.md, sigue el protocolo de reanudación y ejecuta desde la Fase 3 hasta terminar el encargo, con la revisión obligatoria del subagente auditor-independiente; luego entrega tu informe final.»

**Por qué así.** Opus confirma la documentación, decide y congela el contrato del Worker, donde vive toda la seguridad; Sonnet construye las pantallas sobre ese contrato cerrado, que es el trabajo más rutinario; Opus vuelve en una sesión limpia para auditar con ojos frescos y escribir los manuales. La revisión independiente la hace siempre `auditor-independiente`, en Opus. Cada tramo termina con todo en `main`, de modo que el siguiente empieza sobre una base en verde.

# FIN DEL ENCARGO

---

## Historial de versiones

- **1.0 · 19 de noviembre de 2026.** Primera versión, escrita desde cero sobre la disciplina de PromoConnect v1.2. Reemplaza el plan de Gemini del 18 de noviembre y aplica la auditoría del mismo día: credenciales emitidas al entrar, ventana horaria real, interfaz estándar del UI Kit, controles de dispositivos del SDK, respaldo que exige volver a abrir el enlace, ensayo con concurrencia real declarada. Retira la grabación, OBS, la ventana de TV, la PWA y R2.
