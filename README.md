# FinCoach - Personal Finance AI Coach

Full-stack app with:
- **Backend:** Flask + JWT auth + SQLite + FAISS + Groq RAG
- **Frontend:** React (Vite) + plain CSS

## Live Deployment

- Frontend (Vercel): `https://fincoach-neon.vercel.app/`
- Backend (Railway): `https://fincoach-production-3573.up.railway.app/`

## Features

- User authentication (register/login/me) with JWT
- CSV upload and transaction parsing
- Dashboard with category and monthly spending insights
- Transactions table with month/category filtering
- AI Coach chat with retrieval-augmented answers from your own data
- Chat history per authenticated user

## Local Development

### 1) Backend

```bash
cd backend
pip install -r requirements.txt
```

Create/update `backend/.env`:

```env
GROQ_API_KEY=your_groq_key_here
JWT_SECRET_KEY=your_jwt_secret_here
```

Run backend:

```bash
python app.py
```

Backend runs on `http://localhost:5000`.

### 2) Frontend

```bash
cd frontend
npm install
```

Create `.env.local` in `frontend/`:

```env
VITE_API_URL=http://localhost:5000
```

Run frontend:

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Production Setup

### Vercel (Frontend)

Project settings:
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Environment variable:
- `VITE_API_URL=https://fincoach-production-3573.up.railway.app`

Notes:
- `frontend/vercel.json` handles SPA rewrites.
- After env changes, redeploy frontend.

### Railway (Backend)

Set service variables:
- `GROQ_API_KEY=<valid_groq_key>`
- `JWT_SECRET_KEY=<strong_secret>`

Important:
- Updating local `backend/.env` does **not** update Railway.
- After changing Railway variables, restart/redeploy service.

## API Endpoints

Public:
- `POST /api/auth/register`
- `POST /api/auth/login`

Protected (JWT required):
- `GET /api/auth/me`
- `POST /api/upload`
- `GET /api/summary`
- `GET /api/transactions?category=All&month=All`
- `GET /api/chat/history`
- `POST /api/chat` (SSE streaming)

## Project Layout

- `backend/app.py` - Flask app and API routes
- `backend/models.py` - SQLAlchemy models (`User`, `UserFile`, `ChatMessage`)
- `backend/ingest.py` - CSV parsing, chunking, embeddings, FAISS index
- `backend/retriever.py` - similarity retrieval from FAISS
- `backend/coach.py` - Groq streaming responses with RAG context
- `frontend/src/context/AuthContext.jsx` - auth state + token persistence
- `frontend/src/lib/api.js` - API base URL helper
- `frontend/src/pages` - Dashboard, Chat, Transactions, Upload, Login, Register

## Troubleshooting

- **Chat shows `401 invalid_api_key`:**
  Railway has invalid/missing `GROQ_API_KEY`. Update Railway variable and redeploy backend.

- **Frontend looks outdated on Vercel:**
  Ensure latest commit is deployed, correct branch selected, and redeploy with cleared cache.

- **`ModuleNotFoundError: sentence_transformers` (local backend):**
  Run `pip install -r backend/requirements.txt`.

- **Auth routes return 401 unexpectedly:**
  Token may be expired/invalid. Sign out and sign in again.

## Deploy Checklist

Before announcing a new release, verify all items:

1. Backend is healthy at Railway root URL.
2. Railway variables are set: `GROQ_API_KEY`, `JWT_SECRET_KEY`.
3. Frontend variable is set in Vercel: `VITE_API_URL`.
4. Vercel project uses:
   - Root Directory `frontend`
   - Build Command `npm run build`
   - Output Directory `dist`
5. Latest branch/commit is deployed on Vercel.
6. Frontend was redeployed after env var changes.
7. Register/login works in production.
8. CSV upload succeeds and dashboard metrics appear.
9. Chat streams response without Groq key errors.
10. Route refresh works (`/chat`, `/transactions`, `/upload`) without 404.
