import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { OpenAgentButton } from "@/components/app/open-agent-button";

import { datasetHealth } from "@/lib/dataset";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function Home() {
  const health = datasetHealth();

  return (
    <div className="grid gap-8">
      <section className="fx-gradient-border rounded-3xl p-[1px]">
        <div className="rounded-3xl bg-card/70 backdrop-blur-xl p-6 sm:p-10 fx-ring">
          <div className="grid gap-6 md:grid-cols-[1.3fr_0.7fr] md:items-center">
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="animate-in fade-in duration-700">
                  Self-learning layer
                </Badge>
                <Badge variant="outline" className="font-mono animate-in fade-in duration-700 delay-150">
                  local@laptop
                </Badge>
              </div>

              <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
                Build trust into support with a{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[rgb(var(--fx-cyan))] via-[rgb(var(--fx-mint))] to-[rgb(var(--fx-amber))] [background-size:200%_200%] animate-[fxShift_12s_ease_infinite]">
                  continuously learning
                </span>{' '}
                intelligence layer.
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
                This demo reads the SupportMind workbook, detects knowledge gaps, drafts or updates KB articles with
                provenance + governance, scores interactions with a QA rubric, and reports KPIs with deterministic ground
                truth.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button asChild className="h-11 px-6">
                  <Link href="/cases">Run The Learning Loop</Link>
                </Button>
                <Button asChild variant="secondary" className="h-11 px-6">
                  <Link href="/dashboard">See KPIs + Proof</Link>
                </Button>
                <OpenAgentButton label="Ask The Agent" />
              </div>
            </div>

            <div className="grid gap-3">
              <Card className="bg-card/60 backdrop-blur-xl border-border/60 hover:-translate-y-0.5 transition will-change-transform">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Dataset Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  <Row label="Tickets" value={health.sheetCounts["Tickets"] ?? 0} delay={0} />
                  <Row label="Conversations" value={health.sheetCounts["Conversations"] ?? 0} delay={60} />
                  <Row label="KB articles" value={health.sheetCounts["Knowledge_Articles"] ?? 0} delay={120} />
                  <Row label="Tier-3 scripts" value={health.sheetCounts["Scripts_Master"] ?? 0} delay={180} />
                  <Row label="Eval questions" value={health.sheetCounts["Questions"] ?? 0} delay={240} />
                </CardContent>
              </Card>

              <Card className="bg-card/60 backdrop-blur-xl border-border/60 hover:-translate-y-0.5 transition will-change-transform">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">What You Can Prove</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-muted-foreground">
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100">
                    Deterministic retrieval hit@k via <span className="font-mono">Questions.Target_ID</span>
                  </div>
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
                    Provenance via <span className="font-mono">KB_Lineage</span>-compatible records
                  </div>
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
                    QA scoring + autozero red flags via the rubric prompt
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Self-Updating KB",
                desc: "Drafts/patches articles from resolved cases, references scripts, and writes lineage.",
              },
              {
                title: "Coaching + QA",
                desc: "Standardized JSON scoring for transcript + ticket quality with evidence quotes.",
              },
              {
                title: "Safety + Governance",
                desc: "Guardrails block risky guidance; reviewer decisions are logged for auditability.",
              },
            ].map((c, idx) => (
              <Card
                key={c.title}
                className={`bg-card/60 backdrop-blur-xl border-border/60 hover:-translate-y-0.5 transition will-change-transform animate-in fade-in slide-in-from-bottom-2 duration-700`}
                style={{ animationDelay: `${idx * 90}ms` }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{c.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{c.desc}</CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-5 text-xs text-muted-foreground">
            Dataset path: <span className="font-mono">{health.datasetPath}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row(props: { label: string; value: number; delay: number }) {
  return (
    <div
      className="flex items-center justify-between animate-in fade-in slide-in-from-bottom-1 duration-700"
      style={{ animationDelay: `${props.delay}ms` }}
    >
      <span className="text-muted-foreground">{props.label}</span>
      <span className="font-mono text-foreground">{props.value}</span>
    </div>
  );
}
