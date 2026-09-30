// Vercel automatically turns this file into a live endpoint at /api/messages.
// Uses Google's Gemini API, which has a genuinely free tier (no credit card,
// no billing account required) — get a key at https://aistudio.google.com/apikey
//
// The frontend sends { system, messages, max_tokens } and expects back
// { content: [{ type: "text", text }] } — this function does the translation
// to and from Gemini's own request/response format, so the frontend never
// needs to know which AI provider is behind it.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: "Server is missing GEMINI_API_KEY. Add it in Vercel → Project → Settings → Environment Variables.",
    });
  }

  try {
    const { system, messages, max_tokens } = req.body;

    if (!messages) {
      return res.status(400).json({ error: "Request body must include 'messages'." });
    }

    const userText = messages.map((m) => m.content).join("\n\n");

    const body = {
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { maxOutputTokens: max_tokens || 1000 },
    };
    if (system) {
      body.system_instruction = { parts: [{ text: system }] };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
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
      console.error("Gemini API error:", data);
      return res.status(response.status).json({ error: data?.error?.message || "Gemini API request failed." });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";

    res.status(200).json({ content: [{ type: "text", text }] });
  } catch (err) {
    console.error("Function error:", err);
    res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
