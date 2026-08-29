# Lumen — Plan de la aplicación de gestión de préstamos personales

**Fecha:** 17 de agosto de 2026 (actualizado 28 de agosto de 2026)
**Proyecto:** Lumen — Financiera personal orientada a dar pequeños préstamos a personas, con sistema de referidos entre clientes.

Este documento cubre las cuatro etapas: planeamiento, funcionamiento, creación/prueba en local, y despliegue en producción.

---

## 1. Planeamiento

### 1.1 Decisiones tomadas

- **Stack:** Next.js (App Router) + TypeScript + PostgreSQL.
- **Usuarios:** multiusuario con roles — Administrador (dueño) y Cobrador/Asesor (gestionan clientes/cobros asignados).
- **Despliegue:** Vercel + base de datos en la nube.
- **Repositorio:** https://github.com/7ab0/lumen-app (subido el 28 de agosto de 2026, rama `main`).
- **Base de datos:** Neon (Postgres serverless), tanto para desarrollo como para producción — se descartó Docker local (la laptop de trabajo no tiene virtualización de hardware habilitada) y se descartó Supabase (sus extras de auth/storage/realtime no se usan, ya que Lumen usa Auth.js y Vercel Blob por separado; además el plan gratis de Supabase pausa proyectos inactivos tras una semana, mientras que Neon solo "duerme" el cómputo y despierta solo al conectar). Ver detalle de costos en la sección 1.2sexies.
- **Diseño:** mobile-first, instalable como PWA (ver 1.2quinquies) — el cobrador opera principalmente desde el celular en campo, el administrador desde laptop para dashboard y reportes.

### 1.2 Alcance del MVP

- **Fase 1 (MVP):** clientes, préstamos, cuotas, pagos, mora, **agenda diaria de cobros (calendario)**, **botón de WhatsApp (wa.me)**, **reporte diario descargable (Excel)**, **calificación (score) simple de clientes**, **log de auditoría**, **backups automáticos**, **seguridad de login (recuperación de contraseña + límite de intentos)**, **documentos adjuntos por cliente/préstamo**, **contrato de préstamo en PDF**, **recordatorio previo al vencimiento**, **dashboard básico de cartera**, **monitoreo de errores** y **PWA con registro de pagos offline**. Responde directamente a la prioridad de "fácil manejo" tanto en celular como en laptop.
- **Fase 2:** sistema de referidos entre clientes.
- **Fase 3:** migración a WhatsApp Cloud API oficial (envío automático sin clics), dashboard financiero avanzado, envío automático de reportes por correo.

### 1.2bis Decisiones de la segunda ronda

- **WhatsApp:** se empieza con enlaces `wa.me` (gratis, sin verificación de negocio, un clic para enviar). Se evalúa migrar a la API oficial de WhatsApp Business (Cloud API de Meta) más adelante si se necesita automatizar envíos masivos. Precios investigados: la API oficial cobra por conversación de 24h (~US$0.02 utilidad/autenticación, ~US$0.07 marketing) o por mensaje (~US$0.003), y proveedores como Beex ofrecen planes ilimitados desde US$200/mes; requiere verificar el negocio en Meta Business Manager y aprobación de plantillas (proceso de días). No se justifica para el arranque.
- **Reporte diario:** descarga manual desde la app (botón "Descargar reporte del día"), formato Excel (.xlsx). No se envía automáticamente por correo en esta fase.
- **Calificación de clientes:** sin criterio formal de la empresa todavía; se propone una fórmula simple basada en puntualidad de pago (sección 2.10), con el campo `score` listo para ajustar cuando definan los criterios reales.

### 1.2ter Recomendaciones incorporadas antes de producción

Tras revisar el plan, se decidió incorporar al MVP (antes de pasar a producción) las siguientes mejoras, detalladas en las secciones 1.5 y 2:

- Log de auditoría de cambios (quién modificó qué préstamo, cuota o pago, y cuándo).
- Backups automáticos diarios de la base de datos (retención mínima 30 días).
- Seguridad de acceso: recuperación de contraseña y límite de intentos fallidos de login.
- Documentos adjuntos: foto de DNI, comprobante de pago, contrato firmado (subida de archivos a un bucket).
- Contrato de préstamo generado en PDF con los términos del crédito.
- Recordatorio automático uno o dos días antes del vencimiento de cuota (no solo el día del cobro).
- Dashboard básico de cartera (cartera activa total y % de mora general) adelantado al MVP, en versión simple — el dashboard avanzado completo sigue en Fase 3.
- Campos y relación lista para refinanciamiento/renegociación de deuda (funcionalidad completa se define más adelante).
- Monitoreo de errores en producción (Sentry o el logging integrado de Vercel).
- Campos de garantías, avales e ingresos declarados en el registro de cliente/préstamo.

### 1.2quater Diferido (pendiente de revisión posterior)

- **Cumplimiento normativo:** Ley de Protección de Datos Personales (Ley 29733) para el manejo de DNI/teléfono/dirección de clientes, consentimiento explícito, política de privacidad, y verificación de que la tasa de interés cobrada respete los topes regulados por el BCRP para créditos de consumo. **Queda registrado como pendiente, se revisará más adelante antes de operar formalmente con clientes reales — no bloquea el arranque del desarrollo del MVP.**
- **Firma digital del contrato** (cliente firma en pantalla al desembolsar), **geolocalización al registrar un pago**, y **tasas de interés/mora configurables por tipo de préstamo** (en vez de un valor global fijo): mejoras propuestas y evaluadas en la tercera ronda (28 de agosto de 2026); quedan como mejoras candidatas para una fase posterior al MVP, no bloquean el arranque.

### 1.2quinquies Decisiones de la tercera ronda (mobile + alta de clientes)

- **Mobile-first + PWA con modo offline:** la interfaz es una sola app web responsive (Next.js + Tailwind) que se adapta a celular y laptop, sin apps nativas separadas. Se instala como PWA en el celular del cobrador. Los pagos registrados sin señal se guardan localmente (IndexedDB / service worker) y se sincronizan automáticamente al recuperar conexión, para no perder cobros en campo por señal irregular.
- **Alta de cliente en dos pasos:** desde el celular, el alta rápida solo pide nombre, DNI y teléfono (lo mínimo para no perder tiempo frente al cliente); el resto de los datos (dirección, ingresos declarados, aval, foto de DNI, quién lo refirió) se completa después desde la ficha del cliente, ya sea en el celular o en laptop. Los campos correspondientes en el modelo de datos (sección 1.5) ya son opcionales, por lo que no requiere cambios de esquema — es una decisión de flujo/UI.

### 1.2sexies Base de datos: Neon vs. Docker local vs. Supabase (28 de agosto de 2026)

Al intentar levantar Postgres local con Docker en la laptop de trabajo, Docker Desktop falló por falta de soporte de virtualización de hardware. En vez de resolverlo a nivel de BIOS/IT, se evaluó usar directamente una base de datos Postgres en la nube (que de todas formas ya estaba planeada para producción):

- **Docker Desktop:** gratis para uso individual (plan Personal, sin límite de tiempo); solo tiene costo si una empresa necesita varios usuarios con el plan Team ($15-16/usuario/mes). No es el problema de costos — el problema fue técnico (virtualización).
- **Neon (elegido):** plan gratis con 0.5 GB de almacenamiento y 100 horas de cómputo por mes por proyecto, hasta 100 proyectos. Al superar el límite gratis, pausa el cómputo (no cobra automático); el siguiente plan es pago por uso sin mínimo mensual (~US$0.106/hora de cómputo, ~US$0.35/GB de almacenamiento al mes).
- **Supabase (descartado):** plan gratis más limitado para este caso — solo 2 proyectos gratis y los proyectos inactivos se pausan a la semana (hay que reactivarlos a mano). Además incluye auth, storage y APIs en tiempo real que Lumen no usa (ya tiene Auth.js y Vercel Blob), así que no aporta valor extra sobre Neon para este proyecto. Su siguiente plan pago es $25/mes fijo.

Decisión: usar Neon tanto en desarrollo como en producción, sin Docker local. Esto simplifica el setup (una sola base de datos, no dos) y evita depender de la virtualización de la laptop.

### 1.3 Stack técnico

| Capa | Elección | Por qué |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Full-stack en un solo repo (UI + Server Actions), sin backend separado. |
| Base de datos | PostgreSQL | Relacional, ideal para préstamos/cuotas/pagos con integridad referencial. |
| ORM | Prisma | Migraciones versionadas, tipado automático. |
| Autenticación | Auth.js (NextAuth) con Credentials | Login email/password, roles en sesión (admin/cobrador), recuperación de contraseña y bloqueo por intentos fallidos. |
| Validación | Zod | Validación de formularios y datos de servidor. |
| UI | Tailwind CSS + shadcn/ui | Componentes accesibles, rápidos de estilizar, responsive mobile-first. |
| PWA / offline | Serwist (o next-pwa) + IndexedDB | App instalable en celular; cola de pagos registrados sin señal que se sincroniza al reconectar. |
| Fechas/cálculos | date-fns | Vencimientos, mora, plazos. |
| Almacenamiento de archivos | Vercel Blob (o S3) | Documentos adjuntos: DNI, comprobantes, contratos en PDF. |
| Generación de PDF | @react-pdf/renderer o Puppeteer | Contrato de préstamo descargable. |
| Monitoreo de errores | Sentry (o logging integrado de Vercel) | Visibilidad de errores en producción antes de que los reporte un usuario. |
| Hosting | Vercel | Despliegue automático desde GitHub. |
| Base de datos (dev y producción) | Neon (Postgres serverless) | Compatible con Vercel, capa gratuita generosa, sin necesidad de Docker local (ver 1.2sexies). |

### 1.4 Roles y permisos

- **Administrador:** ve y gestiona todo — clientes, préstamos, cobradores, reportes, dashboard de cartera y log de auditoría. Puede crear cobradores.
- **Cobrador/Asesor:** ve solo clientes/préstamos asignados. Registra pagos y ve mora de su cartera.

### 1.5 Modelo de datos

```
User (staff)
  id, name, email, password_hash, role [admin|cobrador],
  failed_login_attempts, locked_until, created_at

Client
  id, first_name, last_name, document_id, phone, email, address,
  referred_by_client_id -> Client (nullable, auto-referencia)
  declared_income (nullable),
  created_by -> User, status [activo|inactivo], created_at,
  score [A|B|C|D], score_updated_at

Guarantor (Aval)
  id, client_id -> Client (a quién avala),
  full_name, document_id, phone, address, created_at

Loan (Préstamo)
  id, client_id -> Client, type [interes_solo|cuota_fija],
  principal_amount, outstanding_principal (saldo de capital pendiente;
  fuente de verdad en interes_solo, ver sección 2.0),
  interest_rate, term_months (referencial en interes_solo, ver 2.0),
  payment_frequency [semanal|quincenal|mensual],
  start_date, status [activo|pagado|en_mora|cancelado|refinanciado],
  refinanced_from_loan_id -> Loan (nullable, referencia al préstamo original),
  assigned_collector_id -> User, created_by -> User, created_at

Installment (Cuota)
  id, loan_id -> Loan, number, due_date,
  amount_due, amount_paid, late_fee,
  status [pendiente|pagada|parcial|atrasada],
  reminder_sent_at (nullable)

Payment (Pago)
  id, installment_id -> Installment, loan_id -> Loan,
  type [cuota|interes|abono_capital|cancelacion_total] (ver sección 2.0),
  amount, interest_amount, principal_amount (desglose; 0 en cuota_fija),
  payment_date, method [efectivo|transferencia|otro],
  registered_by -> User, notes,
  synced_from_offline (boolean, default false)

ReferralReward (Fase 2)
  id, referrer_client_id -> Client, referred_client_id -> Client,
  reward_amount, status [pendiente|pagado], triggered_by_loan_id -> Loan

MessageLog (registro de mensajes WhatsApp)
  id, client_id -> Client, installment_id -> Installment (nullable),
  channel [whatsapp_link|whatsapp_api], message_content, sent_at,
  sent_by -> User

Attachment (Documentos adjuntos)
  id, related_type [client|loan|payment], related_id,
  file_url, type [dni|comprobante_pago|contrato|otro],
  uploaded_by -> User, uploaded_at

AuditLog (Log de auditoría)
  id, user_id -> User, action [create|update|delete],
  entity_type, entity_id, before_data (json), after_data (json),
  created_at
```

`referred_by_client_id` en `Client` modela la cadena de referidos (árbol de referidos, incentivos futuros). `MessageLog` registra cada mensaje de WhatsApp enviado desde la agenda diaria. `Attachment` centraliza cualquier documento adjunto (DNI, comprobantes, contratos), y `AuditLog` deja rastro de cambios sensibles para auditoría interna. `refinanced_from_loan_id` deja el esquema listo para renegociar deuda sin implementar aún el flujo completo. `synced_from_offline` en `Payment` marca los pagos que se registraron sin conexión desde la PWA y se sincronizaron después, útil para detectar conflictos o pagos duplicados al reconectar.

---

## 2. Cómo debe funcionar

### 2.0 Mecánica de repago: interés sobre saldo vs. cuota fija (28 de agosto de 2026)

Lumen maneja dos formas de prestar y cobrar, seleccionables al crear el préstamo (campo `type`):

- **Interés sobre saldo (`interes_solo`) — la que más se usa en la práctica.** El capital queda fijo mientras el préstamo esté abierto. Cada periodo (normalmente un mes) se cobra un interés (10% u otro % pactado) sobre el capital pendiente (`outstanding_principal`). Al llegar la fecha, el cliente tiene tres caminos:
  1. **Pagar solo el interés:** el capital sigue igual y el próximo periodo se vuelve a cobrar el mismo interés sobre el mismo capital.
  2. **Abonar parte del capital:** paga el interés del periodo más un monto extra que reduce `outstanding_principal`; el interés de los periodos siguientes se recalcula sobre el capital ya reducido.
  3. **Cancelar todo:** paga el interés del periodo más todo el capital pendiente; el préstamo se cierra (`status = pagado`).

  Las cuotas **no se generan todas de una vez**: se crea solo la primera al abrir el préstamo, y la siguiente se genera automáticamente recién cuando la anterior se resuelve — ya sea porque se pagó (interés, abono o cancelación) o porque venció sin pago (el job de mora la marca `atrasada` y genera igual la cuota del periodo siguiente, para que el interés se siga acumulando).

  Si un cliente no paga nada en un periodo, ese interés queda como deuda pendiente (cuota `atrasada`) pero el capital **no cambia** y no se aplica una penalidad extra — simplemente el próximo periodo se le vuelve a cobrar el mismo interés sobre el mismo capital, más lo que ya debía.

  El plazo pactado (`term_months`) es solo **referencial**: si se cumple y el cliente sigue prefiriendo pagar solo interés, no se fuerza el cierre automáticamente — se decide caso por caso entre el cobrador/administrador y el cliente. La ficha del préstamo muestra un aviso cuando esto ocurre.

- **Cuota fija (`cuota_fija`) — el método clásico.** Se genera de una sola vez, al crear el préstamo, una tabla fija de cuotas a lo largo del plazo pactado, con el capital + interés simple repartidos en partes iguales (como ya funcionaba antes de esta decisión). Sigue disponible para los préstamos que se pacten así.

- **Registrar cliente (alta rápida en dos pasos):** paso 1, desde el celular en campo, solo nombre, DNI y teléfono — lo mínimo para no hacer esperar al cliente. Paso 2 (cuando haya tiempo, en celular o laptop): dirección, ingresos declarados (opcional), aval/garante (opcional), documento adjunto (foto DNI) y selección opcional de quién lo refirió. El cliente queda operativo (se le puede crear un préstamo) desde el paso 1; el resto de campos se completan después sin bloquear el flujo.
- **Crear préstamo:** monto, tasa, plazo, frecuencia, fecha inicio, cobrador asignado, y **tipo** (interés sobre saldo o cuota fija, ver 2.0) → según el tipo, se genera solo la primera cuota (interés sobre saldo) o toda la tabla de cuotas (cuota fija). El contrato en PDF descargable queda pendiente de implementar (ver "Próximos pasos").
- **Registrar pago:** desde la agenda o la ficha del préstamo, sobre la cuota vigente. En cuota fija, funciona como antes (pago completo → `pagada`, parcial → `parcial`, todas pagadas → préstamo `pagado`). En interés sobre saldo, el cobrador indica qué decidió el cliente (solo interés / abona capital / cancela todo, ver 2.0) y el sistema calcula el reparto entre interés y capital, actualiza `outstanding_principal` y genera la siguiente cuota si el préstamo sigue abierto. Se puede adjuntar comprobante de pago. Si se registra sin conexión desde la PWA, queda en cola local y se sincroniza automáticamente al recuperar señal (marcado con `synced_from_offline`).
- **Mora:** job diario revisa cuotas vencidas con saldo pendiente → pasan a `atrasada`; el préstamo se marca `en_mora`. En cuota fija se aplica interés moratorio configurable. En interés sobre saldo no hay penalidad extra (ver 2.0): el capital queda intacto y el job genera de una vez la cuota del siguiente periodo, para que el interés se siga acumulando mes a mes mientras no se pague.
- **Recordatorio previo al vencimiento:** job diario identifica cuotas que vencen en 1–2 días y las marca para recordatorio; aparecen destacadas en la agenda para que el cobrador envíe el WhatsApp antes de que venzan (reduce mora), registrando `reminder_sent_at`.
- **Refinanciamiento (esquema listo, flujo a definir):** un préstamo `en_mora` puede marcarse `refinanciado` y dar origen a un nuevo `Loan` con `refinanced_from_loan_id` apuntando al original.
- **Referidos (Fase 2):** árbol de quién refirió a quién; bono opcional al completar el referido su primer pago/préstamo.
- **Dashboard básico de cartera (MVP):** cartera activa total, % de mora general, próximos vencimientos de los próximos 7 días. Visible para el Administrador.
- **Dashboard avanzado (Fase 3):** ranking de referidores y métricas adicionales sobre la base del dashboard básico del MVP.
- **Log de auditoría:** cada creación, edición o eliminación sobre `Client`, `Loan`, `Installment` y `Payment` queda registrada en `AuditLog` con el estado anterior y posterior, visible solo para el Administrador.

### Agenda diaria de cobros (calendario) — pantalla principal

Pantalla de inicio: selector de calendario (por defecto "hoy") + lista de cuotas que vencen ese día más las atrasadas de días anteriores, priorizadas por antigüedad de mora, y las que vencen en 1–2 días marcadas como recordatorio. Cada fila muestra cliente, monto, badge de color con su score, y dos botones: "WhatsApp" (mensaje listo para enviar) y "Marcar como pagado" (registro de pago precargado). Cobradores ven solo su cartera asignada; el admin ve todo con filtro opcional. Diseñada mobile-first: en celular es una lista vertical de tarjetas fácil de usar con el pulgar; en laptop aprovecha el ancho como tabla.

### Botón rápido de WhatsApp

Junto a cada cuota, el botón "WhatsApp" arma un enlace `https://wa.me/<telefono>?text=<mensaje>` con una plantilla editable (variables `{nombre}`, `{monto}`, `{fecha_vencimiento}`, `{dias_mora}`). Se abre WhatsApp con el mensaje listo; el cobrador confirma el envío. Cada envío se registra en `MessageLog`. La API oficial de WhatsApp (Cloud API de Meta) se evalúa para una fase posterior si el volumen justifica automatizar envíos masivos (tiene costo por conversación y requiere verificación de negocio).

### Reporte diario descargable

Botón "Descargar reporte del día" que genera un Excel (.xlsx) bajo demanda con tres hojas: Cobros del día, Pendientes/atrasados del día, y Mensajes enviados (desde `MessageLog`). Descarga manual al cerrar el turno, sin infraestructura extra.

### Calificación (score) de clientes

| Score | Criterio |
|---|---|
| A — Excelente | ≥95% de cuotas a tiempo, sin mora activa |
| B — Bueno | 80–94% a tiempo, sin mora activa |
| C — Regular | 60–79% a tiempo, o mora activa leve (<15 días) |
| D — Riesgoso | <60% a tiempo, o mora activa ≥15 días |

Se recalcula automáticamente con cada pago o cambio de estado de cuota; se muestra como badge de color en la ficha del cliente y en la agenda diaria. Ajustable cuando la empresa defina sus propios criterios (ej. peso por referidos o monto histórico).

### Seguridad de acceso

Login con límite de intentos fallidos (bloqueo temporal tras N intentos, campos `failed_login_attempts` y `locked_until` en `User`) y flujo de recuperación de contraseña por correo. Contraseñas hasheadas (ya contemplado en el checklist de despliegue).

### PWA y modo offline (nuevo)

La app se puede instalar desde el navegador del celular (ícono en el home screen, pantalla completa). Un service worker cachea la interfaz y permite que la agenda diaria y el registro de pagos sigan funcionando sin señal: los pagos marcados offline se guardan en IndexedDB y se envían al servidor automáticamente en cuanto el celular recupera conexión, con indicador visual de "pendiente de sincronizar" mientras tanto. No cubre creación de préstamos nuevos ni adjuntos pesados sin conexión (fase posterior si se necesita); el alcance inicial es no perder el registro de un cobro por falta de señal en campo.

---

## 3. Creación y prueba en local

1. Node 20+, pnpm, Docker, Git.
2. `npx create-next-app@latest lumen-app --typescript --tailwind --app --eslint`
3. Instalar: `prisma @prisma/client next-auth @auth/prisma-adapter zod date-fns` + shadcn/ui.
4. Instalar utilidades para las mejoras nuevas: cliente de almacenamiento (`@vercel/blob` o SDK de S3) para adjuntos, librería de PDF (`@react-pdf/renderer` o similar) para el contrato, `@sentry/nextjs` para monitoreo, y `@serwist/next` (o `next-pwa`) para la PWA con soporte offline.
5. PostgreSQL local vía `docker-compose.yml` (imagen `postgres:16`).
6. `.env.local` con `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, credenciales del bucket de almacenamiento y DSN de Sentry.
7. `npx prisma init` → definir `schema.prisma` con las entidades de 1.5 (incluye `Guarantor`, `Attachment`, `AuditLog`) → `npx prisma migrate dev --name init`.
8. Seed: se entregó `lumen-datos-ejemplo.xlsx` (6 clientes, 7 préstamos, 34 cuotas, 23 pagos, mensajes de WhatsApp, score calculado con fórmulas) como base realista para `prisma/seed.ts`. **Pendiente: este archivo se perdió junto con el código anterior — hay que volver a generarlo o recuperarlo antes de este paso.**
9. `pnpm dev` → probar flujos completos en `localhost:3000`, incluyendo instalación de la PWA y un ciclo de registro de pago sin conexión (modo avión) para validar la sincronización.
10. Pruebas unitarias (Vitest) para cálculo de amortización, mora y recordatorios previos; pruebas manuales de flujos end-to-end (incluyendo carga de documentos, generación de PDF de contrato, y sincronización offline).

---

## 4. Despliegue en producción

1. Subir el repo a GitHub.
2. Crear base de datos en Neon o Supabase, copiar `DATABASE_URL` de producción, y activar backups automáticos diarios (retención mínima 30 días) en el panel del proveedor.
3. Crear bucket de almacenamiento (Vercel Blob o S3) para los adjuntos y configurar credenciales.
4. Crear proyecto en Sentry y obtener el DSN para monitoreo de errores.
5. Importar el repo en Vercel; configurar `DATABASE_URL`, `NEXTAUTH_SECRET` (nuevo), `NEXTAUTH_URL`, credenciales del bucket y DSN de Sentry en variables de entorno.
6. Asegurar `"postinstall": "prisma generate"` en `package.json`.
7. Correr `npx prisma migrate deploy` contra producción antes del primer uso real.
8. Checklist: HTTPS (por defecto en Vercel), contraseñas hasheadas, recuperación de contraseña funcional, límite de intentos de login activo, secrets fuertes, backups verificados con una restauración de prueba, `.env` fuera del repo, monitoreo de errores recibiendo eventos de prueba, PWA instalable verificada en un celular real.
9. Dominio propio opcional vía Vercel → Settings → Domains.

---

## Próximos pasos

1. ~~Recuperar o volver a generar `lumen-datos-ejemplo.xlsx`~~ — resuelto: se reemplazó por un seed sintético (`prisma/seed.ts`) con datos equivalentes.
2. ~~Implementar Fase 1: esquema Prisma completo + pantallas de clientes/préstamos, con alta de cliente en dos pasos y diseño mobile-first~~ — **hecho el 28 de agosto de 2026.** El proyecto Next.js se reconstruyó desde cero (el código anterior se había perdido) y está en `C:\Proyectos\Lumen` en la computadora del usuario: esquema Prisma completo, login con roles, layout mobile-first, agenda diaria con WhatsApp y registro de pago, alta de cliente en dos pasos, creación de préstamos con generación automática de cuotas, dashboard básico, reporte diario en Excel, job de mora, y PWA instalable con cola de pagos offline. Ver el `README.md` del proyecto para instrucciones de instalación local.
3. Definir el texto exacto de la plantilla de mensaje de WhatsApp por defecto — **primer borrador escrito el 29 de agosto de 2026** (ver sección siguiente): tono cálido, varias variantes por caso, firmado como "Lummen". Falta que el negocio lo revise y, si se quiere, hacerlo editable desde la app.
4. ~~Pendiente para completar el MVP sobre este scaffold: subida real de documentos adjuntos (DNI, comprobantes) a Vercel Blob o S3, contrato de préstamo en PDF descargable, pruebas unitarias (Vitest) de amortización/mora/score~~ — **hecho el 29 de agosto de 2026** (ver sección siguiente). Queda pendiente probarlo con un `BLOB_READ_WRITE_TOKEN` real y con pruebas manuales end-to-end en pantalla.
5. Configurar backups, monitoreo (Sentry) y seguridad de login antes de invitar usuarios reales (checklist ya documentado en la sección 4, sin código adicional pendiente más allá de las variables de entorno).
6. Referidos, API oficial de WhatsApp y dashboard avanzado en fases siguientes.
7. Evaluar en una fase posterior al MVP: firma digital del contrato en pantalla, geolocalización al registrar un pago, y tasas de interés/mora configurables por tipo de préstamo.
8. **Diferido:** revisión de cumplimiento normativo (Ley 29733, topes de tasa de interés BCRP) antes de operar formalmente con clientes reales.

### Repositorio en GitHub (28 de agosto de 2026)

El código quedó subido en https://github.com/7ab0/lumen-app (rama `main`), para poder trabajarlo desde cualquier computadora. En la revisión rápida antes de subirlo se encontró y corrigió un bug real: `src/proxy.ts` (el middleware de autenticación) protegía sin querer `/api/jobs/mora`, el endpoint que llama el cron diario de Vercel sin cookie de sesión — lo habría redirigido a `/login` en vez de dejarlo correr. Ya está corregido (se excluyó `api/jobs` del matcher) antes del push.

### Dos tipos de préstamo: interés sobre saldo y cuota fija (28 de agosto de 2026)

Tras levantar el proyecto en la laptop con Neon, se aclaró cómo se prestan realmente los montos: capital fijo, interés mensual (10% u otro % pactado) sobre el saldo, y cada mes el cliente elige pagar solo interés (rueda otro mes) o cancelar todo (capital + interés). También se puede abonar parte del capital. Se agregó este tipo de préstamo (`interes_solo`) como el que más se usa, dejando el método de cuota fija original (`cuota_fija`) disponible como segunda opción — ver el detalle completo en la sección 2.0.

Esto cambió el esquema de Prisma (`Loan.type`, `Loan.outstandingPrincipal`, `Payment.type/interestAmount/principalAmount`) y buena parte de la lógica de negocio (creación de préstamo, registro de pago, job de mora, dashboard, formularios). **Pendiente en la laptop:** correr `npx prisma migrate dev --name interes_sobre_saldo` para aplicar el cambio de esquema contra Neon, y `npx prisma db seed` de nuevo para regenerar los datos de ejemplo con la nueva mecánica.

### Cobradora "Lummen" y tono de las plantillas de WhatsApp (29 de agosto de 2026)

Se definió que la cobradora del seed se llama "Lummen" (`lummen@lumen.pe`, reemplaza al placeholder "Luis Torres" en `prisma/seed.ts`), y que los mensajes de WhatsApp (`src/lib/whatsapp.ts`) usan un tono cálido y cercano en vez de uno frío de cobranza, firmados como "Lummen". Hay 3 variantes por caso (atrasada / vence hoy / recordatorio próximo) elegidas al azar. Es un primer borrador — sigue pendiente que el negocio revise el texto exacto (punto 3 de "Próximos pasos").

### Pruebas unitarias, subida de adjuntos y contrato en PDF (29 de agosto de 2026)

Se agregó Vitest (`pnpm test`) con 31 pruebas para la lógica de negocio más delicada: `amortization.ts` (cuota fija, redondeo, interés sobre saldo), `score.ts` (umbrales A/B/C/D y mora activa, mockeando Prisma) y `whatsapp.ts` (que el mensaje siempre tenga las variables correctas pese a la selección aleatoria). Es un punto de partida — falta cubrir el job de mora (`api/jobs/mora`) y la agenda diaria (`lib/agenda.ts`), y sumar pruebas manuales end-to-end de los flujos completos.

También se completaron las dos piezas que faltaban del MVP:

- **Documentos adjuntos:** `server/actions/attachments.ts` sube el archivo a Vercel Blob y crea el `Attachment` en la base de datos; `components/attachments-panel.tsx` es el panel de subida + lista, usado tanto en la ficha del cliente (DNI, otros) como en el préstamo (contrato, comprobante de pago, otros). Requiere `BLOB_READ_WRITE_TOKEN` configurado — sin él, la subida falla con un mensaje claro en vez de romperse. **Pendiente probarlo con un token real.**
- **Contrato de préstamo en PDF:** `lib/pdf/contrato.tsx` (con `@react-pdf/renderer`, ya era dependencia del proyecto) arma el documento con los datos del cliente, las condiciones del préstamo y, en cuota fija, la tabla de cuotas; se descarga desde `/api/prestamos/[id]/contrato`. Incluye un aviso explícito de que es una plantilla de trabajo pendiente de revisión legal (ver punto 8, cumplimiento normativo diferido) — no reemplaza la validación de un abogado.

### Usuario de soporte (Gustavo, 29 de agosto de 2026)

Se agregó un tercer usuario de staff en el seed para soporte: Gustavo
(`soporte@lumen.pe`). El esquema solo tiene dos roles (`ADMIN` |
`COBRADOR`, ver `schema.prisma`) — no existe un rol "soporte"
independiente, así que "todos los privilegios" se resolvió con el rol
`ADMIN` (el de mayor permiso del sistema: ve y gestiona todo, incluye
dashboard y log de auditoría). Si más adelante se necesita un rol de
soporte con permisos distintos a los de un Administrador dueño del
negocio, hay que agregarlo como un tercer valor del enum `Role` — no es
lo mismo pedirlo hoy.

### Nota sobre este scaffold (28 de agosto de 2026)

El proyecto se generó en un entorno en la nube sin acceso a `binaries.prisma.sh` (el CDN de donde Prisma descarga sus motores) ni a `fonts.googleapis.com`, así que no fue posible correr `prisma generate` ni `next build` completos ahí. Sí se verificó: el esquema Prisma se revisó a mano con cuidado, TypeScript compila limpio en todo el proyecto salvo los tipos que dependen del cliente de Prisma generado (se resuelven solos al correr `prisma generate` con internet normal), ESLint pasa sin advertencias, y una compilación de prueba con las fuentes de Google desactivadas terminó sin errores. En la computadora del usuario, con internet normal, `pnpm install` + `prisma generate` + `pnpm dev` deberían funcionar sin ajustes adicionales — si algo falla, es el primer lugar donde mirar.
