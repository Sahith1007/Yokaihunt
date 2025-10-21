# YokaiHunt

Monorepo containing:
- Frontend: Next.js (app/) + Phaser game (components/Game.tsx)
- Backend API: Node/Express + socket.io + Colyseus (server/)
- Database: Prisma ORM targeting Postgres (Railway)
- Smart contracts: Algorand PyTeal (contracts/)

## Local development
- Copy `.env.example` to `.env` and fill values.
- Start backend: `npm run server` (listens on 4000)
- Start frontend: `npm run dev` (Next.js on 3000)
- Open http://localhost:3000

## Environment variables
Place these in the respective platform dashboards.

Frontend (Vercel):
- NEXT_PUBLIC_API_URL = https://your-backend.onrailway.app
- NEXT_PUBLIC_SOCKET_URL = https://your-backend.onrailway.app
- NEXT_PUBLIC_COLYSEUS_ENDPOINT = wss://your-backend.onrailway.app

Backend (Railway service):
- PORT = 4000 (Railway sets this automatically; code respects `PORT`)
- DATABASE_URL = postgres://... (Railway Postgres URL)
- JWT_SECRET = your-strong-secret

Database (Railway Postgres):
- Create a Postgres database and copy its `DATABASE_URL` into the backend service.

## Deploy: Backend → Railway
1) Create a new Railway project and add a service from this repo.
2) Set Start Command to: `npm run server`.
3) Add variables: `DATABASE_URL`, `JWT_SECRET`. Railway sets `PORT`.
4) Add a Postgres plugin (or separate service) and connect the `DATABASE_URL` to the backend.
5) Run Prisma migrations from the service shell:
   - `npm run prisma:generate`
   - `npm run prisma:deploy`
6) Once deployed, note the public backend URL. Example: `https://your-backend.up.railway.app`.

## Deploy: Frontend → Vercel
1) Import the GitHub repo into Vercel.
2) Framework Preset: Next.js (root).
3) Set Environment Variables:
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_SOCKET_URL`
   - `NEXT_PUBLIC_COLYSEUS_ENDPOINT`
4) Deploy. The frontend will call the Railway backend.

## Notes
- socket.io CORS is permissive in dev; you can restrict origins in `server/index.js` for production.
- If you modify Prisma schema, re-run `npm run prisma:generate` and deploy migrations (`npm run prisma:deploy`).
- Colyseus matchmaking is exposed over the same backend URL.
