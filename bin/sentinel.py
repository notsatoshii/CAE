"""
Sentinel — cross-provider adversarial reviewer.

Invokes Gemini 2.5 Pro via adapters/gemini-cli.sh with the methodology-ported
prompt from agents/cae-sentinel-gemini.md. Returns a structured verdict.

Fallback: after N JSON-parse failures (cap in circuit_breakers.yaml), fall
back to the Claude-side wrap of gsd-verifier (via adapters/claude-code.sh).

Usage from orchestrator:
    from sentinel import Sentinel
    s = Sentinel(project_root, circuit_breakers)
    verdict = s.review(task_id, plan_path, diff, builder_model, test_output)
    if verdict["approve"] and verdict["reviewer_model"] != builder_model:
        # safe to merge
    else:
        # route issues back to Forge / escalate
"""
from __future__ import annotations

import json
import re
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class ReviewContext:
    task_id: str
    plan_path: Path
    diff: str
    builder_model: str
    test_output: str = ""


class Sentinel:
    def __init__(self, project_root: Path | str, circuit_breakers=None):
        self.project_root = Path(project_root)
        self.cb = circuit_breakers
        self.cae_root = Path(__file__).resolve().parent.parent
        self.gemini_adapter = self.cae_root / "adapters" / "gemini-cli.sh"
        self.claude_adapter = self.cae_root / "adapters" / "claude-code.sh"
        self.gemini_prompt_file = self.cae_root / "agents" / "cae-sentinel-gemini.md"
        self.metrics_path = self.project_root / ".cae" / "metrics" / "sentinel.jsonl"
        self.metrics_path.parent.mkdir(parents=True, exist_ok=True)

    def _log(self, event: str, **fields):
        entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "event": event, **fields}
        with open(self.metrics_path, "a") as f:
            f.write(json.dumps(entry) + "\n")

    # ─── Build Sentinel's user prompt ───────────────────────────────────
    def _build_prompt_file(self, ctx: ReviewContext) -> Path:
        work_dir = self.project_root / ".planning" / "review" / ctx.task_id
        work_dir.mkdir(parents=True, exist_ok=True)
        prompt_path = work_dir / "review-prompt.md"

        agents_md_path = self.project_root / "AGENTS.md"
        agents_md_ref = f"- {agents_md_path}\n" if agents_md_path.exists() else ""

        prompt_path.write_text(f"""<review_context>
**Task ID:** {ctx.task_id}
**Builder model:** {ctx.builder_model}
**Plan:** @{ctx.plan_path}

You are reviewing the following diff. Apply the methodology in your system
instructions (goal-backward, 3-level: exists/substantive/wired). Produce
ONLY valid JSON matching the schema in your system instructions.
</review_context>

<files_to_read>
- {ctx.plan_path}
{agents_md_ref}</files_to_read>

<diff>
```
{ctx.diff[:15000]}
```
</diff>

<test_output>
```
{ctx.test_output[:3000]}
```
</test_output>

Produce the JSON verdict now. Nothing else.
""")
        return prompt_path

    # ─── Parse Gemini's JSON response ───────────────────────────────────
    @staticmethod
    def _extract_json(raw: str) -> Optional[dict]:
        """Try hard to find a JSON object in the output."""
        raw = raw.strip()
        # Happy path — straight JSON
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
        # Try to find the first {...} block
        start = raw.find("{")
        if start >= 0:
            # Find matching close by counting
            depth = 0
            for i in range(start, len(raw)):
                if raw[i] == "{":
                    depth += 1
                elif raw[i] == "}":
                    depth -= 1
                    if depth == 0:
                        candidate = raw[start:i+1]
                        try:
                            return json.loads(candidate)
                        except json.JSONDecodeError:
                            break
        # Try extracting from ```json fences
        m = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                pass
        return None

    # ─── Validate verdict structure ─────────────────────────────────────
    @staticmethod
    def _validate_verdict(verdict: dict, builder_model: str) -> tuple[bool, str]:
        required = {"approve", "reviewer_model", "builder_model", "issues"}
        missing = required - set(verdict.keys())
        if missing:
            return False, f"missing fields: {missing}"
        if not isinstance(verdict["approve"], bool):
            return False, "approve must be boolean"
        if not isinstance(verdict["issues"], list):
            return False, "issues must be array"
        if verdict["reviewer_model"] == builder_model:
            return False, f"reviewer_model == builder_model ({builder_model}) — adversarial review violated"
        return True, ""

    # ─── Primary: Gemini Sentinel ───────────────────────────────────────
    def _review_gemini(self, ctx: ReviewContext) -> Optional[dict]:
        prompt_path = self._build_prompt_file(ctx)
        session_id = f"sentinel-{ctx.task_id}"

        result = subprocess.run([
            "bash", str(self.gemini_adapter),
            str(prompt_path), "gemini-2.5-pro", session_id,
            "--system-prompt-file", str(self.gemini_prompt_file),
            "--format", "json",
            "--timeout", "600",
        ], capture_output=False)

        output_path = Path(str(prompt_path) + ".output")
        if not output_path.exists():
            self._log("gemini_no_output", task_id=ctx.task_id, exit=result.returncode)
            return None

        raw = output_path.read_text()
        verdict = self._extract_json(raw)
        if verdict is None:
            self._log("gemini_json_parse_failed", task_id=ctx.task_id, raw_len=len(raw))
            if self.cb:
                self.cb.record_sentinel_json_failure()
            return None

        ok, reason = self._validate_verdict(verdict, ctx.builder_model)
        if not ok:
            self._log("gemini_verdict_invalid", task_id=ctx.task_id, reason=reason)
            if self.cb:
                self.cb.record_sentinel_json_failure()
            return None

        self._log("gemini_verdict_ok", task_id=ctx.task_id, approve=verdict["approve"],
                  issue_count=len(verdict["issues"]))
        return verdict

    # ─── Fallback: Claude gsd-verifier wrap ─────────────────────────────
    def _review_claude_fallback(self, ctx: ReviewContext) -> Optional[dict]:
        """
        Fallback path when Gemini's JSON proves unreliable.
        Uses claude --agent gsd-verifier, then synthesizes a verdict from its
        structured markdown output.
        """
        prompt_path = self._build_prompt_file(ctx)
        session_id = f"sentinel-fb-{ctx.task_id}"

        result = subprocess.run([
            "bash", str(self.claude_adapter),
            str(prompt_path), "claude-opus-4-6", session_id,
            "--agent", "gsd-verifier",
            "--effort", "max",
            "--timeout", "1800",
        ], capture_output=False)

        output_path = Path(str(prompt_path) + ".output")
        if not output_path.exists():
            self._log("claude_fallback_no_output", task_id=ctx.task_id)
            return None

        raw = output_path.read_text()

        # gsd-verifier output varies: sometimes JSON verdict, sometimes markdown.
        # Try JSON first (robust across wrap output shapes).
        approve = None
        issues = []
        j = self._extract_json(raw)
        if j is not None:
            # Accept either {"verdict": "pass"|"fail"} or {"approve": bool}
            verdict_str = str(j.get("verdict", "")).lower()
            if verdict_str in ("pass", "approved", "ok"):
                approve = True
            elif verdict_str in ("fail", "reject", "rejected"):
                approve = False
            elif isinstance(j.get("approve"), bool):
                approve = j["approve"]
            for issue in j.get("issues", []) or []:
                if isinstance(issue, dict):
                    issues.append({
                        "severity": issue.get("severity", "MAJOR"),
                        "location": issue.get("location", "(unspecified)"),
                        "description": str(issue.get("description", ""))[:300],
                        "recommendation": issue.get("recommendation", ""),
                    })

        # Fallback to markdown parsing if JSON didn't resolve a verdict.
        if approve is None:
            approve = "## VERIFICATION PASSED" in raw and "## ISSUES FOUND" not in raw
            if not approve:
                for m in re.finditer(r"\*\*(CRITICAL|MAJOR|MINOR)[^*]*\*\*[:\s]+([^\n]+)", raw):
                    issues.append({
                        "severity": m.group(1),
                        "location": "(see full report)",
                        "description": m.group(2).strip()[:300],
                        "recommendation": "(see full report)",
                    })

        verdict = {
            "approve": approve,
            "reviewer_model": "claude-opus-4-6",  # Fallback model — different from Sonnet-tier builder
            "builder_model": ctx.builder_model,
            "task_id": ctx.task_id,
            "verdict_summary": f"Claude fallback review: {'APPROVED' if approve else 'ISSUES FOUND'}",
            "issues": issues,
            "learnings_for_agents_md": [],
            "_fallback": True,
        }

        ok, reason = self._validate_verdict(verdict, ctx.builder_model)
        if not ok:
            self._log("claude_fallback_verdict_invalid", task_id=ctx.task_id, reason=reason)
            return None

        self._log("claude_fallback_verdict_ok", task_id=ctx.task_id, approve=approve, issues=len(issues))
        return verdict

    # ─── Public API ─────────────────────────────────────────────────────
    def review(
        self,
        task_id: str,
        plan_path: Path,
        diff: str,
        builder_model: str,
        test_output: str = "",
    ) -> dict:
        ctx = ReviewContext(task_id, plan_path, diff, builder_model, test_output)

        # Skip Gemini entirely if CLI not installed — go straight to Claude fallback.
        gemini_on_path = subprocess.run(["which", "gemini"], capture_output=True).returncode == 0
        cb_forces_fallback = bool(self.cb and self.cb.should_fall_back_sentinel())
        use_fallback = cb_forces_fallback or not gemini_on_path

        if not use_fallback:
            verdict = self._review_gemini(ctx)
            if verdict is not None:
                return verdict
            use_fallback = True
            self._log("gemini_failed_fallback_engaged", task_id=task_id)

        if use_fallback:
            verdict = self._review_claude_fallback(ctx)
            if verdict is not None:
                return verdict

        # Both failed — return a structured failure verdict
        self._log("sentinel_total_failure", task_id=task_id, builder_model=builder_model)
        return {
            "approve": False,
            "reviewer_model": "none",
            "builder_model": builder_model,
            "task_id": task_id,
            "verdict_summary": "Sentinel failed on both primary (Gemini) and fallback (Claude) paths. Manual review required.",
            "issues": [{
                "severity": "CRITICAL",
                "location": "(meta)",
                "description": "Sentinel review could not be produced",
                "recommendation": "Escalate to human via Telegram",
            }],
            "_total_failure": True,
        }
