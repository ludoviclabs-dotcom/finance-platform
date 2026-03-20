# Deployment Guide — Finance Platform

## Architecture

```
┌─────────────────────────────────────────────┐
│                VPS Hostinger                │
│                                             │
│  ┌──────────────┐    ┌──────────────┐       │
│  │   frontend   │    │     api      │       │
│  │  (Next.js)   │───▶│  (FastAPI)   │       │
│  │  :3000       │    │  :8000       │       │
│  └──────────────┘    └──────────────┘       │
│                                             │
│         Docker Compose orchestration        │
└─────────────────────────────────────────────┘
```

| Service    | Technology | Port | Role                              |
|------------|------------|------|-----------------------------------|
| `frontend` | Next.js 16 | 3000 | UI, SSR, client-side interactions  |
| `api`      | FastAPI    | 8000 | REST API, business logic, calculs  |

## Local development with Docker

```bash
# 1. Copy env file
cp .env.example .env

# 2. Build and start both services
docker compose up --build

# 3. Access
#    Frontend: http://localhost:3000
#    API:      http://localhost:8000
#    API docs: http://localhost:8000/docs
```

## Project structure (deployment files)

```
finance-platform/
├── docker-compose.yml          # Orchestrates frontend + api
├── .env.example                # Environment variables template
├── .github/workflows/
│   ├── frontend.yml            # CI: lint, type check, build
│   └── api.yml                 # CI: import validation
├── apps/frontend/
│   ├── Dockerfile              # Multi-stage Next.js build
│   ├── .dockerignore
│   └── next.config.ts          # output: "standalone" for Docker
└── apps/api/
    ├── Dockerfile              # Python slim image
    └── .dockerignore
```

## CI/CD (GitHub Actions)

Two workflows run automatically on push/PR when their respective `apps/` directory changes:

- **frontend.yml** — `npm ci` → `lint` → `tsc --noEmit` → `build`
- **api.yml** — `pip install` → verify app/models/services import correctly

No automatic deployment is configured yet. These workflows validate code quality only.

## Deploying to Hostinger VPS (future steps)

These steps are **not yet automated** and will need to be done manually:

1. **Provision the VPS** — Ubuntu, min 2 GB RAM recommended
2. **Install Docker & Docker Compose** on the VPS
3. **Clone the repo** on the VPS
4. **Configure `.env`** — copy `.env.example` to `.env` and set production values:
   - `NEXT_PUBLIC_API_BASE_URL` should point to the public API URL (e.g. `https://api.yourdomain.com`)
   - Note: this variable is baked into the frontend at **build time** (`docker compose up --build` re-builds with the value)
5. **Build and run**: `docker compose up --build -d`
6. **Set up a reverse proxy** (Nginx or Caddy) to:
   - Route `yourdomain.com` → frontend `:3000`
   - Route `yourdomain.com/api` or `api.yourdomain.com` → api `:8000`
   - Handle SSL/TLS (Let's Encrypt)
7. **Configure a firewall** — open only ports 80, 443, and SSH

## What remains to be done

- [ ] Reverse proxy (Nginx/Caddy) configuration
- [ ] SSL/TLS certificates (Let's Encrypt)
- [ ] Domain name pointing to VPS IP
- [ ] PostgreSQL database (when needed)
- [ ] Redis cache (when needed)
- [ ] Automated deployment via GitHub Actions (SSH deploy or container registry)
- [ ] Health check monitoring
- [ ] Log aggregation
- [ ] Backup strategy
