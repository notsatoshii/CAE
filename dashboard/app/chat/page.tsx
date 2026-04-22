import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChatLayout } from "./chat-layout";

/**
 * /chat server shell — CHT-04, D-16 (Wave 4, Plan 09-07).
 *
 * Auth-gated: unauthenticated users redirect to /signin.
 * Renders the 50/50 split ChatLayout client component.
 * Server-only: no "use client" directive.
 */
export const metadata = { title: "Chat — CAE" };

export default async function ChatPage() {
  const session = await auth();
  if (!session) redirect("/signin");
  return <ChatLayout />;
}
