"""
Compaction cascade — 5 layers applied cheapest-first to keep Forge's
task.md under the context window.

Architectural note: because CAE invokes claude --print (one turn per invocation),
there's no live session history to prune. The "turns" in this cascade are the
accumulated retry_context blocks that build up across Forge re-attempts. Each
layer decides what to include in the NEXT task.md, not what to remove from a
running session.

Layers (cheapest-first):
  (a) tool output budgets  — prompt-level guidance; Forge respects via persona
  (b) file summary         — large files pre-summarized; task.md refers to summary
  (c) turn pruning         — retry_context capped at last 15 attempts
  (d) Caveman activation   — inject caveman-mode instruction at 60% fill
  (e) hard summarization   — replace old retry_context blocks with a summary at 85%

Fill % estimation: character count of task.md vs model's context window.

Logs every firing to .cae/metrics/compaction.jsonl.

Usage from orchestrator:
    from compactor import Compactor
    c = Compactor(project_root, model="claude-sonnet-4-6")
    compacted_path = c.compact(task_md_path)
    # claude is invoked with compacted_path
"""
from __future__ import annotations

import json
import re
import subprocess
import time
from pathlib import Path
from typing import List, Optional


# Approximate context window sizes in characters (≈ 4 chars per token)
MODEL_CONTEXT_CHARS = {
    "claude-opus-4-6":   800_000,   # 200K tokens input window
    "claude-sonnet-4-6": 800_000,
    "claude-haiku-4-5":  800_000,
    "gemini-2.5-pro":    4_000_000,  # 1M tokens
    "gemini-flash":      4_000_000,
}

# Fill thresholds
THRESHOLD_CAVEMAN = 0.60     # Layer (d)
THRESHOLD_HARD_SUM = 0.85    # Layer (e)

# Layer (a) tool output budgets (consumed by persona prompts)
TOOL_OUTPUT_BUDGETS = {
    "Read": 2000,
    "Grep": 1000,
    "Bash": 3000,
}

# Layer (b) file summary threshold
FILE_SUMMARY_LINE_THRESHOLD = 500

# Layer (c) max retry_context attempts to keep verbatim
MAX_RETRY_ATTEMPTS_VERBATIM = 15


class Compactor:
    def __init__(self, project_root: Path | str, model: str):
        self.project_root = Path(project_root)
        self.cae_root = Path(__file__).resolve().parent.parent
        self.claude_adapter = self.cae_root / "adapters" / "claude-code.sh"
        self.model = model
        self.window_chars = MODEL_CONTEXT_CHARS.get(model, 800_000)
        self.metrics_path = self.project_root / ".cae" / "metrics" / "compaction.jsonl"
        self.metrics_path.parent.mkdir(parents=True, exist_ok=True)

    def _log(self, event: str, **fields):
        entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "event": event, **fields}
        with open(self.metrics_path, "a") as f:
            f.write(json.dumps(entry) + "\n")

    # ─── Public entry point ─────────────────────────────────────────────
    def compact(self, task_md_path: Path) -> Path:
        """
        Apply the cascade to task_md in place. Returns the (possibly same) path.
        Logs every layer that fires.
        """
        content = task_md_path.read_text()
        original_size = len(content)
        layers_fired = []

        # Layer (a): ensure the persona-level tool output budgets are declared
        content, fired = self._apply_layer_a(content)
        if fired:
            layers_fired.append("a_tool_budgets")

        # Layer (b): substitute summaries for large files referenced in <files_to_read>
        content, fired = self._apply_layer_b(content, task_md_path.parent)
        if fired:
            layers_fired.append("b_file_summaries")

        # Layer (c): prune retry_context blocks beyond 15 attempts
        content, fired = self._apply_layer_c(content)
        if fired:
            layers_fired.append("c_turn_pruning")

        # Check fill %
        fill = len(content) / self.window_chars

        # Layer (d): caveman activation at 60%
        if fill >= THRESHOLD_CAVEMAN:
            content, fired = self._apply_layer_d(content)
            if fired:
                layers_fired.append("d_caveman")

        # Layer (e): hard summarization at 85%
        fill = len(content) / self.window_chars
        if fill >= THRESHOLD_HARD_SUM:
            content, fired = self._apply_layer_e(content)
            if fired:
                layers_fired.append("e_hard_summarize")

        final_size = len(content)
        final_fill = final_size / self.window_chars

        if content != task_md_path.read_text():
            task_md_path.write_text(content)

        if layers_fired:
            self._log("compacted", path=str(task_md_path), layers=layers_fired,
                      before_size=original_size, after_size=final_size,
                      window_chars=self.window_chars, final_fill=round(final_fill, 3))

        return task_md_path

    # ─── Layer (a): tool output budgets ─────────────────────────────────
    def _apply_layer_a(self, content: str) -> tuple[str, bool]:
        """
        Ensure task.md has a <tool_budgets> section that tells Forge about
        per-tool output caps. Injected once; idempotent.
        """
        if "<tool_budgets>" in content:
            return content, False
        budgets_block = "\n<tool_budgets>\n"
        for tool, cap in TOOL_OUTPUT_BUDGETS.items():
            budgets_block += f"- {tool}: respect a soft cap of {cap} output tokens per call; truncate verbose results\n"
        budgets_block += "</tool_budgets>\n"

        # Insert before the last instruction block if one exists, else append
        insert_at = content.rfind("<instructions>")
        if insert_at >= 0:
            content = content[:insert_at] + budgets_block + "\n" + content[insert_at:]
        else:
            content += budgets_block
        return content, True

    # ─── Layer (b): file summaries ──────────────────────────────────────
    def _apply_layer_b(self, content: str, work_dir: Path) -> tuple[str, bool]:
        """
        Find files referenced in <files_to_read> that are >500 lines. Generate
        a brief summary (synchronously, via quick Claude call) and swap the
        reference. Results cached per-file for the phase.
        """
        files_block_match = re.search(r"<files_to_read>(.*?)</files_to_read>", content, re.DOTALL)
        if not files_block_match:
            return content, False

        files_block = files_block_match.group(1)
        fired = False
        new_files_block = files_block

        for line in files_block.splitlines():
            m = re.match(r"^-\s+([^\s(]+)", line)
            if not m:
                continue
            ref = m.group(1).strip()
            file_path = self.project_root / ref if not ref.startswith("/") else Path(ref)
            if not file_path.exists() or not file_path.is_file():
                continue
            try:
                lines = file_path.read_text().splitlines()
            except Exception:
                continue
            if len(lines) < FILE_SUMMARY_LINE_THRESHOLD:
                continue

            summary_path = self._get_or_create_summary(file_path)
            if summary_path is not None:
                rel_summary = summary_path.relative_to(self.project_root)
                new_line = line.replace(ref, f"{rel_summary} (summary — original has {len(lines)} lines)")
                new_files_block = new_files_block.replace(line, new_line)
                fired = True

        if fired:
            content = content.replace(files_block_match.group(0),
                                     f"<files_to_read>{new_files_block}</files_to_read>")
        return content, fired

    def _get_or_create_summary(self, file_path: Path) -> Optional[Path]:
        """Cache summaries under .cae/summaries/. Create via Haiku if missing."""
        cache_dir = self.project_root / ".cae" / "summaries"
        cache_dir.mkdir(parents=True, exist_ok=True)
        # Hash path by replacing / with _
        key = str(file_path.relative_to(self.project_root)).replace("/", "_") if file_path.is_relative_to(self.project_root) else file_path.name
        summary_path = cache_dir / f"{key}.summary.md"
        if summary_path.exists():
            return summary_path

        # Create summary via Haiku
        prompt_path = cache_dir / f"{key}.prompt.md"
        prompt_path.write_text(f"""<task>
Summarize this file for a builder agent. Output format:

## Purpose
<1-2 sentences>

## Key exports / symbols
<bulleted list>

## Key control flow
<numbered steps if any>

## Dependencies
<imports / references>

Max 40 lines total. Be terse.
</task>

<file path="{file_path}">
```
{file_path.read_text()[:80_000]}
```
</file>
""")
        session = f"summary-{int(time.time() * 1000)}"
        r = subprocess.run([
            "bash", str(self.claude_adapter),
            str(prompt_path), "claude-haiku-4-5", session,
            "--system-prompt-file", str(self.cae_root / "agents" / "cae-scout.md"),
            "--effort", "low",
            "--timeout", "180",
        ], capture_output=True)
        out = Path(str(prompt_path) + ".output")
        if out.exists() and out.stat().st_size > 50:
            summary_path.write_text(out.read_text())
            return summary_path
        return None

    # ─── Layer (c): turn pruning ────────────────────────────────────────
    def _apply_layer_c(self, content: str) -> tuple[str, bool]:
        """
        Keep only the most recent 15 <retry_context> blocks verbatim.
        Older ones are condensed to a one-line stub.
        """
        blocks = list(re.finditer(r"<retry_context>(.*?)</retry_context>", content, re.DOTALL))
        if len(blocks) <= MAX_RETRY_ATTEMPTS_VERBATIM:
            return content, False

        # Keep last N verbatim, condense the rest
        keep_from = len(blocks) - MAX_RETRY_ATTEMPTS_VERBATIM
        fired = False
        for i, m in enumerate(blocks):
            if i < keep_from:
                condensed = f"<retry_context>\n(attempt {i+1}: pruned by compactor; first line: {m.group(1).splitlines()[0][:100] if m.group(1).strip() else '(empty)'}...)\n</retry_context>"
                content = content.replace(m.group(0), condensed, 1)
                fired = True
        return content, fired

    # ─── Layer (d): caveman activation ──────────────────────────────────
    def _apply_layer_d(self, content: str) -> tuple[str, bool]:
        if "caveman-mode" in content.lower() or "/caveman" in content.lower():
            return content, False
        block = "\n<compression_mode>\nActivate caveman-mode for this invocation: terse output, no prose, technical accuracy first. Context is at >60% fill.\n</compression_mode>\n"
        # Append near the top so Forge sees it early
        insert_at = content.find("<objective>")
        if insert_at < 0:
            return content + block, True
        return content[:insert_at] + block + content[insert_at:], True

    # ─── Layer (e): hard summarization ──────────────────────────────────
    def _apply_layer_e(self, content: str) -> tuple[str, bool]:
        """
        At 85%+ fill, ALL retry_context blocks (except the most recent) are
        replaced by a single compact summary generated via Haiku.
        """
        blocks = list(re.finditer(r"<retry_context>(.*?)</retry_context>", content, re.DOTALL))
        if len(blocks) < 2:
            return content, False

        # Concatenate all but the last
        to_summarize = "\n\n".join(b.group(1) for b in blocks[:-1])
        summary = self._quick_summarize(to_summarize, "These are retry contexts from previous Forge attempts on the same task. Compress them into at most 10 lines capturing: what was tried, what failed, and any patterns.")
        if summary is None:
            return content, False

        # Replace all matched blocks except the last with one summary block
        new_content = content
        for b in blocks[:-1]:
            new_content = new_content.replace(b.group(0), "", 1)

        # Insert the summary once, before the final retry_context block
        if blocks:
            last = blocks[-1]
            replacement = f"<retry_history_summary>\n{summary}\n</retry_history_summary>\n\n" + last.group(0)
            new_content = new_content.replace(last.group(0), replacement, 1)

        return new_content, True

    def _quick_summarize(self, text: str, instruction: str) -> Optional[str]:
        """Sync Haiku summarization — returns summary text or None."""
        cache_dir = self.project_root / ".cae" / "summaries"
        cache_dir.mkdir(parents=True, exist_ok=True)
        prompt_path = cache_dir / f"hard-sum-{int(time.time() * 1000)}.md"
        prompt_path.write_text(f"<task>{instruction}</task>\n\n<content>\n{text[:40_000]}\n</content>\n")
        session = f"hardsum-{int(time.time() * 1000)}"
        subprocess.run([
            "bash", str(self.claude_adapter),
            str(prompt_path), "claude-haiku-4-5", session,
            "--system-prompt-file", str(self.cae_root / "agents" / "cae-scribe.md"),
            "--effort", "low",
            "--timeout", "120",
        ], capture_output=True)
        out = Path(str(prompt_path) + ".output")
        return out.read_text() if out.exists() else None
