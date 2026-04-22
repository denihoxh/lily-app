# Lily Pipeline API — Agent Integration Guide

Base URL: `https://lily-app-xi.vercel.app/api/pipeline`

---

## Quick Start

```bash
curl -X POST https://lily-app-xi.vercel.app/api/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "craving": 8,
    "stress": 7,
    "contexts": ["After coffee", "Work pressure"],
    "memory": ["Used after morning coffee yesterday", "Resisted urge during Zoom call"]
  }'
```

**Response:**
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
    "memory_write": "10:32 AM — craving 8/10, stress 7/10. Used delay_tactic. High risk."
  },
  "pipeline": { "state": {...}, "prediction": {...}, "intervention": {...}, "orchestrator": {...} },
  "latency_ms": 4821
}
```

---

## Request Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `craving` | number 1-10 | ✅ | Current craving intensity |
| `stress` | number 0-10 | ✅ | Current stress level |
| `contexts` | string[] | — | Trigger contexts (e.g. "After coffee") |
| `memory` | string[] | — | Prior event log (max 8 entries) |
| `profile.goal` | string | — | `reduce` / `optimize` / `stabilize` |
| `profile.trigger` | string | — | `stress` / `social` / `routine` / `boredom` |
| `profile.freq` | string | — | `low` / `mod` / `high` |
| `profile.streak_days` | number | — | Current streak |
| `profile.today_uses` | number | — | Uses so far today |
| `custom_agents.state` | string | — | Custom system prompt for User State Agent |
| `custom_agents.predict` | string | — | Custom system prompt for Prediction Agent |
| `custom_agents.intervene` | string | — | Custom system prompt for Intervention Agent |
| `custom_agents.orch` | string | — | Custom system prompt for Orchestrator Agent |

**Auth:** No auth required — the pipeline API key is managed server-side. For custom agent overrides, you may optionally pass your own Groq key as `api_key` in the body.

---

## Python (OpenClaw / LangChain / any framework)

```python
import requests

LILY_API = "https://lily-app-xi.vercel.app/api/pipeline"

def run_lily_pipeline(craving: int, stress: int, contexts: list, memory: list = []):
    """Run the full Lily 4-agent pipeline."""
    response = requests.post(
        LILY_API,
        headers={"Content-Type": "application/json"},
        json={
            "craving": craving,
            "stress": stress,
            "contexts": contexts,
            "memory": memory
        }
    )
    return response.json()

# Basic usage
result = run_lily_pipeline(
    craving=8,
    stress=7,
    contexts=["After coffee", "Work pressure"],
    api_key="sk-ant-..."
)

summary = result["summary"]
print(f"Risk: {summary['risk_pct']}% ({summary['risk_level']})")
print(f"Strategy: {summary['strategy']}")
print(f"Message: {summary['message']}")
print(f"Action: {summary['action']}")
print(f"Next check-in: {summary['next_checkin_minutes']} minutes")
```

---

## LangChain Tool

```python
from langchain.tools import tool
import requests

@tool
def lily_craving_intervention(craving: int, stress: int, context: str, api_key: str) -> str:
    """
    Run the Lily agentic pipeline to get a CBT-grounded intervention
    for a nicotine craving. Returns a structured intervention message.

    Args:
        craving: Craving intensity 1-10
        stress: Stress level 0-10
        context: What's happening right now (e.g. 'After coffee, work stress')
    """
    result = requests.post(
        "https://lily-app-xi.vercel.app/api/pipeline",
        headers={"Content-Type": "application/json"},
        json={
            "craving": craving,
            "stress": stress,
            "contexts": [context],
        }
    ).json()

    if not result.get("ok"):
        return f"Pipeline error: {result.get('error')}"

    s = result["summary"]
    return (
        f"Risk: {s['risk_pct']}% ({s['risk_level']})\n"
        f"Strategy: {s['strategy']} — {s['cbt_technique']}\n"
        f"Message: {s['message']}\n"
        f"Action: {s['action']}\n"
        f"Check back in: {s['next_checkin_minutes']} minutes\n"
        f"Needs professional support: {s['escalate_to_professional']}"
    )

# Use in a LangChain agent
from langchain.agents import initialize_agent, AgentType
from langchain_groq import ChatGroq

llm = ChatGroq(model="llama-3.3-70b-versatile")
tools = [lily_craving_intervention]

agent = initialize_agent(
    tools, llm, agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION, verbose=True
)

agent.run("I'm at craving 8/10 after my morning coffee and feeling stressed about a meeting. Help me.")
```

---

## CrewAI Integration

```python
from crewai import Agent, Task, Crew
from crewai.tools import tool
import requests

@tool("Lily Craving Pipeline")
def lily_pipeline(craving: int, stress: int, contexts: list, api_key: str) -> dict:
    """Run the Lily 4-agent nicotine reduction pipeline."""
    return requests.post(
        "https://lily-app-xi.vercel.app/api/pipeline",
        headers={"Content-Type": "application/json"},
        json={"craving": craving, "stress": stress, "contexts": contexts}
    ).json()

# Wellness coach agent that uses Lily as a tool
wellness_agent = Agent(
    role="Behavioral Wellness Coach",
    goal="Help users manage nicotine cravings using evidence-based CBT interventions",
    backstory="You are a supportive coach that uses the Lily agentic pipeline to deliver real-time interventions.",
    tools=[lily_pipeline],
    verbose=True
)

intervention_task = Task(
    description="User reports craving 8/10, stress 7/10, after coffee and work pressure. Run the Lily pipeline and deliver the intervention.",
    agent=wellness_agent,
    expected_output="A structured intervention with strategy, message, and action steps"
)

crew = Crew(agents=[wellness_agent], tasks=[intervention_task])
result = crew.kickoff()
```

---

## AutoGen Integration

```python
import autogen
import requests

def lily_pipeline_function(craving: int, stress: int, contexts: list, api_key: str) -> dict:
    """Run the Lily agentic pipeline."""
    result = requests.post(
        "https://lily-app-xi.vercel.app/api/pipeline",
        headers={"Content-Type": "application/json"},
        json={"craving": craving, "stress": stress, "contexts": contexts}
    ).json()
    return result.get("summary", {})

# Register as AutoGen function
config_list = [{"model": "llama-3.3-70b-versatile", "api_key": "YOUR_GROQ_KEY"}]

assistant = autogen.AssistantAgent(
    name="LilyCoach",
    system_message="You are a nicotine reduction coach. Use the lily_pipeline function to get interventions for users who report cravings.",
    llm_config={
        "config_list": config_list,
        "functions": [{
            "name": "lily_pipeline",
            "description": "Run the Lily agentic pipeline to get a CBT intervention for a nicotine craving",
            "parameters": {
                "type": "object",
                "properties": {
                    "craving": {"type": "integer", "description": "Craving intensity 1-10"},
                    "stress": {"type": "integer", "description": "Stress level 0-10"},
                    "contexts": {"type": "array", "items": {"type": "string"}},
                    "api_key": {"type": "string"}
                },
                "required": ["craving", "stress", "api_key"]
            }
        }]
    }
)

user = autogen.UserProxyAgent(
    name="User",
    function_map={"lily_pipeline": lily_pipeline_function}
)

user.initiate_chat(assistant, message="I'm at craving 8/10 right now after my morning coffee.")
```

---

## Bring Your Own Agent — Custom System Prompts

Override any of the 4 agents with your own system prompt. Your agent receives the same JSON input and must return the same output schema.

```python
result = requests.post(
    "https://lily-app-xi.vercel.app/api/pipeline",
    headers={"Content-Type": "application/json"},
    json={
        "craving": 8,
        "stress": 7,
        "contexts": ["After coffee"],
        "custom_agents": {
            # Replace the Intervention Agent with your own CBT specialist
            "intervene": """You are a CBT specialist trained in addiction medicine.
            Given the user's state and predicted risk, select the most clinically appropriate
            intervention from: delay_tactic, cognitive_reframing, behavioral_substitution,
            motivational_nudge, social_support, environmental_change.
            Output ONLY valid JSON:
            {"strategy": string, "message": string, "action": string,
             "effectiveness": number, "rationale": string, "cbt_technique": string}"""
        }
    }
).json()
```

---

## Error Handling

```python
result = run_lily_pipeline(craving=8, stress=7, contexts=["Work"], api_key="sk-ant-...")

if not result["ok"]:
    print(f"Error: {result['error']}")
else:
    # Check for partial results (one agent failed but others succeeded)
    if result["summary"].get("partial"):
        print("Warning: pipeline partially completed")
        print(f"Errors: {result.get('errors')}")

    # Check for professional escalation
    if result["summary"]["escalate_to_professional"]:
        print("⚠️ Escalate to professional support")

    # Use the full pipeline output for custom processing
    state = result["pipeline"]["state"]
    prediction = result["pipeline"]["prediction"]
    intervention = result["pipeline"]["intervention"]
    orchestrator = result["pipeline"]["orchestrator"]
```

---

## Rate Limits & Performance

- Average latency: ~5-15 seconds (4 sequential LLM calls)
- Concurrent calls: Tested up to 10 concurrent pipelines
- Memory: Pass up to 8 prior event strings for personalized interventions

---

Built by Deni Hoxha & Leila Veerasamy · MAS.664 AI for Impact · MIT Sloan / MIT Media Lab · Spring 2026
GitHub: https://github.com/denihoxh/lily-app
