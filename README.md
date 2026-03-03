# SADAPOS Frontend

Frontend de SADAPOS (Next.js).

## Requisitos

- Node.js 18+
- npm

## Comandos utiles

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Documentacion operativa

- Manual completo: `docs/manual-operativo-kiosco-goloso.md`
- Checklist diaria (A4): `docs/checklist-diaria-kiosco-goloso.md`

## Configuracion de API

Este frontend consume el backend usando la variable `NEXT_PUBLIC_API_URL`.

Ejemplo en `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Si no se define, se usa el fallback configurado en `lib/api`.

## Despliegue (resumen)

1. Configurar `NEXT_PUBLIC_API_URL` con la URL real del backend.
2. Ejecutar build:

```bash
npm run build
npm run start
```

## Docker (imagen de produccion)

Build local:

```bash
docker build -t sadapos-frontend:local .
docker run --rm -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://localhost:8080 sadapos-frontend:local
```

Publicacion automatica:

- Workflow: `.github/workflows/frontend-image.yml`
- Registry objetivo: `ghcr.io/<tu-usuario>/sadapos-frontend`
- Tags generados: `latest` (rama principal), `sha`, `nombre-de-rama`
