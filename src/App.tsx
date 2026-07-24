import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Coins, Shield, Bot, Settings, Database } from 'lucide-react'
import LLMCostDashboard from '@/components/LLMCostDashboard'
import BudgetGuardrailPanel from '@/components/BudgetGuardrailPanel'
import SRECopilot from '@/components/SRECopilot'
import SigNozSettings from '@/components/SigNozSettings'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [seeded, setSeeded] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    fetch('/api/llm-usage')
      .then(r => r.json())
      .then(d => { if (d.items && d.items.length > 0) setSeeded(true) })
      .catch(() => {})
  }, [])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await fetch('/api/seed-demo', { method: 'POST' })
      setSeeded(true)
    } catch { /* empty */ }
    setSeeding(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">SigNoz LLM Observability</h1>
              <p className="text-xs text-muted-foreground">Token cost tracking · Budget guardrails · SRE copilot</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
              Live
            </Badge>
            {!seeded && (
              <Button size="sm" onClick={handleSeed} disabled={seeding}>
                <Database className="h-3.5 w-3.5 mr-1.5" />
                {seeding ? 'Seeding…' : 'Load Demo Data'}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard" className="gap-1.5">
              <Coins className="h-4 w-4" /> LLM Dashboard
            </TabsTrigger>
            <TabsTrigger value="budget" className="gap-1.5">
              <Shield className="h-4 w-4" /> Budget Guardrails
            </TabsTrigger>
            <TabsTrigger value="sre" className="gap-1.5">
              <Bot className="h-4 w-4" /> SRE Copilot
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-4 w-4" /> SigNoz Config
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <LLMCostDashboard />
          </TabsContent>

          <TabsContent value="budget">
            <BudgetGuardrailPanel />
          </TabsContent>

          <TabsContent value="sre">
            <SRECopilot />
          </TabsContent>

          <TabsContent value="settings">
            <SigNozSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
