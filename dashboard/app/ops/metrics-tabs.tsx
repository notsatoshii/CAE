"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Row = Record<string, unknown>

interface MetricsData {
  breakers: Row[]
  sentinel: Row[]
  compaction: Row[]
  approvals: Row[]
}

interface MetricsTabsProps {
  projectPath: string
}

function deriveColumns(rows: Row[]): string[] {
  const keys = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) keys.add(key)
  }
  const rest = Array.from(keys).filter((k) => k !== "timestamp").sort()
  return keys.has("timestamp") ? ["timestamp", ...rest] : rest
}

function StreamTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">No events yet.</p>
    )
  }
  const cols = deriveColumns(rows)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {cols.map((col) => (
            <TableHead key={col} className={col === "timestamp" ? "w-44" : undefined}>
              {col}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {cols.map((col) => (
              <TableCell key={col} className="font-mono text-xs">
                {row[col] !== undefined ? String(row[col]) : ""}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const EMPTY: MetricsData = { breakers: [], sentinel: [], compaction: [], approvals: [] }

export function MetricsTabs({ projectPath }: MetricsTabsProps) {
  const [metrics, setMetrics] = useState<MetricsData>(EMPTY)

  useEffect(() => {
    const url = `/api/state?project=${encodeURIComponent(projectPath)}`

    async function poll() {
      try {
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setMetrics((data.metrics as MetricsData) ?? EMPTY)
        }
      } catch {
        // network error — keep previous state
      }
    }

    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [projectPath])

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Metrics
      </h2>
      <Tabs defaultValue="breakers">
        <TabsList>
          <TabsTrigger value="breakers">Breakers</TabsTrigger>
          <TabsTrigger value="sentinel">Sentinel</TabsTrigger>
          <TabsTrigger value="compaction">Compaction</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
        </TabsList>
        <TabsContent value="breakers">
          <StreamTable rows={metrics.breakers} />
        </TabsContent>
        <TabsContent value="sentinel">
          <StreamTable rows={metrics.sentinel} />
        </TabsContent>
        <TabsContent value="compaction">
          <StreamTable rows={metrics.compaction} />
        </TabsContent>
        <TabsContent value="approvals">
          <StreamTable rows={metrics.approvals} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
