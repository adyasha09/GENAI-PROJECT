// This file is only used when hosting on Render (or any platform that runs a
// persistent Node server). Vercel ignores this file entirely and uses
// api/messages.js instead — so this project can be deployed on either
// platform from the exact same GitHub repo.
//
// Uses Google's Gemini API, which has a genuinely free tier (no credit card,
// no billing account required) — get a key at https://aistudio.google.com/apikey

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

if (!GEMINI_API_KEY) {
  console.warn(
    "\n⚠️  GEMINI_API_KEY is not set. Add it in Render → your service → Environment.\n"
  );
}

// The frontend still sends the same shape it always has: { system, messages, max_tokens }.
// This function translates that into Gemini's request format and translates
// Gemini's response back into the same { content: [{ type: "text", text }] }
// shape the frontend already knows how to read — so PersonaForge.jsx itself
// never needed to change when the AI provider changed.
async function callGemini({ system, messages, max_tokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const userText = (messages || []).map((m) => m.content).join("\n\n");

  const body = {
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { maxOutputTokens: max_tokens || 1000 },
  };
  if (system) {
    body.system_instruction = { parts: [{ text: system }] };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || "Gemini API request failed.";
    const err = new Error(message);
    err.status = response.status;
    err.details = data;
    throw err;
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";

  return { content: [{ type: "text", text }] };
}

app.post("/api/messages", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Server is missing GEMINI_API_KEY." });
    }
    if (!req.body?.messages) {
      return res.status(400).json({ error: "Request body must include 'messages'." });
    }

    const result = await callGemini(req.body);
    res.json(result);
  } catch (err) {
    console.error("Server error:", err.message, err.details || "");
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, model: GEMINI_MODEL }));

// Serve the built React app (created by `npm run build`, output to ./dist)
const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`PersonaForge server running on port ${PORT}`);
});
