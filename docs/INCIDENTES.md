# Incidentes

Fallas que no se resolvieron en tres intentos. Solo se agrega al final; se cierra cambiando su estado.

## INC-001 · 2026-11-19 15:30 · No se puede leer la documentación de Cloudflare
- Estado: abierto (con alternativa aplicada)
- Tarea: T0.03 · Fase 0
- Explicación para Javier: la red del contenedor donde se construyó no deja entrar a developers.cloudflare.com. Usé en su lugar los tipos oficiales de los paquetes de Cloudflare instalados (SDK y UI Kit de RealtimeKit, SDK REST `cloudflare` y el esquema de Wrangler), que son la fuente de la sección 0 cuando la web no está. Lo que necesito de ti: en el entorno de claude.ai/code que use la sesión corta, agrega `developers.cloudflare.com` a «Allowed domains»; esa sesión puede revisar D-001 y D-002 contra la web.
- Datos técnicos: `curl https://developers.cloudflare.com/realtime/realtimekit/quickstart/index.md` → «CONNECT tunnel failed, response 403» (connect_rejected del proxy).
- Resolución: —
