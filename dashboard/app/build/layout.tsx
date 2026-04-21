import Link from "next/link";

export default async function BuildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav className="flex gap-4 border-b px-8 py-2 text-sm">
        <Link href="/build" className="text-muted-foreground hover:text-foreground">
          Overview
        </Link>
        <Link href="/build/queue" className="text-muted-foreground hover:text-foreground">
          Queue
        </Link>
      </nav>
      {children}
    </>
  );
}
