"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"

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
  const { dev } = useDevMode()
  const t = labelFor(dev)

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
      <StatCard label={t.breakerActiveForge} value={stats.activeForgeCount} />
      <StatCard label={t.breakerInputTokens} value={stats.inputTokensToday.toLocaleString()} />
      <StatCard label={t.breakerOutputTokens} value={stats.outputTokensToday.toLocaleString()} />
      <StatCard label={t.breakerRetries} value={stats.retryCount} />
      <StatCard label={t.breakerPhantom} value={stats.recentPhantomEscalations} />
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t.breakerHalted}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.halted ? (
            <Badge variant="destructive">{t.breakerHaltedYes}</Badge>
          ) : (
            <Badge variant="outline">{t.breakerHaltedNo}</Badge>
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
