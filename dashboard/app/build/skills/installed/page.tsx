import { redirect } from "next/navigation"

/**
 * /build/skills/installed — deep-link redirect to Installed tab.
 * Canonical URL is /build/skills?tab=installed.
 */
export default function InstalledPage() {
  redirect("/build/skills?tab=installed")
}
