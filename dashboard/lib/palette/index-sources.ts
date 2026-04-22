import type { PaletteItem } from "./types";

export interface PaletteSourceContext {
  readonly router: { push: (href: string) => void };
  readonly close: () => void; // closes the palette after run()
}

/** Pure / synchronous; no fetch. Used by build-index without a Promise.all slot. */
export { staticCommandItems } from "./actions";

// ─── helpers ────────────────────────────────────────────────────────────────

async function fetchJson(endpoint: string): Promise<unknown> {
  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`[palette] fetch failed for ${endpoint} (${res.status})`);
  }
  return res.json();
}

// ─── Project items ───────────────────────────────────────────────────────────

export async function fetchProjectItems(
  ctx: PaletteSourceContext,
): Promise<PaletteItem[]> {
  const data = (await fetchJson("/api/state")) as {
    home_phases?: Array<{ project: string; projectName: string }>;
  };

  const phases = Array.isArray(data?.home_phases) ? data.home_phases : [];

  // de-dup by project path — same project may appear in multiple phases
  const seen = new Set<string>();
  const items: PaletteItem[] = [];

  for (const p of phases) {
    const slug = p.project ?? "";
    if (seen.has(slug)) continue;
    seen.add(slug);

    items.push({
      id: `project:${slug}`,
      group: "projects",
      label: p.projectName ?? slug,
      hint: slug,
      run: () => {
        ctx.router.push(`/build?project=${encodeURIComponent(slug)}`);
        ctx.close();
      },
    });
  }

  return items;
}

// ─── Task items ───────────────────────────────────────────────────────────────

export async function fetchTaskItems(
  ctx: PaletteSourceContext,
): Promise<PaletteItem[]> {
  type QueueCard = {
    taskId: string;
    title: string;
    status: string;
    tags?: string[];
    project?: string;
  };

  const data = (await fetchJson("/api/queue")) as {
    columns?: {
      waiting?: QueueCard[];
      in_progress?: QueueCard[];
      double_checking?: QueueCard[];
      stuck?: QueueCard[];
    };
  };

  const columns = data?.columns ?? {};
  const active: QueueCard[] = [
    ...(columns.in_progress ?? []),
    ...(columns.double_checking ?? []),
    ...(columns.waiting ?? []),
    ...(columns.stuck ?? []),
  ];

  return active.map((card) => {
    // Extract a phase hint from tags like "phase:03"
    const phaseTag = card.tags?.find((t) => t.startsWith("phase:"));
    const hint = phaseTag ? phaseTag.replace("phase:", "Phase ") : card.taskId;

    return {
      id: `task:${card.taskId}`,
      group: "tasks" as const,
      label: card.title ?? card.taskId,
      hint,
      run: () => {
        ctx.router.push("/build");
        ctx.close();
      },
    };
  });
}

// ─── Agent items ─────────────────────────────────────────────────────────────

export async function fetchAgentItems(
  ctx: PaletteSourceContext,
): Promise<PaletteItem[]> {
  type AgentEntry = {
    name: string;
    label?: string;
    founder_label?: string;
    role?: string;
  };

  const data = (await fetchJson("/api/agents")) as {
    agents?: AgentEntry[];
  };

  const agents = Array.isArray(data?.agents) ? data.agents : [];

  return agents.map((a) => ({
    id: `agent:${a.name}`,
    group: "agents" as const,
    label: a.founder_label ?? a.label ?? a.name,
    hint: a.role ?? "",
    run: () => {
      ctx.router.push(
        `/build/agents?agent=${encodeURIComponent(a.name)}`,
      );
      ctx.close();
    },
  }));
}

// ─── Workflow items ───────────────────────────────────────────────────────────

export async function fetchWorkflowItems(
  ctx: PaletteSourceContext,
): Promise<PaletteItem[]> {
  type WorkflowEntry = {
    slug: string;
    name: string;
    description?: string;
  };

  const data = (await fetchJson("/api/workflows")) as {
    workflows?: WorkflowEntry[];
  };

  const workflows = Array.isArray(data?.workflows) ? data.workflows : [];

  return workflows.map((wf) => ({
    id: `workflow:${wf.slug}`,
    group: "workflows" as const,
    label: wf.name,
    hint: wf.description ?? "",
    run: () => {
      ctx.router.push(`/build/workflows/${encodeURIComponent(wf.slug)}`);
      ctx.close();
    },
  }));
}

// ─── Memory items ─────────────────────────────────────────────────────────────

export async function fetchMemoryItems(
  ctx: PaletteSourceContext,
): Promise<PaletteItem[]> {
  type MemoryNode = {
    id: string;
    label: string;
    kind: string;
    absPath?: string;
    children?: MemoryNode[];
  };

  const data = (await fetchJson("/api/memory/tree")) as {
    projects?: MemoryNode[];
  };

  // Flatten tree into leaf (file) nodes, cap at 30
  const items: PaletteItem[] = [];

  function collectFiles(node: MemoryNode) {
    if (items.length >= 30) return;
    if (node.kind === "file") {
      const path = node.absPath ?? node.id;
      const basename = path.split("/").pop() ?? node.label;
      items.push({
        id: `memory:${path}`,
        group: "memory" as const,
        label: basename,
        hint: path,
        run: () => {
          ctx.router.push(
            `/memory?focus=${encodeURIComponent(path)}`,
          );
          ctx.close();
        },
      });
    } else if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (items.length >= 30) return;
        collectFiles(child);
      }
    }
  }

  const projects = Array.isArray(data?.projects) ? data.projects : [];
  for (const proj of projects) {
    collectFiles(proj);
  }

  return items;
}
