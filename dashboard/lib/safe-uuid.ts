/**
 * safe-uuid — client-safe UUID v4 generator.
 *
 * `crypto.randomUUID` is only exposed in secure contexts (HTTPS + localhost).
 * Accessing the dashboard over plain `http://<IP>:3002` therefore throws
 * `TypeError: crypto.randomUUID is not a function` — surfaced in session 13
 * as the P0 chat bug (components/chat/chat-panel.tsx:141,147).
 *
 * Strategy:
 *   1. Prefer `globalThis.crypto.randomUUID()` via optional chaining — returns
 *      as soon as the native API is present.
 *   2. Fall back to a v4-shaped UUID seeded from `crypto.getRandomValues` if
 *      available (insecure contexts still expose this), else `Math.random`.
 *
 * IDs from the fallback path are UI-scope only (React keys, optimistic message
 * ids) — not used for security tokens, so low-entropy Math.random is acceptable
 * as the last resort.
 */
export function safeUUID(): string {
  const native = globalThis.crypto?.randomUUID?.();
  if (native) return native;

  const getRandomValues = globalThis.crypto?.getRandomValues?.bind(
    globalThis.crypto,
  );
  const rnd = getRandomValues
    ? () => getRandomValues(new Uint8Array(1))[0]
    : () => Math.floor(Math.random() * 256);

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = rnd() & 0xf;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
