import { GitHubSignInButton } from "./github-sign-in-button";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6 rounded-lg border bg-card p-10 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">CAE</h1>
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          Ctrl+Alt+Elite — your AI engineering team. Sign in to start new
          projects, track execution, and ship faster.
        </p>
        <GitHubSignInButton />
      </div>
    </main>
  );
}
