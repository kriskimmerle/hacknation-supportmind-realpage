"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type Props = {
  ticket: Record<string, string>;
  conversation: Record<string, string> | null;
};

export function CaseRunner({ ticket, conversation }: Props) {
  const ticketNumber = ticket.Ticket_Number;

  const [gap, setGap] = useState<unknown>(null);
  const [draft, setDraft] = useState<unknown>(null);
  const [qa, setQa] = useState<unknown>(null);
  const [publish, setPublish] = useState<unknown>(null);
  const [busy, setBusy] = useState<string>("");

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

  async function runGap() {
    setBusy("gap");
    try {
      const out = await postJson("/api/run/gap", { ticketNumber });
      setGap(out);
    } finally {
      setBusy("");
    }
  }

  async function runDraft() {
    setBusy("draft");
    try {
      const out = await postJson("/api/run/kb-draft", { ticketNumber });
      setDraft(out);
    } finally {
      setBusy("");
    }
  }

  async function runQa() {
    setBusy("qa");
    try {
      const out = await postJson("/api/run/qa", { ticketNumber });
      setQa(out);
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
            <StepChip label="Gap" done={steps.gap} />
            <StepChip label="KB Draft" done={steps.draft} />
            <StepChip label="QA" done={steps.qa} />
            <StepChip label="Governance" done={steps.publish} />
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
              {busy === "gap" ? "Running..." : "Run Gap Detection"}
            </Button>
            <Button onClick={runDraft} disabled={busy !== ""} variant="secondary" className="h-10">
              {busy === "draft" ? "Drafting..." : "Generate KB Draft"}
            </Button>
            <Button onClick={runQa} disabled={busy !== ""} variant="outline" className="h-10">
              {busy === "qa" ? "Scoring..." : "Run QA / Coaching"}
            </Button>
            <Button onClick={() => runPublish("approved")} disabled={busy !== "" || !draft} className="h-10">
              Publish (Approve)
            </Button>
            <Button
              onClick={() => runPublish("rejected")}
              disabled={busy !== "" || !draft}
              variant="destructive"
              className="h-10"
            >
              Reject
            </Button>
            <Button onClick={askAgent} disabled={busy !== ""} variant="outline" className="h-10">
              Ask Agent
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="gap">
        <TabsList className="bg-card/50 backdrop-blur-xl border border-border/60">
          <TabsTrigger value="gap">Gap</TabsTrigger>
          <TabsTrigger value="kb">KB Draft</TabsTrigger>
          <TabsTrigger value="qa">QA</TabsTrigger>
          <TabsTrigger value="gov">Governance</TabsTrigger>
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
      </Tabs>
    </div>
  );
}

function StepChip(props: { label: string; done: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition " +
        (props.done
          ? "bg-[rgba(var(--fx-mint),0.14)] border-[rgba(var(--fx-mint),0.35)]"
          : "bg-background/50 border-border/60")
      }
    >
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
