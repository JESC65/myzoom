# Operación del sábado · Hoja de la laptop del salón

Imprímela y déjala junto a la laptop.

## Una hora antes

- [ ] Cargador conectado. Cable de red si hay; si no, el wifi más cercano.
- [ ] HDMI al televisor; el televisor como **salida de sonido**; volumen probado.
- [ ] Notificaciones del sistema apagadas (Windows: «No molestar» activado).
- [ ] Suspensión desactivada (Windows: Configuración → Sistema → Energía → «Nunca»).
- [ ] Chrome o Edge con **una sola pestaña**.
- [ ] Diagnóstico en verde (pestaña Diagnóstico → «Volver a comprobar»).

## Entrar como anfitrión

1. Abre `https://myzoom.<tu-subdominio>.workers.dev/anfitrion`.
2. Si pide clave, escríbela → «Entrar como anfitrión». (Si ya entraste antes, no la pide.)
3. Pestaña **Sala** → **«Entrar a la sala»**. Acepta cámara y micrófono.
4. Pantalla completa con el botón de la sala o la tecla F11.

## Fijar al compañero que saluda

- Abre «Participantes», busca su nombre (aparece como «Nombre · Ciudad») → **«Fijar»**. Se ve grande en el televisor.
- Al terminar → **«Soltar»**.

## Protocolo de eco

Si se oye eco mientras habla un invitado: **silencia el micrófono del salón** (botón de micrófono en la barra) y vuelve a abrirlo cuando termine.

## Si la laptop se cuelga

Recarga la página (F5). El anfitrión vuelve al panel sin clave: «Entrar a la sala» con un toque.

## Mensajes de WhatsApp listos

**Invitación (enviar el viernes):**
> ¡Hola, Promo 81! Mañana sábado pueden acompañarnos en vivo desde donde estén. Abran este enlace en Chrome o Safari: [ENLACE DE INVITACIÓN]. Escriban su nombre y su ciudad y toquen «Entrar a la reunión». Entran con cámara y micrófono apagados; cuando quieran saludar, los encienden. ¡Los esperamos!

**Empezamos en 10 minutos:**
> ¡Empezamos en 10 minutos! Abran el enlace de siempre en Chrome o Safari: [ENLACE DE INVITACIÓN]. Si no ven o no oyen, ciérrenlo y ábranlo otra vez.

**Nos cambiamos de sala:**
> Nos cambiamos de sala: **salgan de la sala y vuelvan a abrir el mismo enlace** [ENLACE DE INVITACIÓN]. Los lleva solito a la sala nueva.

## Cómo activar el respaldo

Cloudflare → `myzoom` → «Settings» → «Variables and Secrets» → agrega `FALLBACK_URL` = enlace `https://…` de la sala de respaldo → guarda. Espera un minuto, comprueba `…/api/estado` (`"respaldo":true`) y envía el mensaje «Nos cambiamos de sala».

## Si pasa esto, haz esto

| Si pasa esto | Haz esto |
|---|---|
| Un invitado no oye | Que toque «Activar el sonido» si aparece, o que abra el enlace en Chrome/Safari (no dentro de WhatsApp) |
| Un invitado dice «El enlace no es válido» | Reenvíale el enlace de invitación desde el Diagnóstico («Copiar enlace para WhatsApp») |
| Un invitado ve «Saliste de la reunión» | Que toque «Volver a entrar» |
| Se oye eco | Silencia el micrófono del salón mientras habla el invitado |
| El televisor no suena | Revisa la salida de sonido de Windows y «Ajustes → Altavoz» de la sala; reconecta el HDMI |
| La laptop se colgó o se cerró la pestaña | Abre `/anfitrion` otra vez → «Entrar a la sala» |
| Se cortó el internet del salón | Espera 1 minuto: la sala reconecta sola. Si no, recarga la página |
| Nadie puede entrar | Diagnóstico → «Volver a comprobar»; si falla Cloudflare y no se arregla en 5 minutos, activa el respaldo |
| «La reunión ya terminó» antes de tiempo | Amplía `EVENT_CLOSES_AT` en Cloudflare y guarda |
| MyZoom falla del todo | Activa `FALLBACK_URL` y envía «Nos cambiamos de sala» |
