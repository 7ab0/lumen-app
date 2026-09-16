# Retomar Lumen en otra PC

El repo en sí es portable (clonar + instalar), pero hay cosas que **no**
viven en git (ver `.gitignore`: `.env*`, `node_modules`, `.next`,
`.vercel`) y hacen falta para levantar el proyecto en una máquina nueva.
Esta guía cubre eso — para el resto (features, comandos de desarrollo),
ver [README.md](README.md).

## Requisitos

- Node 20+
- pnpm — versión exacta fijada en `package.json` → `packageManager`
  (`pnpm@10.28.0`). Si tu pnpm global es distinto, usa
  `corepack use pnpm@10.28.0` o instala esa versión puntual.

## Pasos

```bash
git clone https://github.com/7ab0/lumen-app.git
cd lumen-app
pnpm install
cp .env.example .env
npx prisma generate
```

Con `.env` completo (ver siguiente sección), sigue con `pnpm dev` como
en el README.

> **Nota:** `npx prisma generate` (y `prisma migrate`) descarga binarios
> desde `binaries.prisma.sh`. Si la red de la PC nueva bloquea ese
> dominio (firewall corporativo, antivirus interceptando HTTPS) vas a
> ver un error 403 — prueba desde otra red o revisa la política de
> salida antes de sospechar del código.

## Variables de entorno (`.env`)

`.env.example` lista las variables; esto es de dónde sacar cada una:

- **`DATABASE_URL`** (Neon, Postgres) y **`AUTH_SECRET`** — mínimo para
  levantar el proyecto en local.
- **`BLOB_READ_WRITE_TOKEN`** (Vercel Blob) — hace falta para que
  funcione la subida de adjuntos (DNI, comprobantes, contrato).
- `NEXTAUTH_URL`, `SENTRY_DSN` — opcionales en local.

### Forma simple: `vercel env pull`

Este proyecto **no tiene** `.vercel/project.json` en esta PC (no se
verificó `vercel link` aquí), así que no se pudo confirmar si ya está
importado en Vercel con las variables configuradas ahí. Si sí lo está,
en la PC nueva es más simple hacer:

```bash
npx vercel login
npx vercel link
npx vercel env pull .env
```

Esto trae `DATABASE_URL`, `AUTH_SECRET` y `BLOB_READ_WRITE_TOKEN` (y lo
demás) directo desde Vercel, sin copiarlas a mano.

### Forma manual (si el proyecto no está en Vercel o prefieres no usar la CLI)

Copia `DATABASE_URL`, `AUTH_SECRET` y `BLOB_READ_WRITE_TOKEN` desde el
`.env` de esta PC **por un canal seguro** (gestor de contraseñas tipo
Bitwarden/1Password) — nunca por chat o email en texto plano (ver
sección 8 de la guía de flujo de trabajo de Clan).

## ⚠️ Importante: NO reseedear la base de datos

La base de datos (Neon) es la misma para desarrollo actualmente. Si la
PC nueva usa el mismo `DATABASE_URL` que esta PC, **no corras
`npx prisma db seed` a la ligera**: el seed borra `Payment`,
`Installment` y `Loan` (y sus `MessageLog`/`Attachment` ligados) antes
de resembrar, para que la corrida sea idempotente — así que reseedear
desde la otra PC borraría los préstamos/pagos de prueba (o reales) que
ya existan en esa base.

Si necesitas datos de ejemplo en una base *distinta* (otra rama de
desarrollo, un `DATABASE_URL` propio para la PC nueva), ahí sí es seguro
correr el seed.

## `docker-compose.yml` — obsoleto

Quedó en el repo pero ya no se usa: el 28 de agosto de 2026 se descartó
Postgres local en Docker a favor de Neon (mismo `DATABASE_URL` de
desarrollo entre PCs). No hace falta levantarlo con `docker compose up`.

## Resumen rápido

1. Clonar + `pnpm install` + `cp .env.example .env` + `npx prisma generate`
2. Completar `.env` con `vercel env pull` (si el proyecto ya está
   linkeado en Vercel) o copiando las 3 variables a mano por un canal
   seguro
3. **No** correr `npx prisma db seed` si el `DATABASE_URL` es el mismo
   que el de esta PC
4. Ignorar `docker-compose.yml`, ya no aplica
