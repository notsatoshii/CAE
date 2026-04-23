/**
 * /api/commits — Class 15C.
 *
 * Returns the last N commits for the Recent Commits card on /build home.
 * Default source is local `git log`; if GITHUB_TOKEN is set AND the origin
 * remote points at github.com, it optionally unions with the GitHub REST
 * API so cross-machine PRs land too.
 *
 * Graceful fallback: any GitHub REST failure logs + returns local-only.
 * The card must NEVER be empty just because the network flaked.
 */

import { NextRequest } from "next/server"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { CAE_ROOT } from "@/lib/cae-config"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.commits")
const exec = promisify(execFile)

export const dynamic = "force-dynamic"

export interface CommitRow {
  sha: string
  shortSha: string
  subject: string
  author: string
  ts: string
  url?: string
  source: "local" | "github"
}

interface RepoInfo {
  owner: string | null
  repo: string | null
  baseUrl: string | null
}

async function getRepoInfo(repo: string): Promise<RepoInfo> {
  try {
    const { stdout } = await exec("git", ["remote", "get-url", "origin"], {
      cwd: repo,
    })
    const url = stdout.trim()
    // Accept both ssh (git@github.com:owner/repo.git) and https
    // (https://github.com/owner/repo.git). Fallback to null for either.
    const ssh = url.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/)
    const https = url.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/)
    const m = ssh ?? https
    if (!m) return { owner: null, repo: null, baseUrl: null }
    return {
      owner: m[1],
      repo: m[2],
      baseUrl: `https://github.com/${m[1]}/${m[2]}`,
    }
  } catch {
    return { owner: null, repo: null, baseUrl: null }
  }
}

async function readLocalCommits(
  repo: string,
  limit: number,
  baseUrl: string | null,
): Promise<CommitRow[]> {
  const SEP = "\x1f"
  const FORMAT = ["%H", "%h", "%cI", "%an", "%s"].join(SEP)
  const { stdout } = await exec(
    "git",
    ["log", `-n`, String(limit), "--since=7 days ago", `--format=${FORMAT}`],
    { cwd: repo, maxBuffer: 8 * 1024 * 1024 },
  )
  const rows: CommitRow[] = []
  for (const line of stdout.split("\n")) {
    if (!line) continue
    const parts = line.split(SEP)
    if (parts.length < 5) continue
    rows.push({
      sha: parts[0],
      shortSha: parts[1],
      ts: parts[2],
      author: parts[3],
      subject: parts[4],
      url: baseUrl ? `${baseUrl}/commit/${parts[0]}` : undefined,
      source: "local",
    })
  }
  return rows
}

/**
 * Fetch the last N commits on the default branch via GitHub REST. Returns
 * null on any failure — caller falls back to local-only.
 *
 * Uses a 3s timeout so dev-machine loss doesn't stall /build home for 30s.
 */
async function fetchGithubCommits(
  info: RepoInfo,
  limit: number,
): Promise<CommitRow[] | null> {
  const token = process.env.GITHUB_TOKEN
  if (!token || !info.owner || !info.repo) return null
  const url = `https://api.github.com/repos/${info.owner}/${info.repo}/commits?per_page=${limit}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 3000)
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: ctrl.signal,
      // Don't cache — fresh fetch on every /build load is cheap enough at
      // 1 request per 3s poll interval and users expect realtime.
      cache: "no-store",
    })
    if (!res.ok) {
      l.warn({ status: res.status }, "github REST non-ok")
      return null
    }
    const raw = (await res.json()) as Array<{
      sha: string
      html_url: string
      commit: {
        author: { name: string; date: string }
        message: string
      }
    }>
    const rows: CommitRow[] = []
    for (const c of raw) {
      const subject = (c.commit.message ?? "").split("\n")[0]
      rows.push({
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        ts: c.commit.author?.date ?? new Date().toISOString(),
        author: c.commit.author?.name ?? "unknown",
        subject,
        url: c.html_url,
        source: "github",
      })
    }
    return rows
  } catch (err) {
    l.warn({ err: String(err) }, "github REST fetch failed")
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Union local + GitHub by sha, preferring GitHub rows (they carry
 * html_url unconditionally) while still emitting locally-exclusive shas
 * that haven't been pushed yet.
 */
function unionBySha(
  local: CommitRow[],
  remote: CommitRow[] | null,
): CommitRow[] {
  if (!remote || remote.length === 0) return local
  const bySha = new Map<string, CommitRow>()
  for (const r of local) bySha.set(r.sha, r)
  for (const r of remote) bySha.set(r.sha, r) // override local with remote
  const merged = Array.from(bySha.values())
  merged.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
  return merged
}

async function getHandler(req: NextRequest) {
  const limitRaw = req.nextUrl.searchParams.get("limit")
  // Parse-or-default logic: explicitly use 10 only when the query is
  // missing/non-numeric, so `?limit=0` still clamps to 1 via the outer
  // Math.max (not silently rewritten to 10 by the `|| 10` fallback).
  const parsed = Number.parseInt(limitRaw ?? "", 10)
  const base = Number.isFinite(parsed) ? parsed : 10
  const limit = Math.max(1, Math.min(50, base))
  const repo = req.nextUrl.searchParams.get("repo") ?? CAE_ROOT

  const info = await getRepoInfo(repo)
  const [local, remote] = await Promise.all([
    readLocalCommits(repo, limit, info.baseUrl).catch((err): CommitRow[] => {
      l.error({ err }, "local git log failed")
      return []
    }),
    fetchGithubCommits(info, limit),
  ])

  const merged = unionBySha(local, remote).slice(0, limit)
  return Response.json({ commits: merged, repo: info.baseUrl })
}

export const GET = withLog(getHandler, "/api/commits")
