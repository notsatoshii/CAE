export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

// Infinite cache for DONE.md (immutable after task completion)
const responseCache = new Map<string, { ts: number; body: string }>();

async function getHandler(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  if (!taskId) {
    return new Response(JSON.stringify({ error: "taskId required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Check cache (infinite TTL for immutable DONE.md)
  const cached = responseCache.get(taskId);
  if (cached) {
    return new Response(cached.body, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  try {
    // Read DONE.md from outbox
    const donePath = join(
      "/home/cae/outbox",
      taskId,
      "DONE.md"
    );

    const content = await readFile(donePath, "utf-8");

    // Cache forever
    responseCache.set(taskId, { ts: Date.now(), body: content });

    return new Response(content, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("Failed to read DONE.md:", { err, taskId });
    return new Response(JSON.stringify({ error: "Task not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
}

export const GET = getHandler;
