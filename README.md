# lily.

**Behavior change, in the moment.**

Lily is a deployed agentic AI pipeline for nicotine reduction. Four specialized agents observe your behavioral state, predict relapse risk, select a CBT-grounded intervention, and coordinate in real time — every time you feel a craving.

Built for MAS.664 AI for Impact · MIT Sloan / MIT Media Lab · Spring 2026  
Team: Deni Hoxha & Leila Veerasamy

---

## Live Demo

**Web App:** https://lily-app-xi.vercel.app
**Mobile App:** https://lily-app-xi.vercel.app/app.html
**Docs:** https://lily-app-xi.vercel.app/docs.html  


---

## What Lily Does

Most nicotine reduction tools offer static plans and scheduled reminders. Lily is different — it responds to what you're actually experiencing right now.

When you log a craving, Lily's 4-agent pipeline fires:

1. **User State Agent** — synthesizes your craving event, stress level, context, and memory history into a structured behavioral snapshot
2. **Prediction Agent** — estimates your relapse probability and craving trajectory based on your state
3. **Intervention Agent** — selects the most appropriate CBT-grounded strategy (urge surfing, cognitive reframing, delay tactic, behavioral substitution, motivational nudge, or social support) and generates a personalized message
4. **Orchestrator Agent** — makes the final decision, sets a proactive check-in window, and writes a memory update that closes the feedback loop

Every logged event improves future interventions. The feedback loop is the core architectural primitive.

---

## Architecture

```
USER INPUT
    │
    ▼
┌─────────────────────┐
│   User State Agent  │  ← craving event + memory history
│   (behavioral       │
│    snapshot JSON)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Prediction Agent  │  ← relapse probability + trajectory
│   (risk assessment) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Intervention Agent  │  ← CBT strategy + personalized message
│ (strategy selector) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Orchestrator Agent │  ← final decision + memory write
│  (coordinator)      │
└──────────┬──────────┘
           │
           ▼
    ACTION OUTPUT
    + MEMORY UPDATE → feeds back to User State Agent
```

Each agent makes an independent cloud LLM call with structured JSON inputs and outputs. The Orchestrator closes the feedback loop by writing a memory update that the User State Agent reads on the next pipeline run.

**Powered by:** Llama 3.3-70B via Groq (server-side — no API key needed to use the app)  

---

## Repo Structure

```
lily-app/
├── index.html              # Web app (main URL — full desktop layout + live pipeline)
├── app.html                # Mobile app (streamlined coaching interface)
├── docs.html               # Documentation landing page
├── api/
│   └── pipeline.js         # Vercel serverless function — REST API endpoint
├── SOUL.md                 # OpenClaw agent configuration
├── SKILL.md                # OpenClaw skill definition
├── AGENT_INTEGRATION.md    # Integration guide (LangChain, CrewAI, AutoGen)
├── vercel.json             # Vercel routing + CORS config
├── server.js               # Express server for local dev
├── package.json
└── README.md
```

---

## Setup

### Prerequisites

- Node.js (v18+)

### Run locally

```bash
# Clone the repo
git clone https://github.com/denihoxh/lily-app.git
cd lily-app

# Install dependencies
npm install

# Serve locally
npx serve .
```

Open `http://localhost:3000` for the consumer app.  

### API Keys

The consumer app (`index.html`) calls the Anthropic API directly from the browser. To use it with your own key, open `index.html` and replace the API key in the `getReply` function:

```javascript
// Find this line in index.html (~line 1290)
'x-api-key': 'YOUR_ANTHROPIC_API_KEY_HERE',
```

### Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

---

## Clinical Framing

Lily is a behavioral coaching tool, not a medical device. It is not a substitute for professional care.

Key design decisions informed by clinical mentor **Jana Krystofova Mike, MD** (UCSF Pediatric Critical Care, agentic AI researcher):

- Interventions are grounded in **Cognitive Behavioral Therapy (CBT)** techniques: urge surfing, cognitive reframing, delay tactics, behavioral substitution
- Heavy users are flagged at onboarding and encouraged to supplement Lily with professional support
- Lily escalates to professional support suggestions when users express severe distress
- The system is designed as an AI co-assistant, not a standalone treatment

---

## Known Limitations

- **Strategy monoculture:** The Intervention Agent defaults heavily to craving surfing. A diversity mechanism tied to prior strategy effectiveness is needed.
- **Prediction calibration:** Risk scores cluster at 60–80% even for low-severity inputs. The Prediction Agent needs recalibration at the low end.
- **No contradiction detection:** The User State Agent averages contradictory inputs rather than flagging them. An input validation layer is the next architectural priority.
- **Rate limiting:** At high concurrency, the pipeline may hit API rate limits. Production deployment may require request queuing.
- **Latency:** 4 sequential agent calls take ~12–15 seconds. Parallelizing User State + Prediction agents would cut this significantly.
- **Self-reported inputs:** All craving and stress data is self-reported. Integration with biometric data (HRV, wearables) would improve prediction accuracy.

---

## Roadmap

- [ ] Input validation layer before User State Agent
- [ ] Strategy diversity mechanism using prior effectiveness data
- [ ] Prediction Agent recalibration at low-risk thresholds
- [ ] Parallelized User State + Prediction agent calls
- [ ] Clinical outcome validation (A/B test vs. control group)
- [ ] Integration with health APIs (Apple Health, Oura, Whoop)
- [ ] Expansion to alcohol and other behavioral addictions

---

---

## OpenClaw Integration

Lily is fully compatible with [OpenClaw](https://github.com/openclaw/openclaw) — the open-source personal AI assistant framework. Use Lily as a coaching agent on any OpenClaw-supported channel: WhatsApp, Telegram, iMessage, Slack, Discord, SMS.

### Install as an OpenClaw agent

```bash
# Install OpenClaw
npm install -g openclaw@latest
openclaw onboard

# Add Lily as an agent from SOUL.md
openclaw agents add --from https://raw.githubusercontent.com/denihoxh/lily-app/main/SOUL.md

# Install the Lily pipeline skill
openclaw skills add https://raw.githubusercontent.com/denihoxh/lily-app/main/SKILL.md

# Start the gateway
openclaw gateway:watch
```

Once running, Lily will respond to craving events on any connected channel and maintain behavioral memory across sessions using OpenClaw's built-in memory system.

### OpenClaw key files

| File | Purpose |
|---|---|
| `SOUL.md` | Agent identity, rules, personality, channel config, and memory schema |
| `SKILL.md` | Full skill definition with input/output schema and integration examples |

---

## Pipeline API — Use with Any Agent Framework

Lily's 4-agent pipeline is available as a live REST API. Any agent framework can call it directly.

```bash
POST https://lily-app-xi.vercel.app/api/pipeline
Content-Type: application/json

{
  "craving": 8,
  "stress": 7,
  "contexts": ["After coffee", "Work pressure"],
  "memory": ["Prior event logs..."],
  "custom_agents": {
    "intervene": "optional custom system prompt to override this agent"
  }
}
```

Returns:
```json
{
  "ok": true,
  "summary": {
    "risk_pct": 75,
    "risk_level": "high",
    "strategy": "delay_tactic",
    "message": "Notice the craving and let it be there...",
    "action": "Set a 15-minute timer.",
    "next_checkin_minutes": 30,
    "escalate_to_professional": false,
    "memory_write": "10:32 AM — craving 8/10. Used delay_tactic."
  },
  "pipeline": { "state": {}, "prediction": {}, "intervention": {}, "orchestrator": {} },
  "latency_ms": 4821
}
```

See [`AGENT_INTEGRATION.md`](./AGENT_INTEGRATION.md) for full examples with **LangChain**, **CrewAI**, **AutoGen**, and raw Python.


## Built With

- **Llama 3.3-70B** (Groq) — AI pipeline (server-side)
- **Vercel** — deployment
- **Vanilla JS + HTML/CSS** — no framework dependencies

---

## Team

**Deni Hoxha** — MBA Candidate, MIT Sloan '27. Product manager, ex-Morgan Stanley. Harvard BA/MA '21.  
**Leila Veerasamy** — MBA Candidate, MIT Sloan '27. Ex-founder DTC startup, Brown University.

---

## Course Context

MAS.664 AI for Impact · MIT Media Lab & MIT Sloan · Spring 2026  
Clinical mentor: Jana Krystofova Mike, MD — UCSF Pediatric Critical Care  
Startup mentor: Jennifer Jordan — VC, MassVentures, MIT Martin Trust Center

---

## License

MIT License. See LICENSE for details.
