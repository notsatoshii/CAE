import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { TopNav } from "@/components/shell/top-nav";
import { ExplainModeProvider } from "@/lib/providers/explain-mode";
import { DevModeProvider } from "@/lib/providers/dev-mode";
import { StatePollProvider } from "@/lib/hooks/use-state-poll";
import { Toaster } from "@/components/ui/sonner";

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
        <ExplainModeProvider>
          <DevModeProvider>
            <StatePollProvider>
              {session && <TopNav session={session} />}
              {children}
              <Toaster />
            </StatePollProvider>
          </DevModeProvider>
        </ExplainModeProvider>
      </body>
    </html>
  );
}
