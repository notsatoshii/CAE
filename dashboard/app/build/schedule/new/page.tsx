import { redirect } from "next/navigation"

/**
 * /build/schedule/new → redirect to /build/schedule?tab=new
 * The schedule client handles the "new" tab via query param or
 * direct navigation defaults to list tab — redirect to main page.
 */
export default function NewSchedulePage() {
  redirect("/build/schedule")
}
