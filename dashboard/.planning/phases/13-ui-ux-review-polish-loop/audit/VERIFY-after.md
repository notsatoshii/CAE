# Phase 13 — Data Correctness Verification

**Run:** 2026-04-23T07:15:37  
**Server:** http://localhost:3003  
**Mode:** SOURCE-ONLY (auth deferred)  
**Panels checked:** 17  
**Confirmed bugs:** 0  
**Auth-deferred:** 14  

| Panel | API path | Source value | API value | Verdict |
|---|---|---|---|---|
| Cost ticker (top nav) | `/api/state` | in=0 out=0 fmt=0 | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |
| Heartbeat dot | `/api/state` | halted=False retries=0 phantoms=0 | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |
| Rollup: shipped_today | `/api/state` | 0 | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |
| Rollup: tokens_today | `/api/state` | 0 | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |
| Rollup: in_flight | `/api/state` | in_flight derivation requires live phase progress_pct from a... | SKIP | ⚠️ UNVERIFIABLE |
| Rollup: blocked (self-consistency check) | `/api/state` | cross-check requires live API | SKIP | ⚠️ AUTH-DEFERRED |
| Rollup: warnings | `/api/state` | 0 | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |
| Active phase: wave_current | `/api/state` | wave_current derivation requires task status from cae-phase-... | SKIP | ⚠️ UNVERIFIABLE |
| Active phase: progress_pct | `/api/state` | 01-shell-auth-toggle=0%; 02-ops-core=0%; 03-design-system-foundation=0%; 04-build-home-rewrite=0%; 05-agents-tab=100%; 06-workflows-queue=0%; 07-metrics-global-top-bar-icon-page=0%; 08-memory-global-top-bar-icon-page-graphify=0%; 09-changes-tab-right-rail-chat=0%; 10-plan-mode-projects-prds-roadmaps-uat=0%; 11-live-floor-pixel-agents-isometric-overlay=0%; 12-command-palette-polish-empty-states=0%; 13-ui-ux-review-polish-loop=50%; 14-orchestration-depth-skills-hub-cron-rbac=0% | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |
| Needs-you count | `/api/state` | 0 | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |
| Recent ledger token sums | `/api/state` | events=6 total_tokens=0 | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |
| Agents 7d success % | `/api/agents` | forge=100.0%(6runs) | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |
| Metrics MTD spend | `/api/metrics` | 0 | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |
| Changes: merges_today | `/api/changes` | 0 | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |
| Queue counts | `/api/queue` | inbox=3 shipped=3 stuck=0 | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |
| Memory tree leaf count | `/api/memory/tree` | 412 | AUTH-REQUIRED | ⚠️ AUTH-DEFERRED |
| Chat unread count (WR-01 static analysis) | `static-analysis` | UNCONFIRMED: UNCONFIRMED | N/A | ⚠️ UNCONFIRMED |

> **Auth note:** 14 panel(s) show ⚠️ AUTH-DEFERRED because `storage-state.json` is absent (deferred per session-7 directive). Run `authsetup.sh` to enable live API comparison. Source values are computed and shown for reference. WR-01 chat unread confirmed via static code analysis (no auth required).


---
**Legend:**  
- ✅ OK / SELF-CONSISTENT — API value matches source-of-truth  
- ❌ MISMATCH / CODE-BUG — data is wrong; see UI-AUDIT-correctness.md  
- ⚠️ AUTH-DEFERRED — needs live auth session (storage-state.json absent)  
- ⚠️ UNVERIFIABLE — derivation too complex to second-source without re-implementing aggregator  
- ⚠️ UNCONFIRMED — static analysis found no evidence of bug  
