"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CaseListItem = {
  ticketNumber: string;
  subject: string;
  priority: string;
  tier: string;
  category: string;
  module: string;
  scriptId: string;
  kbId: string;
  generatedKbId: string;
  channel: string;
};

export function CasesClient() {
  const [items, setItems] = useState<CaseListItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [visible, setVisible] = useState(36);

  async function load() {
    setBusy(true);
    try {
      const res = await fetch("/api/cases?limit=400");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { items: CaseListItem[] };
      setItems(data.items);
      setVisible(36);
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const all = items || [];
    const query = q.trim().toLowerCase();
    return all.filter((it) => {
      if (tier !== "all" && String(it.tier || "").trim() !== tier) return false;
      if (priority !== "all" && String(it.priority || "").trim().toLowerCase() !== priority) return false;
      if (!query) return true;
      return (
        it.ticketNumber.toLowerCase().includes(query) ||
        it.subject.toLowerCase().includes(query) ||
        (it.category || "").toLowerCase().includes(query) ||
        (it.module || "").toLowerCase().includes(query)
      );
    });
  }, [items, q, tier, priority]);

  const paged = useMemo(() => {
    return filtered.slice(0, Math.max(0, visible));
  }, [filtered, visible]);

  const [autoMore, setAutoMore] = useState(true);

  const renderItems: Array<CaseListItem | null> = items
    ? paged
    : Array.from({ length: 6 }).map(() => null);

  return (
    <div className="grid gap-4">
      <Card className="bg-card/60 backdrop-blur-xl border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Search + Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[1fr_200px_200px_auto] md:items-center">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ticket, subject, module, category..."
              className="h-11 bg-background/70"
            />
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger className="h-11 bg-background/70">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tiers</SelectItem>
                <SelectItem value="1.0">Tier 1</SelectItem>
                <SelectItem value="2.0">Tier 2</SelectItem>
                <SelectItem value="3.0">Tier 3</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-11 bg-background/70">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button className="h-11" onClick={load} disabled={busy}>
              {busy ? "Loading..." : items ? "Refresh" : "Load cases"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="text-muted-foreground">
              {items ? (
                <span>
                  Showing <span className="font-mono text-foreground">{paged.length}</span> of{' '}
                  <span className="font-mono text-foreground">{filtered.length}</span> (filtered) from{' '}
                  <span className="font-mono text-foreground">{items.length}</span>
                </span>
              ) : (
                <span>Click “Load cases” to fetch from the local dataset API.</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="font-mono">
                Tier-3 = script-heavy
              </Badge>
              <Badge variant="secondary" className="font-mono">
                KB-SYN-* = learned KB
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/60 backdrop-blur-xl border-border/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Results</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <button
                type="button"
                className="rounded-full border bg-background/60 px-3 py-1 transition hover:bg-foreground/5"
                onClick={() => setAutoMore((v) => !v)}
              >
                Auto-load: <span className="font-mono text-foreground">{autoMore ? "on" : "off"}</span>
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[64vh] rounded-xl border bg-muted/20 p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {renderItems.map((it, idx) => (
                <Card
                  key={it?.ticketNumber || `loading-${idx}`}
                  className="bg-card/70 backdrop-blur-xl border-border/60 hover:-translate-y-0.5 hover:shadow-lg transition will-change-transform"
                  style={{ animationDelay: `${idx * 20}ms` }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid gap-1">
                        <div className="font-mono text-xs text-muted-foreground">
                          {it ? it.ticketNumber : "CS-..."}
                        </div>
                        <CardTitle className="text-sm leading-5">
                          {it?.subject || "Loading subject..."}
                        </CardTitle>
                      </div>
                      {it?.priority ? (
                        <Badge variant="secondary">{it.priority}</Badge>
                      ) : (
                        <Badge variant="outline">—</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm">
                    <div className="grid gap-1 text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Tier</span>
                        <span className="font-mono text-foreground">{it?.tier || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Channel</span>
                        <span className="font-mono text-foreground">{it?.channel || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Script</span>
                        <span className="font-mono text-foreground text-xs">{it?.scriptId || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Learned KB</span>
                        <span className="font-mono text-foreground text-xs">{it?.generatedKbId || "—"}</span>
                      </div>
                    </div>

                    {!it ? (
                      <Button disabled className="h-10">
                        Loading...
                      </Button>
                    ) : (
                      <Button asChild className="h-10">
                        <Link href={`/cases/${it.ticketNumber}`}>Open →</Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {items && filtered.length > paged.length ? (
              <AutoLoadSentinel
                enabled={autoMore}
                remaining={filtered.length - paged.length}
                onLoadMore={() => setVisible((v) => Math.min(filtered.length, v + 36))}
              />
            ) : null}
          </ScrollArea>

          {items && filtered.length > paged.length ? (
            <div className="flex items-center justify-center pt-4">
              <Button
                variant="secondary"
                className="h-11 px-6"
                onClick={() => setVisible((v) => Math.min(filtered.length, v + 36))}
              >
                Load more ({Math.min(36, filtered.length - paged.length)})
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function AutoLoadSentinel(props: {
  enabled: boolean;
  remaining: number;
  onLoadMore: () => void;
}) {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!props.enabled) return;
    if (!ref) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) props.onLoadMore();
      },
      { rootMargin: "220px" }
    );
    obs.observe(ref);
    return () => obs.disconnect();
  }, [props.enabled, props, ref]);

  return (
    <div className="pt-4">
      <div ref={setRef} className="rounded-xl border bg-background/60 p-3 text-xs text-muted-foreground">
        {props.enabled ? (
          <span>
            Auto-loading more… <span className="font-mono text-foreground">{props.remaining}</span> remaining
          </span>
        ) : (
          <span>
            <span className="font-mono text-foreground">{props.remaining}</span> remaining
          </span>
        )}
      </div>
    </div>
  );
}
