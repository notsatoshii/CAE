import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/signin");
  const cookieStore = await cookies();
  const mode = cookieStore.get("cae-mode")?.value;
  redirect(mode === "plan" ? "/plan" : "/build");
}
