# Blog App API

RESTful backend for a full-featured blog platform — authentication, blog CRUD, comments, likes, reports, user management, and Cloudinary image uploads.

**Live API:** [https://api.awanlabs.online](https://api.awanlabs.online)  
**API Docs:** [Postman Documentation](https://documenter.getpostman.com/view/50227688/2sBY4VHwD8)

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

---

## Features

- **Auth** — Register, login, JWT sessions, profile get/update
- **Blogs** — Full CRUD for admins, public listing, slugs, tags, categories, stats
- **Engagement** — Comments, likes (toggle), content reports
- **Users** — Public profiles, liked blogs, comments; admin user management
- **Uploads** — Signed Cloudinary uploads with webhook verification
- **Caching** — Redis-backed response caching
- **Ops** — Docker Compose, Nginx, GitHub Actions CI/CD, AWS-ready

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (ESM), Express |
| Database | PostgreSQL + Prisma ORM |
| Cache | Redis (ioredis) |
| Auth | JWT + bcrypt |
| Media | Cloudinary |
| Infra | Docker, Nginx, GitHub Actions |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (recommended), **or** local PostgreSQL + Redis

### 1. Clone & install

```bash
git clone https://github.com/Abu-bakar-webdeveloper/blog-app.git
cd blog-app/server
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your database, JWT, Redis, and Cloudinary values.

### 3. Run with Docker (recommended)

From `server/`:

```bash
docker compose up -d
npx prisma migrate dev
npm run prisma:seed
```

Or run the app locally against Dockerized Postgres/Redis:

```bash
docker compose up -d db redis
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

Server defaults to **http://localhost:3000**.

### 4. Health check

```bash
curl http://localhost:3000/health
```

### Seed admin (local only)

| Field | Value |
|-------|--------|
| Email | `admin@blog.com` |
| Password | `admin123` |

Change this password before any production use.

---

## API Overview

Base URL (local): `http://localhost:3000`  
Base URL (prod): `https://api.awanlabs.online`

Protected routes use:

```http
Authorization: Bearer <token>
```

| Group | Prefix | Highlights |
|-------|--------|------------|
| Health | `GET /health` | Service status |
| Auth | `/api/auth` | Register, login, profile |
| Blogs | `/api/blogs` | CRUD, comments, likes, reports, stats |
| Users | `/api/users` | Profiles, likes, admin user list |
| Reports | `/api/reports` | Admin moderation |
| Upload | `/api/upload` | Cloudinary signature & verify |

### Example — list blogs

```http
GET /api/blogs
Authorization: Bearer <admin_token>
```

```json
{
  "success": true,
  "data": {
    "blogs": [
      {
        "id": "cmsf3jupr0001a9e3okguyfai",
        "title": "New Blog Post from Postman",
        "content": "This is a detailed blog post...",
        "slug": "new-blog-post-from-postman",
        "excerpt": "A brief summary of the blog post",
        "type": "TECHNOLOGY",
        "tags": ["postman"]
      }
    ]
  }
}
```

Full interactive reference: **[Postman Docs](https://documenter.getpostman.com/view/50227688/2sBY4VHwD8)**  
Manual scenario checklist: [`ROUTE_TESTING.md`](./ROUTE_TESTING.md)

---

## Project Structure

```
blog-app/
├── .github/workflows/     # CI & deploy pipelines
├── ROUTE_TESTING.md       # Manual API test scenarios
└── server/
    ├── app.js             # Express entrypoint
    ├── prisma/            # Schema, migrations, seed
    ├── postman/           # Postman collection (YAML)
    ├── src/
    │   ├── config/        # Env, Redis
    │   ├── controllers/
    │   ├── middleware/    # Auth & roles
    │   ├── routes/
    │   ├── services/
    │   └── utils/
    ├── docker-compose.yml
    ├── Dockerfile
    ├── AWS_DEPLOYMENT_GUIDE.md
    └── REDIS_GUIDE.md
```

---

## Environment Variables

See [`server/.env.example`](./server/.env.example) for the full list. Required at minimum:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing tokens |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection |
| `CLOUDINARY_*` | Cloud name, API key, API secret |
| `PORT` | Server port (default `3000`) |
| `NODE_ENV` | `development` \| `production` |

---

## Scripts

Run from `server/`:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon |
| `npm start` | Production start |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run migrations |
| `npm run prisma:seed` | Seed admin user |
| `npm run prisma:studio` | Open Prisma Studio |

---

## Deployment

- **Docker / Compose:** `server/docker-compose.yml`, `server/docker-compose.prod.yml`
- **AWS walkthrough:** [`server/AWS_DEPLOYMENT_GUIDE.md`](./server/AWS_DEPLOYMENT_GUIDE.md)
- **Redis caching notes:** [`server/REDIS_GUIDE.md`](./server/REDIS_GUIDE.md)

---

## License

This project is provided as-is for learning and portfolio use. Add a license file if you intend to open-source it formally.
