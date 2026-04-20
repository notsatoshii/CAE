import type { Session } from "next-auth";
import { ModeToggle } from "./mode-toggle";
import { UserMenu } from "./user-menu";

interface TopNavProps {
  session: Session;
}

export function TopNav({ session }: TopNavProps) {
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center border-b bg-background/80 px-4 backdrop-blur">
      <div className="flex flex-1 items-center">
        <span className="font-semibold tracking-tight">CAE</span>
      </div>
      <div className="flex items-center">
        <ModeToggle />
      </div>
      <div className="flex flex-1 items-center justify-end">
        <UserMenu session={session} />
      </div>
    </header>
  );
}
