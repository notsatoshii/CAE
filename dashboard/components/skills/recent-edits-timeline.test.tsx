/**
 * Tests for components/skills/recent-edits-timeline.tsx
 *
 * Asserts:
 *   - grouping by day
 *   - ordering: newest day first
 *   - SHA renders as a link to GitHub when githubSlug is provided
 *   - empty state when no commits
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RecentEditsTimeline } from "./recent-edits-timeline";
import type { SkillsCommit } from "@/lib/skills/last-updated";

const mk = (iso: string, sha: string, subject: string): SkillsCommit => ({
  sha,
  fullSha: (sha + "x".repeat(40)).slice(0, 40),
  iso,
  author: "eric",
  subject,
});

describe("RecentEditsTimeline", () => {
  it("renders 'no recent edits' when commits is empty", () => {
    render(<RecentEditsTimeline commits={[]} />);
    expect(screen.getByTestId("recent-edits-empty")).toBeInTheDocument();
  });

  it("groups commits by day and preserves newest-first order", () => {
    const commits: SkillsCommit[] = [
      mk("2026-04-17T15:00:00Z", "aaa1111", "latest"),
      mk("2026-04-17T09:00:00Z", "bbb2222", "earlier-same-day"),
      mk("2026-04-16T10:00:00Z", "ccc3333", "day-before"),
      mk("2026-04-14T08:00:00Z", "ddd4444", "oldest"),
    ];
    render(<RecentEditsTimeline commits={commits} />);

    const days = screen.getAllByTestId("recent-edits-day");
    expect(days).toHaveLength(3);
    expect(days[0].getAttribute("data-day")).toBe("2026-04-17");
    expect(days[1].getAttribute("data-day")).toBe("2026-04-16");
    expect(days[2].getAttribute("data-day")).toBe("2026-04-14");

    const day0Commits = within(days[0]).getAllByTestId("recent-edits-commit");
    expect(day0Commits).toHaveLength(2);
    expect(day0Commits[0].getAttribute("data-sha")).toBe("aaa1111");
    expect(day0Commits[1].getAttribute("data-sha")).toBe("bbb2222");
  });

  it("renders 'last N commits' in header", () => {
    const commits: SkillsCommit[] = [
      mk("2026-04-17T15:00:00Z", "aaa1111", "one"),
      mk("2026-04-16T09:00:00Z", "bbb2222", "two"),
    ];
    render(<RecentEditsTimeline commits={commits} />);
    expect(screen.getByText(/last 2 commits/i)).toBeInTheDocument();
  });

  it("links SHA to GitHub when githubSlug is provided", () => {
    const commits: SkillsCommit[] = [
      mk("2026-04-17T15:00:00Z", "aaa1111", "subject"),
    ];
    render(
      <RecentEditsTimeline
        commits={commits}
        githubSlug="erik/ctrl-alt-elite"
      />
    );
    const link = screen.getByRole("link", { name: /aaa1111/ });
    expect(link.getAttribute("href")).toMatch(
      /^https:\/\/github\.com\/erik\/ctrl-alt-elite\/commit\/aaa1111/
    );
  });

  it("renders SHA as plain text when no githubSlug", () => {
    const commits: SkillsCommit[] = [
      mk("2026-04-17T15:00:00Z", "aaa1111", "subject"),
    ];
    render(<RecentEditsTimeline commits={commits} />);
    // No <a> for the SHA
    expect(screen.queryByRole("link", { name: /aaa1111/ })).toBeNull();
    expect(screen.getByText("aaa1111")).toBeInTheDocument();
  });
});
