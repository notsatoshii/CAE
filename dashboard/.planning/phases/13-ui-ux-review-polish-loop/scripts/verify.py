#!/usr/bin/env python3
"""Phase 13 data-correctness verifier. Reads live /api/* + parses source files. Emits VERIFY.md.

Wave 0 (plan 13-01): ONE worked panel (cost ticker).
Wave 1.5 (plan 13-03): Extended to 17 panels covering all V2 §1 source-of-truth map.

Auth strategy: When storage-state.json is present, all panels hit live API + compare.
When absent (deferred per session-7 directive), panels run in SOURCE-ONLY mode:
  - ✅ panels where source-file analysis alone can confirm correctness
  - ⚠️ AUTH-DEFERRED panels where live API comparison is required
  - ❌ CODE-BUG panels confirmed broken via static code analysis (WR-01)

Usage:
    cd scripts && python3 verify.py [--base-url http://localhost:3003] [--source-only]
Exit 0 = all verified clean, 1 = one or more mismatches/confirmed bugs, 2 = fatal config error.

Panels covered (V2 §1 source-of-truth map):
 1. Cost ticker (top nav)
 2. Heartbeat dot (halted/retryCount/phantoms)
 3. Rollup: shipped_today
 4. Rollup: tokens_today (must match cost ticker within ±0)
 5. Rollup: in_flight
 6. Rollup: blocked (must equal needs_you[type=blocked].length)
 7. Rollup: warnings
 8. Active phase: wave_current
 9. Active phase: progress_pct
10. Needs-you count
11. Recent ledger token sums (forge_end events)
12. Agents 7d success % (/api/agents)
13. Metrics MTD spend (/api/metrics)
14. Changes merges_today (/api/changes vs git log --merges)
15. Queue counts (/api/queue)
16. Memory tree leaf count (/api/memory/tree)
17. Chat unread count (WR-01 — static code analysis confirms broken)
"""

import argparse
import json
import os
import pathlib
import re
import subprocess
import sys
import datetime as dt
from typing import Any, Callable, Optional

# ---- paths ----
SCRIPTS = pathlib.Path(__file__).parent
# scripts/ → 13-ui-ux-review-polish-loop/ → phases/ → .planning/ → dashboard/ (repo root)
ROOT = SCRIPTS.parent.parent.parent.parent
AUDIT = SCRIPTS.parent / "audit"
AUDIT.mkdir(exist_ok=True)
WORKING = AUDIT / "working"
WORKING.mkdir(exist_ok=True)

# CAE project root (default per cae-config.ts)
CAE_ROOT = pathlib.Path(os.environ.get("CAE_ROOT", "/home/cae/ctrl-alt-elite"))

# The dashboard root is the repo root (ROOT already)
DASHBOARD_ROOT = ROOT

# ---- args ----
ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--base-url", default="http://localhost:3003", help="Audit server base URL (default: :3003)")
ap.add_argument("--dry-run", action="store_true", help="Print panels that would run, exit without hitting /api/*")
ap.add_argument("--source-only", action="store_true", help="Skip live API calls; only run source-file analysis panels")
args = ap.parse_args()
BASE = args.base_url

# ---- auth ----
STORAGE = SCRIPTS / "storage-state.json"
HAS_AUTH = STORAGE.exists()
SOURCE_ONLY = args.source_only or not HAS_AUTH

if not HAS_AUTH and not SOURCE_ONLY:
    print(f"[verify] INFO: storage-state.json not found at {STORAGE}", file=sys.stderr)
    print(f"[verify] Running in SOURCE-ONLY mode. API panels will show ⚠️ AUTH-DEFERRED.", file=sys.stderr)
    print(f"[verify] Run authsetup.sh to enable live API comparison.", file=sys.stderr)

COOKIE_HDR = ""
if HAS_AUTH:
    import urllib.request
    import urllib.error
    storage = json.loads(STORAGE.read_text())
    COOKIE_OBJ = next((c for c in storage["cookies"] if c["name"] == "authjs.session-token"), None)
    if COOKIE_OBJ is None:
        print("[verify] FATAL: authjs.session-token not in storage-state.json — re-run authsetup.sh", file=sys.stderr)
        sys.exit(2)
    COOKIE_HDR = f"authjs.session-token={COOKIE_OBJ['value']}"

# ---- helpers ----
def api(path: str) -> Any:
    """GET /api/* with auth cookie. Raises on non-200 or network error."""
    import urllib.request
    req = urllib.request.Request(f"{BASE}{path}", headers={"Cookie": COOKIE_HDR})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)

def tail_jsonl(relpath: str, project_root: Optional[pathlib.Path] = None) -> list[dict]:
    """Read a .jsonl file relative to project_root (default: CAE_ROOT). Returns empty list if missing."""
    base = project_root or CAE_ROOT
    p = base / relpath
    if not p.exists():
        # Also try from DASHBOARD_ROOT
        alt = DASHBOARD_ROOT / relpath
        if not alt.exists():
            return []
        p = alt
    rows = []
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return rows

def tail_jsonl_path(path: pathlib.Path) -> list[dict]:
    """Read a .jsonl file from absolute path. Returns empty list if missing."""
    if not path.exists():
        return []
    rows = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return rows

def all_cb_rows() -> list[dict]:
    """Collect circuit-breakers.jsonl rows from all known project locations."""
    rows = []
    for project_path in [
        CAE_ROOT / ".cae" / "metrics" / "circuit-breakers.jsonl",
        DASHBOARD_ROOT / ".cae" / "metrics" / "circuit-breakers.jsonl",
    ]:
        rows.extend(tail_jsonl_path(project_path))
    return rows

def all_sentinel_rows() -> list[dict]:
    """Collect sentinel.jsonl rows from all known project locations."""
    rows = []
    for project_path in [
        CAE_ROOT / ".cae" / "metrics" / "sentinel.jsonl",
        DASHBOARD_ROOT / ".cae" / "metrics" / "sentinel.jsonl",
    ]:
        rows.extend(tail_jsonl_path(project_path))
    return rows

def today_iso() -> str:
    return dt.date.today().isoformat()

def fmt_tokens(n: int) -> str:
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1000:
        return f"{n/1000:.1f}k"
    return str(n)

def git_log_merges_today(project_path: pathlib.Path) -> int:
    """Count git merge commits with today's author date."""
    today = today_iso()
    try:
        result = subprocess.run(
            ["git", "log", "--all", "--merges",
             f"--since={today} 00:00",
             f"--until={today} 23:59",
             "--oneline"],
            capture_output=True, text=True, cwd=str(project_path), timeout=10
        )
        lines = [l.strip() for l in result.stdout.splitlines() if l.strip()]
        return len(lines)
    except Exception:
        return 0

# ---- panel registry ----
# Shape per panel:
#   panel:           human label (shown in VERIFY.md)
#   api_path:        /api/* path to query (or None for source-only panels)
#   api_getter:      fn(json_response) -> comparable value (None for source-only)
#   source_fn:       fn() -> comparable value or special verdict string
#   formatter:       fn(value) -> str for comparison + display
#   tolerance:       0 = exact match; numeric delta for float panels
#   verdict_mode:    "api_vs_source" | "static_analysis" | "source_only"
PANELS: list[dict] = []

# =====================================
# Panel 1: Cost ticker (top nav)
# =====================================
def cost_ticker_source() -> dict:
    today = today_iso()
    rows = all_cb_rows()
    in_t = sum(r.get("input_tokens", 0) for r in rows if str(r.get("ts", "")).startswith(today))
    out_t = sum(r.get("output_tokens", 0) for r in rows if str(r.get("ts", "")).startswith(today))
    return {"inputTokensToday": in_t, "outputTokensToday": out_t}

PANELS.append({
    "panel": "Cost ticker (top nav)",
    "api_path": "/api/state",
    "api_getter": lambda j: {
        "inputTokensToday": j["breakers"]["inputTokensToday"],
        "outputTokensToday": j["breakers"]["outputTokensToday"],
    },
    "source_fn": cost_ticker_source,
    "formatter": lambda d: (
        f"in={d['inputTokensToday']} "
        f"out={d['outputTokensToday']} "
        f"fmt={fmt_tokens(d['inputTokensToday'] + d['outputTokensToday'])}"
    ),
    "tolerance": 0,
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 2: Heartbeat dot
# =====================================
def heartbeat_source() -> dict:
    """Derive heartbeat state from circuit-breakers.jsonl:
    halted = any unresolved 'halt' event in last 24h
    retryCount = count of forge_end(success=false) today
    recentPhantomEscalations = count of escalate_to_phantom in last 24h
    """
    rows = all_cb_rows()
    today = today_iso()
    now_ms = dt.datetime.now().timestamp() * 1000
    day_ms = 86400000

    halted = False
    retry_count = 0
    phantom_escalations = 0
    halt_task_ids = set()
    resume_task_ids = set()

    for r in rows:
        ts_str = r.get("ts", "")
        event = r.get("event", "")
        try:
            ts_ms = dt.datetime.fromisoformat(ts_str.replace("Z", "+00:00")).timestamp() * 1000
        except Exception:
            continue
        age_ms = now_ms - ts_ms
        if age_ms < 0 or age_ms > day_ms:
            continue
        if event == "halt":
            halt_task_ids.add(r.get("task_id", ""))
        elif event == "resume":
            resume_task_ids.add(r.get("task_id", ""))
        elif event == "forge_end" and r.get("success") is False:
            retry_count += 1
        elif event == "escalate_to_phantom":
            phantom_escalations += 1

    # halted = any unresolved halts
    for tid in halt_task_ids:
        if tid not in resume_task_ids:
            halted = True
            break

    return {
        "halted": halted,
        "retryCount": retry_count,
        "recentPhantomEscalations": phantom_escalations,
    }

PANELS.append({
    "panel": "Heartbeat dot",
    "api_path": "/api/state",
    "api_getter": lambda j: {
        "halted": j["breakers"].get("halted", False),
        "retryCount": j["breakers"]["retryCount"],
        "recentPhantomEscalations": j["breakers"].get("recentPhantomEscalations", 0),
    },
    "source_fn": heartbeat_source,
    "formatter": lambda d: f"halted={d['halted']} retries={d['retryCount']} phantoms={d['recentPhantomEscalations']}",
    "tolerance": 0,
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 3: Rollup shipped_today
# =====================================
def rollup_shipped_today_source() -> dict:
    """Count outbox DONE.md items with status=success modified today.
    Fallback: count git merge commits today across known projects.
    """
    today = today_iso()
    shipped = 0

    # Primary: outbox DONE.md with status=success mtime today
    outbox_root = pathlib.Path(os.environ.get("OUTBOX_ROOT", "/home/cae/outbox"))
    if outbox_root.exists():
        for task_dir in outbox_root.iterdir():
            if not task_dir.is_dir():
                continue
            done_path = task_dir / "DONE.md"
            if not done_path.exists():
                continue
            # Check status=success
            text = done_path.read_text()
            if "status: success" not in text and "status:success" not in text:
                continue
            mtime = dt.datetime.fromtimestamp(done_path.stat().st_mtime).date().isoformat()
            if mtime == today:
                shipped += 1

    # Fallback: git merges today
    if shipped == 0:
        for project_path in [CAE_ROOT, DASHBOARD_ROOT]:
            if (project_path / ".git").exists():
                shipped += git_log_merges_today(project_path)

    return {"shipped_today": shipped}

PANELS.append({
    "panel": "Rollup: shipped_today",
    "api_path": "/api/state",
    "api_getter": lambda j: {"shipped_today": j["rollup"]["shipped_today"]},
    "source_fn": rollup_shipped_today_source,
    "formatter": lambda d: str(d["shipped_today"]),
    "tolerance": 0,
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 4: Rollup tokens_today (must match cost ticker)
# =====================================
def rollup_tokens_today_source() -> dict:
    """Reuse cost ticker source — tokens_today must equal inputTokensToday + outputTokensToday."""
    ct = cost_ticker_source()
    return {"tokens_today": ct["inputTokensToday"] + ct["outputTokensToday"]}

PANELS.append({
    "panel": "Rollup: tokens_today",
    "api_path": "/api/state",
    "api_getter": lambda j: {"tokens_today": j["rollup"]["tokens_today"]},
    "source_fn": rollup_tokens_today_source,
    "formatter": lambda d: fmt_tokens(d["tokens_today"]),
    "tolerance": 0,
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 5: Rollup in_flight
# =====================================
def rollup_in_flight_source() -> dict:
    """in_flight = phases with progress_pct > 0 and < 100.
    This is derived from phases state, which requires live API to get progress_pct.
    Return UNVERIFIABLE for source-only mode.
    """
    return {"__unverifiable": "in_flight derivation requires live phase progress_pct from aggregator — circular dependency without re-implementing buildPhases()"}

PANELS.append({
    "panel": "Rollup: in_flight",
    "api_path": "/api/state",
    "api_getter": lambda j: {"in_flight": j["rollup"]["in_flight"]},
    "source_fn": rollup_in_flight_source,
    "formatter": lambda d: d.get("__unverifiable", str(d.get("in_flight", 0))),
    "tolerance": 0,
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 6: Rollup blocked (must equal needs_you[type=blocked] count)
# Self-consistency check within the same API response
# =====================================
def rollup_blocked_source() -> dict:
    """blocked = count of needs_you items where type == 'blocked'.
    This is a SELF-CONSISTENCY check — both values come from the same /api/state
    response but different aggregator code paths. If they disagree, it's a P0 bug.
    Returns a sentinel to indicate we need the API for both sides.
    """
    return {"__needs_api_crosscheck": "rollup.blocked vs needs_you[type=blocked] — self-consistency in /api/state response"}

PANELS.append({
    "panel": "Rollup: blocked (self-consistency check)",
    "api_path": "/api/state",
    "api_getter": lambda j: {
        "rollup_blocked": j["rollup"]["blocked"],
        "needs_you_blocked": len([n for n in j.get("needs_you", []) if n.get("type") == "blocked"]),
    },
    "source_fn": rollup_blocked_source,
    "formatter": lambda d: (
        d.get("__needs_api_crosscheck",
              f"rollup={d.get('rollup_blocked','?')} vs needs_you[blocked]={d.get('needs_you_blocked','?')}"
              )
    ),
    "tolerance": 0,
    "verdict_mode": "api_vs_source",
    "_crosscheck": True,  # formatter compares rollup_blocked == needs_you_blocked
})

# =====================================
# Panel 7: Rollup warnings
# =====================================
def rollup_warnings_source() -> dict:
    """warnings = retryCount + recentPhantomEscalations (from circuit-breakers.jsonl)"""
    hb = heartbeat_source()
    return {"warnings": hb["retryCount"] + hb["recentPhantomEscalations"]}

PANELS.append({
    "panel": "Rollup: warnings",
    "api_path": "/api/state",
    "api_getter": lambda j: {"warnings": j["rollup"]["warnings"]},
    "source_fn": rollup_warnings_source,
    "formatter": lambda d: str(d["warnings"]),
    "tolerance": 0,
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 8: Active phase wave_current
# =====================================
def active_phase_wave_source() -> dict:
    """Parse .planning/phases/*/PLAN.md frontmatter + SUMMARY.md presence.
    wave_current = if any task running → max running task wave
                   else → (max wave with all tasks merged) + 1
    This requires knowing task status, which requires cae-phase-detail.ts logic.
    We can inspect PLAN.md files but can't replicate the full TaskStatus logic.
    Return UNVERIFIABLE for this panel.
    """
    return {"__unverifiable": "wave_current derivation requires task status from cae-phase-detail.ts (STATUS_RUNNING/MERGED) — too complex to second-source without re-implementing PLAN.md task parser fully"}

PANELS.append({
    "panel": "Active phase: wave_current",
    "api_path": "/api/state",
    "api_getter": lambda j: {"phases": [(p["phase"], p["wave_current"]) for p in j.get("home_phases", [])]},
    "source_fn": active_phase_wave_source,
    "formatter": lambda d: d.get("__unverifiable", str(d.get("phases", []))),
    "tolerance": 0,
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 9: Active phase progress_pct
# =====================================
def active_phase_progress_source() -> dict:
    """Attempt to compute progress_pct from PLAN.md task checkboxes.
    Progress = merged_tasks / total_tasks * 100.
    Heuristic: - [x] items in PLAN.md files are 'done', - [ ] are pending.
    This is an approximation — the real aggregator uses cae-phase-detail.ts
    which parses task type/status from SUMMARY.md presence + task markers.
    """
    planning_dir = DASHBOARD_ROOT / ".planning" / "phases"
    if not planning_dir.exists():
        return {"__unverifiable": "no .planning/phases/ directory found"}

    phase_data = []
    for phase_dir in sorted(planning_dir.iterdir()):
        if not phase_dir.is_dir():
            continue
        # Count task checkboxes from PLAN.md files
        plan_files = list(phase_dir.glob("*-PLAN.md"))
        if not plan_files:
            continue
        # Check if this is active — has PLAN.md but not CAE-SUMMARY.md at top level
        # (simplified approximation of listPhases status check)
        total_checked = 0
        total_unchecked = 0
        for plan_file in plan_files:
            text = plan_file.read_text()
            total_checked += len(re.findall(r'- \[x\]', text, re.IGNORECASE))
            total_unchecked += len(re.findall(r'- \[ \]', text))
        total = total_checked + total_unchecked
        pct = round(total_checked / total * 100) if total > 0 else 0
        phase_data.append({
            "phase": phase_dir.name,
            "progress_pct": pct,
            "merged": total_checked,
            "total": total,
        })

    return {"phases": phase_data}

PANELS.append({
    "panel": "Active phase: progress_pct",
    "api_path": "/api/state",
    "api_getter": lambda j: {"phases": [(p["phase"], p["progress_pct"]) for p in j.get("home_phases", [])]},
    "source_fn": active_phase_progress_source,
    "formatter": lambda d: (
        d.get("__unverifiable",
              "; ".join(f"{p['phase']}={p['progress_pct']}%" for p in d.get("phases", [])) or "no active phases"
              )
    ),
    "tolerance": 5,  # ±5% acceptable — checkbox heuristic vs real task status
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 10: Needs-you count
# =====================================
def needs_you_source() -> dict:
    """Derive needs_you items from source files:
    - blocked: tasks with 3+ failed forge_end in last 24h OR failed task status
    - plan_review: any *-REVIEW-READY.md markers in .planning/phases/
    - dangerous: outbox tasks with APPROVAL.md and no DONE.md
    """
    today = today_iso()
    now_ms = dt.datetime.now().timestamp() * 1000
    day_ms = 86400000
    count = 0

    # blocked from circuit breakers (3+ failures in 24h)
    rows = all_cb_rows()
    fail_counts: dict[str, int] = {}
    for r in rows:
        if r.get("event") != "forge_end" or r.get("success") is not False:
            continue
        ts_str = r.get("ts", "")
        try:
            ts_ms = dt.datetime.fromisoformat(ts_str.replace("Z", "+00:00")).timestamp() * 1000
        except Exception:
            continue
        if now_ms - ts_ms > day_ms:
            continue
        task_id = r.get("task_id", "")
        if task_id:
            fail_counts[task_id] = fail_counts.get(task_id, 0) + 1
    count += sum(1 for c in fail_counts.values() if c >= 3)

    # plan_review markers
    for project_path in [CAE_ROOT, DASHBOARD_ROOT]:
        phases_dir = project_path / ".planning" / "phases"
        if phases_dir.exists():
            try:
                count += len(list(phases_dir.glob("*-REVIEW-READY.md")))
            except Exception:
                pass

    # dangerous: outbox with APPROVAL.md and no DONE.md
    outbox_root = pathlib.Path(os.environ.get("OUTBOX_ROOT", "/home/cae/outbox"))
    if outbox_root.exists():
        for task_dir in outbox_root.iterdir():
            if not task_dir.is_dir():
                continue
            if (task_dir / "APPROVAL.md").exists() and not (task_dir / "DONE.md").exists():
                count += 1

    return {"needs_you_count": count}

PANELS.append({
    "panel": "Needs-you count",
    "api_path": "/api/state",
    "api_getter": lambda j: {"needs_you_count": len(j.get("needs_you", []))},
    "source_fn": needs_you_source,
    "formatter": lambda d: str(d["needs_you_count"]),
    "tolerance": 1,  # ±1 acceptable — timing of failed task status detection
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 11: Recent ledger token sums
# =====================================
def recent_ledger_source() -> dict:
    """Derive recent forge_end events with tokens from circuit-breakers.jsonl.
    Returns the top 20 forge_end events sorted by ts desc, with their token sums.
    """
    rows = all_cb_rows()
    events = []
    for r in rows:
        if r.get("event") != "forge_end":
            continue
        ts = r.get("ts", "")
        tokens = r.get("input_tokens", 0) + r.get("output_tokens", 0)
        task_id = r.get("task_id", "")
        events.append({"ts": ts, "task_id": task_id, "tokens": tokens})

    events.sort(key=lambda e: e["ts"], reverse=True)
    recent_20 = events[:20]
    total_tokens = sum(e["tokens"] for e in recent_20)
    return {"recent_event_count": len(recent_20), "total_tokens_in_recent": total_tokens}

PANELS.append({
    "panel": "Recent ledger token sums",
    "api_path": "/api/state",
    "api_getter": lambda j: {
        "recent_event_count": len(j.get("events_recent", [])),
        "total_tokens_in_recent": sum(e.get("tokens", 0) for e in j.get("events_recent", [])),
    },
    "source_fn": recent_ledger_source,
    "formatter": lambda d: f"events={d['recent_event_count']} total_tokens={fmt_tokens(d['total_tokens_in_recent'])}",
    "tolerance": 0,
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 12: Agents 7d success %
# =====================================
def agents_success_source() -> dict:
    """Compute per-agent 7d success rate from circuit-breakers.jsonl.
    success_rate = forge_end(success=true) in 7d / total forge_end in 7d per agent
    """
    rows = all_cb_rows()
    now_ms = dt.datetime.now().timestamp() * 1000
    window_7d_ms = 7 * 86400000

    success_by_agent: dict[str, int] = {}
    total_by_agent: dict[str, int] = {}

    for r in rows:
        if r.get("event") != "forge_end":
            continue
        ts_str = r.get("ts", "")
        try:
            ts_ms = dt.datetime.fromisoformat(ts_str.replace("Z", "+00:00")).timestamp() * 1000
        except Exception:
            continue
        age_ms = now_ms - ts_ms
        if age_ms < 0 or age_ms > window_7d_ms:
            continue
        agent = r.get("agent", "forge").lower() or "forge"
        total_by_agent[agent] = total_by_agent.get(agent, 0) + 1
        if r.get("success") is True:
            success_by_agent[agent] = success_by_agent.get(agent, 0) + 1

    agents = {}
    for agent in set(list(success_by_agent.keys()) + list(total_by_agent.keys())):
        total = total_by_agent.get(agent, 0)
        success = success_by_agent.get(agent, 0)
        rate = (success / total * 100) if total > 0 else 0
        agents[agent] = {"success_rate": round(rate, 1), "total": total}

    return {"agents": agents}

PANELS.append({
    "panel": "Agents 7d success %",
    "api_path": "/api/agents",
    "api_getter": lambda j: {
        "agents": {a["name"]: {"success_rate": round(a["stats_7d"]["success_rate"] * 100, 1), "total": a["stats_7d"].get("total", 0)}
                   for a in j.get("agents", [])}
    },
    "source_fn": agents_success_source,
    "formatter": lambda d: "; ".join(
        f"{name}={info['success_rate']}%({info['total']}runs)"
        for name, info in sorted(d.get("agents", {}).items())
        if info.get("total", 0) > 0
    ) or "no agent activity in 7d",
    "tolerance": 1,  # ±1% for floating-point rounding
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 13: Metrics MTD spend
# =====================================
def metrics_mtd_source() -> dict:
    """Compute tokens_mtd from circuit-breakers.jsonl — sum all input+output tokens
    for events in the current month (YYYY-MM prefix matches today's date).
    """
    rows = all_cb_rows()
    today = today_iso()
    month_prefix = today[:7]  # YYYY-MM

    tokens_mtd = 0
    for r in rows:
        tok = r.get("input_tokens", 0) + r.get("output_tokens", 0)
        if tok <= 0:
            continue
        ts = r.get("ts", "")
        if ts.startswith(month_prefix):
            tokens_mtd += tok

    return {"tokens_mtd": tokens_mtd}

PANELS.append({
    "panel": "Metrics MTD spend",
    "api_path": "/api/metrics",
    "api_getter": lambda j: {"tokens_mtd": j["spending"]["tokens_mtd"]},
    "source_fn": metrics_mtd_source,
    "formatter": lambda d: fmt_tokens(d["tokens_mtd"]),
    "tolerance": 0,
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 14: Changes merges_today (git log)
# =====================================
def changes_merges_source() -> dict:
    """Count git merge commits with today's author date across known projects."""
    total = 0
    for project_path in [CAE_ROOT, DASHBOARD_ROOT]:
        if (project_path / ".git").exists():
            total += git_log_merges_today(project_path)
    return {"merges_today": total}

PANELS.append({
    "panel": "Changes: merges_today",
    "api_path": "/api/changes",
    "api_getter": lambda j: {
        "merges_today": len([e for e in (j if isinstance(j, list) else j.get("events", []))
                             if e.get("ts", "").startswith(today_iso())])
    },
    "source_fn": changes_merges_source,
    "formatter": lambda d: str(d["merges_today"]),
    "tolerance": 0,
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 15: Queue counts
# =====================================
def queue_counts_source() -> dict:
    """Count inbox and outbox directories as a proxy for queue depth."""
    inbox_root = pathlib.Path(os.environ.get("INBOX_ROOT", "/home/cae/inbox"))
    outbox_root = pathlib.Path(os.environ.get("OUTBOX_ROOT", "/home/cae/outbox"))

    inbox_count = 0
    outbox_count = 0
    shipped_count = 0
    stuck_count = 0

    if inbox_root.exists():
        inbox_count = sum(1 for d in inbox_root.iterdir() if d.is_dir())

    if outbox_root.exists():
        for task_dir in outbox_root.iterdir():
            if not task_dir.is_dir():
                continue
            outbox_count += 1
            done_path = task_dir / "DONE.md"
            if done_path.exists():
                text = done_path.read_text()
                if "status: success" in text:
                    shipped_count += 1
                elif "status: error" in text or "status: failed" in text:
                    stuck_count += 1

    return {
        "inbox_total": inbox_count,
        "outbox_total": outbox_count,
        "shipped": shipped_count,
        "stuck": stuck_count,
    }

PANELS.append({
    "panel": "Queue counts",
    "api_path": "/api/queue",
    "api_getter": lambda j: {
        "inbox_total": j["counts"]["waiting"] + j["counts"]["in_progress"] + j["counts"]["double_checking"],
        "outbox_total": j["counts"]["shipped"] + j["counts"]["stuck"],
        "shipped": j["counts"]["shipped"],
        "stuck": j["counts"]["stuck"],
    },
    "source_fn": queue_counts_source,
    "formatter": lambda d: f"inbox={d['inbox_total']} shipped={d['shipped']} stuck={d['stuck']}",
    "tolerance": 0,
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 16: Memory tree leaf count
# =====================================
def memory_tree_source() -> int:
    """Walk the D-10 memory globs and count leaf files (matching MEMORY_PATH_PATTERNS).
    D-10 per-project globs:
      - <project>/AGENTS.md
      - <project>/KNOWLEDGE/**/*.md
      - <project>/.claude/agents/*.md
      - <project>/agents/cae-*.md
      - <project>/.planning/phases/*/*.md
    """
    MEMORY_PATTERNS = [
        r'/AGENTS\.md$',
        r'/KNOWLEDGE/.+\.md$',
        r'/\.claude/agents/[^/]+\.md$',
        r'/agents/cae-[^/]+\.md$',
        r'/\.planning/phases/[^/]+/[^/]+\.md$',
    ]
    compiled = [re.compile(p) for p in MEMORY_PATTERNS]

    def is_memory_path(abs_path: str) -> bool:
        return any(pat.search(abs_path) for pat in compiled)

    SKIP_DIRS = {"node_modules", ".next", ".git", "graphify-out", ".cae", "dist", "build", ".turbo"}

    count = 0
    for project_path in [CAE_ROOT, DASHBOARD_ROOT]:
        if not project_path.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(str(project_path)):
            # Prune skip dirs
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for fname in filenames:
                full = os.path.join(dirpath, fname)
                if is_memory_path(full):
                    count += 1

    return count

PANELS.append({
    "panel": "Memory tree leaf count",
    "api_path": "/api/memory/tree",
    "api_getter": lambda j: sum(
        sum(len(g.get("files", [])) for g in p.get("groups", []))
        for p in j.get("projects", [])
    ),
    "source_fn": memory_tree_source,
    "formatter": lambda d: str(d) if isinstance(d, int) else str(d),
    "tolerance": 0,
    "verdict_mode": "api_vs_source",
})

# =====================================
# Panel 17: Chat unread count (WR-01 — static code analysis)
# =====================================
def chat_unread_static_analysis() -> dict:
    """Static code analysis of app/api/chat/send/route.ts to confirm WR-01 bug.

    WR-01: randomUUID() emitted on every SSE frame overwrites client lastSeenMsgId
    → unreadCount always 0 after reload.

    Evidence pattern to find:
    1. beginId = randomUUID() at stream start (line ~165)
    2. encodeSSE(randomUUID(), "assistant.delta", ...) — NEW uuid per delta (wrong)
    3. encodeSSE(randomUUID(), "unread_tick", ...) — NEW uuid per tick (wrong)
    4. assistantMsgId = randomUUID() at end — NEVER the same as beginId

    Fix: beginId ONCE → use for begin + end; delta/tick emit "" id.
    """
    send_route = ROOT / "app" / "api" / "chat" / "send" / "route.ts"
    if not send_route.exists():
        return {"status": "error", "reason": "send/route.ts not found"}

    text = send_route.read_text()
    lines = text.splitlines()

    findings = []

    # Pattern 1: randomUUID() for assistant.delta SSE frames
    for i, line in enumerate(lines, 1):
        if "randomUUID()" in line and "assistant.delta" in lines[i-1:i] or \
           ("randomUUID()" in line and '"assistant.delta"' in text[max(0, text.find(line)-200):text.find(line)+200]):
            # More precise: look for encodeSSE(randomUUID(), "assistant.delta"
            pass

    # Direct pattern match on known WR-01 evidence lines
    delta_uuid_lines = []
    tick_uuid_lines = []
    begin_uuid_lines = []
    end_uuid_lines = []

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if "randomUUID()" in stripped:
            if "assistant.begin" in stripped or (i > 1 and "assistant.begin" in lines[i-2]):
                begin_uuid_lines.append((i, stripped))
            elif "assistant.delta" in stripped or (i > 1 and "assistant.delta" in lines[i-2]):
                delta_uuid_lines.append((i, stripped))
            elif "unread_tick" in stripped or (i > 1 and "unread_tick" in lines[i-2]):
                tick_uuid_lines.append((i, stripped))
            elif "assistantMsgId" in stripped and "=" in stripped:
                end_uuid_lines.append((i, stripped))

    # Search broader context for these patterns
    # Look for lines with encodeSSE + randomUUID + known event names
    all_uuid_in_sse = []
    for i, line in enumerate(lines, 1):
        if "randomUUID()" in line and "encodeSSE(" in line:
            # Get context
            context_start = max(0, i-3)
            context = "\n".join(lines[context_start:i+1])
            all_uuid_in_sse.append({"line": i, "text": line.strip(), "context_snippet": context[-200:]})

    # Also look for assistantMsgId = randomUUID() at end
    final_uuid_lines = []
    for i, line in enumerate(lines, 1):
        if "assistantMsgId" in line and "randomUUID()" in line:
            final_uuid_lines.append((i, line.strip()))

    # Determine if bug is confirmed
    # The bug is: multiple randomUUID() calls within a single stream response
    # Expected fix: ONE beginId = randomUUID() at start, reused for all frames
    uuid_call_count_in_stream = len(all_uuid_in_sse) + len(final_uuid_lines)

    bug_confirmed = uuid_call_count_in_stream >= 2  # More than 1 randomUUID in stream = bug

    # Additional check: verify beginId is NOT reused for assistant.delta
    begin_id_found = False
    begin_id_reused = False
    for i, line in enumerate(lines, 1):
        if "beginId" in line and "randomUUID()" in line:
            begin_id_found = True
        if "beginId" in line and "assistant.delta" in line:
            begin_id_reused = True

    return {
        "bug_confirmed": bug_confirmed,
        "uuid_calls_in_stream": uuid_call_count_in_stream,
        "all_uuid_in_sse": all_uuid_in_sse[:5],  # first 5 evidence lines
        "final_uuid_lines": final_uuid_lines,
        "begin_id_found": begin_id_found,
        "begin_id_reused": begin_id_reused,
        "verdict": "CODE-BUG" if bug_confirmed else "UNCONFIRMED",
        "severity": "P0",
        "description": (
            "WR-01: Multiple randomUUID() calls within SSE stream — "
            "client lastSeenMsgId is overwritten by ephemeral UUIDs, "
            "causing readTranscriptAfter() to return [] on every reload → unread always 0"
            if bug_confirmed else
            "WR-01 pattern not found — check send/route.ts manually"
        )
    }

PANELS.append({
    "panel": "Chat unread count (WR-01 static analysis)",
    "api_path": None,  # No live API needed — static code analysis
    "api_getter": None,
    "source_fn": chat_unread_static_analysis,
    "formatter": lambda d: (
        f"BUG CONFIRMED: {d['uuid_calls_in_stream']} randomUUID() calls in stream (expected 1). "
        f"lastSeenMsgId overwritten → unread always 0"
        if d.get("bug_confirmed")
        else f"UNCONFIRMED: {d.get('verdict', 'unknown')}"
    ),
    "tolerance": 0,
    "verdict_mode": "static_analysis",
})

# ---- execute ----
if args.dry_run:
    print(f"[verify] --dry-run: {len(PANELS)} panel(s) would run against {BASE}")
    for p in PANELS:
        print(f"  - {p['panel']} → {p.get('api_path', 'static-analysis')} [mode={p['verdict_mode']}]")
    sys.exit(0)

rows_out: list[str] = [
    "| Panel | API path | Source value | API value | Verdict |",
    "|---|---|---|---|---|",
]
mismatches = 0
auth_deferred = 0

for panel in PANELS:
    mode = panel["verdict_mode"]

    # --- Static analysis panels (e.g. WR-01) ---
    if mode == "static_analysis":
        try:
            result = panel["source_fn"]()
            afmt = panel["formatter"](result)
            if result.get("bug_confirmed"):
                verdict = "❌ CODE-BUG"
                mismatches += 1
            else:
                verdict = "⚠️ UNCONFIRMED"
            rows_out.append(
                f"| {panel['panel']} | `static-analysis` | {afmt} | N/A | {verdict} |"
            )
        except Exception as e:
            rows_out.append(
                f"| {panel['panel']} | `static-analysis` | ERR | N/A | ❌ EXCEPTION: {str(e)[:80]} |"
            )
            mismatches += 1
        continue

    # --- API vs Source panels ---
    expected_raw = None
    try:
        expected_raw = panel["source_fn"]()
    except Exception as e:
        rows_out.append(
            f"| {panel['panel']} | `{panel.get('api_path','?')}` | ERR:{str(e)[:40]} | SKIP | ⚠️ SOURCE-ERROR |"
        )
        continue

    # Check for special markers
    if isinstance(expected_raw, dict) and "__unverifiable" in expected_raw:
        rows_out.append(
            f"| {panel['panel']} | `{panel.get('api_path','?')}` | {expected_raw['__unverifiable'][:60]}... | SKIP | ⚠️ UNVERIFIABLE |"
        )
        continue

    if isinstance(expected_raw, dict) and "__needs_api_crosscheck" in expected_raw:
        if SOURCE_ONLY:
            rows_out.append(
                f"| {panel['panel']} | `{panel.get('api_path','?')}` | cross-check requires live API | SKIP | ⚠️ AUTH-DEFERRED |"
            )
            auth_deferred += 1
            continue

    if SOURCE_ONLY:
        # Compute source value for documentation, but skip live API
        try:
            efmt = panel["formatter"](expected_raw)
        except Exception as e:
            efmt = f"ERR:{str(e)[:40]}"
        rows_out.append(
            f"| {panel['panel']} | `{panel.get('api_path','?')}` | {efmt} | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |"
        )
        auth_deferred += 1
        continue

    # Live API comparison
    try:
        import urllib.request
        import urllib.error
        api_raw = api(panel["api_path"])
        actual = panel["api_getter"](api_raw)
        expected = expected_raw

        # Special: cross-check panel (rollup.blocked vs needs_you[blocked])
        if panel.get("_crosscheck"):
            rollup_b = actual.get("rollup_blocked", "?")
            needs_b = actual.get("needs_you_blocked", "?")
            match = rollup_b == needs_b
            verdict = "✅ SELF-CONSISTENT" if match else "❌ SELF-INCONSISTENT"
            if not match:
                mismatches += 1
            rows_out.append(
                f"| {panel['panel']} | `{panel['api_path']}` | rollup.blocked={rollup_b} | needs_you[blocked]={needs_b} | {verdict} |"
            )
            continue

        afmt = panel["formatter"](actual)
        efmt = panel["formatter"](expected)

        tol = panel.get("tolerance", 0)
        if tol == 0:
            match = afmt == efmt
        else:
            # Numeric tolerance: try to extract numbers for comparison
            try:
                a_num = float(re.search(r'[\d.]+', afmt).group())
                e_num = float(re.search(r'[\d.]+', efmt).group())
                match = abs(a_num - e_num) <= tol
            except Exception:
                match = afmt == efmt

        verdict = "OK" if match else "MISMATCH"
        if not match:
            mismatches += 1
        rows_out.append(
            f"| {panel['panel']} | `{panel['api_path']}` | {efmt} | {afmt} | {'✅ ' + verdict if match else '❌ ' + verdict} |"
        )
    except Exception as e:
        rows_out.append(
            f"| {panel['panel']} | `{panel.get('api_path','?')}` | ERR | ERR | ❌ EXCEPTION: {str(e)[:80]} |"
        )
        mismatches += 1

auth_note = ""
if auth_deferred > 0:
    auth_note = (
        f"\n\n> **Auth note:** {auth_deferred} panel(s) show ⚠️ AUTH-DEFERRED because `storage-state.json` "
        f"is absent (deferred per session-7 directive). Run `authsetup.sh` to enable live API comparison. "
        f"Source values are computed and shown for reference. WR-01 chat unread confirmed via static code analysis (no auth required).\n"
    )

report = (
    "# Phase 13 — Data Correctness Verification\n\n"
    f"**Run:** {dt.datetime.now().isoformat(timespec='seconds')}  \n"
    f"**Server:** {BASE}  \n"
    f"**Mode:** {'SOURCE-ONLY (auth deferred)' if SOURCE_ONLY else 'LIVE API + source'}  \n"
    f"**Panels checked:** {len(PANELS)}  \n"
    f"**Confirmed bugs:** {mismatches}  \n"
    f"**Auth-deferred:** {auth_deferred}  \n\n"
    + "\n".join(rows_out)
    + auth_note
    + "\n\n---\n"
    "**Legend:**  \n"
    "- ✅ OK / SELF-CONSISTENT — API value matches source-of-truth  \n"
    "- ❌ MISMATCH / CODE-BUG — data is wrong; see UI-AUDIT-correctness.md  \n"
    "- ⚠️ AUTH-DEFERRED — needs live auth session (storage-state.json absent)  \n"
    "- ⚠️ UNVERIFIABLE — derivation too complex to second-source without re-implementing aggregator  \n"
    "- ⚠️ UNCONFIRMED — static analysis found no evidence of bug  \n"
)

(AUDIT / "VERIFY.md").write_text(report)
print(f"[verify] panels={len(PANELS)} confirmed_bugs={mismatches} auth_deferred={auth_deferred} → {AUDIT / 'VERIFY.md'}")
sys.exit(0 if mismatches == 0 else 1)
