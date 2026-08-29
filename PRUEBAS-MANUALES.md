# Checklist de pruebas manuales — Lumen

Recorrido de los flujos completos en pantalla, antes de invitar usuarios
reales o desplegar a producción. Complementa las pruebas automáticas
(`pnpm test`, ver PLAN.md) que solo cubren la lógica de negocio, no la
interfaz. Pruébalo primero en `pnpm dev` local; repite lo esencial una
vez desplegado en Vercel antes de dar acceso real.

Marca cada casilla al probarlo. Si algo falla, anota el paso exacto y
lo que pasó (para reportarlo o pedir ayuda a arreglarlo).

## 0. Preparar el entorno

- [ ] `npx prisma db seed` corre sin errores y crea los usuarios de
      prueba: `admin@lumen.pe` y `lummen@lumen.pe` (contraseña
      `lumen1234` ambos).
- [ ] `pnpm dev` levanta sin errores en `localhost:3000`.

## 1. Login y seguridad de acceso

- [ ] Entrar con `admin@lumen.pe` funciona y lleva al dashboard.
- [ ] Entrar con `lummen@lumen.pe` funciona y lleva a la agenda (no al
      dashboard — ese es solo de Admin).
- [ ] Con la cobradora logueada, entrar a `/dashboard` a mano por la URL
      redirige, no muestra el dashboard.
- [ ] Escribir la contraseña mal 5 veces seguidas bloquea la cuenta
      temporalmente (mensaje claro, no un error genérico).
- [ ] Cerrar sesión y volver a entrar funciona normal.

## 2. Alta de cliente (dos pasos)

- [ ] Alta rápida (paso 1) con solo nombre, DNI y teléfono guarda y
      lleva a la ficha del cliente.
- [ ] Repetir el mismo DNI muestra el error de "ya existe" en vez de
      duplicar el cliente.
- [ ] Completar el paso 2 (dirección, ingresos, aval, referido) desde
      la ficha guarda correctamente y la tarjeta de "completar perfil"
      desaparece.
- [ ] El aval queda visible en la ficha del cliente después de
      guardarlo.

## 3. Crear préstamo — Interés sobre saldo (el más usado)

- [ ] Crear un préstamo tipo "Interés sobre saldo" genera **una sola**
      cuota inicial (no toda una tabla).
- [ ] El monto de esa primera cuota es el interés pactado sobre el
      capital (ej. 10% de S/1000 = S/100).
- [ ] La ficha del préstamo muestra el capital pendiente y el tipo
      correctamente.

## 4. Crear préstamo — Cuota fija (método clásico)

- [ ] Crear un préstamo tipo "Cuota fija" genera de una vez **toda la
      tabla de cuotas** según el plazo.
- [ ] La suma de todas las cuotas cuadra con capital + interés total
      (revisar que no falten ni sobren centavos por redondeo).

## 5. Agenda diaria y WhatsApp

- [ ] La agenda muestra las cuotas de hoy, las atrasadas (más antiguas
      primero) y las que vencen en 1-2 días como recordatorio.
- [ ] El botón "WhatsApp" abre `wa.me` con el mensaje ya escrito y el
      número correcto.
- [ ] Repetir el envío un par de veces: el mensaje varía de texto (tono
      cálido, ver `whatsapp.ts`) pero siempre trae el nombre y el monto
      correctos.
- [ ] Después de enviar, queda registrado en el reporte diario (sección
      8) como mensaje enviado.

## 6. Registrar pago — Interés sobre saldo

Probar las tres decisiones posibles sobre la misma cuota (en présta-
mos de prueba distintos, para no mezclar):

- [ ] **Solo interés:** el capital pendiente NO cambia, y se genera la
      cuota del siguiente periodo con el mismo interés.
- [ ] **Abono a capital:** el capital pendiente baja en el monto
      abonado, y el interés de la siguiente cuota se calcula sobre el
      capital ya reducido (menor que antes).
- [ ] **Cancelación total:** el préstamo pasa a "Pagado", el capital
      pendiente queda en 0, y no se genera ninguna cuota más.

## 7. Registrar pago — Cuota fija

- [ ] Pago completo de una cuota la marca "Pagada".
- [ ] Pago parcial la marca "Parcial" y el saldo pendiente de esa cuota
      se actualiza.
- [ ] Al pagar la última cuota pendiente, el préstamo completo pasa a
      "Pagado".

## 8. Job de mora (`/api/jobs/mora`)

- [ ] Dejar vencer una cuota sin pagar y correr el job (a mano, con el
      secret que use el endpoint) la marca "Atrasada" y el préstamo
      pasa a "En mora".
- [ ] En interés sobre saldo, el job igual genera la cuota del
      siguiente periodo (para que el interés se siga acumulando) sin
      tocar el capital.
- [ ] La cuota atrasada se ve destacada en la agenda, priorizada por
      antigüedad.

## 9. Score de clientes

- [ ] Un cliente con historial 100% puntual muestra score A.
- [ ] Provocar una mora en un cliente le baja el score al menos a C,
      aunque su historial anterior fuera bueno.
- [ ] El badge de score se actualiza solo, sin recargar a mano, después
      de registrar un pago.

## 10. Documentos adjuntos (nuevo, 29 de agosto)

- [ ] Con `BLOB_READ_WRITE_TOKEN` configurado, subir una foto de DNI
      desde la ficha del cliente funciona y aparece en la lista.
- [ ] Subir un comprobante de pago o el contrato desde el detalle del
      préstamo funciona y aparece en la lista.
- [ ] Click en un documento de la lista lo abre/descarga bien.
- [ ] Intentar subir un archivo de más de 10 MB o de un formato no
      permitido (ej. .docx) muestra un error claro, no rompe la página.
- [ ] Sin `BLOB_READ_WRITE_TOKEN` configurado, el intento de subida
      muestra el mensaje de "falta configurar" en vez de fallar feo.

## 11. Contrato de préstamo en PDF (nuevo, 29 de agosto)

- [ ] El botón "Descargar contrato" en el detalle del préstamo
      descarga un PDF.
- [ ] Los datos del cliente y las condiciones del préstamo en el PDF
      coinciden con lo que está en pantalla.
- [ ] En un préstamo de cuota fija, la tabla de cuotas del PDF está
      completa y correcta.
- [ ] El aviso de "plantilla pendiente de revisión legal" aparece
      visible en el documento.

## 12. Dashboard y reporte diario

- [ ] El dashboard (solo Admin) muestra cartera activa total y % de
      mora coherentes con los datos de prueba.
- [ ] "Descargar reporte del día" genera un Excel con las tres hojas
      (cobros, pendientes/atrasados, mensajes enviados) y los datos
      cuadran con lo hecho ese día.

## 13. PWA y modo offline

- [ ] La app se puede instalar como PWA desde el navegador (celular o
      Chrome de escritorio).
- [ ] Con el modo avión activado, registrar un pago lo deja en cola
      local con el aviso de "pendiente de sincronizar".
- [ ] Al desactivar el modo avión, el pago en cola se sincroniza solo y
      el aviso desaparece.

## 14. Auditoría (solo Admin)

- [ ] Crear/editar un cliente, préstamo o pago deja rastro en el log de
      auditoría, con el estado anterior y posterior.
- [ ] Un usuario con rol Cobrador no puede ver el log de auditoría.

---

Si todo esto pasa, el siguiente paso es el checklist de despliegue en
producción (PLAN.md, sección 4): base de datos real con backups,
Vercel Blob, Sentry, y las variables de entorno de producción en
Vercel.
