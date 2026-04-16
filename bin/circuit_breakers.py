"""
Circuit breakers for CAE orchestrator.

Tracks six limits per Phase 1 Decision 6. Every enforcement event is
logged to .cae/metrics/circuit-breakers.jsonl in the project root.

Usage from orchestrator:
    from circuit_breakers import CircuitBreakers, LimitExceeded

    cb = CircuitBreakers.load(project_root)

    # Per-Forge turn tracking
    cb.record_forge_turn(task_id)  # raises LimitExceeded if over max_turns

    # Per-task retries
    cb.record_task_failure(task_id)
    if cb.should_escalate_to_phantom(task_id):
        ...
    if cb.should_halt():
        ...

    # Token counting
    cb.record_tokens(task_id, input_tokens=N, output_tokens=M)

    # Parallelism
    with cb.acquire_forge_slot():
        run_forge(...)
"""
from __future__ import annotations

import json
import os
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict


class LimitExceeded(Exception):
    """Raised when a circuit breaker trips."""
    def __init__(self, limit_name: str, detail: str):
        super().__init__(f"{limit_name}: {detail}")
        self.limit_name = limit_name
        self.detail = detail


@dataclass
class BreakerConfig:
    max_turns: int = 30
    max_input_tokens: int = 500000
    max_output_tokens: int = 100000
    max_retries: int = 3
    max_concurrent_forge: int = 4
    forge_failures_spawn_phantom: int = 3
    phantom_failures_halt: int = 2
    sentinel_max_json_parse_failures: int = 2
    telegram_notify_on_halt: bool = True

    @classmethod
    def from_yaml(cls, path: Path) -> "BreakerConfig":
        import yaml
        data = yaml.safe_load(path.read_text())
        return cls(
            max_turns=data["per_forge"]["max_turns"],
            max_input_tokens=data["per_forge"]["max_input_tokens"],
            max_output_tokens=data["per_forge"]["max_output_tokens"],
            max_retries=data["per_task"]["max_retries"],
            max_concurrent_forge=data["parallelism"]["max_concurrent_forge"],
            forge_failures_spawn_phantom=data["escalation"]["forge_failures_spawn_phantom"],
            phantom_failures_halt=data["escalation"]["phantom_failures_halt"],
            sentinel_max_json_parse_failures=data.get("sentinel", {}).get("max_json_parse_failures", 2),
            telegram_notify_on_halt=data.get("escalation", {}).get("on_halt", {}).get("telegram_notify", True),
        )


@dataclass
class TaskState:
    forge_attempts: int = 0           # Forge runs this task has consumed
    phantom_attempts: int = 0         # Phantom runs for this task
    current_turns: int = 0            # Turns in the currently-running Forge
    total_input_tokens: int = 0
    total_output_tokens: int = 0


class CircuitBreakers:
    def __init__(self, cfg: BreakerConfig, metrics_path: Path):
        self.cfg = cfg
        self.metrics_path = metrics_path
        self.metrics_path.parent.mkdir(parents=True, exist_ok=True)
        self._tasks: Dict[str, TaskState] = {}
        self._forge_semaphore = threading.BoundedSemaphore(cfg.max_concurrent_forge)
        self._halt_flag = False
        self._lock = threading.Lock()
        self._sentinel_json_failures = 0

    @classmethod
    def load(cls, project_root: Path | str) -> "CircuitBreakers":
        project_root = Path(project_root)
        # Config lives in CAE repo, not project repo
        cae_root = Path(__file__).resolve().parent.parent
        cfg = BreakerConfig.from_yaml(cae_root / "config" / "circuit-breakers.yaml")
        metrics_path = project_root / ".cae" / "metrics" / "circuit-breakers.jsonl"
        return cls(cfg, metrics_path)

    # ─── Logging ────────────────────────────────────────────────────────
    def _log(self, event: str, **fields):
        entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "event": event, **fields}
        with self._lock:
            with open(self.metrics_path, "a") as f:
                f.write(json.dumps(entry) + "\n")

    def _task(self, task_id: str) -> TaskState:
        if task_id not in self._tasks:
            self._tasks[task_id] = TaskState()
        return self._tasks[task_id]

    # ─── Turn tracking ──────────────────────────────────────────────────
    def begin_forge_run(self, task_id: str):
        """Call at start of a fresh Forge invocation (resets turn counter)."""
        self._task(task_id).current_turns = 0
        self._log("forge_begin", task_id=task_id, attempt=self._task(task_id).forge_attempts + 1)

    def record_forge_turn(self, task_id: str):
        """Call before each tool call. Raises LimitExceeded if over max_turns."""
        t = self._task(task_id)
        t.current_turns += 1
        if t.current_turns > self.cfg.max_turns:
            self._log("limit_exceeded", task_id=task_id, limit="max_turns",
                      value=t.current_turns, cap=self.cfg.max_turns)
            raise LimitExceeded("max_turns",
                                f"task {task_id} exceeded {self.cfg.max_turns} turns")

    # ─── Token budgets ──────────────────────────────────────────────────
    def record_tokens(self, task_id: str, input_tokens: int = 0, output_tokens: int = 0):
        t = self._task(task_id)
        t.total_input_tokens += input_tokens
        t.total_output_tokens += output_tokens

        if t.total_input_tokens > self.cfg.max_input_tokens:
            self._log("limit_exceeded", task_id=task_id, limit="max_input_tokens",
                      value=t.total_input_tokens, cap=self.cfg.max_input_tokens)
            raise LimitExceeded("max_input_tokens",
                                f"task {task_id} consumed {t.total_input_tokens} input tokens")

        if t.total_output_tokens > self.cfg.max_output_tokens:
            self._log("limit_exceeded", task_id=task_id, limit="max_output_tokens",
                      value=t.total_output_tokens, cap=self.cfg.max_output_tokens)
            raise LimitExceeded("max_output_tokens",
                                f"task {task_id} generated {t.total_output_tokens} output tokens")

    # ─── Retries + escalation ───────────────────────────────────────────
    def record_forge_attempt(self, task_id: str, success: bool):
        t = self._task(task_id)
        t.forge_attempts += 1
        self._log("forge_end", task_id=task_id, attempt=t.forge_attempts, success=success)
        if not success and t.forge_attempts >= self.cfg.max_retries:
            self._log("limit_exceeded", task_id=task_id, limit="max_retries",
                      value=t.forge_attempts, cap=self.cfg.max_retries)

    def should_escalate_to_phantom(self, task_id: str) -> bool:
        t = self._task(task_id)
        if t.forge_attempts >= self.cfg.forge_failures_spawn_phantom:
            self._log("escalate_to_phantom", task_id=task_id, forge_attempts=t.forge_attempts)
            return True
        return False

    def record_phantom_attempt(self, task_id: str, success: bool):
        t = self._task(task_id)
        t.phantom_attempts += 1
        self._log("phantom_end", task_id=task_id, attempt=t.phantom_attempts, success=success)
        if not success and t.phantom_attempts >= self.cfg.phantom_failures_halt:
            self.trigger_halt(reason=f"phantom failed {t.phantom_attempts} times on task {task_id}")

    # ─── Sentinel JSON reliability ──────────────────────────────────────
    def record_sentinel_json_failure(self):
        self._sentinel_json_failures += 1
        self._log("sentinel_json_failure", count=self._sentinel_json_failures,
                  cap=self.cfg.sentinel_max_json_parse_failures)

    def should_fall_back_sentinel(self) -> bool:
        if self._sentinel_json_failures >= self.cfg.sentinel_max_json_parse_failures:
            self._log("sentinel_fallback_triggered", failures=self._sentinel_json_failures)
            return True
        return False

    def reset_sentinel_json_failures(self):
        self._sentinel_json_failures = 0

    # ─── Global halt ────────────────────────────────────────────────────
    def trigger_halt(self, reason: str):
        self._halt_flag = True
        self._log("halt", reason=reason, telegram_notify=self.cfg.telegram_notify_on_halt)

    def should_halt(self) -> bool:
        return self._halt_flag

    # ─── Parallelism ────────────────────────────────────────────────────
    @contextmanager
    def acquire_forge_slot(self):
        """Block until a Forge slot is available. Use as context manager."""
        got = self._forge_semaphore.acquire(timeout=3600)
        if not got:
            self._log("limit_exceeded", limit="max_concurrent_forge_timeout",
                      cap=self.cfg.max_concurrent_forge)
            raise LimitExceeded("max_concurrent_forge_timeout",
                                "no Forge slot available within 1h")
        self._log("forge_slot_acquired")
        try:
            yield
        finally:
            self._forge_semaphore.release()
            self._log("forge_slot_released")

    # ─── Introspection ──────────────────────────────────────────────────
    def snapshot(self) -> dict:
        return {
            "halt": self._halt_flag,
            "sentinel_json_failures": self._sentinel_json_failures,
            "tasks": {k: vars(v) for k, v in self._tasks.items()},
            "config": vars(self.cfg),
        }
