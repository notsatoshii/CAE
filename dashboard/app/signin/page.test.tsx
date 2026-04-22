/**
 * Tests for app/signin/page.tsx — Two-provider sign-in page
 * Phase 14 Plan 04 — Test 9: page renders GitHub + Google buttons
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Mock next-auth/react — factory must not reference outer `const` (hoisting issue).
// We get the spy via vi.mocked() after setup.
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}))

// Mock next-auth and providers so importing @/auth doesn't break
vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }),
}))
vi.mock("next-auth/providers/github", () => ({ default: {} }))
vi.mock("next-auth/providers/google", () => ({
  default: (_opts?: unknown) => ({ id: "google", type: "oauth" }),
}))

import SignInPage from "./page"
import { signIn } from "next-auth/react"

const signInMock = vi.mocked(signIn)

describe("SignInPage", () => {
  it("Test 9a: renders both GitHub and Google sign-in buttons", () => {
    render(<SignInPage />)
    expect(screen.getByTestId("github-sign-in-button")).toBeInTheDocument()
    expect(screen.getByTestId("google-sign-in-button")).toBeInTheDocument()
  })

  it("Test 9b: GitHub button has text containing 'GitHub'", () => {
    render(<SignInPage />)
    const btn = screen.getByTestId("github-sign-in-button")
    expect(btn.textContent).toMatch(/GitHub/i)
  })

  it("Test 9c: Google button has text containing 'Google'", () => {
    render(<SignInPage />)
    const btn = screen.getByTestId("google-sign-in-button")
    expect(btn.textContent).toMatch(/Google/i)
  })

  it("Test 9d: clicking Google button calls signIn('google')", async () => {
    const user = userEvent.setup()
    render(<SignInPage />)
    const btn = screen.getByTestId("google-sign-in-button")
    await user.click(btn)
    expect(signInMock).toHaveBeenCalledWith("google")
  })

  it("clicking GitHub button calls signIn('github')", async () => {
    const user = userEvent.setup()
    render(<SignInPage />)
    const btn = screen.getByTestId("github-sign-in-button")
    await user.click(btn)
    expect(signInMock).toHaveBeenCalledWith("github")
  })
})
