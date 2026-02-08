"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import {
  BotMessageSquare,
  Bug,
  CheckCircle2,
  ClipboardCheck,
  FilePenLine,
  Gavel,
  Microscope,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";

export type CaseRunnerProps = {
  ticket: Record<string, string>;
  conversation: Record<string, string> | null;
  script: {
    Script_ID: string;
    Script_Title: string;
    Script_Inputs: string;
    Script_Purpose: string;
  } | null;
};

export function CaseRunner({ ticket, conversation, script }: CaseRunnerProps) {
  const ticketNumber = ticket.Ticket_Number;

  const [gap, setGap] = useState<unknown>(null);
  const [draft, setDraft] = useState<unknown>(null);
  const [qa, setQa] = useState<unknown>(null);
  const [publish, setPublish] = useState<unknown>(null);
  const [busy, setBusy] = useState<string>("");
  const [xray, setXray] = useState<unknown>(null);

  const steps = {
    gap: Boolean(gap),
    draft: Boolean(draft),
    qa: Boolean(qa),
    publish: Boolean(publish),
  };

  const transcript = conversation?.Transcript || "";
  const transcriptPreview = useMemo(() => {
    const t = transcript.replace(/\s+/g, " ").trim();
    return t.length > 800 ? t.slice(0, 800) + "..." : t;
  }, [transcript]);

  async function postJson(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function loadXRay() {
    try {
      const res = await fetch(`/api/audit?ticketNumber=${encodeURIComponent(ticketNumber)}&limit=120`);
      if (!res.ok) return;
      setXray(await res.json());
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadXRay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketNumber]);

  async function runGap() {
    setBusy("gap");
    try {
      const out = await postJson("/api/run/gap", { ticketNumber });
      setGap(out);
      loadXRay();
    } finally {
      setBusy("");
    }
  }

  async function runDraft(mode?: "new" | "patch") {
    setBusy("draft");
    try {
      const out = await postJson("/api/run/kb-draft", { ticketNumber, mode: mode || "new" });
      setDraft(out);
      loadXRay();
    } finally {
      setBusy("");
    }
  }

  async function runQa() {
    setBusy("qa");
    try {
      const out = await postJson("/api/run/qa", { ticketNumber });
      setQa(out);
      loadXRay();
    } finally {
      setBusy("");
    }
  }

  async function runPublish(decision: "approved" | "rejected" | "needs_changes") {
    setBusy("publish");
    try {
      const out = await postJson("/api/run/publish", {
        ticketNumber,
        decision,
        reviewerRole: "Tier 3 Support",
        notes: "Local demo decision",
      });
      setPublish(out);
      loadXRay();
    } finally {
      setBusy("");
    }
  }

  function askAgent() {
    const msg = [
      `Ticket_Number: ${ticketNumber}`,
      ticket.Subject ? `Subject: ${ticket.Subject}` : "",
      ticket.Description ? `Description: ${ticket.Description}` : "",
      "\nQuestion: What is the best proven fix path (KB vs Script vs prior resolution)? Include citations and required inputs.",
    ]
      .filter(Boolean)
      .join("\n");

    window.dispatchEvent(
      new CustomEvent("supportmind:chat", {
        detail: { message: msg, autoSend: true },
      })
    );
  }

  return (
    <div className="grid gap-4">
      <Card className="bg-card/60 backdrop-blur-xl border-border/60 fx-ring animate-in fade-in slide-in-from-bottom-2 duration-700">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{ticketNumber}</span>
            {ticket.Priority ? <Badge variant="secondary">{ticket.Priority}</Badge> : null}
            {ticket.Tier ? <Badge variant="outline">Tier {ticket.Tier}</Badge> : null}
            {ticket.Category ? <Badge variant="outline">{ticket.Category}</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StepChip label="Gap" done={steps.gap} Icon={ScanSearch} />
            <StepChip label="KB Draft" done={steps.draft} Icon={FilePenLine} />
            <StepChip label="QA" done={steps.qa} Icon={ClipboardCheck} />
            <StepChip label="Governance" done={steps.publish} Icon={Gavel} />
            <StepChip label="X-Ray" done={Boolean(xray)} Icon={Microscope} />
          </div>
          <div>
            <div className="text-muted-foreground">Subject</div>
            <div>{ticket.Subject}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-muted-foreground">Transcript preview</div>
            <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs leading-5 whitespace-pre-wrap break-words">
              {transcriptPreview || "(no transcript)"}
            </div>
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button onClick={runGap} disabled={busy !== ""} className="h-10">
              <ScanSearch className="mr-2 h-4 w-4" />
              {busy === "gap" ? "Running..." : "Run Gap Detection"}
            </Button>
            {(() => {
              const action = (gap as any)?.action;
              const wantsPatch = action === "patch_existing_kb";
              return wantsPatch ? (
                <Button onClick={() => runDraft("patch")} disabled={busy !== ""} variant="secondary" className="h-10">
                  <FilePenLine className="mr-2 h-4 w-4" />
                  {busy === "draft" ? "Patching..." : "Patch Existing KB"}
                </Button>
              ) : (
                <Button onClick={() => runDraft("new")} disabled={busy !== ""} variant="secondary" className="h-10">
                  <FilePenLine className="mr-2 h-4 w-4" />
                  {busy === "draft" ? "Drafting..." : "Generate KB Draft"}
                </Button>
              );
            })()}
            <Button onClick={runQa} disabled={busy !== ""} variant="outline" className="h-10">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              {busy === "qa" ? "Scoring..." : "Run QA / Coaching"}
            </Button>
            <Button onClick={() => runPublish("approved")} disabled={busy !== "" || !draft} className="h-10">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Publish (Approve)
            </Button>
            <Button
              onClick={() => runPublish("rejected")}
              disabled={busy !== "" || !draft}
              variant="destructive"
              className="h-10"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button onClick={askAgent} disabled={busy !== ""} variant="outline" className="h-10">
              <BotMessageSquare className="mr-2 h-4 w-4" />
              Ask Agent
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-card/60 backdrop-blur-xl border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Triage</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {!gap ? (
              <div className="text-muted-foreground">Run gap detection to see recommended resource type (KB vs Script).</div>
            ) : (
              <TriageSummary gap={gap} script={script} />
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur-xl border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Knowledge Draft</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {!draft ? (
              <div className="text-muted-foreground">Generate a KB draft to see placeholders, lineage, and publish readiness.</div>
            ) : (
              <DraftSummary draftPayload={draft} />
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur-xl border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">QA Scorecard</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {!qa ? (
              <div className="text-muted-foreground">Run QA/Coaching to generate rubric-scored JSON and red flag checks.</div>
            ) : (
              <QaSummary qaPayload={qa} />
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="gap">
        <TabsList className="bg-card/50 backdrop-blur-xl border border-border/60">
          <TabsTrigger value="gap" className="gap-2">
            <ScanSearch className="h-4 w-4" />
            Gap
          </TabsTrigger>
          <TabsTrigger value="kb" className="gap-2">
            <FilePenLine className="h-4 w-4" />
            KB Draft
          </TabsTrigger>
          <TabsTrigger value="qa" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            QA
          </TabsTrigger>
          <TabsTrigger value="gov" className="gap-2">
            <Gavel className="h-4 w-4" />
            Governance
          </TabsTrigger>
          <TabsTrigger value="xray" className="gap-2">
            <Microscope className="h-4 w-4" />
            X-Ray
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gap">
          <JsonPanel title="Gap Decision" data={gap} emptyHint="Run gap detection to see results." />
        </TabsContent>
        <TabsContent value="kb">
          <JsonPanel title="KB Draft + Guardrails" data={draft} emptyHint="Generate a KB draft to see results." />
        </TabsContent>
        <TabsContent value="qa">
          <JsonPanel title="QA Rubric JSON" data={qa} emptyHint="Run QA to see the rubric-scored JSON." />
        </TabsContent>
        <TabsContent value="gov">
          <JsonPanel title="Publish Decision" data={publish} emptyHint="Publish/Reject a draft to log governance." />
        </TabsContent>

        <TabsContent value="xray">
          <XRayPanel
            ticketNumber={ticketNumber}
            xray={xray}
            fallback={{ ticket, conversation, script, gap, draft, qa, publish }}
            onRefresh={loadXRay}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function XRayPanel(props: {
  ticketNumber: string;
  xray: unknown;
  fallback: {
    ticket: Record<string, string>;
    conversation: Record<string, string> | null;
    script: CaseRunnerProps["script"];
    gap: unknown;
    draft: unknown;
    qa: unknown;
    publish: unknown;
  };
  onRefresh: () => void;
}) {
  const data = props.xray as any;
  const report = data?.xray;
  const events = Array.isArray(data?.events) ? (data.events as any[]) : [];
  const auto = Array.isArray(data?.autopilotEvents) ? (data.autopilotEvents as any[]) : [];

  const lastOfType = (t: string) => {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i]?.type === t) return events[i];
    }
    return null;
  };
  const gapPayload = props.fallback.gap || lastOfType("gap_detect")?.payload || null;
  const draftPayload = props.fallback.draft || lastOfType("kb_draft")?.payload || null;

  const [traces, setTraces] = useState<unknown>(null);
  async function loadTraces() {
    try {
      const res = await fetch(`/api/traces?ticketNumber=${encodeURIComponent(props.ticketNumber)}&limit=8`);
      if (!res.ok) return;
      setTraces(await res.json());
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadTraces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.ticketNumber]);

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border/60 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base inline-flex items-center gap-2">
          <Microscope className="h-4 w-4" />
          Audit / X-Ray
        </CardTitle>
        <Button variant="secondary" className="h-9" onClick={props.onRefresh}>
          <Sparkles className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="text-sm text-muted-foreground">
          Traceability for this case: where data came from (dataset/local artifacts), what ran (gap/draft/guardrails/QA), and
          what evidence was cited.
        </div>

        <Accordion type="multiple" className="w-full" defaultValue={["sources", "timeline"]}>
          <AccordionItem value="work">
            <AccordionTrigger>Show Your Work (Case Aggregation)</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3 text-sm">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Case context used by agents</div>
                  <pre className="mt-2 text-xs leading-5 whitespace-pre-wrap break-words max-w-full">
                    {JSON.stringify(report?.aggregation?.caseContext || {}, null, 2)}
                  </pre>
                </div>
                {Array.isArray(report?.aggregation?.steps) && report.aggregation.steps.length ? (
                  <div className="grid gap-2">
                    {report.aggregation.steps.map((s: any, i: number) => (
                      <div key={i} className="rounded-xl border bg-background/60 p-3">
                        <div className="font-mono text-xs">{String(s.name || `step-${i + 1}`)}</div>
                        <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                          {String(s.showYourWork || "")}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sources">
            <AccordionTrigger>Data Sources + Joins</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3 text-sm">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Dataset</div>
                  <div className="mt-1 font-mono text-xs break-all">{report?.datasetPath || "(unknown)"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Loaded at: {report?.datasetLoadedAt || "—"}</div>
                </div>

                {Array.isArray(report?.sources) && report.sources.length ? (
                  <div className="grid gap-2">
                    {report.sources.map((s: any, i: number) => (
                      <div key={i} className="rounded-xl border bg-background/60 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">{String(s.label || "Source")}</div>
                            <div className="mt-1 font-mono text-xs break-all">{String(s.ref || "")}</div>
                          </div>
                        </div>
                        {s.details ? (
                          <div className="mt-2 rounded-lg border bg-muted/30 p-2">
                            <pre className="text-xs leading-5 whitespace-pre-wrap break-words max-w-full">
                              {JSON.stringify(s.details, null, 2)}
                            </pre>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No source report yet. Click Refresh (or run an action) to generate the X-Ray view.
                  </div>
                )}

                {Array.isArray(report?.joins) && report.joins.length ? (
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Joins used to build the case context</div>
                    <div className="mt-2 grid gap-2">
                      {report.joins.map((j: any, i: number) => (
                        <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/60 p-2">
                          <span className="font-mono text-xs">
                            {String(j.from)} → {String(j.to)} on {String(j.on)}={String(j.value)}
                          </span>
                          <span
                            className={
                              "rounded-full border px-3 py-1 text-[10px] font-mono " +
                              (j.ok
                                ? "bg-[rgba(var(--fx-mint),0.14)] border-[rgba(var(--fx-mint),0.35)]"
                                : "bg-[rgba(var(--fx-amber),0.10)] border-[rgba(var(--fx-amber),0.30)]")
                            }
                          >
                            {j.ok ? "OK" : "MISSING"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="timeline">
            <AccordionTrigger>Automation Timeline (Audit Log)</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3 text-sm">
                {events.length ? (
                  <div className="grid gap-2">
                    {events.slice(-18).map((e: any, i: number) => (
                      <div key={i} className="rounded-xl border bg-background/60 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">
                              <span className="font-mono">{String(e.type || "event")}</span> · {String(e.at || "").slice(11, 19)}
                            </div>
                            <div className="mt-1 text-sm">{e.summary || "—"}</div>
                          </div>
                          {typeof e.ok === "boolean" ? (
                            <span
                              className={
                                "rounded-full border px-3 py-1 text-[10px] font-mono " +
                                (e.ok
                                  ? "bg-[rgba(var(--fx-mint),0.14)] border-[rgba(var(--fx-mint),0.35)]"
                                  : "bg-[rgba(var(--fx-amber),0.10)] border-[rgba(var(--fx-amber),0.30)]")
                              }
                            >
                              {e.ok ? "OK" : "BLOCK"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No audit events logged yet for this ticket. Run Gap/Draft/QA/Publish to generate trace.
                  </div>
                )}

                {auto.length ? (
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Autopilot timeline (if used)</div>
                    <div className="mt-2 grid gap-2">
                      {auto.slice(-10).map((e: any, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-3 rounded-lg border bg-background/60 p-2">
                          <span className="font-mono text-xs">
                            {String(e.stage || "")} ok={String(e.ok)}
                          </span>
                          <span className="text-xs text-muted-foreground">{String(e.at || "").slice(11, 19)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">LLM traces (inputs/outputs) saved locally</div>
                    <Button variant="secondary" size="sm" className="h-8" onClick={loadTraces}>
                      <Bug className="mr-2 h-3.5 w-3.5" />
                      Refresh traces
                    </Button>
                  </div>
                  {(() => {
                    const t = traces as any;
                    const items = Array.isArray(t?.items) ? t.items : [];
                    if (!items.length) {
                      return (
                        <div className="mt-2 text-sm text-muted-foreground">
                          No trace artifacts found yet. Run seed/gap/draft/QA to generate them.
                        </div>
                      );
                    }
                    return (
                      <div className="mt-3 grid gap-2">
                        <div className="text-xs text-muted-foreground font-mono break-all">{String(t.dir || "")}</div>
                        {items.slice(0, 3).map((x: any, i: number) => (
                          <div key={i} className="rounded-xl border bg-background/60 p-3">
                            <div className="text-xs text-muted-foreground">{String(x.name || "trace")}</div>
                            <div className="mt-1 font-mono text-[10px] break-all">{String(x.fullPath || "")}</div>
                            {x.data ? (
                              <pre className="mt-2 text-xs leading-5 whitespace-pre-wrap break-words max-w-full">
                                {JSON.stringify(x.data, null, 2)}
                              </pre>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="evidence">
            <AccordionTrigger>Citations (Evidence Used)</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3 text-sm">
                <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Evidence source mapping: `KB` → `Knowledge_Articles` (+ local published KB), `SCRIPT` → `Scripts_Master`,
                  `TICKET_RESOLUTION` → `Tickets` (+ local sim tickets).
                </div>
                <EvidenceBlock title="From Gap Detection" payload={gapPayload} path={"evidence"} />
                <EvidenceBlock title="From KB Draft Retrieval" payload={draftPayload} path={"draft"} />
                <div className="text-xs text-muted-foreground">
                  Tip: ask the Agent about this ticket; the chat response returns citations and is also written to the audit
                  log as `retrieve`.
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="guardrails">
            <AccordionTrigger>Guardrails (Checks Ran)</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3 text-sm">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Latest KB draft guardrails</div>
                  <pre className="mt-2 text-xs leading-5 whitespace-pre-wrap break-words max-w-full">
                    {(() => {
                      const g = (draftPayload as any)?.guardrails;
                      return g ? JSON.stringify(g, null, 2) : "(run Generate KB Draft to see guardrails output)";
                    })()}
                  </pre>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function EvidenceBlock(props: { title: string; payload: unknown; path: "evidence" | "draft" }) {
  if (props.path === "evidence") {
    const p = props.payload as any;
    const ev = Array.isArray(p?.evidence) ? (p.evidence as any[]) : [];
    return (
      <div className="rounded-xl border bg-background/60 p-3">
        <div className="text-xs text-muted-foreground">{props.title}</div>
        {ev.length ? (
          <div className="mt-2 grid gap-2">
            {ev.slice(0, 10).map((e, i) => (
              <div key={i} className="rounded-lg border bg-muted/30 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs">
                    {String(e.sourceType)}:{String(e.sourceId)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">score={String(e.score)}</span>
                </div>
                {e.title ? <div className="mt-1 text-xs">{String(e.title)}</div> : null}
                {e.snippet ? (
                  <div className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap">{String(e.snippet)}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">No evidence captured yet.</div>
        )}
      </div>
    );
  }

  const p = props.payload as any;
  const evidence = Array.isArray(p?.evidence) ? (p.evidence as any[]) : [];
  const refs = Array.isArray(p?.draft?.references) ? (p.draft.references as any[]) : [];
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <div className="text-xs text-muted-foreground">{props.title}</div>
      {evidence.length ? (
        <div className="mt-2 grid gap-2">
          {evidence.slice(0, 10).map((e: any, i: number) => (
            <div key={i} className="rounded-lg border bg-muted/30 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs">
                  {String(e.sourceType)}:{String(e.sourceId)}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">score={String(e.score)}</span>
              </div>
              {e.title ? <div className="mt-1 text-xs">{String(e.title)}</div> : null}
              {e.snippet ? (
                <div className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap">{String(e.snippet)}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {refs.length ? (
        <div className="mt-3">
          <div className="text-xs text-muted-foreground">Structured references (from draft JSON)</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {refs.slice(0, 12).map((r: any, i: number) => (
              <span key={i} className="rounded-full border bg-muted/30 px-3 py-1 text-xs font-mono">
                {String(r.type)}:{String(r.id)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground">
          {evidence.length
            ? "No structured references were captured in the draft JSON."
            : "Run Generate KB Draft to capture evidence + references."}
        </div>
      )}
    </div>
  );
}

function TriageSummary(props: {
  gap: unknown;
  script: CaseRunnerProps["script"];
}) {
  const g = props.gap as any;
  const action = g?.action || "—";
  const suggested = g?.answerTypeSuggested || "—";
  const reason = String(g?.reason || "");
  const evidence = Array.isArray(g?.evidence) ? (g.evidence as any[]) : [];

  const top = evidence.slice(0, 4).map((e) => ({
    type: e?.sourceType,
    id: e?.sourceId,
  }));

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border bg-background/60 px-3 py-1 text-xs font-mono">{suggested}</span>
        <span className="rounded-full border bg-background/60 px-3 py-1 text-xs font-mono">{action}</span>
      </div>
      {reason ? <div className="text-xs text-muted-foreground line-clamp-3">{reason}</div> : null}

      {props.script ? (
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground">Script Required</div>
          <div className="mt-1 font-mono text-xs break-all">{props.script.Script_ID}</div>
          {props.script.Script_Inputs ? (
            <div className="mt-2 text-xs text-muted-foreground break-words">
              Inputs: <span className="font-mono">{props.script.Script_Inputs}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {top.length ? (
        <div className="flex flex-wrap gap-2">
          {top.map((t, i) => (
            <span key={String(i)} className="rounded-full border bg-background/60 px-3 py-1 text-xs font-mono">
              {t.type}:{t.id}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DraftSummary(props: { draftPayload: unknown }) {
  const p = props.draftPayload as any;
  const d = p?.draft;
  const guard = p?.guardrails;
  const ok = Boolean(guard?.ok);
  const kbId = d?.kbDraftId;
  const title = d?.title;
  const required = Array.isArray(d?.requiredInputs) ? d.requiredInputs : [];
  const lineage = Array.isArray(d?.lineage) ? d.lineage : [];

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Draft</div>
          <div className="font-mono text-xs break-all">{kbId || "—"}</div>
          <div className="text-sm line-clamp-2">{title || "—"}</div>
        </div>
        <span
          className={
            "rounded-full border px-3 py-1 text-xs font-mono " +
            (ok
              ? "bg-[rgba(var(--fx-mint),0.12)] border-[rgba(var(--fx-mint),0.35)]"
              : "bg-[rgba(var(--fx-amber),0.10)] border-[rgba(var(--fx-amber),0.30)]")
          }
        >
          <span className="inline-flex items-center gap-2">
            {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
            {ok ? "GUARDRAILS OK" : "BLOCKED"}
          </span>
        </span>
      </div>

      <div className="grid gap-1 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Required inputs</span>
          <span className="font-mono text-foreground">{required.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Lineage edges</span>
          <span className="font-mono text-foreground">{lineage.length}</span>
        </div>
      </div>

      {required.length ? (
        <div className="flex flex-wrap gap-2">
          {required.slice(0, 6).map((r: any) => (
            <span key={String(r.placeholder)} className="rounded-full border bg-background/60 px-3 py-1 text-xs font-mono">
              {r.placeholder}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QaSummary(props: { qaPayload: unknown }) {
  const p = props.qaPayload as any;
  const qa = p?.qa || p; // /api/run/qa returns {qa}
  const overall = String(qa?.Overall_Weighted_Score || "");
  const red = qa?.Red_Flags && typeof qa.Red_Flags === "object" ? qa.Red_Flags : {};
  const redYes = Object.values(red).filter((v: any) => String(v?.score || "").toLowerCase() === "yes").length;
  const delivered = qa?.Interaction_QA?.Delivered_Expected_Outcome?.score;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Overall</div>
          <div className="text-3xl font-semibold tabular-nums">{overall || "—"}</div>
        </div>
        <div className="grid gap-1 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>Red flags</span>
            <span className="font-mono text-foreground">{redYes}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Expected outcome</span>
            <span className="font-mono text-foreground">{delivered || "—"}</span>
          </div>
        </div>
      </div>
      {redYes > 0 ? (
        <div className="rounded-xl border bg-[rgba(var(--fx-amber),0.10)] p-3 text-xs">
          One or more red flags were triggered. This would autozero the score and block autopublish.
        </div>
      ) : null}
    </div>
  );
}

function StepChip(props: { label: string; done: boolean; Icon?: ComponentType<{ className?: string }> }) {
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition " +
        (props.done
          ? "bg-[rgba(var(--fx-mint),0.14)] border-[rgba(var(--fx-mint),0.35)]"
          : "bg-background/50 border-border/60")
      }
    >
      {props.Icon ? (
        <props.Icon className={"h-3.5 w-3.5 " + (props.done ? "text-[rgb(var(--fx-mint))]" : "text-foreground/50")} />
      ) : null}
      <span
        className={
          "h-1.5 w-1.5 rounded-full " +
          (props.done
            ? "bg-[rgb(var(--fx-mint))] shadow-[0_0_0_4px_rgba(var(--fx-mint),0.15)]"
            : "bg-foreground/25")
        }
      />
      {props.label}
    </span>
  );
}

function JsonPanel(props: { title: string; data: unknown; emptyHint: string }) {
  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border/60 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <CardHeader>
        <CardTitle className="text-base">{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!props.data ? (
          <div className="text-sm text-muted-foreground">{props.emptyHint}</div>
        ) : (
          <ScrollArea className="h-[520px] rounded-md border bg-muted/30 p-3">
            <pre className="text-xs leading-5 whitespace-pre-wrap break-words max-w-full">
              {JSON.stringify(props.data, null, 2)}
            </pre>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
