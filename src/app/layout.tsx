import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/app/nav";
import { ChatWidget } from "@/components/app/chat-widget";
import { ThemeProvider } from "@/components/theme-provider";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "SupportMind Learning Loop",
  description: "Self-learning support intelligence demo (local)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="pointer-events-none fixed inset-0 -z-10">
            <div className="absolute inset-0 fx-grid" />
            <div className="absolute inset-0 fx-noise" />
            <div className="absolute left-[-120px] top-[120px] h-[420px] w-[420px] rounded-full bg-[rgba(var(--fx-cyan),0.18)] blur-3xl fx-float" />
            <div className="absolute right-[-140px] top-[40px] h-[520px] w-[520px] rounded-full bg-[rgba(var(--fx-amber),0.16)] blur-3xl fx-float [animation-delay:1.2s]" />
            <div className="absolute left-[20%] bottom-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(var(--fx-mint),0.16)] blur-3xl fx-float [animation-delay:2.4s]" />
          </div>

          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="sticky top-0 z-40 pt-3">
              <div className="fx-glass fx-ring rounded-2xl px-4">
                <AppNav />
              </div>
            </div>
            <div className="py-6 animate-in fade-in slide-in-from-bottom-2 duration-700">{children}</div>
          </div>

          <ChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
