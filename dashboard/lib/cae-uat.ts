/**
 * lib/cae-uat.ts — UAT state management for the ROADMAP → UAT pipeline.
 *
 * Phase 10 REQ-10-08:
 *  - parseSuccessCriteria: parse Definition-of-done bullets from ROADMAP.md
 *    into Map<phaseNum, UatItem[]> with 8-char sha1 stable ids
 *  - loadUatState: load or initialize per-phase .planning/uat/phaseN.json
 *  - patchUatState: update a single item's status/note and persist
 *
 * ID STABILITY (D-10):
 *  id = sha1(phase + ':' + bulletText).slice(0, 8)
 *  Same bullet in different phases → different ids (phase number is part of seed).
 *  Same bullet in same phase → always same id (deterministic).
 *
 * SECURITY (T-10-03-05):
 *  parseSuccessCriteria is a pure string operation: no shell, no eval.
 *  Catastrophic backtracking avoided via anchored lookaheads + non-greedy quantifiers.
 */

import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { Project } from "./cae-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UatItem {
  /** sha1(phase + ':' + text).slice(0,8) */
  id: string;
  /** original bullet text */
  label: string;
  status: "pending" | "pass" | "fail";
  /** optional free-text note from the UAT reviewer */
  note?: string;
  /** ISO timestamp of last status change */
  ts?: string;
  /** true when a previously-known id no longer appears in the current ROADMAP */
  orphaned?: boolean;
}

export interface UatState {
  phase: number;
  items: UatItem[];
}

/** Patch request shape accepted by patchUatState (object overload). */
export interface UatPatch {
  phase: number;
  id: string;
  status: "pass" | "fail";
  note?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute the stable 8-char sha1 id for a (phase, bulletText) pair.
 * The phase number is part of the hash seed to prevent collisions across phases.
 */
function hashId(phase: number, text: string): string {
  return createHash("sha1")
    .update(`${phase}:${text}`)
    .digest("hex")
    .slice(0, 8);
}

/**
 * Resolve the absolute path of the UAT state JSON for a given phase.
 */
function stateFilePath(root: string, phaseNum: number): string {
  return join(root, ".planning", "uat", `phase${phaseNum}.json`);
}

/**
 * Read the project ROADMAP.md text. Returns empty string on ENOENT.
 */
async function readRoadmap(root: string): Promise<string> {
  const p = join(root, ".planning", "ROADMAP.md");
  return readFile(p, "utf8").catch(() => "");
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/**
 * Parse all '## Phase N:' sections in a ROADMAP markdown string.
 * For each phase, extract 'Definition of done:' bullet list.
 * Returns Map<phaseNum, UatItem[]> with status='pending' on every item.
 *
 * Parsing strategy (sentinel approach):
 *  JS multiline regex lacks \Z (true end-of-string). We append a sentinel
 *  heading so the lookahead always finds a boundary instead of relying on \Z.
 *
 * Catastrophic-backtracking-safe: anchored lookaheads + non-greedy quantifiers.
 * Case-insensitive match on 'Definition of done'.
 */
export function parseSuccessCriteria(md: string): Map<number, UatItem[]> {
  const out = new Map<number, UatItem[]>();

  // Sentinel: guarantee every phase section has a following ## Phase N heading.
  const sentinel = "\n## Phase 999999: sentinel\n";
  const src = md + sentinel;

  // Match each ## Phase N section up to the next ## Phase heading.
  const phaseRe =
    /^##\s+Phase\s+(\d+)\b[^\n]*\n([\s\S]*?)(?=^##\s+Phase\s+\d+\b)/gm;

  for (const m of src.matchAll(phaseRe)) {
    const phaseNum = parseInt(m[1], 10);
    // Skip the sentinel phase itself.
    if (phaseNum === 999999) continue;

    const body = m[2];

    // Find "Definition of done:" block — case-insensitive.
    // Block ends at blank line or end of section body.
    const dodMatch =
      /Definition of done:\s*\n([\s\S]*?)(?:\n[ \t]*\n|$)/i.exec(body);
    if (!dodMatch) continue;

    const bulletsBlock = dodMatch[1];
    const bullets = [...bulletsBlock.matchAll(/^\s*-\s+(.+)$/gm)]
      .map((b) => b[1].trim())
      .filter(Boolean);

    if (bullets.length === 0) continue;

    const items: UatItem[] = bullets.map((label) => ({
      id: hashId(phaseNum, label),
      label,
      status: "pending",
    }));

    out.set(phaseNum, items);
  }

  return out;
}

/**
 * Load or initialize <root>/.planning/uat/phase<N>.json.
 *
 * - When the file is missing: parse ROADMAP.md via parseSuccessCriteria,
 *   write the fresh state, return it.
 * - When the file exists: merge:
 *     - Known ids: preserve existing status / note / ts
 *     - New ROADMAP ids not in saved state: append as pending
 *     - Saved ids not in current ROADMAP: flag orphaned: true
 *
 * Overload 1: loadUatState(projectRoot, phaseNum) — plain string root
 * Overload 2: loadUatState(proj, phaseNum) — Project object
 */
export async function loadUatState(
  projectRoot: string,
  phaseNum: number,
): Promise<UatState>;
export async function loadUatState(
  proj: Project,
  phaseNum: number,
): Promise<UatState>;
export async function loadUatState(
  projOrRoot: string | Project,
  phaseNum: number,
): Promise<UatState> {
  const root = typeof projOrRoot === "string" ? projOrRoot : projOrRoot.path;
  const file = stateFilePath(root, phaseNum);

  // Parse current ROADMAP for fresh items.
  const roadmapMd = await readRoadmap(root);
  const parsedItems = parseSuccessCriteria(roadmapMd).get(phaseNum) ?? [];

  // Attempt to read existing state file.
  let existing: UatState | null = null;
  try {
    const raw = await readFile(file, "utf8");
    existing = JSON.parse(raw) as UatState;
  } catch {
    // File missing or unparseable — treat as new.
  }

  let items: UatItem[];

  if (!existing) {
    items = parsedItems;
  } else {
    // Merge existing state with freshly parsed ROADMAP items.
    const parsedIds = new Set(parsedItems.map((p) => p.id));
    const existingById = new Map(existing.items.map((it) => [it.id, it]));

    items = [
      // Current ROADMAP items — preserve prior status/note/ts if known.
      ...parsedItems.map((p) => {
        const prior = existingById.get(p.id);
        if (prior) {
          return {
            ...p,
            status: prior.status,
            note: prior.note,
            ts: prior.ts,
            // orphaned intentionally omitted — the bullet is live in the current ROADMAP.
            // If it was previously orphaned (removed then re-added verbatim), the re-match
            // here means it's live again; spreading prior.orphaned would falsely keep it dead.
          };
        }
        return p;
      }),
      // Items in saved state that no longer exist in ROADMAP — flag as orphaned.
      ...existing.items
        .filter((it) => !parsedIds.has(it.id))
        .map((it) => ({ ...it, orphaned: true })),
    ];
  }

  const state: UatState = { phase: phaseNum, items };

  // Persist (create or overwrite).
  await mkdir(join(root, ".planning", "uat"), { recursive: true });
  await writeFile(file, JSON.stringify(state, null, 2), "utf8");

  return state;
}

/**
 * Update a single item's status + optional note, persist to disk.
 *
 * Overload 1: patchUatState(projectRoot, patch) — patch object { phase, id, status, note? }
 * Overload 2: patchUatState(proj, phaseNum, id, status, note?) — explicit args (plan interface)
 *
 * Behaviour on missing id:
 *  - If the item id is not found in the loaded state, the item is created
 *    (upsert semantics) so that fresh projects with no ROADMAP can still
 *    record UAT patches. This matches the test scaffold expectation:
 *    "If item not found (fresh project), patch creates it".
 */
export async function patchUatState(
  projectRoot: string,
  patch: UatPatch,
): Promise<UatState>;
export async function patchUatState(
  proj: Project,
  phaseNum: number,
  id: string,
  status: "pass" | "fail",
  note?: string,
): Promise<UatState>;
export async function patchUatState(
  projOrRoot: string | Project,
  patchOrPhase: UatPatch | number,
  id?: string,
  status?: "pass" | "fail",
  note?: string,
): Promise<UatState> {
  let root: string;
  let phaseNum: number;
  let itemId: string;
  let itemStatus: "pass" | "fail";
  let itemNote: string | undefined;

  if (typeof patchOrPhase === "object") {
    // Object overload: patchUatState(projectRoot, patch)
    root = typeof projOrRoot === "string" ? projOrRoot : projOrRoot.path;
    phaseNum = patchOrPhase.phase;
    itemId = patchOrPhase.id;
    itemStatus = patchOrPhase.status;
    itemNote = patchOrPhase.note;
  } else {
    // Explicit args overload: patchUatState(proj, phaseNum, id, status, note?)
    root = typeof projOrRoot === "string" ? projOrRoot : projOrRoot.path;
    phaseNum = patchOrPhase;
    itemId = id!;
    itemStatus = status!;
    itemNote = note;
  }

  const state = await loadUatState(root, phaseNum);
  const idx = state.items.findIndex((it) => it.id === itemId);

  const now = new Date().toISOString();

  if (idx >= 0) {
    // Update existing item in-place.
    state.items[idx] = {
      ...state.items[idx],
      status: itemStatus,
      note: itemNote,
      ts: now,
    };
  } else {
    // Item not found — upsert so fresh projects can record patches.
    // (Test scaffold: "If item not found (fresh project), patch creates it")
    state.items.push({
      id: itemId,
      label: itemId, // placeholder label when no ROADMAP bullet exists
      status: itemStatus,
      note: itemNote,
      ts: now,
    });
  }

  const file = stateFilePath(root, phaseNum);
  await mkdir(join(root, ".planning", "uat"), { recursive: true });
  await writeFile(file, JSON.stringify(state, null, 2), "utf8");
  return state;
}
