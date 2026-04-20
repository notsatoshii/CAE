export const dynamic = "force-dynamic";

import { listInbox, listOutbox } from "@/lib/cae-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { DelegateForm } from "./delegate-form";
import type { InboxTask, OutboxTask } from "@/lib/cae-types";

function ageLabel(createdAt: Date): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "secondary",
  failed: "destructive",
  error: "destructive",
};

export default async function QueuePage() {
  const [inbox, outbox] = await Promise.all([listInbox(), listOutbox()]);

  return (
    <main className="p-8 max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">CAE Queue</h1>

      <DelegateForm />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-base font-semibold mb-3">
            Inbox{" "}
            <span className="text-muted-foreground font-normal text-sm">
              awaiting execution
            </span>
          </h2>
          {inbox.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks in inbox.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task ID</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>BUILDPLAN</TableHead>
                  <TableHead>META</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inbox.map((t: InboxTask) => (
                  <TableRow key={t.taskId}>
                    <TableCell className="font-mono text-xs">{t.taskId}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {ageLabel(t.createdAt)}
                    </TableCell>
                    <TableCell>
                      {t.hasBuildplan ? (
                        <Badge variant="secondary">yes</Badge>
                      ) : (
                        <Badge variant="outline">no</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {/* META presence not in type — show n/a */}
                        n/a
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.hasBuildplan && (
                        <Link
                          href={`/ops/queue/inbox/${t.taskId}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          View BUILDPLAN
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">
            Outbox{" "}
            <span className="text-muted-foreground font-normal text-sm">
              completed
            </span>
          </h2>
          {outbox.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed tasks.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Commits</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outbox.map((t: OutboxTask) => (
                  <TableRow key={t.taskId}>
                    <TableCell className="font-mono text-xs">{t.taskId}</TableCell>
                    <TableCell>
                      {t.status ? (
                        <Badge variant={STATUS_VARIANT[t.status] ?? "outline"}>
                          {t.status}
                        </Badge>
                      ) : (
                        <Badge variant="outline">unknown</Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className="max-w-[160px] truncate text-xs text-muted-foreground"
                      title={t.summary}
                    >
                      {t.summary ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {t.branch ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.commits?.length ?? 0}
                    </TableCell>
                    <TableCell>
                      {t.hasDone && (
                        <Link
                          href={`/ops/queue/outbox/${t.taskId}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          View DONE
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </main>
  );
}
