# FinCoach — AI Personal Finance Coach

An AI-powered personal finance web app that lets users upload their bank CSV files and chat with an AI coach that answers questions based on their real transaction data. Built with Flask, React, Groq LLM, and a RAG pipeline using FAISS vector search.

---

## What it does

- Upload any bank CSV file — automatically detects column formats from any bank in the world
- Get an instant spending dashboard with category breakdown and monthly trends
- Chat with an AI coach that gives specific answers grounded in your real transaction data
- Every user gets a private account with persistent chat history and saved data
- Supports Revolut, Italian banks, US banks, Kaggle datasets, and any CSV with date and amount columns

---



## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, Flask, Flask-JWT-Extended, Flask-CORS |
| Database | SQLite + SQLAlchemy |
| AI / LLM | Groq API — llama-3.3-70b-versatile |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| Vector Search | FAISS (faiss-cpu) |
| Frontend | React 18 + Vite |
| Styling | Plain CSS with CSS variables |
| Auth | JWT tokens stored in localStorage |
| CSV Parsing | Pandas |

---


## Features

- **User authentication** — register and login with email and password, JWT tokens with 7-day expiry
- **Private data per user** — every user has their own FAISS index and database records, fully isolated
- **Smart CSV detection** — two-step column detection handles any bank format automatically
- **Spending dashboard** — total spent, biggest category, transaction count, savings potential, monthly trend bars
- **AI chat with streaming** — responses stream token by token in real time
- **Persistent chat history** — conversations are saved to the database and restored on next login
- **Transaction table** — filterable by category and month, sorted by amount
- **Drag and drop upload** — with success, error, and loading states

---

## Setup and Installation

### Requirements

- Python 3.10 or higher
- Node.js 18 or higher
- A free Groq API key from [console.groq.com](https://console.groq.com)

### 1. Clone the repository

```bash
git clone https://github.com/YOURUSERNAME/fincoach.git
cd fincoach
```

### 2. Backend setup

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` folder:


GROQ_API_KEY=your_groq_api_key_here
JWT_SECRET_KEY=any_long_random_string_minimum_32_characters

Start the backend:

```bash
python app.py
```

The API will run on `http://localhost:5000`

### 3. Frontend setup

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### 4. First use

1. Go to `http://localhost:5173`
2. Click "Sign up" and create an account
3. Go to the Upload page and upload your bank CSV file
4. Go to Dashboard to see your spending breakdown
5. Go to AI Coach and start asking questions about your finances

---

## API Endpoints

| Method | Route | Auth Required | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Create a new account |
| POST | /api/auth/login | No | Login and get JWT token |
| GET | /api/auth/me | Yes | Get current user info |
| POST | /api/upload | Yes | Upload CSV and build FAISS index |
| GET | /api/summary | Yes | Get dashboard statistics |
| GET | /api/transactions | Yes | Get filtered transaction list |
| POST | /api/chat | Yes | Send message, get streaming AI response |
| GET | /api/chat/history | Yes | Get saved chat history |

---

## Database Models

**User** — id, email, password_hash, name, plan (free/pro), created_at

**UserFile** — id, user_id, filename, row_count, uploaded_at

**ChatMessage** — id, user_id, role (user/assistant), content, created_at

---

## Supported CSV Formats

The app uses a two-step column detection system:

**Step 1 — Local matching:** checks for known column name variants from common banks (Date, Transaction Date, Started Date, Amount, Debit Amount, Description, Merchant Name, etc.)

**Step 2 — AI fallback:** if local matching fails, sends the column names to Groq LLM which maps them to the standard format automatically

Tested with:
- Revolut exports
- Italian banks (Intesa Sanpaolo, UniCredit, Fineco)
- US banks (Chase, Bank of America format)
- Kaggle personal finance datasets
- Any CSV containing date and amount columns

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| GROQ_API_KEY | Yes | Your Groq API key from console.groq.com |
| JWT_SECRET_KEY | Yes | Any random string, minimum 32 characters |

---

## Roadmap

- [ ] Stripe subscription billing (Free vs Pro plan)
- [ ] Weekly AI-generated email reports
- [ ] Anomaly detection and spending alerts
- [ ] PDF export of monthly reports
- [ ] Deploy to Railway + Vercel
- [ ] Interactive charts with Recharts
- [ ] Mobile app with React Native

---

## License

MIT License — free to use, modify, and distribute.