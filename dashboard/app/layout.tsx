import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
                      {children}
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
