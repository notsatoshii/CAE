import * as yaml from "yaml"

export type SkillFrontmatter = {
  name?: string
  description?: string
  disableModelInvocation: boolean
  allowedTools: string[]
}

type ParseResult = {
  frontmatter: SkillFrontmatter
  body: string
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

const DEFAULT_FRONTMATTER: SkillFrontmatter = {
  disableModelInvocation: false,
  allowedTools: [],
}

/**
 * Parses a SKILL.md content string into structured frontmatter + body.
 *
 * - Detects `---\n...\n---\n` at start.
 * - Uses yaml package to parse frontmatter.
 * - Normalizes `disable-model-invocation` → `disableModelInvocation` (boolean, default false).
 * - Normalizes `allowed-tools` as string[] (splits string variant on spaces, accepts list directly).
 * - Gracefully handles missing frontmatter (returns defaults, body = full content).
 * - Gracefully handles malformed YAML (returns defaults, extracts body if possible).
 */
export function parseSkillMd(content: string): ParseResult {
  const match = FRONTMATTER_RE.exec(content)
  if (!match) {
    return { frontmatter: { ...DEFAULT_FRONTMATTER }, body: content }
  }

  const rawYaml = match[1]
  const body = match[2] ?? ""

  let parsed: Record<string, unknown> = {}
  try {
    const result = yaml.parse(rawYaml)
    if (result && typeof result === "object" && !Array.isArray(result)) {
      parsed = result as Record<string, unknown>
    }
  } catch {
    // Malformed YAML — return defaults with recovered body
    return { frontmatter: { ...DEFAULT_FRONTMATTER }, body: body || content }
  }

  // Normalize disableModelInvocation — YAML key is "disable-model-invocation"
  const disableRaw =
    parsed["disable-model-invocation"] ?? parsed["disableModelInvocation"]
  const disableModelInvocation =
    typeof disableRaw === "boolean" ? disableRaw : false

  // Normalize allowedTools — YAML key is "allowed-tools"
  const toolsRaw = parsed["allowed-tools"] ?? parsed["allowedTools"]
  let allowedTools: string[] = []
  if (Array.isArray(toolsRaw)) {
    allowedTools = toolsRaw.filter((t) => typeof t === "string") as string[]
  } else if (typeof toolsRaw === "string") {
    allowedTools = toolsRaw.split(/\s+/).filter(Boolean)
  }

  const frontmatter: SkillFrontmatter = {
    name: typeof parsed["name"] === "string" ? parsed["name"] : undefined,
    description:
      typeof parsed["description"] === "string"
        ? parsed["description"]
        : undefined,
    disableModelInvocation,
    allowedTools,
  }

  return { frontmatter, body }
}
