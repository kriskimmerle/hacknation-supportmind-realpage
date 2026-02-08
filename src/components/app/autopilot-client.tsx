"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";

import { Rocket, Wand2, CheckCircle2, AlertTriangle, Hourglass, Bug, Copy } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type Ev = {
  id: string;
  seq?: number;
  at: string;
  ticketNumber: string;
  stage: string;
  ok: boolean;
  summary: string;
  artifactPaths: Record<string, string>;
};

export function AutopilotClient() {
  const [busy, setBusy] = useState<string>("");
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [now, setNow] = useState(() => Date.now());

  async function refresh() {
    const res = await fetch("/api/autopilot/feed?limit=60");
    if (!res.ok) return;
    const out = (await res.json()) as { events: Ev[] };
    setEvents(out.events);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, []);

  async function seed() {
    setBusy("seed");
    try {
      const res = await fetch("/api/autopilot/seed", { method: "POST" });
      const out = await res.json();
      if (out.ticketNumber) {
        setSelected(out.ticketNumber);
        // Immediately kick off autopilot run
        await run(out.ticketNumber);
      }
    } finally {
      setBusy("");
      refresh();
    }
  }

  async function run(ticketNumber?: string) {
    const tn = (ticketNumber || selected).trim();
    if (!tn) return;
    setBusy("run");
    try {
      await fetch("/api/autopilot/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticketNumber: tn }),
      });
    } finally {
      setBusy("");
      refresh();
    }
  }

  async function retry(ticketNumber: string) {
    setSelected(ticketNumber);
    await run(ticketNumber);
  }

  const grouped = useMemo(() => {
    const by = new Map<string, Ev[]>();
    for (const e of events || []) {
      const k = e.ticketNumber;
      if (!by.has(k)) by.set(k, []);
      by.get(k)!.push(e);
    }
    return Array.from(by.entries()).map(([ticketNumber, evs]) => ({
      ticketNumber,
      evs: evs.sort((a, b) => {
        const as = typeof a.seq === "number" ? a.seq : 0;
        const bs = typeof b.seq === "number" ? b.seq : 0;
        if (as !== bs) return as - bs;
        return a.at.localeCompare(b.at);
      }),
    }));
  }, [events]);

  return (
    <div className="grid gap-4">
      <Card className="bg-card/60 backdrop-blur-xl border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Controls</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button onClick={seed} disabled={busy !== ""} className="h-11">
            <Wand2 className="mr-2 h-4 w-4" />
            {busy === "seed" ? "Seeding…" : "Seed New Case (Agent)"}
          </Button>
          <Button onClick={() => run()} disabled={busy !== "" || !selected} variant="secondary" className="h-11">
            <Rocket className="mr-2 h-4 w-4" />
            {busy === "run" ? "Running…" : "Run Autopublish"}
          </Button>

          <Badge variant="outline" className="font-mono">
            {selected ? `Selected: ${selected}` : "Select by seeding or paste into Agent"}
          </Badge>
        </CardContent>
      </Card>

      <Card className="bg-card/60 backdrop-blur-xl border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Live Learning Feed</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!events ? (
            <div className="grid gap-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="text-sm text-muted-foreground">No autopilot events yet. Seed a case to start.</div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {grouped.slice(0, 8).map((g) => (
                <AccordionItem key={g.ticketNumber} value={g.ticketNumber}>
                  <AccordionTrigger>
                    <div className="flex w-full items-center justify-between gap-3 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{g.ticketNumber}</span>
                        <StatusPill evs={g.evs} now={now} />
                      </div>
                      <div className="text-xs text-muted-foreground">{g.evs[g.evs.length - 1]?.at.slice(11, 19)}</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                      <div className="text-xs text-muted-foreground">
                        {busy ? "Autopilot running..." : ""}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="secondary" size="sm" className="h-8">
                          <Link href={`/cases/${g.ticketNumber}`}>Open case</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={busy !== ""}
                          onClick={() => retry(g.ticketNumber)}
                        >
                          <Rocket className="mr-2 h-3.5 w-3.5" />
                          Retry autopilot
                        </Button>
                      </div>
                    </div>

                    <Timeline evs={g.evs} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusPill(props: { evs: Ev[]; now: number }) {
  const last = props.evs[props.evs.length - 1];
  const ok = last?.ok;
  const stage = last?.stage || "";
  if (!last) return null;

  const lastAt = Date.parse(last.at);
  const isStuckStage = stage === "qa_eval_started" || stage === "publish_started";
  const isStuck = isStuckStage && Number.isFinite(lastAt) && props.now - lastAt > 60_000;

  const Icon = isStuck
    ? Hourglass
    : ok
      ? CheckCircle2
      : stage === "needs_review"
        ? AlertTriangle
        : Hourglass;

  const label =
    stage === "published"
      ? "AUTO-PUBLISHED"
      : stage === "needs_review"
        ? "NEEDS REVIEW"
        : isStuck
          ? "STUCK"
        : stage.toUpperCase().replaceAll("_", " ");

  return (
    <Badge
      variant={ok ? "secondary" : "outline"}
      className={
        isStuck
          ? "bg-[rgba(var(--fx-amber),0.12)] border-[rgba(var(--fx-amber),0.35)]"
          : ok
          ? "bg-[rgba(var(--fx-mint),0.14)] border-[rgba(var(--fx-mint),0.35)]"
          : "bg-[rgba(var(--fx-amber),0.10)] border-[rgba(var(--fx-amber),0.30)]"
      }
    >
      <Icon className="mr-2 h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

function Timeline(props: { evs: Ev[] }) {
  const stages = [
    "seeded",
    "gap_detect",
    "kb_draft",
    "guardrail",
    "qa_eval_started",
    "qa_eval",
    "publish_started",
    "published",
    "needs_review",
    "failed",
  ];
  const stageIndex = (s: string) => {
    const i = stages.indexOf(s);
    return i === -1 ? 0 : i;
  };
  const last = props.evs[props.evs.length - 1];
  const prog = Math.min(100, Math.max(5, ((stageIndex(last.stage) + 1) / stages.length) * 100));

  return (
    <div className="grid gap-3">
      <Progress value={prog} className="h-2" />
      <div className="grid gap-2">
        {props.evs.slice(-6).map((e, idx) => (
          <div
            key={e.at + idx}
            className={
              "rounded-xl border p-3 animate-in fade-in slide-in-from-bottom-1 duration-500 " +
              (e.ok ? "bg-muted/30" : "bg-[rgba(var(--fx-amber),0.10)] border-[rgba(var(--fx-amber),0.30)]")
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{e.stage}</span> · {e.at.slice(11, 19)}
                </div>
                <div className="text-sm">{e.summary}</div>
              </div>
              <div className="flex items-center gap-2">
                {!e.ok ? (
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 px-3"
                        onClick={async () => {
                          // noop: SheetTrigger handles open, but we fetch debug first
                        }}
                      >
                        <Bug className="mr-2 h-3.5 w-3.5" />
                        Report
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[92vw] max-w-[560px]">
                      <SheetHeader>
                        <SheetTitle>Debug Report</SheetTitle>
                      </SheetHeader>
                      <DebugPanel ticketNumber={e.ticketNumber} />
                    </SheetContent>
                  </Sheet>
                ) : null}

                {e.stage === "needs_review" ? (
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 px-3">
                        Review
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[92vw] max-w-[560px]">
                      <SheetHeader>
                        <SheetTitle>Human Review</SheetTitle>
                      </SheetHeader>
                      <ReviewPanel ticketNumber={e.ticketNumber} />
                    </SheetContent>
                  </Sheet>
                ) : null}
                <Badge variant="outline" className="font-mono">
                  {e.ok ? "OK" : "BLOCK"}
                </Badge>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {Object.entries(e.artifactPaths)
                .slice(0, 3)
                .map(([k, v]) => `${k}: ${v.split("/").slice(-2).join("/")}`)
                .join(" | ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DebugPanel(props: { ticketNumber: string }) {
  const [data, setData] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/autopilot/debug?ticketNumber=${encodeURIComponent(props.ticketNumber)}`);
        if (!res.ok) return;
        setData(await res.json());
      } finally {
        setBusy(false);
      }
    })();
  }, [props.ticketNumber]);

  async function copy() {
    if (!data) return;
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  }

  return (
    <div className="mt-4 grid gap-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="font-mono">
          {props.ticketNumber}
        </Badge>
        <Button onClick={copy} disabled={!data} variant="secondary" size="sm" className="h-8">
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copy JSON
        </Button>
      </div>
      <div className="rounded-xl border bg-muted/30 p-3">
        <pre className="text-xs leading-5 whitespace-pre-wrap break-words max-w-full">
          {busy ? "Loading debug..." : data ? JSON.stringify(data, null, 2) : "No debug data"}
        </pre>
      </div>
    </div>
  );
}

function ReviewPanel(props: { ticketNumber: string }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function submit(decision: "approved" | "rejected" | "needs_changes") {
    setBusy(true);
    try {
      const res = await fetch("/api/autopilot/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticketNumber: props.ticketNumber,
          decision,
          reviewerRole: "Human Reviewer",
          notes,
        }),
      });
      const out = await res.json();
      setResult(out);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid gap-3">
      <Badge variant="outline" className="font-mono">
        {props.ticketNumber}
      </Badge>
      <div className="text-sm text-muted-foreground">
        Approve to publish the last KB draft + emit lineage. Reject or request changes to keep it in review.
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Reviewer notes (what to change / why)"
        className="min-h-[90px]"
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => submit("approved")} disabled={busy}>
          Approve + Publish
        </Button>
        <Button onClick={() => submit("needs_changes")} disabled={busy} variant="secondary">
          Needs changes
        </Button>
        <Button onClick={() => submit("rejected")} disabled={busy} variant="destructive">
          Reject
        </Button>
      </div>
      {result ? (
        <div className="rounded-xl border bg-muted/30 p-3">
          <pre className="text-xs leading-5 whitespace-pre-wrap break-words max-w-full">{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}
