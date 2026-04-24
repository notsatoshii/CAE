// crypto.randomUUID is only available in secure contexts (HTTPS + localhost).
// Falls back to getRandomValues-seeded v4 shape; final fallback is Math.random.
export function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const rnd =
    typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
      ? () => crypto.getRandomValues(new Uint8Array(1))[0]
      : () => Math.floor(Math.random() * 256);
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = rnd() & 0xf;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
