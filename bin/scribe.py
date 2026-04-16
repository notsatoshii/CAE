"""
Scribe — automated knowledge extraction.

After a phase completes, reads SUMMARY.md files + Sentinel verdicts + git log,
invokes Gemini Flash with the methodology from agents/cae-scribe-gemini.md,
merges the JSON response into AGENTS.md and KNOWLEDGE/<topic>.md files with:
  - 300-line AGENTS.md hard cap (overflow rotates to KNOWLEDGE/)
  - Dedupe on write (skip entries that duplicate existing content)
  - Stale entry removal (if Scribe flagged them)

Falls back to Claude Haiku if Gemini Flash isn't available.

Usage from orchestrator:
    from scribe import Scribe
    s = Scribe(project_root)
    s.run_for_phase(phase_num)
"""
from __future__ import annotations

import json
import re
import subprocess
import time
from pathlib import Path
from typing import List, Optional


# Section order in AGENTS.md
SECTIONS = ["Project Conventions", "Patterns That Work", "Gotchas", "Library/API Notes"]
AGENTS_MD_LINE_CAP = 300


class Scribe:
    def __init__(self, project_root: Path | str):
        self.project_root = Path(project_root)
        self.cae_root = Path(__file__).resolve().parent.parent
        self.gemini_adapter = self.cae_root / "adapters" / "gemini-cli.sh"
        self.claude_adapter = self.cae_root / "adapters" / "claude-code.sh"
        self.scribe_prompt = self.cae_root / "agents" / "cae-scribe-gemini.md"
        self.metrics_path = self.project_root / ".cae" / "metrics" / "scribe.jsonl"
        self.metrics_path.parent.mkdir(parents=True, exist_ok=True)
        self.agents_md = self.project_root / "AGENTS.md"
        self.knowledge_dir = self.project_root / "KNOWLEDGE"

    def _log(self, event: str, **fields):
        entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "event": event, **fields}
        with open(self.metrics_path, "a") as f:
            f.write(json.dumps(entry) + "\n")

    # ─── Build Scribe's user prompt ─────────────────────────────────────
    def _build_prompt(self, phase_num: str) -> Optional[Path]:
        phase_dir = self._find_phase_dir(phase_num)
        if phase_dir is None:
            return None

        summaries = list(phase_dir.rglob("SUMMARY*.md")) + list(phase_dir.rglob("*SUMMARY*.md"))
        review_dir = self.project_root / ".planning" / "review"
        reviews = list(review_dir.rglob("review-prompt.md.output")) if review_dir.exists() else []

        # Git log for this phase
        try:
            git_log = subprocess.run(
                ["git", "-C", str(self.project_root), "log", "--oneline", "-20"],
                capture_output=True, text=True, timeout=10
            ).stdout
        except Exception:
            git_log = ""

        current_agents = self.agents_md.read_text() if self.agents_md.exists() else ""
        existing_topics = [p.stem for p in self.knowledge_dir.glob("*.md")] if self.knowledge_dir.exists() else []

        work_dir = phase_dir / "scribe"
        work_dir.mkdir(exist_ok=True)
        prompt_path = work_dir / "scribe-prompt.md"

        # Cap each summary at 2000 chars to keep prompt manageable
        def _read_capped(path, cap=2000):
            try:
                return path.read_text()[:cap]
            except Exception as e:
                return f"(could not read: {e})"

        summaries_text = "\n\n".join(
            f"### {s.relative_to(self.project_root)}\n{_read_capped(s)}" for s in summaries[:20]
        )
        reviews_text = "\n\n".join(
            f"### {r.relative_to(self.project_root)}\n{_read_capped(r, 1500)}" for r in reviews[:10]
        )

        prompt_path.write_text(f"""<scribe_context>
**Phase:** {phase_num}
**Phase dir:** {phase_dir.relative_to(self.project_root)}
</scribe_context>

<summaries>
{summaries_text or "(no SUMMARY.md files found)"}
</summaries>

<sentinel_reviews>
{reviews_text or "(no reviews found)"}
</sentinel_reviews>

<git_log>
{git_log}
</git_log>

<current_agents_md>
{current_agents or "(empty)"}
</current_agents_md>

<existing_knowledge_topics>
{', '.join(existing_topics) or "(none)"}
</existing_knowledge_topics>

Extract learnings and return JSON per your system instructions. Empty arrays are acceptable for a phase with nothing new.
""")
        return prompt_path

    def _find_phase_dir(self, phase_num: str) -> Optional[Path]:
        phases = self.project_root / ".planning" / "phases"
        if not phases.is_dir():
            return None
        padded = f"{int(phase_num):02d}"
        for d in phases.glob(f"{padded}-*"):
            return d
        for d in phases.glob(f"{phase_num}-*"):
            return d
        return None

    # ─── Invoke Scribe (Gemini Flash primary, Haiku fallback) ───────────
    def _invoke(self, prompt_path: Path) -> Optional[dict]:
        session_id = f"scribe-{int(time.time())}"

        # Primary: Gemini Flash
        gemini_available = subprocess.run(["which", "gemini"], capture_output=True).returncode == 0
        if gemini_available:
            r = subprocess.run([
                "bash", str(self.gemini_adapter),
                str(prompt_path), "gemini-flash", session_id,
                "--system-prompt-file", str(self.scribe_prompt),
                "--format", "json",
                "--timeout", "300",
            ], capture_output=False)
            parsed = self._parse_output(prompt_path)
            if parsed is not None:
                self._log("gemini_scribe_ok", additions=len(parsed.get("agents_md_additions", [])))
                return parsed
            self._log("gemini_scribe_failed")

        # Fallback: Claude Haiku (cheap)
        r = subprocess.run([
            "bash", str(self.claude_adapter),
            str(prompt_path), "claude-haiku-4-5", session_id + "-fb",
            "--system-prompt-file", str(self.scribe_prompt),
            "--effort", "low",
            "--timeout", "600",
        ], capture_output=False)
        parsed = self._parse_output(prompt_path)
        if parsed is not None:
            self._log("claude_haiku_scribe_ok", additions=len(parsed.get("agents_md_additions", [])))
            return parsed

        self._log("scribe_total_failure")
        return None

    def _parse_output(self, prompt_path: Path) -> Optional[dict]:
        output_path = Path(str(prompt_path) + ".output")
        if not output_path.exists():
            return None
        raw = output_path.read_text().strip()

        # Try straight JSON parse
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # Try to find first {...}
            start = raw.find("{")
            if start < 0:
                return None
            depth = 0
            for i in range(start, len(raw)):
                if raw[i] == "{":
                    depth += 1
                elif raw[i] == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            data = json.loads(raw[start:i+1])
                            break
                        except json.JSONDecodeError:
                            return None
            else:
                return None

        # Validate shape
        for field in ("agents_md_additions", "knowledge_topic_updates", "stale_entries_to_remove"):
            if field not in data:
                data[field] = []
            if not isinstance(data[field], list):
                return None
        return data

    # ─── Merge result into AGENTS.md and KNOWLEDGE/ ─────────────────────
    def _apply(self, result: dict) -> dict:
        applied = {"agents_md_added": 0, "agents_md_removed": 0,
                   "knowledge_topics_updated": 0, "agents_md_overflowed": 0}

        current = self.agents_md.read_text() if self.agents_md.exists() else self._blank_agents_md()
        parsed_sections = self._parse_agents_md(current)

        # Remove stale entries
        for stale in result.get("stale_entries_to_remove", []):
            stale_norm = stale.strip()
            for section, entries in parsed_sections.items():
                before = len(entries)
                parsed_sections[section] = [e for e in entries if e.strip() != stale_norm]
                applied["agents_md_removed"] += before - len(parsed_sections[section])

        # Add new entries (dedupe)
        for add in result.get("agents_md_additions", []):
            section = add.get("section")
            entry = add.get("entry", "").strip()
            attribution = add.get("attribution", "")
            if not section or not entry or section not in SECTIONS:
                continue
            # Format entry with attribution
            full_entry = f"- {entry}" + (f" ({attribution})" if attribution else "")
            # Dedupe: skip if any existing entry has >80% word overlap
            if self._is_duplicate(full_entry, parsed_sections[section]):
                continue
            parsed_sections[section].append(full_entry)
            applied["agents_md_added"] += 1

        # Reassemble AGENTS.md
        new_md = self._assemble_agents_md(parsed_sections)

        # Apply 300-line cap — overflow oldest entries per section to KNOWLEDGE/
        if new_md.count("\n") > AGENTS_MD_LINE_CAP:
            overflow_topic = f"agents-md-overflow-{int(time.time())}"
            overflow_lines = []
            lines = new_md.split("\n")
            while len(lines) > AGENTS_MD_LINE_CAP and parsed_sections:
                # Find largest section and drop its oldest entry
                largest = max(parsed_sections, key=lambda s: len(parsed_sections[s]))
                if not parsed_sections[largest]:
                    break
                oldest = parsed_sections[largest].pop(0)
                overflow_lines.append(f"## {largest}")
                overflow_lines.append(oldest)
                new_md = self._assemble_agents_md(parsed_sections)
                lines = new_md.split("\n")
                applied["agents_md_overflowed"] += 1
            if overflow_lines:
                self._write_knowledge(overflow_topic, "\n".join(overflow_lines), tags=["overflow"])

        self.agents_md.write_text(new_md)

        # Write topic files
        for update in result.get("knowledge_topic_updates", []):
            topic = update.get("topic", "").strip()
            content = update.get("content", "").strip()
            tags = update.get("tags", [])
            if not topic or not content:
                continue
            self._write_knowledge(topic, content, tags)
            applied["knowledge_topics_updated"] += 1

        return applied

    def _is_duplicate(self, new_entry: str, existing: List[str]) -> bool:
        """
        Duplicate detection:
          - substring containment (one is within the other after strip/normalize)
          - OR >60% Jaccard of significant words
        """
        def words(s):
            return set(re.findall(r"\w{3,}", s.lower()))

        def normalize(s):
            return re.sub(r"[^a-z0-9 ]", " ", s.lower()).split()

        new_words = words(new_entry)
        new_core = " ".join(normalize(new_entry))
        if not new_words:
            return False
        for e in existing:
            ew = words(e)
            if not ew:
                continue
            e_core = " ".join(normalize(e))
            # Substring containment catches "entry A" and "entry A plus detail"
            if new_core in e_core or e_core in new_core:
                return True
            # Jaccard on significant words
            overlap = len(new_words & ew) / max(len(new_words | ew), 1)
            if overlap >= 0.6:
                return True
        return False

    def _parse_agents_md(self, content: str) -> dict:
        """Parse AGENTS.md into {section_name: [entry_line, ...]}."""
        sections = {s: [] for s in SECTIONS}
        current = None
        for line in content.splitlines():
            m = re.match(r"^##\s+(.+?)\s*$", line)
            if m and m.group(1) in SECTIONS:
                current = m.group(1)
                continue
            if current and line.strip().startswith("-"):
                sections[current].append(line.rstrip())
        return sections

    def _assemble_agents_md(self, sections: dict) -> str:
        out = ["# AGENTS.md — Team Knowledge Base", ""]
        for s in SECTIONS:
            out.append(f"## {s}")
            if sections[s]:
                out.extend(sections[s])
            out.append("")
        return "\n".join(out).rstrip() + "\n"

    def _blank_agents_md(self) -> str:
        return self._assemble_agents_md({s: [] for s in SECTIONS})

    def _write_knowledge(self, topic: str, content: str, tags: List[str]):
        self.knowledge_dir.mkdir(exist_ok=True)
        # Normalize topic to kebab-case
        topic_safe = re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-")
        path = self.knowledge_dir / f"{topic_safe}.md"

        tags_fm = ""
        if not path.exists() and tags:
            tags_fm = f"---\ntags: [{', '.join(tags)}]\n---\n\n# {topic}\n\n"

        with open(path, "a") as f:
            if tags_fm:
                f.write(tags_fm)
            f.write(content.rstrip() + "\n\n")

    # ─── Public entry point ─────────────────────────────────────────────
    def run_for_phase(self, phase_num: str) -> dict:
        """Full run: invoke, parse, apply. Returns dict of counts."""
        prompt_path = self._build_prompt(phase_num)
        if prompt_path is None:
            self._log("scribe_no_phase_dir", phase=phase_num)
            return {"error": "phase dir not found"}

        result = self._invoke(prompt_path)
        if result is None:
            return {"error": "scribe invocation failed"}

        applied = self._apply(result)
        self._log("scribe_applied", phase=phase_num, **applied)
        return applied
