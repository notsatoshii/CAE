/**
 * Claude CLI subprocess wrapper — Phase 9 Plan 03 Task 2.
 *
 * Thin wrapper that emits the exact CLI invocation required by
 * 09-CONTEXT D-03:
 *
 *   claude --print
 *          --resume <sessionId>
 *          --append-system-prompt-file <voiceFile>
 *          --output-format stream-json
 *          --include-partial-messages
 *          --model <model>
 *
 * stdin receives `messageText`, then closes. stdout is newline-delimited
 * JSON (the stream-json protocol documented at
 * https://docs.claude.com/en/docs/claude-code/sdk). The caller parses
 * line-by-line and re-frames into SSE chunks; see
 * app/api/chat/send/route.ts for the parse table.
 *
 * cwd MUST be CAE_ROOT — the claude CLI resolves session files relative
 * to cwd (`~/.claude/projects/-home-cae-ctrl-alt-elite/<uuid>.jsonl`),
 * so spawning with any other cwd creates a fresh session and --resume
 * fails (09-CONTEXT gotcha #4).
 *
 * Class-18 root/sudo wrapper (C2-FIX-WAVE):
 *   Claude CLI ≥2.1.117 refuses to run as root. The dashboard dev server
 *   runs as root so direct `spawn("claude", ...)` silently exits non-zero.
 *   We drop to the `cae` user via `sudo -u cae -E env HOME=/home/cae claude`.
 *   `sudo -u cae` switches user; `-E` preserves env; `HOME=/home/cae` is
 *   forced so Claude's config lookup lands on cae's home (credentials +
 *   ~/.claude/projects/<slug>/<sessionId>.jsonl for --resume). Credentials
 *   are mirrored from /root to /home/cae by /usr/local/bin/cae-creds-resync.sh
 *   on a 3h cron. sudoers.d/cae-claude grants passwordless `sudo -u cae claude`.
 *
 * No unit tests for this module in isolation — it's a ~40-line thin
 * wrapper. Integration-tested via /api/chat/send e2e in Wave 5.
 *
 * Security (threat T-09-03-06, command injection): args are passed as a
 * typed array, never shell-parsed. sessionId is regex-validated by the
 * caller (validateSessionId from cae-chat-state) before being passed here.
 * voiceFile is an absolute path the caller constructs from a whitelisted
 * AgentName, so path injection is not possible.
 *
 * Rate-limit handling (gotcha #12): the caller observes stderr and the
 * exit code; if stderr matches /rate.?limit/i or /usage.?limit/i the
 * caller emits an SSE `rate_limited` event.
 */

import { spawn } from "child_process";
import type { Readable } from "stream";

export interface SpawnChatInput {
  sessionId: string;
  /** Absolute path to `dashboard/docs/voices/<agent>.md`. */
  voiceFile: string;
  /** Claude model id — from MODEL_BY_AGENT in lib/voice-router.ts. */
  model: string;
  messageText: string;
  /** MUST be CAE_ROOT so --resume finds the session jsonl. */
  cwd: string;
}

export interface SpawnChatHandle {
  stdout: Readable;
  stderr: Readable;
  /** Resolves with the subprocess exit code. */
  wait: () => Promise<number>;
  /** SIGTERM the child; safe to call after exit. */
  kill: () => void;
}

export function spawnClaudeChat(input: SpawnChatInput): SpawnChatHandle {
  const args = [
    "--print",
    "--resume",
    input.sessionId,
    "--append-system-prompt-file",
    input.voiceFile,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--model",
    input.model,
  ];

  // Class-18 root/sudo wrapper: claude CLI ≥2.1.117 refuses to run as root.
  // The dashboard server runs as root; drop to the `cae` user via sudo. The
  // full argv is therefore: ["sudo", "-u", "cae", "-E", "env", "HOME=/home/cae",
  // "claude", ...args]. See the module-level comment for the full rationale.
  const child = spawn(
    "sudo",
    ["-u", "cae", "-E", "env", "HOME=/home/cae", "claude", ...args],
    {
      cwd: input.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    },
  );

  // Feed the message over stdin, then close.
  if (child.stdin) {
    child.stdin.write(input.messageText);
    child.stdin.end();
  }

  let exited: number | null = null;
  let exitErr: Error | null = null;
  const waiters: Array<(code: number) => void> = [];

  child.on("exit", (code) => {
    exited = code ?? 0;
    for (const w of waiters) w(exited);
    waiters.length = 0;
  });
  child.on("error", (err) => {
    // `error` fires if spawn itself fails (e.g., `sudo` not on PATH or
    // sudoers refuses the request). Convert to an exit-style resolution
    // so callers don't hang.
    exitErr = err;
    exited = 127;
    for (const w of waiters) w(127);
    waiters.length = 0;
  });

  return {
    stdout: child.stdout!,
    stderr: child.stderr!,
    wait() {
      return new Promise<number>((resolve, reject) => {
        if (exited !== null) {
          if (exitErr) reject(exitErr);
          else resolve(exited);
          return;
        }
        waiters.push(resolve);
      });
    },
    kill() {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    },
  };
}
