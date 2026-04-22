#!/usr/bin/env python3
"""Phase 13 data-correctness verifier. Reads live /api/* + parses source files. Emits VERIFY.md.

Wave 0 scaffolds it with ONE worked panel (cost ticker). Plan 13-03 (Wave 1.5) clones the
pattern ~12 more times per V2 §1 source-of-truth map.

Usage:
    cd scripts && python3 verify.py [--base-url http://localhost:3003]
Exit 0 = all panels verified, 1 = one or more mismatches, 2 = fatal (no auth).
"""
import argparse, json, pathlib, urllib.request, urllib.error, sys, datetime as dt
from typing import Callable, Any

# ---- paths ----
SCRIPTS = pathlib.Path(__file__).parent
# scripts/ → 13-ui-ux-review-polish-loop/ → phases/ → .planning/ → dashboard/ (repo root)
ROOT = SCRIPTS.parent.parent.parent.parent
AUDIT = SCRIPTS.parent / "audit"
AUDIT.mkdir(exist_ok=True)

# ---- args ----
ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--base-url", default="http://localhost:3003", help="Audit server base URL (default: :3003)")
ap.add_argument("--dry-run", action="store_true", help="Print panels that would run, exit without hitting /api/*")
args = ap.parse_args()
BASE = args.base_url

# ---- auth ----
STORAGE = SCRIPTS / "storage-state.json"
if not STORAGE.exists():
    print(f"[verify] FATAL: storage-state.json not found at {STORAGE}", file=sys.stderr)
    print(f"[verify] Run authsetup.sh first to produce it. See 13-01-SUMMARY.md.", file=sys.stderr)
    sys.exit(2)

storage = json.loads(STORAGE.read_text())
COOKIE_OBJ = next((c for c in storage["cookies"] if c["name"] == "authjs.session-token"), None)
if COOKIE_OBJ is None:
    print("[verify] FATAL: authjs.session-token not in storage-state.json — re-run authsetup.sh", file=sys.stderr)
    sys.exit(2)
COOKIE_HDR = f"authjs.session-token={COOKIE_OBJ['value']}"

# ---- helpers ----
def api(path: str) -> Any:
    """GET /api/* with auth cookie. Raises on non-200 or network error."""
    req = urllib.request.Request(f"{BASE}{path}", headers={"Cookie": COOKIE_HDR})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)

def tail_jsonl(relpath: str) -> list[dict]:
    """Read a .jsonl file from repo root. Returns empty list if missing."""
    p = ROOT / relpath
    if not p.exists():
        return []
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

def fmt_tokens(n: int) -> str:
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1000:
        return f"{n/1000:.1f}k"
    return str(n)

# ---- panel registry ----
# Wave 0 ships ONE worked panel (cost ticker). Plan 13-03 appends ~12 more rows
# per V2 §1 source-of-truth map. Shape per panel:
#   panel:       human label (shown in VERIFY.md)
#   api_path:    /api/* path to query
#   api_getter:  fn(json_response) -> comparable value
#   source_fn:   fn() -> comparable value (reads source-of-truth files)
#   formatter:   fn(value) -> str for comparison + display
#   tolerance:   0 = exact match; future: numeric delta for float panels
PANELS: list[dict] = []

# ---- Panel: Cost ticker (top nav) ----
def cost_ticker_source() -> dict:
    today = dt.date.today().isoformat()
    rows = tail_jsonl(".cae/metrics/circuit-breakers.jsonl")
    in_t  = sum(r.get("input_tokens",  0) for r in rows if str(r.get("ts", "")).startswith(today))
    out_t = sum(r.get("output_tokens", 0) for r in rows if str(r.get("ts", "")).startswith(today))
    return {"inputTokensToday": in_t, "outputTokensToday": out_t}

PANELS.append({
    "panel": "Cost ticker (top nav)",
    "api_path": "/api/state",
    "api_getter": lambda j: {
        "inputTokensToday":  j["breakers"]["inputTokensToday"],
        "outputTokensToday": j["breakers"]["outputTokensToday"],
    },
    "source_fn": cost_ticker_source,
    "formatter": lambda d: (
        f"in={d['inputTokensToday']} "
        f"out={d['outputTokensToday']} "
        f"fmt={fmt_tokens(d['inputTokensToday'] + d['outputTokensToday'])}"
    ),
    "tolerance": 0,
})

# Plan 13-03 adds panels here (agent roster, queue depth, changes count, heartbeat, etc.)

# ---- execute ----
if args.dry_run:
    print(f"[verify] --dry-run: {len(PANELS)} panel(s) would run against {BASE}")
    for p in PANELS:
        print(f"  - {p['panel']} → {p['api_path']}")
    sys.exit(0)

rows_out: list[str] = [
    "| Panel | API path | Source value | API value | Verdict |",
    "|---|---|---|---|---|",
]
mismatches = 0

for panel in PANELS:
    try:
        api_raw   = api(panel["api_path"])
        actual    = panel["api_getter"](api_raw)
        expected  = panel["source_fn"]()
        afmt      = panel["formatter"](actual)
        efmt      = panel["formatter"](expected)
        match     = afmt == efmt
        verdict   = "OK" if match else "MISMATCH"
        if not match:
            mismatches += 1
        rows_out.append(
            f"| {panel['panel']} | `{panel['api_path']}` | {efmt} | {afmt} | {'✅ ' + verdict if match else '❌ ' + verdict} |"
        )
    except urllib.error.HTTPError as e:
        rows_out.append(f"| {panel['panel']} | `{panel['api_path']}` | ERR | HTTP {e.code} | ❌ EXCEPTION |")
        mismatches += 1
    except Exception as e:
        rows_out.append(f"| {panel['panel']} | `{panel['api_path']}` | ERR | ERR | ❌ EXCEPTION: {str(e)[:80]} |")
        mismatches += 1

report = (
    "# Phase 13 — Data Correctness Verification\n\n"
    f"**Run:** {dt.datetime.now().isoformat(timespec='seconds')}  \n"
    f"**Server:** {BASE}  \n"
    f"**Panels checked:** {len(PANELS)}  \n"
    f"**Mismatches:** {mismatches}  \n\n"
    + "\n".join(rows_out)
    + "\n\n---\n"
    "_Panel 13-03 (Wave 1.5) will expand this table with ~12 additional panels._\n"
)

(AUDIT / "VERIFY.md").write_text(report)
print(f"[verify] panels={len(PANELS)} mismatches={mismatches} → {AUDIT / 'VERIFY.md'}")
sys.exit(0 if mismatches == 0 else 1)
