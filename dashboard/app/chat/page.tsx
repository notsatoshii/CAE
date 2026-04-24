import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { ChatLayout } from "./chat-layout";

/**
 * /chat server shell — CHT-04, D-16 (Wave 4, Plan 09-07).
 *
 * Auth-gated: unauthenticated users redirect to /signin.
 * Renders the 50/50 split ChatLayout client component.
 * Server-only: no "use client" directive.
 *
 * Class 9 hydration fix: reads the `devMode` cookie server-side and passes it
 * as `initialDev` so SSR and the first client render agree on aria-labels.
 * Without this, `useDevMode()` hydrates from localStorage post-mount and flips
 * the chat pane aria-label, producing a React hydration mismatch warning on
 * admin mobile + wide /chat cells. The DevModeProvider writes the cookie
 * alongside localStorage whenever dev-mode changes.
 */
export const metadata = { title: "Chat — CAE" };

export default async function ChatPage() {
  const session = await auth();
  if (!session) redirect("/signin");
  const cookieStore = await cookies();
  const initialDev = cookieStore.get("devMode")?.value === "true";
  return <ChatLayout initialDev={initialDev} />;
}
