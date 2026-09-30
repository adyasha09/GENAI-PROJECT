# PersonaForge — Multi-Persona Debate Simulator

A GenAI + Prompt Engineering project: pick a topic and 2–4 AI personas (Economist, Ethicist, Skeptic, Optimist, or your own custom persona), and watch them debate across several rounds — each persona driven by its own engineered system prompt — before a neutral Moderator persona closes with a summary.

**This project is entirely free to run.** It uses Google's **Gemini API**, which has a genuine free tier — no credit card, no billing account, nothing to pay, ever (within Google's free daily usage limits, which are generous for a project like this).

```
personaforge/
├── api/
│   └── messages.js     Vercel serverless function — calls the free Gemini API
├── server.js            Express server — same job, used for Render hosting instead
├── src/
│   ├── PersonaForge.jsx  the app UI and debate orchestration logic
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── render.yaml           Render deployment config
└── .env.example
```

The browser never talks to Google directly. It calls `/api/messages` on the same domain; that request is handled server-side (by `api/messages.js` on Vercel, or `server.js` on Render), which holds your free API key as an environment variable (never committed to git) and forwards the request to Gemini. This keeps your key private and is the standard, secure pattern for using any AI API from a frontend app.

This same repo works on **either** Vercel or Render — pick whichever you prefer; you don't need both.

## 1. Get your free API key (no payment info needed)

1. Go to **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**
2. Sign in with any Google account
3. Click **Create API key**
4. Copy the key — it looks like `AIzaSy...`

That's it — this key is free to use, with no credit card requested anywhere in this flow.

## 2. Prerequisites

- [Node.js](https://nodejs.org) 18+ (check with `node -v`)
- Your free Gemini API key from step 1
- A free GitHub account
- A free Vercel **or** Render account (both let you sign up with GitHub)

## 3. Local setup

```bash
npm install
cp .env.example .env
```
Open `.env` and paste your key into `GEMINI_API_KEY`.

## 4. Run it locally

```bash
npm run dev
```
This starts the frontend at `http://localhost:5173`. To also test the backend locally, in a second terminal run:
```bash
npm run start
```
This starts the full app (frontend + API) together at `http://localhost:3000` — use this URL to actually test the "Begin debate" button locally.

## 5. Push this project to GitHub

```bash
git init
git add .
git status   # double check .env does NOT appear in this list — only .env.example should
git commit -m "Initial commit: PersonaForge (free Gemini version)"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/personaforge.git
git push -u origin main
```

If you already have this repo on GitHub from before, and you're just updating it with these new files:
```bash
git add .
git commit -m "Switch to free Gemini API"
git push
```

## 6. Deploy — Option A: Render (recommended, simplest for this project)

1. Go to **[render.com](https://render.com)** → sign up/log in with GitHub.
2. Click **New +** → **Web Service**.
3. Select your `personaforge` repository (click **Configure account** first if it's not listed).
4. Render should auto-detect `render.yaml` and fill everything in. If not, set manually:
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Instance Type:** Free
5. Under **Environment Variables**, add:
   - `GEMINI_API_KEY` → paste your free key from step 1
6. Click **Create Web Service** and wait a few minutes for the build to finish.
7. Once it shows **Live**, your URL (e.g. `https://personaforge.onrender.com`) is your hosted link.

Note: Render's free tier sleeps after inactivity and takes ~30–50 seconds to wake up on the next visit — normal, and fine for a student submission.

## 7. Deploy — Option B: Vercel

1. Go to **[vercel.com/new](https://vercel.com/new)** → log in with GitHub.
2. Click **Import** next to your `personaforge` repository.
3. Leave build settings as default — Vercel auto-detects this as a Vite project.
4. Under **Environment Variables**, add:
   - `GEMINI_API_KEY` → paste your free key from step 1
5. Click **Deploy**.
6. You'll get a live URL like `https://personaforge.vercel.app`.

## Notes on the prompt engineering design

- Each persona (`buildDebaterSystemPrompt` in `PersonaForge.jsx`) gets its own system prompt defining its worldview and a fixed set of behavioural rules (stay in character, 3–5 sentences, explicitly rebut a prior point from round 2 onward, never break character).
- The Moderator uses a separate, stricter system prompt (`MODERATOR_SYSTEM_PROMPT`) that forces a fixed three-paragraph structure and explicitly forbids declaring a winner.
- The full transcript is re-sent as context on every turn so each persona can respond to what's already been said.
- The frontend talks to `/api/messages` using a provider-agnostic request/response shape; the backend (`server.js` / `api/messages.js`) translates that to and from Gemini's specific API format. This means the AI provider could be swapped again later (e.g. to a different free API) by only touching the backend file, never the UI code.

See `PersonaForge_Project_Report.docx` in this same folder for the full write-up (requirement analysis, system design, prompt engineering methodology, testing, and screenshots).
