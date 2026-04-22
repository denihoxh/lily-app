/**
 * Lily Pipeline API
 * POST /api/pipeline
 *
 * Runs the full 4-agent agentic pipeline for nicotine reduction.
 * Compatible with OpenClaw, LangChain, CrewAI, AutoGen, and any agent
 * framework that can make HTTP requests.
 *
 * REQUEST BODY:
 * {
 *   "craving": 8,                          // 1-10 (required)
 *   "stress": 7,                           // 1-10 (required)
 *   "contexts": ["After coffee", "Work"],  // string[] (optional)
 *   "memory": ["Prior event..."],          // string[] (optional, max 8)
 *   "profile": {                           // optional user context
 *     "goal": "reduce"|"optimize"|"stabilize",
 *     "trigger": "stress"|"social"|"routine"|"boredom",
 *     "freq": "low"|"mod"|"high",
 *     "streak_days": 4,
 *     "today_uses": 2
 *   },
 *   "custom_agents": {                     // optional — override any agent
 *     "state": "custom system prompt...",
 *     "predict": "custom system prompt...",
 *     "intervene": "custom system prompt...",
 *     "orch": "custom system prompt..."
 *   }
 * }
 *
 * RESPONSE:
 * {
 *   "ok": true,
 *   "pipeline": {
 *     "state": { ...userStateOutput },
 *     "prediction": { ...predictionOutput },
 *     "intervention": { ...interventionOutput },
 *     "orchestrator": { ...orchestratorOutput }
 *   },
 *   "summary": {
 *     "risk_pct": 75,
 *     "risk_level": "high",
 *     "strategy": "delay_tactic",
 *     "cbt_technique": "Urge surfing",
 *     "message": "Notice the craving...",
 *     "action": "Set a 15-min timer",
 *     "decision": "approve",
 *     "next_checkin_minutes": 30,
 *     "escalate_to_professional": false,
 *     "memory_write": "10:32 AM — craving 8/10..."
 *   },
 *   "latency_ms": 4821
 * }
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

// ── Default system prompts for each agent ──

const DEFAULT_PROMPTS = {

  state: `You are the User State Agent for Lily, a nicotine reduction platform.
Your job: synthesize the user's craving event and memory history into a structured behavioral state snapshot.
Output ONLY valid JSON with no preamble, no markdown, no backticks:
{
  "event": { "craving": number, "stress": number, "contexts": string[], "time": string },
  "usage": { "today": number, "target": number, "status": "on_track" | "at_risk" | "exceeded" },
  "patterns": string[],
  "high_risk_triggers": string[],
  "streak_days": number,
  "memory_summary": string
}
patterns: 2-3 short behavioral observations inferred from the event and memory.
If memory is empty, infer patterns from the event context alone.`,

  predict: `You are the Prediction Agent for Lily, a nicotine reduction platform.
Your job: estimate relapse probability and craving trajectory based on the user's behavioral state.
IMPORTANT calibration: low craving (1-3) = 0.10-0.30, moderate (4-6) = 0.35-0.60, high (7-9) = 0.60-0.85, extreme (10) = 0.85-0.98.
Output ONLY valid JSON with no preamble, no markdown, no backticks:
{
  "probability": number,
  "risk": "low" | "moderate" | "high" | "critical",
  "trajectory": "rising" | "stable" | "falling",
  "peak_in_minutes": number,
  "drivers": string[],
  "protective": string[],
  "window_to_act": string
}`,

  intervene: `You are the Intervention Agent for Lily, a nicotine reduction platform.
Your interventions MUST be grounded in CBT (Cognitive Behavioral Therapy).
Available strategies:
- delay_tactic: urge surfing — wait 15 minutes, the craving wave will fall
- cognitive_reframing: question the thought behind the craving
- behavioral_substitution: replace the action with something concrete
- motivational_nudge: remind the user of their goal and prior wins
- social_support: encourage reaching out to someone
- environmental_change: physically remove the user from the trigger context
Select the strategy most appropriate for the current risk level and context.
Output ONLY valid JSON with no preamble, no markdown, no backticks:
{
  "strategy": string,
  "message": string,
  "action": string,
  "effectiveness": number,
  "rationale": string,
  "cbt_technique": string
}
message: warm, direct, 2-3 sentences. action: one concrete step the user can take right now.`,

  orch: `You are the Orchestrator Agent for Lily, a nicotine reduction platform.
Your job: make the final coordination decision, set a check-in window, and write a memory update.
escalate_to_professional: set true ONLY if craving >= 9 AND stress >= 8, OR if the user's situation seems beyond coaching.
next_checkin_minutes: 15-30 for high/critical risk, 45-90 for moderate, 120+ for low.
Output ONLY valid JSON with no preamble, no markdown, no backticks:
{
  "decision": "approve" | "override" | "escalate",
  "final_message": string,
  "override_reason": string | null,
  "escalate_to_professional": boolean,
  "long_term_note": string,
  "memory_write": string,
  "next_checkin_minutes": number
}
memory_write: a single sentence log entry with timestamp, craving level, strategy used, and outcome.`

};

// ── LLM call helper ──
async function callAgent(apiKey, systemPrompt, userContent, agentName) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${agentName} failed: ${err.error?.message || `HTTP ${res.status}`}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';

  // Parse JSON — strip any accidental markdown fences
  const clean = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`${agentName} returned non-JSON: ${clean.slice(0, 100)}`);
  }
}

// ── Main handler ──
export default async function handler(req, res) {
  // CORS headers — allows any agent framework to call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  const t0 = Date.now();

  // ── Parse and validate input ──
  const body = req.body || {};
  const craving = Number(body.craving);
  const stress = Number(body.stress);

  if (!craving || craving < 1 || craving > 10) {
    return res.status(400).json({ ok: false, error: 'craving must be a number 1-10' });
  }
  if (stress === undefined || isNaN(stress) || stress < 0 || stress > 10) {
    return res.status(400).json({ ok: false, error: 'stress must be a number 0-10' });
  }

  const contexts = Array.isArray(body.contexts) ? body.contexts.slice(0, 5) : [];
  const memory = Array.isArray(body.memory) ? body.memory.slice(-8) : [];
  const profile = body.profile || {};
  const customAgents = body.custom_agents || {};

  // API key: header takes priority, then body
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || body.api_key;
  if (!apiKey) {
    return res.status(401).json({ ok: false, error: 'API key required. Pass as x-api-key header, Authorization: Bearer <key>, or api_key in body.' });
  }

  // ── Input validation layer (addressing Jana's feedback) ──
  const issues = [];
  if (craving >= 9 && stress <= 2) issues.push('High craving with very low stress — contradictory inputs detected');
  if (contexts.length === 0) issues.push('No context provided — agents will infer from craving/stress only');

  const errors = [];
  const pipeline = {};

  try {
    // ── Agent 1: User State ──
    const statePrompt = customAgents.state || DEFAULT_PROMPTS.state;
    const stateInput = [
      `Craving ${craving}/10 | Stress ${stress}/10`,
      contexts.length ? `Context: ${contexts.join(', ')}` : 'Context: not provided',
      `Time: ${new Date().toISOString()}`,
      `Uses today: ${profile.today_uses ?? 0}`,
      `Target: ${profile.freq === 'high' ? 10 : profile.freq === 'mod' ? 6 : 4}`,
      `Streak: ${profile.streak_days ?? 0} days`,
      `Goal: ${profile.goal || 'stabilize'}`,
      `Primary trigger: ${profile.trigger || 'stress'}`,
      `Memory:\n${memory.length ? memory.map(m => `- ${m}`).join('\n') : '(no prior memory)'}`,
      issues.length ? `\nInput notes: ${issues.join('; ')}` : ''
    ].join('\n');

    pipeline.state = await callAgent(apiKey, statePrompt, stateInput, 'User State Agent');

    // ── Agent 2: Prediction ──
    const predictPrompt = customAgents.predict || DEFAULT_PROMPTS.predict;
    pipeline.prediction = await callAgent(apiKey, predictPrompt, `User state:\n${JSON.stringify(pipeline.state, null, 2)}`, 'Prediction Agent');

    // ── Agent 3: Intervention ──
    const intervenePrompt = customAgents.intervene || DEFAULT_PROMPTS.intervene;
    const interveneInput = [
      `User state:\n${JSON.stringify(pipeline.state, null, 2)}`,
      `Prediction:\n${JSON.stringify(pipeline.prediction, null, 2)}`
    ].join('\n\n');
    pipeline.intervention = await callAgent(apiKey, intervenePrompt, interveneInput, 'Intervention Agent');

    // ── Agent 4: Orchestrator ──
    const orchPrompt = customAgents.orch || DEFAULT_PROMPTS.orch;
    const orchInput = [
      `User state:\n${JSON.stringify(pipeline.state, null, 2)}`,
      `Prediction:\n${JSON.stringify(pipeline.prediction, null, 2)}`,
      `Intervention:\n${JSON.stringify(pipeline.intervention, null, 2)}`
    ].join('\n\n');
    pipeline.orchestrator = await callAgent(apiKey, orchPrompt, orchInput, 'Orchestrator Agent');

  } catch (err) {
    errors.push(err.message);
    // Return partial results if we have them
    if (Object.keys(pipeline).length === 0) {
      return res.status(502).json({ ok: false, error: errors[0], details: errors });
    }
  }

  const latency_ms = Date.now() - t0;

  // ── Build summary for easy agent consumption ──
  const summary = {
    risk_pct: Math.round((pipeline.prediction?.probability || 0.5) * 100),
    risk_level: pipeline.prediction?.risk || 'unknown',
    strategy: pipeline.intervention?.strategy || 'unknown',
    cbt_technique: pipeline.intervention?.cbt_technique || 'unknown',
    message: pipeline.orchestrator?.final_message || pipeline.intervention?.message || '',
    action: pipeline.intervention?.action || '',
    decision: pipeline.orchestrator?.decision || 'approve',
    next_checkin_minutes: pipeline.orchestrator?.next_checkin_minutes || 60,
    escalate_to_professional: pipeline.orchestrator?.escalate_to_professional || false,
    memory_write: pipeline.orchestrator?.memory_write || '',
    input_issues: issues.length ? issues : undefined,
    partial: errors.length > 0 ? true : undefined
  };

  return res.status(200).json({
    ok: true,
    pipeline,
    summary,
    latency_ms,
    errors: errors.length ? errors : undefined
  });
}
