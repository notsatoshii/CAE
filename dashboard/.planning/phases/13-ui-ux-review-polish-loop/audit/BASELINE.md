# Phase 13 Wave 1 — Baseline Capture Report

## Coverage

**Status: PARTIAL — auth routes skipped (no storage-state.json)**

| Metric | Count |
|--------|-------|
| Total screenshots captured | 8 |
| Auth routes captured | 0 |
| Public routes captured | 8 (root + signin x 4 viewport/mode combos) |
| Auth routes skipped | 60 |
| Capture failures | 0 |
| MANIFEST.tsv rows | 8 |

### By Mode

| Mode | Shots | Viewports |
|------|-------|-----------|
| founder | 6 | mobile, laptop, wide |
| dev | 2 | laptop |

### By Viewport

| Viewport | Shots |
|----------|-------|
| mobile | 2 |
| laptop | 4 |
| wide | 2 |

### Captured Slugs (public routes only)

- `root` × [mobile-founder, laptop-founder, wide-founder, laptop-dev]
- `signin` × [mobile-founder, laptop-founder, wide-founder, laptop-dev]

### Auth-Gated Slugs (skipped — require storage-state.json)

**Routes (14 slugs × 4 viewport/mode combos = 56 shots missing):**
- build-home, build-agents, build-changes, build-queue
- build-workflows, build-workflows-new
- memory-browse, memory-graph
- metrics, plan, chat
- build-phase-1, build-phase-8, build-phase-404

**Drawer states (4 slugs × laptop-founder = 4 shots missing):**
- build-task-sheet, agent-drawer-forge, agent-drawer-scribe, memory-browse-tab

**Total expected at full auth coverage: 69 shots**
**Total captured this run: 8 shots (public only)**
**Gap: 61 shots pending authsetup.sh run**

## Disk

| Item | Size |
|------|------|
| 8 PNGs total | 142,550 bytes (~139 KB) |
| Average PNG | ~17.8 KB |
| Extrapolated at full 69 shots | ~1.23 MB |
| Headroom available | 129 GB |

No disk pressure. Both before and after passes will fit comfortably.

## Console baseline

**Scope: public routes only (auth routes skipped)**

| Slug | Console Errors | Console Warns | Page Errors | First Error Sample |
|------|---------------|---------------|-------------|-------------------|
| root | 0 | 0 | 0 | — |
| signin | 0 | 0 | 0 | — |

**Top 5 noisiest routes:** N/A — only public routes captured; both are clean (0 errors).

Once auth routes are captured (post-authsetup.sh), plan 13-06 (logging audit) should target any route with console_error_count > 1 and resolve each to ≤1 expected error/route.

**Baseline file:** `audit/working/console-baseline.tsv` (gitignored working output)

## Environment

| Component | Version |
|-----------|---------|
| Node.js | v22.22.0 |
| Next.js | ^16.2.4 |
| Playwright Python | 1.58.0 |
| Audit port | :3003 |
| Dev port (:3002) | UP — unaffected throughout |
| Auth state | storage-state.json ABSENT (deferred) |
| Capture script | scripts/capture.sh |

## Auth Gap — Resolution Path

The 61 missing screenshots require running `authsetup.sh` once to capture a GitHub OAuth session cookie. This is a **one-time headed browser** step requiring X display or a manual browser session.

**To unblock full baseline:**
```bash
cd /home/cae/ctrl-alt-elite/dashboard/.planning/phases/13-ui-ux-review-polish-loop/scripts
bash authsetup.sh   # headed Chromium → GitHub OAuth → writes storage-state.json
bash capture.sh before  # re-run full matrix; existing 8 shots overwritten; 69 total produced
```

After re-running capture.sh, re-generate this BASELINE.md from the updated MANIFEST.tsv.

Wave 7 delta pairing (`shots/before/` vs `shots/after/`) will work correctly once the baseline is complete — the MANIFEST.tsv schema is stable.

## Next Steps

**Plan 13-03:** data-correctness audit — `verify.py --full` across all verified panels.
- Requires storage-state.json (same blocker)
- PANELS registry has 1 worked panel (cost ticker from /api/state vs circuit-breakers.jsonl)
- Once unblocked, verify.py should achieve exit 0 on all panels

**Plan 13-06:** logging audit — console-baseline.tsv provides before-state.
- Target: zero console errors on auth routes (currently unknown — no baseline)
- After auth unblock: re-capture console-baseline.tsv, then apply fixes in 13-06

## Failures

Zero `[capture:FAIL]` entries in `audit/working/capture-before.log`. All 60 auth skips are graceful `[capture:SKIP]` — not failures. Capture script exited 0.

---

Baseline captured at 2026-04-22T19:52:20Z
