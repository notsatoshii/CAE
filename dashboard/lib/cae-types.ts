export interface Phase {
  number: number
  name: string
  planFiles: string[]
  status: "idle" | "active" | "done" | "failed"
}

export interface Project {
  name: string
  path: string
  hasPlanning: boolean
}

export interface InboxTask {
  taskId: string
  createdAt: Date
  buildplanPath: string
  metaPath: string
  hasBuildplan: boolean
}

export interface OutboxTask {
  taskId: string
  hasDone: boolean
  processed: boolean
  status?: string
  summary?: string
  branch?: string
  commits?: string[]
}

export interface CbState {
  activeForgeCount: number
  activeTaskIds: string[]
  recentFailures: number
  recentPhantomEscalations: number
  halted: boolean
}

// Phase 4 home state types (re-exported for convenience)
export type {
  Rollup,
  AgentActive,
  PhaseSummary,
  RecentEvent,
  NeedsYouItem,
  HomeState,
} from "./cae-home-state"
