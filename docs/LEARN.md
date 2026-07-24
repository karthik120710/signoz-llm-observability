# SigNoz LLM Observability Platform — How It Works

## 📊 Architecture Overview

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Your LLM Agents │────▶│  OTel Collector  │────▶│     SigNoz       │
│  (OpenAI/Anthropic│     │  (auto-instrument)│    │  (metrics/traces) │
│   /Bedrock calls) │     └─────────────────┘     └────────┬─────────┘
└──────────────────┘                                       │
                                                          │ REST API
┌──────────────────┐     ┌─────────────────┐     ┌────────▼─────────┐
│  SRE Copilot     │◀───▶│  MCP Server     │◀───▶│  This Dashboard  │
│  (AI diagnosis)  │     │  (SigNoz MCP)   │     │  (your app)      │
└──────────────────┘     └─────────────────┘     └──────────────────┘
```

## 🔢 Three Ways to Get Data Into the Dashboard

### Method 1: Demo Seed (fastest — already done)
The "Load Demo Data" button calls `/api/seed-demo` which creates:
- **300 LLM usage records** spread across 7 days
- **3 budget rules** (daily, per-agent, monthly)
- **4 SRE incidents** (2 critical, 2 warning)
- **2 budget alerts** (cost threshold, token threshold)

This is the data you see on the dashboard right now ($12.02 cost, 976K tokens).

### Method 2: Send Real LLM Usage Events (for production)
Every time your agent makes an LLM call, send the usage data to:
```
POST /api/llm-usage
{
  "provider": "openai",          // or "anthropic", "bedrock"
  "model": "gpt-4o",             // model name
  "inputTokens": 1500,           // prompt tokens
  "outputTokens": 800,           // completion tokens
  "cost": 0.023,                 // calculated cost in dollars
  "latencyMs": 1200,             // response time
  "status": "success",           // "success", "error", "rate_limited"
  "agentName": "sre-copilot",    // which agent made the call
  "sessionId": "sess_abc123",    // session tracking
  "traceId": "trace_xyz789"      // links to SigNoz traces
}
```

### Method 3: OpenTelemetry Auto-Instrumentation (best for production)
For real production use, install the OTel library and it captures everything automatically:

```python
# Python example
pip install opentelemetry-instrumentation-openai-v2

# Set env vars
export OTEL_SERVICE_NAME=my-agent
export OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.us.signoz.cloud:443
export OTEL_EXPORTER_OTLP_HEADERS="signoz-ingestion-key=YOUR_KEY"
export OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true

# Run your agent
opentelemetry-instrument python your_agent.py
```

This automatically captures every OpenAI/Anthropic call as a trace with token metrics.

---

## 💰 How Cost Tracking Works

Each LLM provider charges different rates:

| Provider | Input (per 1K tokens) | Output (per 1K tokens) |
|----------|----------------------|------------------------|
| OpenAI GPT-4o | $0.0025 | $0.010 |
| OpenAI GPT-4o-mini | $0.00015 | $0.0006 |
| Anthropic Claude Sonnet 4.5 | $0.003 | $0.015 |
| Anthropic Claude Haiku 4.5 | $0.001 | $0.005 |

The dashboard calculates cost as: `totalTokens × costPerToken` for each provider/model.

---

## 🛡️ How Budget Guardrails Work

### Creating Rules
Go to the "Budget Guardrails" tab and click "New Rule". You can set:

- **Scope**: Global (all usage), Per Agent, or Per Model
- **Period**: Daily, Monthly, or Total (lifetime)
- **Limits**: Max tokens, max cost, or both
- **Threshold**: When to fire alert (e.g., 80% = fires when usage hits 80% of limit)
- **Action**: 
  - `alert` → just notify
  - `throttle` → slow down the agent
  - `shutdown` → stop the agent entirely

### Running a Budget Check
Click "Run Budget Check" to evaluate all enabled rules against current usage:
```
POST /api/budget-check

For each enabled rule:
  1. Query total usage since period start (today for daily, month start for monthly)
  2. Compare against limits
  3. If usage ≥ (limit × threshold): fire alert
  4. Store alert in budget_alerts table
```

### Example Flow
```
Rule: "Global Daily Budget" — $25/day, alert at 80%
Current usage: $21.50 (86%)
→ Alert fires: "Global Daily Budget: $21.50 spent (86%)"
→ If action = "shutdown": agent stops receiving requests
→ If action = "alert": just shows the amber banner
```

---

## 🤖 How the SRE Copilot Works

### Viewing Incidents
The SRE Copilot tab shows incidents with severity badges:
- 🔴 **Critical** — immediate attention needed
- 🟡 **Warning** — potential issue, monitor closely
- ℹ️ **Info** — informational

### AI Diagnosis
Click "AI Diagnose" on any incident. In production, this:
1. Queries SigNoz MCP server for traces related to the incident
2. Finds the relevant span with highest latency
3. Correlates with recent deployments and metric changes
4. Generates a root-cause hypothesis
5. Suggests a fix

In demo mode, it returns simulated but realistic analysis.

### Chat Interface
The chat lets you ask questions like:
- "Show me the last hour of alerts"
- "Why is sre-copilot slow?"
- "What's the token burn rate for auto-responder?"

In production, this queries SigNoz via the MCP server and returns real data.

---

## 🔌 Connecting Real SigNoz

1. Go to "SigNoz Config" tab
2. Enter your SigNoz instance URL (e.g., `https://your-instance.signoz.cloud`)
3. Enter your API key
4. Click "Test Connection"
5. Copy the MCP config into your AI client (Cursor, Claude Desktop, etc.)
6. Copy the OTel collector config into your infrastructure

---

## 🏃 Quick Start on Your Local Machine

```bash
git clone https://github.com/karthik120710/signoz-llm-observability.git
cd signoz-llm-observability
bun install
bun run generate          # generates Prisma client + routes
bun run dev               # starts the app

# In another terminal, seed demo data:
curl -X POST http://localhost:3001/api/seed-demo

# Or send a single LLM usage record:
curl -X POST http://localhost:3001/api/llm-usage \
  -H "Content-Type: application/json" \
  -d '{"provider":"openai","model":"gpt-4o","inputTokens":1500,"outputTokens":800,"cost":0.023,"latencyMs":1200,"status":"success","agentName":"my-agent"}'
```
