import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Shield, AlertTriangle, Bell, Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react'

interface BudgetRule {
  id: string
  name: string
  scope: string
  scopeValue: string | null
  limitType: string
  maxTokens: number | null
  maxCost: number | null
  alertThreshold: number
  action: string
  enabled: boolean
  createdAt: string
}

interface BudgetAlert {
  id: string
  ruleId: string
  ruleName: string
  alertType: string
  currentTokens: number
  currentCost: number
  limitTokens: number | null
  limitCost: number | null
  threshold: number
  message: string
  acknowledged: boolean
  createdAt: string
}

function formatTokens(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

export default function BudgetGuardrailPanel() {
  const [rules, setRules] = useState<BudgetRule[]>([])
  const [alerts, setAlerts] = useState<BudgetAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [checking, setChecking] = useState(false)
  const [form, setForm] = useState({
    name: '', scope: 'global', scopeValue: '', limitType: 'daily',
    maxTokens: '', maxCost: '', alertThreshold: '0.8', action: 'alert',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [rulesRes, alertsRes] = await Promise.all([
        fetch('/api/budget-rules'),
        fetch('/api/budget-alerts'),
      ])
      const rulesData = await rulesRes.json()
      const alertsData = await alertsRes.json()
      setRules(rulesData.items ?? [])
      setAlerts(alertsData.items ?? [])
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreate = async () => {
    await fetch('/api/budget-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        scope: form.scope,
        scopeValue: form.scopeValue || undefined,
        limitType: form.limitType,
        maxTokens: form.maxTokens ? parseInt(form.maxTokens) : undefined,
        maxCost: form.maxCost ? parseFloat(form.maxCost) : undefined,
        alertThreshold: parseFloat(form.alertThreshold),
        action: form.action,
        enabled: true,
      }),
    })
    setForm({ name: '', scope: 'global', scopeValue: '', limitType: 'daily', maxTokens: '', maxCost: '', alertThreshold: '0.8', action: 'alert' })
    setShowForm(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/budget-rules/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const handleToggle = async (rule: BudgetRule) => {
    await fetch('/api/budget-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
    })
    fetchData()
  }

  const handleCheck = async () => {
    setChecking(true)
    await fetch('/api/budget-check', { method: 'POST' })
    fetchData()
    setChecking(false)
  }

  const handleAcknowledge = async (id: string) => {
    await fetch(`/api/budget-alerts/${id}/acknowledge`, { method: 'POST' })
    fetchData()
  }

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Budget Guardrails</h2>
          <p className="text-muted-foreground">Token & cost limits with automated alerting</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCheck} disabled={checking}>
            <Shield className="h-4 w-4 mr-2" />
            {checking ? 'Checking…' : 'Run Budget Check'}
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Active Alerts Banner */}
      {unacknowledgedAlerts.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="font-semibold text-amber-600">{unacknowledgedAlerts.length} Active Alert{unacknowledgedAlerts.length > 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {unacknowledgedAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-background/80 border">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{alert.message}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {alert.alertType === 'token_threshold' || alert.alertType === 'both_threshold' ? (
                        <span>Token: {formatTokens(alert.currentTokens)} / {formatTokens(alert.limitTokens)}</span>
                      ) : null}
                      {' '}
                      {alert.alertType === 'cost_threshold' || alert.alertType === 'both_threshold' ? (
                        <span>Cost: ${alert.currentCost} / ${alert.limitCost}</span>
                      ) : null}
                    </div>
                    <Progress value={Math.min(alert.threshold * 100, 100)} className="h-1.5 mt-2 max-w-[300px]" />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleAcknowledge(alert.id)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Ack
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Rule Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Create Budget Rule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rule Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Daily Token Cap" />
              </div>
              <div>
                <Label>Scope</Label>
                <Select value={form.scope} onValueChange={v => setForm(f => ({ ...f, scope: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="agent">Per Agent</SelectItem>
                    <SelectItem value="model">Per Model</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Period</Label>
                <Select value={form.limitType} onValueChange={v => setForm(f => ({ ...f, limitType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="total">Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>On Breach Action</Label>
                <Select value={form.action} onValueChange={v => setForm(f => ({ ...f, action: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alert">Alert Only</SelectItem>
                    <SelectItem value="throttle">Throttle</SelectItem>
                    <SelectItem value="shutdown">Shutdown Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max Tokens</Label>
                <Input type="number" value={form.maxTokens} onChange={e => setForm(f => ({ ...f, maxTokens: e.target.value }))} placeholder="e.g. 500000" />
              </div>
              <div>
                <Label>Max Cost ($)</Label>
                <Input type="number" value={form.maxCost} onChange={e => setForm(f => ({ ...f, maxCost: e.target.value }))} placeholder="e.g. 25.00" step="0.01" />
              </div>
              <div>
                <Label>Alert Threshold (%)</Label>
                <Input type="number" value={form.alertThreshold} onChange={e => setForm(f => ({ ...f, alertThreshold: e.target.value }))} step="0.05" min="0.1" max="1" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!form.name}>Create Rule</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Active Rules
          </CardTitle>
          <CardDescription>{rules.length} rule{rules.length !== 1 ? 's' : ''} configured</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : rules.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No budget rules configured. Create one to get started.</p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {rules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <Switch checked={rule.enabled} onCheckedChange={() => handleToggle(rule)} />
                      <div>
                        <div className="font-medium">{rule.name}</div>
                        <div className="text-sm text-muted-foreground flex gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs">{rule.limitType}</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{rule.scope}</Badge>
                          {rule.maxTokens && <span>Tokens: {formatTokens(rule.maxTokens)}</span>}
                          {rule.maxCost && <span>Cost: ${rule.maxCost}</span>}
                          <span>Alert at {Math.round(rule.alertThreshold * 100)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rule.action === 'shutdown' ? 'destructive' : rule.action === 'throttle' ? 'default' : 'secondary'}>
                        {rule.action}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Alert History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Alert History
          </CardTitle>
          <CardDescription>{alerts.length} alert{alerts.length !== 1 ? 's' : ''} fired</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No alerts fired yet. Run a budget check to evaluate rules.</p>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {alerts.map(alert => (
                  <div key={alert.id} className={`flex items-center justify-between p-3 rounded-lg border ${alert.acknowledged ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-3">
                      {alert.acknowledged ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-amber-500" />
                      )}
                      <div>
                        <div className="text-sm">{alert.message}</div>
                        <div className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <Button variant="ghost" size="sm" onClick={() => handleAcknowledge(alert.id)}>
                        Acknowledge
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
