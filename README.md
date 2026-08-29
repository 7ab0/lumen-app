# Lumen — Gestión de préstamos personales

Financiera personal: agenda diaria de cobros, clientes, préstamos, cuotas,
pagos, mora, WhatsApp, reporte diario en Excel, score de clientes y PWA con
registro de pagos offline. Ver el plan completo del proyecto (documento
`plan-lumen-app.md`) para el contexto de producto y las decisiones tomadas.

## Estado de este scaffold

Este proyecto se reconstruyó desde cero después de perder el código y el
archivo `lumen-datos-ejemplo.xlsx` originales. Lo que ya está implementado:

- Esquema Prisma completo (clientes, avales, préstamos, cuotas, pagos,
  referidos, mensajes, adjuntos, auditoría).
- Login con roles (Administrador / Cobrador), bloqueo por intentos
  fallidos.
- Layout mobile-first (barra inferior en celular, sidebar en laptop).
- Agenda diaria de cobros con WhatsApp (`wa.me`) y registro de pago.
- Alta de cliente en dos pasos (rápida + completar perfil).
- Dos tipos de préstamo (28 de agosto de 2026, ver plan sección "2.0"):
  **interés sobre saldo** (el más usado: el capital queda fijo y cada
  periodo el cliente paga solo el interés o cancela todo; también admite
  abono parcial de capital) y **cuota fija** (el método clásico: tabla
  de cuotas generada de una sola vez, con interés simple/flat).
- Dashboard básico de cartera + reporte diario descargable en Excel.
- Job de mora (`/api/jobs/mora`, programado en `vercel.json`).
- PWA instalable con cola de pagos offline (IndexedDB, sincroniza sola).
- Seed de datos de ejemplo (reemplaza el xlsx perdido).
- Documentos adjuntos (29 de agosto de 2026): subida real de archivos
  (DNI, comprobantes, contrato) a Vercel Blob desde la ficha del cliente
  y del préstamo — requiere `BLOB_READ_WRITE_TOKEN` configurado.
- Contrato de préstamo en PDF descargable (29 de agosto de 2026), desde
  el detalle del préstamo — es una plantilla de trabajo, pendiente de
  revisión legal antes de usarla formalmente (ver plan, punto 8).
- Pruebas unitarias (Vitest) de amortización, score y plantillas de
  WhatsApp — `pnpm test`.

Lo que queda pendiente para completar el MVP del plan (ver también la
sección "Próximos pasos" del documento de plan):

- Probar la subida de adjuntos con un `BLOB_READ_WRITE_TOKEN` real (acá
  solo se verificó el código, sin una cuenta de Vercel Blob a mano).
- Backups automáticos y monitoreo de errores (Sentry): se configuran en
  el proveedor de base de datos y en Vercel al desplegar, no requieren
  código adicional en este repo.
- Más pruebas: job de mora, agenda diaria, y un checklist de pruebas
  manuales end-to-end de los flujos completos en pantalla.
- Mejoras evaluadas y diferidas: firma digital del contrato,
  geolocalización al registrar un pago, tasas configurables por tipo de
  préstamo.

## Requisitos

- Node 20+
- pnpm
- Docker (para PostgreSQL local)

## Instalación local

```bash
pnpm install

# Base de datos local
docker compose up -d

# Copia el archivo de variables de entorno y ajusta lo que necesites
cp .env.example .env

# Genera el cliente de Prisma y aplica el esquema
npx prisma generate
npx prisma migrate dev --name init

# Carga datos de ejemplo (clientes, préstamos, cuotas, pagos)
npx prisma db seed

pnpm dev
```

Abre `http://localhost:3000`. Usuarios de prueba (creados por el seed):

- **Admin:** `admin@lumen.pe` / `lumen1234`
- **Cobradora (Lummen):** `lummen@lumen.pe` / `lumen1234`
- **Soporte (Gustavo, con todos los privilegios — rol ADMIN):** `soporte@lumen.pe` / `lumen1234`

> Nota: la generación del cliente de Prisma (`prisma generate` /
> `migrate`) descarga binarios desde `binaries.prisma.sh`. Si tu red
> corporativa bloquea ese dominio vas a ver un error 403 — prueba desde
> otra red o revisa la política de salida de tu firewall.

### Probar el modo offline (PWA)

El service worker (`public/sw.js`) está escrito a mano en vez de
generarse en el build, porque Next.js 16 usa Turbopack por defecto y los
plugins de PWA basados en webpack (como `@serwist/next`) todavía no son
compatibles con Turbopack — así que funciona igual en `pnpm dev` que en
producción.

1. Abre la app (`pnpm dev`) en el celular o en Chrome de escritorio,
   instálala como PWA (ícono "Instalar app").
2. Activa el modo avión, marca un pago desde la agenda — queda en cola
   local (IndexedDB).
3. Desactiva el modo avión: el pago se sincroniza solo y desaparece el
   aviso de "pendiente de sincronizar".

## Variables de entorno

Ver `.env.example`. Como mínimo para desarrollo local necesitas
`DATABASE_URL` y `AUTH_SECRET` (genera uno con
`openssl rand -base64 33`).

## Despliegue en producción

Ver la sección 4 del plan del proyecto (`plan-lumen-app.md`) para el
checklist completo: Vercel + Neon/Supabase + Vercel Blob + Sentry +
`vercel.json` (ya incluido) para el cron del job de mora.
