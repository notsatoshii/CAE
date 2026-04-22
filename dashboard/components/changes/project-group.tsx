"use client";

/**
 * Phase 9 Wave 2 (plan 09-04) — ProjectGroup.
 *
 * One base-ui Accordion.Item per project. Header = project name + count.
 * Panel = the day-grouped ChangeRow stack. Expansion is controlled by the
 * parent Accordion.Root in changes-client.tsx (`multiple + defaultValue`
 * expanded-by-default — D-12).
 *
 * base-ui specifics (verified against node_modules/@base-ui/react/accordion
 * types, v1.4):
 *   - Import path is `@base-ui/react/accordion` (Accordion namespace).
 *   - Parts: Root / Item / Header / Trigger / Panel.
 *   - Accordion.Root uses `multiple` (boolean) + `defaultValue` (array of
 *     values) — NOT a `type="multiple"` string as Radix Accordion.
 *   - Accordion.Item accepts `value` as the stable identity.
 *   - Accordion.Header renders an <h3>; Accordion.Trigger renders a <button>.
 *   - No `asChild` anywhere (AGENTS.md gotcha — base-ui is not polymorphic;
 *     gotcha #5 in 09-CONTEXT.md).
 *
 * Accordion.Header is the <h3>, so DayGroup's inner headers are stepped down
 * visually via `font-medium text-sm` but remain semantic <h3>s (day labels).
 * Screen readers will hear Project / date / event-prose in that order.
 */

import { Accordion } from "@base-ui/react/accordion";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { DayGroup } from "./day-group";
import type { ProjectGroup as ProjectGroupData } from "@/lib/cae-changes-state";

export function ProjectGroup({ group }: { group: ProjectGroupData }) {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  return (
    <Accordion.Item
      value={group.project}
      className="border-b border-[color:var(--border,#1f1f22)] last:border-b-0"
      data-testid={`project-group-${group.projectName}`}
    >
      <Accordion.Header className="m-0">
        <Accordion.Trigger
          className="group flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[color:var(--surface-hover,#1a1a1d)]"
        >
          <span className="text-base font-medium text-[color:var(--text,#e5e5e5)]">
            {L.changesProjectHeader(group.projectName, group.count)}
          </span>
          <span
            aria-hidden
            className="text-[color:var(--text-muted,#8a8a8c)] transition-transform group-data-[panel-open]:rotate-180"
          >
            &#9662;
          </span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel className="px-4 pb-4">
        <DayGroup events={group.events} />
      </Accordion.Panel>
    </Accordion.Item>
  );
}
