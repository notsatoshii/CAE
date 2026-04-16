"""
Telegram approval gate for CAE dangerous actions.

Checks planned shell commands against config/dangerous-actions.yaml regex patterns.
If any match: posts a Telegram message and waits for approval. On timeout or
rejection, raises ActionDenied.

Modes:
  - Real (env CAE_TELEGRAM_BOT_TOKEN set): posts to Telegram, polls for reply.
  - Stub (token absent): logs attempt, auto-approves with prominent warning.
    This keeps development unblocked until the user creates a bot.

Env vars:
  CAE_TELEGRAM_BOT_TOKEN   Bot token from @BotFather (required for real mode)
  CAE_TELEGRAM_CHAT_ID     Chat ID to post to (required for real mode)
  CAE_GATE_STUB_AUTO       If "1", stub mode auto-approves. Default "1".
                           Set to "0" to make stub mode deny (useful for tests).

Usage from orchestrator:
    from telegram_gate import TelegramGate, ActionDenied
    gate = TelegramGate(project_root)
    try:
        gate.check_command("git push origin main")  # raises ActionDenied or returns
    except ActionDenied as e:
        # abort action, log, notify
"""
from __future__ import annotations

import json
import os
import re
import secrets
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional


class ActionDenied(Exception):
    """Raised when a dangerous action is denied (by user, timeout, or config)."""
    def __init__(self, pattern_name: str, command: str, reason: str):
        super().__init__(f"{pattern_name}: {reason}")
        self.pattern_name = pattern_name
        self.command = command
        self.reason = reason


@dataclass
class Pattern:
    name: str
    regex: re.Pattern
    description: str
    timeout_minutes: int


class TelegramGate:
    def __init__(self, project_root: Path | str):
        self.project_root = Path(project_root)
        self.cae_root = Path(__file__).resolve().parent.parent
        self.patterns = self._load_patterns()
        self.metrics_path = self.project_root / ".cae" / "metrics" / "approvals.jsonl"
        self.metrics_path.parent.mkdir(parents=True, exist_ok=True)

        self.bot_token = os.environ.get("CAE_TELEGRAM_BOT_TOKEN", "").strip()
        self.chat_id = os.environ.get("CAE_TELEGRAM_CHAT_ID", "").strip()
        self.stub_auto = os.environ.get("CAE_GATE_STUB_AUTO", "1") == "1"

    def _load_patterns(self) -> List[Pattern]:
        try:
            import yaml
        except ImportError:
            raise RuntimeError("PyYAML required")
        data = yaml.safe_load((self.cae_root / "config" / "dangerous-actions.yaml").read_text())
        out = []
        for entry in data.get("patterns", []):
            out.append(Pattern(
                name=entry["name"],
                regex=re.compile(entry["regex"], re.IGNORECASE),
                description=entry["description"],
                timeout_minutes=entry["telegram_timeout_minutes"],
            ))
        return out

    def _log(self, event: str, **fields):
        entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "event": event, **fields}
        with open(self.metrics_path, "a") as f:
            f.write(json.dumps(entry) + "\n")

    # ─── Public API ─────────────────────────────────────────────────────
    def match(self, command: str) -> Optional[Pattern]:
        """Return the first matching pattern, or None."""
        for p in self.patterns:
            if p.regex.search(command):
                return p
        return None

    def check_command(self, command: str, task_id: str = "<unspecified>") -> None:
        """
        If command matches a dangerous pattern, request approval.
        Returns normally on approval. Raises ActionDenied on rejection/timeout/stub-deny.
        """
        pattern = self.match(command)
        if pattern is None:
            return  # Not dangerous

        self._log("gate_triggered", task_id=task_id, pattern=pattern.name, command=command[:200])

        if self.bot_token and self.chat_id:
            approved, reason = self._request_real_approval(pattern, command, task_id)
        else:
            approved, reason = self._request_stub_approval(pattern, command, task_id)

        self._log("gate_decision", task_id=task_id, pattern=pattern.name,
                  approved=approved, reason=reason)

        if not approved:
            raise ActionDenied(pattern.name, command, reason)

    # ─── Stub approval (no bot token) ───────────────────────────────────
    def _request_stub_approval(self, pattern: Pattern, command: str, task_id: str) -> tuple[bool, str]:
        print(f"⚠ CAE_TELEGRAM_BOT_TOKEN not set — STUB MODE")
        print(f"⚠ Dangerous action: [{pattern.name}] {pattern.description}")
        print(f"⚠ Command: {command[:200]}")
        print(f"⚠ Stub auto-{'approve' if self.stub_auto else 'deny'} is ON. Set CAE_TELEGRAM_BOT_TOKEN to enable real approval flow.")
        return self.stub_auto, f"stub_{'approved' if self.stub_auto else 'denied'}"

    # ─── Real approval (with bot token) ─────────────────────────────────
    def _request_real_approval(self, pattern: Pattern, command: str, task_id: str) -> tuple[bool, str]:
        token = secrets.token_hex(4)  # 8-char random token for reply matching
        message = (
            f"🛑 *CAE Dangerous Action*\n\n"
            f"*Pattern:* `{pattern.name}`\n"
            f"*Task:* `{task_id}`\n"
            f"*Description:* {pattern.description}\n\n"
            f"```\n{command[:500]}\n```\n\n"
            f"Reply with one of:\n"
            f"  `approve {token}`  — allow this action\n"
            f"  `deny {token}`     — reject\n\n"
            f"Timeout: {pattern.timeout_minutes} minutes."
        )
        self._telegram_send(message)

        # Poll for reply
        deadline = time.time() + pattern.timeout_minutes * 60
        last_update_id = self._telegram_current_update_id()

        while time.time() < deadline:
            time.sleep(5)
            replies = self._telegram_get_new_messages(last_update_id)
            for upd in replies:
                last_update_id = max(last_update_id, upd["update_id"])
                text = upd.get("message", {}).get("text", "").strip().lower()
                if f"approve {token}" in text:
                    return True, "telegram_approved"
                if f"deny {token}" in text:
                    return False, "telegram_denied"
                # Other messages ignored (user may be having other conversations)

        return False, "telegram_timeout"

    # ─── Telegram HTTP API ──────────────────────────────────────────────
    def _telegram_send(self, text: str):
        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        data = urllib.parse.urlencode({
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": "Markdown",
        }).encode()
        req = urllib.request.Request(url, data=data, method="POST")
        try:
            urllib.request.urlopen(req, timeout=10).read()
        except Exception as e:
            self._log("telegram_send_error", error=str(e))

    def _telegram_current_update_id(self) -> int:
        """Return the latest update_id so we only match future replies."""
        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/getUpdates?limit=1&offset=-1"
            with urllib.request.urlopen(url, timeout=10) as r:
                data = json.load(r)
            results = data.get("result", [])
            if results:
                return results[-1]["update_id"]
        except Exception:
            pass
        return 0

    def _telegram_get_new_messages(self, after_id: int) -> list:
        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/getUpdates?offset={after_id + 1}"
            with urllib.request.urlopen(url, timeout=10) as r:
                data = json.load(r)
            return data.get("result", [])
        except Exception as e:
            self._log("telegram_getUpdates_error", error=str(e))
            return []
