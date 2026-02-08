"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function AppNav() {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Avoid hydration mismatch between SSR and client theme.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const isDark = mounted && (resolvedTheme || theme) === "dark";

  const links = [
    { href: "/cases", label: "Cases" },
    { href: "/autopilot", label: "Autopilot" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  function openAgent() {
    window.dispatchEvent(
      new CustomEvent("supportmind:chat", {
        detail: { message: "", autoSend: false },
      })
    );
  }

  return (
    <div className="w-full py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[rgba(var(--fx-cyan),0.9)] via-[rgba(var(--fx-mint),0.75)] to-[rgba(var(--fx-amber),0.75)] shadow-sm" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">SupportMind</div>
            <div className="text-xs text-muted-foreground">Learning Loop</div>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {links.map((l) => {
            const active = pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative rounded-full px-4 py-2 text-sm transition",
                  "hover:bg-foreground/5",
                  active
                    ? "bg-foreground/5 text-foreground"
                    : "text-foreground/70 hover:text-foreground"
                )}
              >
                {active ? (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[rgb(var(--fx-cyan))] shadow-[0_0_0_4px_rgba(var(--fx-cyan),0.12)]" />
                ) : null}
                <span className={cn(active ? "pl-3" : "")}>{l.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={openAgent}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition",
              "text-foreground/70 hover:text-foreground hover:bg-foreground/5"
            )}
          >
            Agent
          </button>

          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full transition",
              "text-foreground/70 hover:text-foreground hover:bg-foreground/5"
            )}
            aria-label={
              mounted
                ? isDark
                  ? "Switch to light theme"
                  : "Switch to dark theme"
                : "Toggle theme"
            }
            suppressHydrationWarning
          >
            {mounted ? (
              isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )
            ) : (
              <span className="h-4 w-4" />
            )}
          </button>

          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="rounded-full px-4 py-2 text-sm text-foreground/70 transition hover:text-foreground hover:bg-foreground/5"
          >
            Health
          </a>

          <Badge variant="secondary" className="font-mono">
            demo
          </Badge>
        </div>
      </div>
    </div>
  );
}
