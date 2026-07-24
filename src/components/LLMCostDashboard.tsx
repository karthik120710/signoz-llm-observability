import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, Coins, Zap, Clock, AlertTriangle, Activity } from 'lucide-react'

interface UsageSummary {
  totalTokens: number
  inputTokens: number
  outputTokens: number
  totalCost: number
  count: number
  avgLatency: number
}

interface TimelinePoint {
  hour: string
  tokens: number
  inputTokens: number
  outputTokens: number
  cost: number
  count: number
  avgLatency: number
}

interface ModelGroup {
  model: string
  _sum: { inputTokens: number; outputTokens: number; totalTokens: number; cost: number }
  _count: number
  _avg: { latencyMs: number }
}

interface ProviderGroup {
  provider: string
  _sum: { inputTokens: number; outputTokens: number; totalTokens: number; cost: number }
  _count: number
  _avg: { latencyMs: number }
}

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export default function LLMCostDashboard() {
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [byModel, setByModel] = useState<ModelGroup[]>([])
  const [byProvider, setByProvider] = useState<ProviderGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (timeRange !== 'all') {
        const now = new Date()
        if (timeRange === '24h') params.set('from', new Date(now.getTime() - 24 * 3600 * 1000).toISOString())
        else if (timeRange === '7d') params.set('from', new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString())
      }

      const [usageRes, timelineRes, modelRes, providerRes] = await Promise.all([
        fetch(`/api/llm-usage?${params}`),
        fetch(`/api/llm-usage?groupBy=hour&${params}`),
        fetch(`/api/llm-usage?groupBy=model&${params}`),
        fetch(`/api/llm-usage?groupBy=provider&${params}`),
      ])
      const usageData = await usageRes.json()
      const timelineData = await timelineRes.json()
      const modelData = await modelRes.json()
      const providerData = await providerRes.json()

      setSummary(usageData.summary)
      setTimeline(timelineData.timeline ?? [])
      setByModel(modelData.groups ?? [])
      setByProvider(providerData.groups ?? [])
    } catch { /* empty */ }
    setLoading(false)
  }, [timeRange])

  useEffect(() => { fetchData() }, [fetchData])

  const pieData = byProvider.map(p => ({
    name: p.provider,
    value: Math.round(p._sum.cost * 10000) / 10000,
    tokens: p._sum.totalTokens,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">LLM Cost Dashboard</h2>
          <p className="text-muted-foreground">Token usage, costs, and performance across all providers</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[100px] rounded-lg" />)
        ) : (
          <>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Coins className="h-4 w-4" /> Total Cost
                </div>
                <div className="text-2xl font-bold text-primary">${summary?.totalCost.toFixed(4) ?? '0'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Zap className="h-4 w-4" /> Total Tokens
                </div>
                <div className="text-2xl font-bold">{formatTokens(summary?.totalTokens ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" /> Input
                </div>
                <div className="text-2xl font-bold">{formatTokens(summary?.inputTokens ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4 text-cyan-500" /> Output
                </div>
                <div className="text-2xl font-bold">{formatTokens(summary?.outputTokens ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Activity className="h-4 w-4" /> API Calls
                </div>
                <div className="text-2xl font-bold">{summary?.count ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" /> Avg Latency
                </div>
                <div className="text-2xl font-bold">{summary?.avgLatency ?? 0}ms</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Token Usage Over Time</CardTitle>
            <CardDescription>Hourly token consumption with input/output breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[300px]" /> : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={h => h?.slice(11, 13) ? `${h.slice(11, 13)}:00` : h} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatTokens} />
                  <Tooltip formatter={(value: number) => formatTokens(value)} />
                  <Legend />
                  <Area type="monotone" dataKey="inputTokens" stackId="1" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} name="Input Tokens" />
                  <Area type="monotone" dataKey="outputTokens" stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} name="Output Tokens" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Cost by Provider Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Cost by Provider</CardTitle>
            <CardDescription>Distribution across LLM providers</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[300px]" /> : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" nameKey="name" label={({ name, value }) => `$${value.toFixed(3)}`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cost by Model Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cost & Calls by Model</CardTitle>
          <CardDescription>Comparative cost breakdown across all tracked models</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-[300px]" /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byModel.map(m => ({
                model: m.model.length > 20 ? m.model.slice(0, 20) + '…' : m.model,
                cost: Math.round(m._sum.cost * 10000) / 10000,
                tokens: m._sum.totalTokens,
                calls: m._count,
                latency: Math.round(m._avg.latencyMs),
              }))}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="model" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={formatTokens} />
                <Tooltip formatter={(value: number, name: string) => name === 'cost' ? `$${value.toFixed(4)}` : formatTokens(value)} />
                <Legend />
                <Bar yAxisId="left" dataKey="cost" fill="#6366f1" radius={[4, 4, 0, 0]} name="Cost ($)" />
                <Bar yAxisId="right" dataKey="tokens" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Tokens" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Error Rate Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Provider Performance
          </CardTitle>
          <CardDescription>Latency and call count per provider</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-[100px]" /> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {byProvider.map(p => (
                <div key={p.provider} className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <Badge variant="outline" className="mb-2 capitalize">{p.provider}</Badge>
                    <div className="text-sm text-muted-foreground">{p._count} calls</div>
                    <div className="text-sm text-muted-foreground">Avg {Math.round(p._avg.latencyMs)}ms</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">${Math.round(p._sum.cost * 10000) / 10000}</div>
                    <div className="text-sm text-muted-foreground">{formatTokens(p._sum.totalTokens)} tokens</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
