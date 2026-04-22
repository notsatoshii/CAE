import { GitHubSignInButton } from "./github-sign-in-button";

export default function SignInPage() {
  const year = new Date().getFullYear();
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[color:var(--bg)] px-4"
      data-testid="signin-page"
    >
      {/* Subtle radial gradient behind card — not distracting, UI-SPEC compliant */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--accent)]/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-8 py-10 shadow-xl">
        {/* Product wordmark — pillar-1 focal point */}
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-[32px] font-semibold tracking-tight text-[color:var(--text)]">
            CAE
          </h1>
          <p className="text-[13px] font-medium tracking-widest text-[color:var(--text-muted)] uppercase">
            Ctrl+Alt+Elite
          </p>
        </div>

        {/* Value proposition — pillar-5: 15px body */}
        <p className="text-center text-[15px] leading-relaxed text-[color:var(--text-muted)] max-w-[260px]">
          Control plane for your AI agent fleet. Sign in to start shipping.
        </p>

        {/* CTA — prominent, brand-appropriate */}
        <div className="w-full">
          <GitHubSignInButton />
        </div>

        {/* Footer */}
        <p className="text-[11px] text-[color:var(--text-muted)] opacity-60">
          © {year} Ctrl+Alt+Elite
        </p>
      </div>
    </main>
  );
}
