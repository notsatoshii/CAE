"""
Phantom — CAE debugger integration.

The wrap itself is one shell call:
    claude --print --effort max --agent gsd-debugger <prompt>

This module is the INTEGRATION around that call:
  - Decide when Phantom is needed (based on CircuitBreakers escalation signals)
  - Prepare the context Phantom needs (failing diff, errors, plan, prior SUMMARYs)
  - Interpret Phantom's structured return:
      ## ROOT CAUSE FOUND   → orchestrator routes fix as Forge's next retry input
      ## DEBUG COMPLETE     → same (Phantom already fixed it inline; just report)
      ## CHECKPOINT REACHED → Telegram escalation to human
  - Maintain per-task debug file state across re-invocations

Context prep is the meat. A Phantom with good context is worth its Opus tier.

Usage from orchestrator:
    from phantom import Phantom
    ph = Phantom(project_root, circuit_breakers)
    result = ph.investigate(task_id, plan_path, forge_summaries, git_diff, error_output)
    if result.kind == "fix":
        # Pass result.fix_instructions to next Forge run
    elif result.kind == "escalate":
        # Send result.report to Telegram
"""
from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import List, Literal, Optional


@dataclass
class PhantomResult:
    kind: Literal["fix", "escalate", "inline_done", "failed"]
    raw_output: str
    fix_instructions: Optional[str] = None   # For "fix": what to tell next Forge
    report: Optional[str] = None             # For "escalate": what to send to human
    root_cause: Optional[str] = None         # Extracted summary


class Phantom:
    """Integrates the gsd-debugger wrap into the orchestrator's retry loop."""

    def __init__(self, project_root: Path | str, circuit_breakers=None):
        self.project_root = Path(project_root)
        self.cb = circuit_breakers
        self.cae_root = Path(__file__).resolve().parent.parent
        self.adapter = self.cae_root / "adapters" / "claude-code.sh"
        self.debug_root = self.project_root / ".planning" / "debug"
        self.debug_root.mkdir(parents=True, exist_ok=True)

    # ─── Decide when to escalate ────────────────────────────────────────
    def should_escalate(self, task_id: str) -> bool:
        if self.cb is None:
            return False
        return self.cb.should_escalate_to_phantom(task_id)

    # ─── Prepare Phantom's context ──────────────────────────────────────
    def _task_debug_dir(self, task_id: str) -> Path:
        d = self.debug_root / task_id
        d.mkdir(parents=True, exist_ok=True)
        return d

    def prepare_context(
        self,
        task_id: str,
        plan_path: Path,
        forge_summaries: List[Path],
        git_diff: str,
        error_output: str,
    ) -> Path:
        """
        Write a context file Phantom will read. Returns the path.
        Accumulates across re-invocations — each call adds a new <investigation> block.
        """
        ddir = self._task_debug_dir(task_id)
        ctx_path = ddir / "context.md"

        investigation_num = len(list(ddir.glob("investigation-*.md"))) + 1
        inv_path = ddir / f"investigation-{investigation_num}.md"

        parts = []
        parts.append(f"# Phantom Investigation #{investigation_num} — task {task_id}\n")
        parts.append(f"## Plan being executed\n\n@{plan_path}\n")

        if forge_summaries:
            parts.append("## Prior Forge attempts (SUMMARY.md files)\n")
            for s in forge_summaries:
                parts.append(f"\n### {s.name}\n")
                try:
                    parts.append(s.read_text()[:4000])  # Cap each summary
                except Exception as e:
                    parts.append(f"(could not read: {e})")

        if error_output:
            parts.append("\n## Last error output\n\n```\n")
            parts.append(error_output[-4000:])  # Last 4k chars, tail is usually the most relevant
            parts.append("\n```\n")

        if git_diff:
            parts.append("\n## Current diff\n\n```diff\n")
            parts.append(git_diff[:8000])
            parts.append("\n```\n")

        investigation_content = "\n".join(parts)
        inv_path.write_text(investigation_content)

        # Rebuild rolling context.md with the latest investigation on top
        prior = sorted(ddir.glob("investigation-*.md"))
        rolling = "# Phantom debug context — rolling\n\n"
        for p in reversed(prior):  # Most recent first
            rolling += f"---\n\n{p.read_text()}\n\n"
        ctx_path.write_text(rolling)

        return ctx_path

    # ─── Build the prompt Phantom receives ──────────────────────────────
    def _build_prompt(self, context_path: Path, task_id: str) -> Path:
        """Prompt written to a temp file, piped into the adapter."""
        ddir = self._task_debug_dir(task_id)
        prompt_path = ddir / "prompt.md"
        prompt_path.write_text(f"""<debug_context>
**Task:** {task_id}
**Mode:** autonomous (not interactive — no checkpoints unless unavoidable)

A previous Forge instance failed multiple times on this task. Investigate
the root cause and either (a) describe the fix the next Forge should apply,
or (b) flag that human input is required.

<files_to_read>
- {context_path}
</files_to_read>
</debug_context>

<expected_output>
- ## ROOT CAUSE FOUND — root cause + fix instructions the orchestrator passes to next Forge
- ## DEBUG COMPLETE — you fixed it inline (less likely in autonomous mode)
- ## CHECKPOINT REACHED — you need human input; describe what and why
</expected_output>
""")
        return prompt_path

    # ─── Invoke gsd-debugger ────────────────────────────────────────────
    def investigate(
        self,
        task_id: str,
        plan_path: Path,
        forge_summaries: List[Path],
        git_diff: str = "",
        error_output: str = "",
    ) -> PhantomResult:
        """
        Run Phantom on a failing task. Returns structured PhantomResult.
        """
        if self.cb:
            # Note: Phantom attempts tracked separately from Forge attempts
            pass  # Orchestrator calls cb.record_phantom_attempt() after we return

        context_path = self.prepare_context(task_id, plan_path, forge_summaries, git_diff, error_output)
        prompt_path = self._build_prompt(context_path, task_id)

        # Invoke via adapter
        session_id = f"phantom-{task_id}"
        cmd = [
            str(self.adapter),
            str(prompt_path),
            "claude-opus-4-6",   # Phantom always uses Opus for deep debugging
            session_id,
            "--agent", "gsd-debugger",
            "--effort", "max",
            "--timeout", "1800",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)

        output_path = Path(str(prompt_path) + ".output")
        output = output_path.read_text() if output_path.exists() else ""

        if result.returncode != 0:
            return PhantomResult(kind="failed", raw_output=output or result.stderr)

        return self._parse_output(output)

    # ─── Parse Phantom's structured return ──────────────────────────────
    def _parse_output(self, output: str) -> PhantomResult:
        """
        Scan for section markers (per WRAPPED_AGENT_CONTRACTS.md):
          ## ROOT CAUSE FOUND
          ## DEBUG COMPLETE
          ## CHECKPOINT REACHED
        Preamble before the first marker is discarded.
        """
        markers = {
            "## ROOT CAUSE FOUND": "fix",
            "## DEBUG COMPLETE": "inline_done",
            "## CHECKPOINT REACHED": "escalate",
        }

        best_idx = None
        best_kind = None
        for marker, kind in markers.items():
            idx = output.find(marker)
            if idx >= 0 and (best_idx is None or idx < best_idx):
                best_idx = idx
                best_kind = kind

        if best_kind is None:
            # No marker found — treat as failed
            return PhantomResult(kind="failed", raw_output=output)

        section = output[best_idx:]

        if best_kind == "fix":
            # Extract root cause (first paragraph after "Root Cause:" header if present, else first para)
            root_cause = self._extract_root_cause(section)
            # The whole section after the marker is the fix instructions to pass to next Forge
            return PhantomResult(
                kind="fix",
                raw_output=output,
                root_cause=root_cause,
                fix_instructions=section,
            )

        if best_kind == "inline_done":
            return PhantomResult(
                kind="inline_done",
                raw_output=output,
                root_cause=self._extract_root_cause(section),
            )

        if best_kind == "escalate":
            return PhantomResult(
                kind="escalate",
                raw_output=output,
                report=section,
            )

        return PhantomResult(kind="failed", raw_output=output)

    @staticmethod
    def _extract_root_cause(section: str) -> Optional[str]:
        # Look for patterns like "Root Cause: ..." or "**Root cause:** ..."
        m = re.search(r"(?:\*\*)?Root [Cc]ause[:\*]{0,3}\s*([^\n]+)", section)
        if m:
            return m.group(1).strip()
        # Fallback: first non-empty line after the marker
        for line in section.splitlines()[1:]:
            line = line.strip()
            if line:
                return line[:200]
        return None
