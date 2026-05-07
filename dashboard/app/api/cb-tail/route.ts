export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

// 30-second cache for CB file (write-heavy)
let _responseCache: { ts: number; body: string } | null = null;
const RESPONSE_CACHE_TTL = 30_000;

async function getHandler(req: NextRequest) {
  const limit = Math.min(
    5000,
    parseInt(req.nextUrl.searchParams.get("limit") || "5000") || 5000
  );
  const now = Date.now();

  // Return cached response if fresh
  if (
    _responseCache &&
    now - _responseCache.ts < RESPONSE_CACHE_TTL
  ) {
    return new Response(_responseCache.body, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  try {
    // Read circuit-breaker file
    const cbPath = join(
      process.cwd(),
      "..",
      "..",
      ".cae",
      "metrics",
      "circuit-breakers.jsonl"
    );

    const content = await readFile(cbPath, "utf-8");
    const lines = content
      .split("\n")
      .filter((line) => line.trim())
      .slice(-limit)
      .join("\n");

    _responseCache = { ts: now, body: lines };

    return new Response(lines, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("Failed to read circuit-breaker file:", err);
    return new Response(
      JSON.stringify({ error: "Circuit-breaker file not found" }),
      { status: 404, headers: { "content-type": "application/json" } }
    );
  }
}

export const GET = getHandler;
