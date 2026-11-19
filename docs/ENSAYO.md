# Ensayo del viernes 20 de noviembre

Una hora, con el equipo real del salón y el mayor número posible de compañeros. Marca cada casilla. Lo que se prueba aquí **no se pudo probar en la sesión que construyó el código** (no hay teléfonos ni redes reales): ver `docs/VERIFICACION.md`.

Antes: `EVENT_OPENS_AT` debe abrir antes del ensayo (por ejemplo `2026-11-20T00:00:00-05:00`) y el Diagnóstico debe estar en verde.

| # | Prueba | Cómo | Resultado esperado | ✓ |
|---|---|---|---|---|
| 1 | Dos redes | Laptop del salón en su wifi; un celular con datos móviles | Se ven y se oyen en ambos sentidos | ☐ |
| 2 | iPhone con Safari como oyente | Abrir el enlace, entrar **sin dar permisos** de cámara ni micrófono | Ve y oye la sala; si aparece «Toca aquí para activar el sonido», al tocarlo se oye | ☐ |
| 3 | Android con Chrome como oyente | Igual que el 2 | Igual que el 2 | ☐ |
| 4 | Saludo desde el teléfono | En el 2 y el 3, tocar micrófono y cámara en la barra y aceptar permisos | El salón lo ve y lo oye por el televisor | ☐ |
| 5 | Enlace desde WhatsApp | Tocar el enlace dentro de WhatsApp | Aparece el aviso destacado y «Copiar enlace»; si no oye, abrirlo en Chrome/Safari funciona | ☐ |
| 6 | Invitado tardío | Uno entra 15 minutos después | Entra sin problema y ve la sala en curso | ☐ |
| 7 | Recarga del anfitrión | Recargar la página de la laptop | Vuelve al panel sin escribir la clave; «Entrar a la sala» con un toque | ☐ |
| 8 | Corte de wifi del salón | Apagar el router 20 segundos y encenderlo | La sala muestra «Se perdió la conexión. Intentando reconectar…» y se recupera sola, **sin** pasar a «Saliste de la reunión» (D-018). Si no se recupera en 2 minutos: recargar | ☐ |
| 9 | Corte de datos en un celular | Modo avión 15 segundos | Igual que el 8 | ☐ |
| 10 | HDMI y volumen real | Laptop conectada al televisor, volumen real, el televisor como única salida audible | Se oye bien en todo el salón | ☐ |
| 11 | Desconectar y reconectar HDMI | Sacar el cable y volver a ponerlo | La imagen y el sonido vuelven al televisor (revisar «Ajustes → Altavoz» de la sala si el sonido quedó en la laptop) | ☐ |
| 12 | Eco | Un invitado habla con el micrófono del salón abierto, y luego cerrado | Anotar si hay eco; con el micrófono del salón cerrado no debe haber eco | ☐ |
| 13 | Fijar a un invitado | Desde la laptop, en participantes, «Fijar» al que saluda y luego «Soltar» | El televisor lo muestra grande y luego vuelve al mosaico | ☐ |
| 14 | Concurrencia real | Juntar a la misma hora a todos los que se pueda | Anotar la cifra real: **____ conexiones**. Si no se llega a 20, se escribe la cifra, no «validado para 20» | ☐ |
| 15 | Credencial real y registros | En Cloudflare → `myzoom` → Logs, durante las pruebas | Sin errores `[rtk] addParticipant`; anotar si aparece `expires_on rejected` (D-002) | ☐ |
| 16 | Consola y CSP | En la laptop, F12 → Console | Sin errores «Content Security Policy» (D-009) | ☐ |
| 17 | Respaldo con dos personas dentro | Activar `FALLBACK_URL`; dos personas dentro siguen la instrucción «Salgan y vuelvan a abrir el mismo enlace» | Ven el aviso rojo en menos de 1 minuto y, al reabrir el enlace, llegan a la sala de respaldo. Luego **borrar** `FALLBACK_URL` | ☐ |

## Decisión de las 18:00 del viernes

- **MyZoom** si las pruebas 1, 2 o 3, 4, 7, 8, 10, 13 y 15 salieron bien.
- **Sala de respaldo** si falló alguna de esas y no hay arreglo con solo variables. En ese caso: activar `FALLBACK_URL` el sábado desde temprano; el mismo enlace de WhatsApp llevará a todos allí.

Decisión tomada: ☐ MyZoom ☐ Respaldo · Hora: ______

Después de decidir: **congelar `main`** (DESPLIEGUE, paso 9).
