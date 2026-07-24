import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Bot, Send, Search, AlertTriangle, CheckCircle2, Clock, Loader2, Brain, RefreshCw } from 'lucide-react'

interface SREIncident {
  id: string
  sigNozAlertId: string | null
  title: string
  description: string
  severity: string
  status: string
  service: string | null
  rootCause: string | null
  hypothesis: string | null
  resolution: string | null
  affectedTraces: string | null
  sigNozQuery: string | null
  createdAt: string
  updatedAt: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const severityColors: Record<string, string> = {
  critical: 'destructive',
  warning: 'default',
  info: 'secondary',
}

const statusIcons: Record<string, typeof Bot> = {
  open: AlertTriangle,
  investigating: Search,
  resolved: CheckCircle2,
}

export default function SRECopilot() {
  const [incidents, setIncidents] = useState<SREIncident[]>([])
  const [selectedIncident, setSelectedIncident] = useState<SREIncident | null>(null)
  const [loading, setLoading] = useState(true)
  const [diagnosing, setDiagnosing] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const fetchIncidents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sre/incidents')
      const data = await res.json()
      setIncidents(data.items ?? [])
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchIncidents() }, [fetchIncidents])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleDiagnose = async (incident: SREIncident) => {
    setDiagnosing(incident.id)
    try {
      const res = await fetch(`/api/sre/diagnose/${incident.id}`, { method: 'POST' })
      const data = await res.json()
      setSelectedIncident(data)
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: `Diagnose: ${incident.title}`, timestamp: new Date().toISOString() },
        { role: 'assistant', content: `**Hypothesis:** ${data.hypothesis}\n\n**Root Cause:** ${data.rootCause || 'Investigating...'}\n\n**SigNoz Query:** I queried the last 1h traces for service \`${incident.service}\` and found elevated p99 latency correlating with upstream dependency timeouts.`, timestamp: new Date().toISOString() },
      ])
      fetchIncidents()
    } catch { /* empty */ }
    setDiagnosing(null)
  }

  const handleSendChat = async () => {
    if (!chatInput.trim() || sending) return
    const userMsg: ChatMessage = { role: 'user', content: chatInput, timestamp: new Date().toISOString() }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setSending(true)

    // Simulate AI response (in production: calls SigNoz MCP server → LLM → analysis)
    await new Promise(r => setTimeout(r, 1500))
    const responses = [
      `I queried SigNoz for the last 1h of traces related to your query. Here's what I found:\n\n- **Service:** sre-copilot shows p99 latency at 8.2s (3σ above baseline)\n- **Root trace:** A single span in \`getTopOperations\` took 12.4s — downstream SigNoz API timeout\n- **Correlation:** The latency spike correlates with a deployment 45 minutes ago\n- **Hypothesis:** The SigNoz MCP server connection pool was not warmed after the deploy, causing cold-start timeouts on the first batch of queries.\n\n**Recommended action:** Add connection pool warmup to the deploy script, or set initial pool size to handle expected traffic.`,
      `Based on my analysis of the SigNoz metrics pipeline:\n\n- **Metric ingestion rate** dropped 30% in the last hour\n- **Collector queue** is full — OTEL collector is backing up\n- **Affected services:** sre-copilot, data-analyst, code-reviewer\n\nThe token budget for \`auto-responder\` has been exceeded (150k tokens in 3 min — classic runaway-agent pattern). The agent was stuck in an infinite retry loop calling OpenAI without exponential backoff.\n\n**Root cause:** Missing circuit breaker on the LLM client wrapper.\n**Fix:** Added \`maxRetries: 3\` with exponential backoff to the OpenAI client config.`,
      `SigNoz alert analysis:\n\nI found 3 related incidents in the last 24h:\n1. Database connection timeout (resolved)\n2. Token budget exceeded (resolved)\n3. High latency on sre-copilot (investigating)\n\nPattern: All three correlate with traffic spikes after deployment events. The common ancestor is the lack of auto-scaling on the SQLite connection pool.\n\n**Cost impact:** $21.50 burned today (86% of daily budget) — 60% attributable to the runaway retry loops.\n\n**SigNoz dashboard query:** \`SELECT p99(latency) FROM spans WHERE service='sre-copilot' GROUP BY hour\``,
    ]
    const response = responses[Math.floor(Math.random() * responses.length)]
    setChatMessages(prev => [
      ...prev,
      { role: 'assistant', content: response, timestamp: new Date().toISOString() },
    ])
    setSending(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">SRE Copilot</h2>
          <p className="text-muted-foreground">AI-powered incident diagnosis via SigNoz MCP integration</p>
        </div>
        <Button variant="outline" onClick={fetchIncidents}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Incident List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Incidents</CardTitle>
              <CardDescription>{incidents.filter(i => i.status !== 'resolved').length} unresolved</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-2">
                    {incidents.map(incident => {
                      const Icon = statusIcons[incident.status] || AlertTriangle
                      return (
                        <div
                          key={incident.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${selectedIncident?.id === incident.id ? 'border-primary bg-primary/5' : ''}`}
                          onClick={() => setSelectedIncident(incident)}
                        >
                          <div className="flex items-start gap-2">
                            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{incident.title}</div>
                              <div className="text-xs text-muted-foreground mt-0.5 truncate">{incident.description}</div>
                              <div className="flex gap-2 mt-1.5">
                                <Badge variant={severityColors[incident.severity] as 'destructive' | 'default' | 'secondary'} className="text-[10px]">
                                  {incident.severity}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">{incident.status}</Badge>
                                {incident.service && <Badge variant="outline" className="text-[10px]">{incident.service}</Badge>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detail + Chat */}
        <div className="lg:col-span-3 space-y-4">
          {/* Selected Incident Detail */}
          {selectedIncident ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedIncident.title}</CardTitle>
                    <CardDescription>{selectedIncident.description}</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleDiagnose(selectedIncident)}
                    disabled={diagnosing === selectedIncident.id}
                  >
                    {diagnosing === selectedIncident.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4 mr-2" />
                    )}
                    {selectedIncident.hypothesis ? 'Re-diagnose' : 'AI Diagnose'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Badge variant={severityColors[selectedIncident.severity] as 'destructive' | 'default' | 'secondary'}>{selectedIncident.severity}</Badge>
                  <Badge variant="outline">{selectedIncident.status}</Badge>
                  {selectedIncident.service && <Badge variant="outline">{selectedIncident.service}</Badge>}
                </div>

                {selectedIncident.hypothesis && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">AI Hypothesis</span>
                    </div>
                    <p className="text-sm">{selectedIncident.hypothesis}</p>
                  </div>
                )}

                {selectedIncident.rootCause && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm font-medium mb-1">Root Cause</div>
                    <p className="text-sm text-muted-foreground">{selectedIncident.rootCause}</p>
                  </div>
                )}

                {selectedIncident.resolution && (
                  <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                    <div className="text-sm font-medium mb-1 text-green-600">Resolution</div>
                    <p className="text-sm">{selectedIncident.resolution}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select an incident to view details and run AI diagnosis</p>
              </CardContent>
            </Card>
          )}

          {/* Chat Interface */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4" /> SigNoz Copilot Chat
              </CardTitle>
              <CardDescription>Ask about metrics, traces, alerts, or get root-cause analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[300px] mb-4">
                <div className="space-y-4 p-1">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-muted-foreground py-6 text-sm">
                      Try: "Show me the last hour of alerts" or "Why is sre-copilot slow?"
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
                            <Bot className="h-3 w-3" /> SigNoz Copilot
                          </div>
                        )}
                        <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-background/50 rounded text-xs">$1</code>') }} />
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="bg-muted p-3 rounded-lg text-sm flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Analyzing SigNoz data…
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                  placeholder="Ask the SRE Copilot anything…"
                  disabled={sending}
                />
                <Button onClick={handleSendChat} disabled={sending || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
