import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings, CheckCircle2, XCircle, Loader2, ExternalLink, Plug, Server, Key, Globe } from 'lucide-react'

interface SigNozConfig {
  id: string
  instanceUrl: string
  apiKey: string
  region: string
  mcpEnabled: boolean
  mcpUrl: string | null
  connected: boolean
  lastSyncAt: string | null
}

export default function SigNozSettings() {
  const [config, setConfig] = useState<SigNozConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ connected: boolean; error?: string } | null>(null)
  const [form, setForm] = useState({
    instanceUrl: '',
    apiKey: '',
    region: 'us',
    mcpEnabled: false,
  })

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/signoz-config')
      const data = await res.json()
      if (data.config) {
        setConfig(data.config)
        setForm({
          instanceUrl: data.config.instanceUrl,
          apiKey: '',
          region: data.config.region,
          mcpEnabled: data.config.mcpEnabled,
        })
      }
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const handleSave = async () => {
    await fetch('/api/signoz-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        apiKey: form.apiKey || config?.apiKey,
        mcpUrl: form.mcpEnabled ? `https://mcp.${form.region}.signoz.cloud/mcp` : null,
      }),
    })
    fetchConfig()
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/signoz-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceUrl: form.instanceUrl, apiKey: form.apiKey || config?.apiKey }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      setTestResult({ connected: false, error: msg })
    }
    setTesting(false)
  }

  const otelConfig = `# OpenTelemetry Collector Configuration for SigNoz
# Add to your otel-collector-config.yaml

processors:
  batch:
    timeout: 10s
    send_batch_size: 1024

exporters:
  otlp:
    endpoint: "ingest.${form.region}.signoz.cloud:443"
    tls:
      insecure: false
    headers:
      "signoz-ingestion-key": "<YOUR_INGESTION_KEY>"

  # For LLM-specific metrics (token usage, cost)
  prometheus:
    endpoint: "0.0.0.0:8889"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp, prometheus]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp]`

  const mcpConfig = `{
  "mcpServers": {
    "signoz": {
      "url": "https://mcp.${form.region}.signoz.cloud/mcp",
      "headers": {
        "SIGNOZ-API-KEY": "<YOUR_API_KEY>",
        "X-SigNoz-URL": "${form.instanceUrl}"
      }
    }
  }
}`

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">SigNoz Integration</h2>
        <p className="text-muted-foreground">Configure SigNoz connection, MCP server, and OpenTelemetry pipeline</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" /> Connection
            </CardTitle>
            <CardDescription>Connect to your SigNoz instance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  {config?.connected ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="h-3 w-3 mr-1" /> Not Connected
                    </Badge>
                  )}
                  {config?.lastSyncAt && (
                    <span className="text-xs text-muted-foreground">
                      Last sync: {new Date(config.lastSyncAt).toLocaleString()}
                    </span>
                  )}
                </div>

                <div>
                  <Label className="flex items-center gap-1"><Globe className="h-3 w-3" /> Instance URL</Label>
                  <Input
                    value={form.instanceUrl}
                    onChange={e => setForm(f => ({ ...f, instanceUrl: e.target.value }))}
                    placeholder="https://your-instance.signoz.cloud"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-1"><Key className="h-3 w-3" /> API Key</Label>
                  <Input
                    type="password"
                    value={form.apiKey}
                    onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                    placeholder={config?.apiKey ? '•••••••• (stored)' : 'Enter your SigNoz API key'}
                  />
                </div>

                <div>
                  <Label>Region</Label>
                  <Select value={form.region} onValueChange={v => setForm(f => ({ ...f, region: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us">US (cloud.signoz.io)</SelectItem>
                      <SelectItem value="in">India (in.signoz.cloud)</SelectItem>
                      <SelectItem value="eu">EU (eu.signoz.cloud)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>MCP Server</Label>
                    <p className="text-xs text-muted-foreground">Enable Model Context Protocol for AI assistants</p>
                  </div>
                  <Switch
                    checked={form.mcpEnabled}
                    onCheckedChange={v => setForm(f => ({ ...f, mcpEnabled: v }))}
                  />
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleTest} disabled={testing}>
                    {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Settings className="h-4 w-4 mr-2" />}
                    Test Connection
                  </Button>
                  <Button onClick={handleSave}>Save</Button>
                </div>

                {testResult && (
                  <div className={`p-3 rounded-lg text-sm ${testResult.connected ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'}`}>
                    {testResult.connected ? (
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Connection successful (HTTP {testResult.connected})</span>
                    ) : (
                      <span className="flex items-center gap-1"><XCircle className="h-4 w-4" /> {testResult.error || 'Connection failed'}</span>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* MCP Configuration */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" /> MCP Server Config
              </CardTitle>
              <CardDescription>Add this to your AI client (Cursor, Claude Desktop, etc.)</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto font-mono">{mcpConfig}</pre>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline">Cursor</Badge>
                <Badge variant="outline">Claude Desktop</Badge>
                <Badge variant="outline">Windsurf</Badge>
                <Badge variant="outline">VS Code</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">MCP Server Capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {[
                  'Query metrics (latency, errors, throughput)',
                  'Search and aggregate traces',
                  'Search and aggregate logs',
                  'List and manage alerts',
                  'Create and update dashboards',
                  'Get service topology and operations',
                  'Execute PromQL and ClickHouse queries',
                ].map((cap, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    <span>{cap}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* OpenTelemetry Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> OpenTelemetry Collector Config
          </CardTitle>
          <CardDescription>Use this config to instrument your LLM calls and export to SigNoz</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto font-mono max-h-[400px]">{otelConfig}</pre>
          <div className="mt-4 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <h4 className="font-semibold text-sm mb-2">LLM Auto-Instrumentation</h4>
            <p className="text-sm text-muted-foreground mb-2">For Python apps, install the OpenAI auto-instrumentation library:</p>
            <pre className="p-2 rounded bg-muted text-xs font-mono">pip install opentelemetry-instrumentation-openai-v2</pre>
            <p className="text-sm text-muted-foreground mt-2">Then run your app with:</p>
            <pre className="p-2 rounded bg-muted text-xs font-mono mt-1">{'OTEL_SERVICE_NAME=llm-agent \\\nOTEL_EXPORTER_OTLP_ENDPOINT="https://ingest.us.signoz.cloud:443" \\\nOTEL_EXPORTER_OTLP_HEADERS="signoz-ingestion-key=YOUR_KEY" \\\nOTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true \\\nopentelemetry-instrument python your_app.py'}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Architecture Diagram */}
      <Card>
        <CardHeader>
          <CardTitle>Architecture Overview</CardTitle>
          <CardDescription>How the components connect</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-lg border">
              <div className="text-2xl mb-2">🤖</div>
              <div className="font-semibold text-sm">LLM Agents</div>
              <div className="text-xs text-muted-foreground">OpenAI / Anthropic / Bedrock calls</div>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="text-2xl mb-2">📡</div>
              <div className="font-semibold text-sm">OTel Collector</div>
              <div className="text-xs text-muted-foreground">Auto-instrumentation & export</div>
            </div>
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
              <div className="text-2xl mb-2">📊</div>
              <div className="font-semibold text-sm">SigNoz</div>
              <div className="text-xs text-muted-foreground">Metrics, traces, logs, alerts</div>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="text-2xl mb-2">🧠</div>
              <div className="font-semibold text-sm">MCP Server</div>
              <div className="text-xs text-muted-foreground">AI-powered root-cause analysis</div>
            </div>
          </div>
          <div className="flex items-center justify-center mt-4 gap-2 text-sm text-muted-foreground">
            <span>Agents → OTel → SigNoz → MCP → SRE Copilot → Dashboard</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
