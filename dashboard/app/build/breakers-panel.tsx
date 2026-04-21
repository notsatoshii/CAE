"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface BreakerStats {
  activeForgeCount: number
  inputTokensToday: number
  outputTokensToday: number
  retryCount: number
  recentPhantomEscalations: number
  halted: boolean
}

interface BreakersPanelProps {
  projectPath: string
}

export function BreakersPanel({ projectPath }: BreakersPanelProps) {
  const [stats, setStats] = useState<BreakerStats | null>(null)

  useEffect(() => {
    const url = `/api/state?project=${encodeURIComponent(projectPath)}`

    async function poll() {
      try {
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setStats(data.breakers as BreakerStats)
        }
      } catch {
        // network error — keep previous state
      }
    }

    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [projectPath])

  if (!stats) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <StatCard label="Active Forge" value={stats.activeForgeCount} />
      <StatCard label="Input tokens today" value={stats.inputTokensToday.toLocaleString()} />
      <StatCard label="Output tokens today" value={stats.outputTokensToday.toLocaleString()} />
      <StatCard label="Retries" value={stats.retryCount} />
      <StatCard label="Phantom escalations" value={stats.recentPhantomEscalations} />
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Halted
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.halted ? (
            <Badge variant="destructive">halted</Badge>
          ) : (
            <Badge variant="outline">running</Badge>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
