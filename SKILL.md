# Lily Pipeline — OpenClaw Skill

A CBT-grounded nicotine reduction pipeline. Runs 4 specialized agents (User State → Prediction → Intervention → Orchestrator) and returns a structured intervention for a craving event.

## Install

```bash
openclaw skills add https://raw.githubusercontent.com/denihoxh/lily-app/main/SKILL.md
```

Or manually add to your OpenClaw workspace:

```bash
cp SKILL.md ~/.openclaw/workspace/skills/lily/SKILL.md
openclaw skills reload
```

## Skill: `lily_pipeline`

Run the full 4-agent pipeline for a nicotine craving event.

### Input

| Parameter | Type | Required | Description |
|---|---|---|---|
| `craving` | integer 1–10 | ✅ | Craving intensity right now |
| `stress` | integer 0–10 | ✅ | Stress level right now |
| `contexts` | string[] | — | What's happening (e.g. "After coffee") |
| `memory` | string[] | — | Prior event log entries (max 8) |
| `api_key` | string | — | Optional — pipeline uses server-side key by default |

### Output

```json
{
  "ok": true,
  "summary": {
    "risk_pct": 75,
    "risk_level": "high",
    "strategy": "delay_tactic",
    "cbt_technique": "Urge surfing",
    "message": "Notice the craving and let it be there without acting on it...",
    "action": "Set a 15-minute timer. Do anything else until it goes off.",
    "decision": "approve",
    "next_checkin_minutes": 30,
    "escalate_to_professional": false,
    "memory_write": "10:32 AM — craving 8/10, stress 7/10. Used delay_tactic."
  },
  "pipeline": {
    "state": { ... },
    "prediction": { ... },
    "intervention": { ... },
    "orchestrator": { ... }
  },
  "latency_ms": 4821
}
```

### Endpoint

```
POST https://lily-app-xi.vercel.app/api/pipeline
```

### Example

```javascript
// In an OpenClaw skill handler
const result = await fetch("https://lily-app-xi.vercel.app/api/pipeline", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY
  },
  body: JSON.stringify({
    craving: 8,
    stress: 7,
    contexts: ["After coffee", "Work pressure"],
    memory: ctx.memory?.lily || []
  })
}).then(r => r.json());

// Write to OpenClaw memory
ctx.memory.lily = [...(ctx.memory.lily || []), result.summary.memory_write].slice(-8);

return result.summary.message;
```

---

## Skill: `lily_log`

Log a moment and get an immediate coaching response.

### Input

| Parameter | Type | Description |
|---|---|---|
| `type` | string | `"used"` / `"resisted"` / `"craving"` / `"stressed"` |
| `api_key` | string | Optional — omit to use server-side key |

### Behavior

Maps the log type to a craving/stress profile and fires the full pipeline:

| Type | Craving | Stress | Context |
|---|---|---|---|
| `used` | 7 | 6 | Just used |
| `resisted` | 6 | 4 | Urge resisted |
| `craving` | 9 | 6 | Strong craving |
| `stressed` | 5 | 8 | Stress trigger |

---

## Skill: `lily_checkin`

Proactive check-in based on next_checkin_minutes from last pipeline run.

### Behavior

Reads the last `next_checkin_minutes` from the pipeline output stored in memory, schedules a check-in, and sends a warm nudge message from Lily asking how the user is doing.

### Example check-in message

> "Hey — it's been about 30 minutes since that craving hit. How are you doing now? Did the wave pass?"

---

## Bring Your Own Agent

Override any of Lily's 4 agents with a custom system prompt:

```json
{
  "craving": 8,
  "stress": 7,
  "contexts": ["After coffee"],
  "custom_agents": {
    "intervene": "You are a specialist in ACT (Acceptance and Commitment Therapy)...",
    "orch": "You are a conservative orchestrator who escalates at risk > 70%..."
  }
}
```

---

## Agent Output Schema Reference

### User State Agent
```json
{
  "event": { "craving": 8, "stress": 7, "contexts": [], "time": "string" },
  "usage": { "today": 2, "target": 5, "status": "on_track" },
  "patterns": ["string"],
  "high_risk_triggers": ["string"],
  "streak_days": 4,
  "memory_summary": "string"
}
```

### Prediction Agent
```json
{
  "probability": 0.75,
  "risk": "high",
  "trajectory": "rising",
  "peak_in_minutes": 15,
  "drivers": ["string"],
  "protective": ["string"],
  "window_to_act": "string"
}
```

### Intervention Agent
```json
{
  "strategy": "delay_tactic",
  "message": "string",
  "action": "string",
  "effectiveness": 0.72,
  "rationale": "string",
  "cbt_technique": "Urge surfing"
}
```

### Orchestrator Agent
```json
{
  "decision": "approve",
  "final_message": "string",
  "override_reason": null,
  "escalate_to_professional": false,
  "long_term_note": "string",
  "memory_write": "string",
  "next_checkin_minutes": 30
}
```

---

## Clinical Note

Lily is a behavioral coaching tool, not a medical device. Interventions are grounded in CBT. For heavy use, Lily works best alongside professional support. Built with guidance from Jana Krystofova Mike, MD (UCSF Pediatric Critical Care).

---

*Lily · github.com/denihoxh/lily-app · MIT License*
