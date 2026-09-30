import React, { useState, useRef, useEffect } from "react";
import { Play, Plus, X, Gavel, Loader2, RotateCcw, Users, ScrollText } from "lucide-react";

const PALETTE = [
  { accent: "#B5654A", tint: "#F4E7E1" }, // clay
  { accent: "#3C6E71", tint: "#E3EEEE" }, // teal
  { accent: "#7A5C8E", tint: "#EFE7F2" }, // plum
  { accent: "#8A8A3C", tint: "#F1F1DF" }, // olive
];

const PRESET_PERSONAS = [
  {
    id: "economist",
    name: "The Economist",
    description: "Reasons from incentives, trade-offs, scarcity, and market efficiency. Distrusts arguments that ignore costs or unintended consequences.",
  },
  {
    id: "ethicist",
    name: "The Ethicist",
    description: "Reasons from moral principle, rights, fairness, and duty. Pushes back when practicality is used to excuse harm.",
  },
  {
    id: "skeptic",
    name: "The Skeptic",
    description: "Demands evidence, distrusts grand claims, and probes for hidden assumptions, exaggeration, or wishful thinking in every argument.",
  },
  {
    id: "optimist",
    name: "The Optimist",
    description: "Focuses on human ingenuity, historical progress, and the upside case. Believes problems are solvable and change is usually net positive.",
  },
  {
    id: "pragmatist",
    name: "The Pragmatist",
    description: "Cares about what actually works in practice, implementation realities, and incremental steps over ideological purity.",
  },
  {
    id: "traditionalist",
    name: "The Traditionalist",
    description: "Values continuity, established institutions, and caution about discarding what has worked. Wary of untested change.",
  },
];

function buildDebaterSystemPrompt(persona, topic) {
  return `You are role-playing as a debate persona called "${persona.name}" in a formal multi-person debate.

DEBATE TOPIC: "${topic}"

YOUR PERSONA: ${persona.description}

RULES YOU MUST FOLLOW:
- Stay strictly in character as ${persona.name} the entire time. Argue from this persona's distinctive worldview, not a neutral or balanced position.
- Write 3 to 5 sentences only (roughly 70-110 words). Be punchy, specific, and substantive — never repeat a point you or anyone else already made.
- If earlier turns exist in the transcript below, you MUST explicitly engage with at least one specific point another debater made — rebut it, concede part of it, or sharpen it — before adding your own point.
- Never break character, never mention you are an AI or a language model, never add meta-commentary about the debate itself, never use headers, labels, or bullet points. Write as natural spoken debate remarks in first person.`;
}

const MODERATOR_SYSTEM_PROMPT = (topic) => `You are a neutral, even-handed debate moderator closing out a formal debate on the topic: "${topic}".

Given the full transcript below, write a closing summary with exactly three short paragraphs, no headers or labels:
1. The strongest point made by each distinct persona (one sentence per persona).
2. Where the debaters most directly clashed or disagreed.
3. A neutral closing note on what a thoughtful listener should weigh, WITHOUT declaring a single "winner" and without inserting your own opinion on the topic.

Keep the whole response under 160 words. Do not mention that you are an AI.`;

async function callClaude(systemPrompt, userContent) {
  // Calls our own backend (server/index.js), which holds the real Anthropic
  // API key and forwards the request. The browser never sees the key.
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || data?.error || "Request to the backend failed.";
    throw new Error(message);
  }
  const text = (data.content || [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  return text || "(no response)";
}

function transcriptAsText(messages, topic) {
  if (messages.length === 0) return `Debate topic: "${topic}". No arguments have been made yet. You are opening the debate.`;
  const lines = messages.map((m) => `${m.name}: ${m.text}`).join("\n\n");
  return `Debate topic: "${topic}"\n\nTranscript so far:\n\n${lines}\n\nIt is now your turn. Give your next argument, following your rules.`;
}

export default function PersonaForge() {
  const [phase, setPhase] = useState("setup"); // setup | debating | done
  const [topic, setTopic] = useState("Should social media platforms be regulated like public utilities?");
  const [selectedIds, setSelectedIds] = useState(["economist", "ethicist", "skeptic", "optimist"]);
  const [customPersonas, setCustomPersonas] = useState([]);
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [rounds, setRounds] = useState(2);
  const [messages, setMessages] = useState([]);
  const [moderatorText, setModeratorText] = useState("");
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [stage, setStage] = useState(""); // "" | "debating" | "moderating"
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  const allPersonas = [...PRESET_PERSONAS, ...customPersonas];
  const activePersonas = allPersonas
    .filter((p) => selectedIds.includes(p.id))
    .map((p, i) => ({ ...p, color: PALETTE[i % PALETTE.length] }));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, moderatorText, currentSpeaker]);

  function toggleId(id) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  function addCustomPersona() {
    if (!customName.trim() || !customDesc.trim()) return;
    if (activePersonas.length >= 4) return;
    const id = "custom-" + Date.now();
    const persona = { id, name: customName.trim(), description: customDesc.trim() };
    setCustomPersonas((prev) => [...prev, persona]);
    setSelectedIds((prev) => [...prev, id]);
    setCustomName("");
    setCustomDesc("");
  }

  function removePersona(id) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setCustomPersonas((prev) => prev.filter((p) => p.id !== id));
  }

  async function runDebate() {
    if (activePersonas.length < 2 || !topic.trim()) return;
    setPhase("debating");
    setMessages([]);
    setModeratorText("");
    setError("");
    setStage("debating");

    try {
      let history = [];
      for (let r = 0; r < rounds; r++) {
        for (const persona of activePersonas) {
          setCurrentSpeaker(persona.name);
          const sys = buildDebaterSystemPrompt(persona, topic);
          const userContent = transcriptAsText(history, topic);
          const text = await callClaude(sys, userContent);
          const entry = { name: persona.name, text, color: persona.color, round: r + 1 };
          history = [...history, entry];
          setMessages((prev) => [...prev, entry]);
        }
      }
      setCurrentSpeaker(null);
      setStage("moderating");
      const modText = await callClaude(
        MODERATOR_SYSTEM_PROMPT(topic),
        transcriptAsText(history, topic).replace("It is now your turn. Give your next argument, following your rules.", "Write your closing summary now.")
      );
      setModeratorText(modText);
      setStage("");
      setPhase("done");
    } catch (err) {
      setError(err.message || "Something went wrong while generating the debate.");
      setStage("");
      setCurrentSpeaker(null);
      setPhase(messages.length > 0 ? "done" : "setup");
    }
  }

  function resetAll() {
    setPhase("setup");
    setMessages([]);
    setModeratorText("");
    setCurrentSpeaker(null);
    setStage("");
    setError("");
  }

  return (
    <div
      style={{
        fontFamily: "'Georgia', 'Times New Roman', serif",
        background: "#12202E",
        minHeight: "100vh",
        color: "#EDE6D6",
      }}
      className="w-full flex flex-col"
    >
      {/* Header */}
      <div
        style={{ borderBottom: "1px solid #2E4155", background: "#0D1720" }}
        className="px-6 py-5 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Gavel size={26} color="#C9A227" />
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.3 }}>PersonaForge</div>
            <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: 12, color: "#9AAAB8" }}>
              a chamber for AI personas to argue it out
            </div>
          </div>
        </div>
        {phase !== "setup" && (
          <button
            onClick={resetAll}
            style={{
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
              border: "1px solid #3C526A",
              color: "#C9D6E0",
            }}
            className="flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-[#1B2A3A] transition"
          >
            <RotateCcw size={14} /> New debate
          </button>
        )}
      </div>

      {phase === "setup" && (
        <div className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
          {error && (
            <div
              style={{
                background: "#3A1F22",
                border: "1px solid #8A3B3B",
                color: "#F3C9C9",
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
                fontSize: 13,
              }}
              className="rounded px-4 py-3 mb-6"
            >
              {error}
            </div>
          )}
          <label style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: 13, color: "#9AAAB8" }}>
            Debate topic
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={2}
            style={{
              background: "#0D1720",
              border: "1px solid #2E4155",
              color: "#EDE6D6",
              fontFamily: "'Georgia', serif",
            }}
            className="w-full mt-2 mb-6 rounded px-4 py-3 text-lg resize-none focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
            placeholder="e.g. Should AI-generated art be eligible for copyright?"
          />

          <div className="flex items-center justify-between mb-3">
            <label style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: 13, color: "#9AAAB8" }}>
              Choose 2–4 personas
            </label>
            <span style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: 12, color: "#6B7E8F" }}>
              {activePersonas.length}/4 selected
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {PRESET_PERSONAS.map((p) => {
              const selected = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleId(p.id)}
                  style={{
                    textAlign: "left",
                    background: selected ? "#1B2A3A" : "#0D1720",
                    border: selected ? "1px solid #C9A227" : "1px solid #23384A",
                  }}
                  className="rounded px-4 py-3 transition"
                >
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                  <div
                    style={{
                      fontFamily: "'Helvetica Neue', Arial, sans-serif",
                      fontSize: 12,
                      color: "#9AAAB8",
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    {p.description}
                  </div>
                </button>
              );
            })}
          </div>

          {customPersonas.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {customPersonas.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: "#1B2A3A",
                    border: "1px solid #C9A227",
                  }}
                  className="rounded px-4 py-3 relative"
                >
                  <button
                    onClick={() => removePersona(p.id)}
                    className="absolute top-2 right-2 opacity-60 hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                  <div
                    style={{
                      fontFamily: "'Helvetica Neue', Arial, sans-serif",
                      fontSize: 12,
                      color: "#9AAAB8",
                      marginTop: 4,
                    }}
                  >
                    {p.description}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{ border: "1px dashed #2E4155", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}
            className="rounded p-4 mb-8"
          >
            <div style={{ fontSize: 12, color: "#9AAAB8", marginBottom: 8 }}>Add a custom persona</div>
            <div className="flex gap-2 mb-2">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Name (e.g. The Futurist)"
                style={{ background: "#0D1720", border: "1px solid #2E4155", color: "#EDE6D6" }}
                className="flex-1 rounded px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <input
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="One line describing their stance/worldview"
                style={{ background: "#0D1720", border: "1px solid #2E4155", color: "#EDE6D6" }}
                className="flex-1 rounded px-3 py-2 text-sm focus:outline-none"
              />
              <button
                onClick={addCustomPersona}
                disabled={activePersonas.length >= 4}
                style={{ background: "#C9A227", color: "#0D1720" }}
                className="rounded px-3 py-2 flex items-center gap-1 text-sm font-semibold disabled:opacity-40"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-8">
            <label style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: 13, color: "#9AAAB8" }}>
              Rounds
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((r) => (
                <button
                  key={r}
                  onClick={() => setRounds(r)}
                  style={{
                    background: rounds === r ? "#C9A227" : "#0D1720",
                    color: rounds === r ? "#0D1720" : "#EDE6D6",
                    border: "1px solid #2E4155",
                    fontFamily: "'Helvetica Neue', Arial, sans-serif",
                  }}
                  className="w-9 h-9 rounded font-semibold text-sm"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={runDebate}
            disabled={activePersonas.length < 2 || !topic.trim()}
            style={{
              background: activePersonas.length < 2 || !topic.trim() ? "#3C526A" : "#C9A227",
              color: "#0D1720",
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
            }}
            className="w-full py-3 rounded font-bold text-base flex items-center justify-center gap-2 transition"
          >
            <Play size={18} /> Begin debate
          </button>
        </div>
      )}

      {(phase === "debating" || phase === "done") && (
        <div className="flex-1 flex flex-col items-center px-6 py-6">
          <div
            style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#9AAAB8", fontSize: 12 }}
            className="mb-2 flex items-center gap-2 max-w-2xl w-full"
          >
            <Users size={14} /> {activePersonas.map((p) => p.name).join(" · ")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }} className="max-w-2xl w-full">
            {topic}
          </div>

          <div ref={scrollRef} className="max-w-2xl w-full flex-1 overflow-y-auto pr-1" style={{ maxHeight: "62vh" }}>
            {messages.map((m, idx) => (
              <div key={idx} className="mb-4 rounded" style={{ background: m.color.tint, padding: "14px 16px" }}>
                <div
                  style={{
                    fontFamily: "'Helvetica Neue', Arial, sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                    color: m.color.accent,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    marginBottom: 6,
                  }}
                >
                  {m.name} <span style={{ opacity: 0.6, fontWeight: 400 }}>· round {m.round}</span>
                </div>
                <div style={{ color: "#1E2A33", fontSize: 15, lineHeight: 1.55 }}>{m.text}</div>
              </div>
            ))}

            {stage === "debating" && currentSpeaker && (
              <div
                style={{
                  fontFamily: "'Helvetica Neue', Arial, sans-serif",
                  color: "#9AAAB8",
                  fontSize: 13,
                }}
                className="flex items-center gap-2 mb-4"
              >
                <Loader2 size={14} className="animate-spin" /> {currentSpeaker} is composing a response…
              </div>
            )}

            {error && (
              <div
                style={{
                  background: "#3A1F22",
                  border: "1px solid #8A3B3B",
                  color: "#F3C9C9",
                  fontFamily: "'Helvetica Neue', Arial, sans-serif",
                  fontSize: 13,
                }}
                className="rounded px-4 py-3 mb-4"
              >
                {error}
              </div>
            )}

            {stage === "moderating" && (
              <div
                style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#9AAAB8", fontSize: 13 }}
                className="flex items-center gap-2 mb-4"
              >
                <Loader2 size={14} className="animate-spin" /> Moderator is preparing a closing summary…
              </div>
            )}

            {moderatorText && (
              <div
                style={{
                  background: "#0D1720",
                  border: "1px solid #C9A227",
                  borderRadius: 6,
                  padding: "16px 18px",
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Helvetica Neue', Arial, sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                    color: "#C9A227",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    marginBottom: 8,
                  }}
                  className="flex items-center gap-2"
                >
                  <ScrollText size={14} /> Moderator's closing summary
                </div>
                <div style={{ color: "#EDE6D6", fontSize: 15, lineHeight: 1.6 }}>{moderatorText}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
