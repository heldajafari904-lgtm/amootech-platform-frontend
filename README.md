# Amootech platform frontend

Minimal Next.js App Router frontend for the Amootech development environment.

Docker Compose in the sibling `amootech-platform-backend` repository is the
canonical local workflow:

```bash
cd ../amootech-platform-backend
docker compose up --build
```

The frontend is available at http://localhost:3000. Browser-side backend calls
should use `NEXT_PUBLIC_API_BASE_URL`; see `.env.example`.

Run lint through Compose:

```bash
docker compose exec frontend npm run lint
```
