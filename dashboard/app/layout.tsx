import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { TopNav } from "@/components/shell/top-nav";
import { ExplainModeProvider } from "@/lib/providers/explain-mode";
import { DevModeProvider } from "@/lib/providers/dev-mode";
import { StatePollProvider } from "@/lib/hooks/use-state-poll";
import { ChatRailProvider } from "@/lib/providers/chat-rail";
import { ChatRail } from "@/components/chat/chat-rail";
import { Toaster } from "@/components/ui/sonner";
import { CommandPaletteProvider } from "@/lib/hooks/use-command-palette";
import { ShortcutOverlayProvider } from "@/lib/hooks/use-shortcut-overlay";
import { CommandPalette } from "@/components/palette/command-palette";
import { ShortcutOverlay } from "@/components/ui/shortcut-overlay";
import { ClientErrorBridge, RootErrorBoundary } from "@/components/root-error-boundary";
import { AlertBanner } from "@/components/shell/alert-banner";
import { DebugBreadcrumbPanel } from "@/components/shell/debug-breadcrumb-panel";

// Phase 15 aesthetic foundation pass — Inter Variable replaces Geist Sans
// (per .planning/phases/15-screenshot-truth-harness/VISUAL-RESEARCH.md §1).
// Variable name `--font-geist-sans` is preserved to avoid call-site churn;
// underlying font swapped to Inter with full weight range and the `opsz`
// optical-sizing axis enabled so 11–13px UI text renders with adjusted
// stroke + counters.
const interSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  display: "swap",
});

// JetBrains Mono Variable replaces Geist Mono. Variable weight; latin subset.
// next/font's JetBrains_Mono does not expose an `axes` option (no opsz axis
// on this family in Google Fonts as of next 16.2), so we omit it.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CAE Dashboard",
  description: "Ctrl+Alt+Elite Dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" className="dark">
      <body
        className={`${interSans.variable} ${jetbrainsMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <RootErrorBoundary>
          <ClientErrorBridge />
          <ExplainModeProvider>
            <DevModeProvider>
              <StatePollProvider>
                <ChatRailProvider session={session}>
                  <CommandPaletteProvider>
                    <ShortcutOverlayProvider>
                      {session && <TopNav session={session} />}
                      {session && <AlertBanner />}
                      {/* Class 13D: #main-content is the subtree that gets
                          dimmed + blurred when a modal/sheet/dialog opens.
                          Putting the id at this layer (not only in
                          /build/layout.tsx) means the focus-dim rule fires
                          on every route (/metrics, /memory, /chat, /floor,
                          /plan) without per-layout plumbing.
                          NB: `display: contents` is INTENTIONALLY avoided —
                          `filter` doesn't cascade across contents boxes, so
                          the wrapper must be a real flow-level element. */}
                      <div id="main-content">
                        {children}
                      </div>
                      {session && <ChatRail />}
                      {session && <CommandPalette />}
                      {session && <ShortcutOverlay />}
                      {session && <DebugBreadcrumbPanel />}
                      <Toaster />
                    </ShortcutOverlayProvider>
                  </CommandPaletteProvider>
                </ChatRailProvider>
              </StatePollProvider>
            </DevModeProvider>
          </ExplainModeProvider>
        </RootErrorBoundary>
      </body>
    </html>
  );
}
