/**
 * /build/security — Security panel landing page.
 *
 * Redirects to the Skills trust sub-tab by default.
 * Admin-gated via middleware (all /build/* routes require auth).
 */
import { redirect } from "next/navigation"

export default function SecurityPage() {
  redirect("/build/security/skills")
}
