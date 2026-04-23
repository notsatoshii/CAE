/**
 * Tests for /build/admin/roles page
 * Phase 14 Plan 04 — Task 3, Test 3
 *
 * The page is a server component that reads env at render time.
 * We test the RoleEditor client component directly with props.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }),
}))
vi.mock("next-auth/providers/github", () => ({ default: {} }))
vi.mock("next-auth/providers/google", () => ({
  default: (_opts?: unknown) => ({ id: "google", type: "oauth" }),
}))

import { RoleEditor } from "./role-editor"

describe("RoleEditor", () => {
  it("Test 3: renders admin and operator email lists", () => {
    render(
      <RoleEditor
        admins={["eric@diiant.com", "alice@diiant.com"]}
        operators={["ops@diiant.com"]}
      />
    )
    expect(screen.getByText("eric@diiant.com")).toBeInTheDocument()
    expect(screen.getByText("alice@diiant.com")).toBeInTheDocument()
    expect(screen.getByText("ops@diiant.com")).toBeInTheDocument()
  })

  it("shows empty state when no admins configured", () => {
    render(<RoleEditor admins={[]} operators={[]} />)
    // Should not crash; shows empty list indicators
    expect(screen.getByText(/No admins/i)).toBeInTheDocument()
  })

  it("shows edit-via-env instruction", () => {
    render(<RoleEditor admins={["eric@diiant.com"]} operators={[]} />)
    expect(screen.getByText(/ADMIN_EMAILS/)).toBeInTheDocument()
  })
})
