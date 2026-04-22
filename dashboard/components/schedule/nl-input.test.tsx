import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import React from "react"
import { NlInput } from "./nl-input"

// Mock fetch globally
const mockFetch = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  global.fetch = mockFetch
  mockFetch.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        cron: "0 9 * * *",
        source: "rule",
        english: "At 09:00 AM",
        nextRun: "2026-04-23T13:00:00.000Z",
      }),
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("NlInput", () => {
  it("Test 7: debounces — calls fetch once after 300ms", async () => {
    render(<NlInput onResult={vi.fn()} />)
    const textarea = screen.getByPlaceholderText(/every morning at 9am/i)

    fireEvent.change(textarea, { target: { value: "every hour" } })
    expect(mockFetch).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/schedule/parse",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("Test 7b: does not fetch for empty input", async () => {
    render(<NlInput onResult={vi.fn()} />)
    const textarea = screen.getByPlaceholderText(/every morning at 9am/i)

    fireEvent.change(textarea, { target: { value: "   " } })

    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("Test 7c: calls onResult with parse result", async () => {
    const onResult = vi.fn()
    render(<NlInput onResult={onResult} />)
    const textarea = screen.getByPlaceholderText(/every morning at 9am/i)

    fireEvent.change(textarea, { target: { value: "every morning at 9am" } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      // flush microtasks
      await Promise.resolve()
    })

    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ cron: "0 9 * * *" })
    )
  })

  it("Test 7d: renders input with correct placeholder", () => {
    render(<NlInput onResult={vi.fn()} />)
    expect(screen.getByPlaceholderText(/every morning at 9am/i)).toBeInTheDocument()
  })
})
