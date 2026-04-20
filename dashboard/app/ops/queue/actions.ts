"use server";

import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { INBOX_ROOT } from "@/lib/cae-config";

export async function createDelegation(formData: FormData): Promise<string> {
  const session = await auth();
  if (!session) throw new Error("unauthorized");

  const buildplan = formData.get("buildplan") as string | null;
  if (!buildplan?.trim()) throw new Error("BUILDPLAN content is required");

  const targetRepo = (formData.get("target_repo") as string | null)?.trim() || undefined;
  const taskId = `web-${randomUUID().slice(0, 8)}`;
  const taskDir = join(INBOX_ROOT, taskId);

  await mkdir(taskDir, { recursive: true });
  await writeFile(join(taskDir, "BUILDPLAN.md"), buildplan.trim(), "utf8");

  if (targetRepo) {
    const meta = `target_repo: ${targetRepo}\ncreated_by: dashboard\n`;
    await writeFile(join(taskDir, "META.yaml"), meta, "utf8");
  }

  const shortId = taskId.replace("web-", "");
  const child = spawn(
    "tmux",
    ["new-session", "-d", "-s", `buildplan-${shortId}`, `cae execute-buildplan ${taskId}`],
    { detached: true, stdio: "ignore" }
  );
  child.unref();

  revalidatePath("/ops/queue");
  return taskId;
}
