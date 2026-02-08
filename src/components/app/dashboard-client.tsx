"use client";

import { useState, type ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

import type { KPIReport } from "@/lib/kpi";

import {
  Activity,
  Brain,
  Database,
  FileCheck,
  Rocket,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export function DashboardClient(props: { health: unknown }) {
  const [metrics, setMetrics] = useState<unknown>(null);
  const [kpi, setKpi] = useState<KPIReport | null>(null);
  const [busy, setBusy] = useState(false);

  async function runEval() {
    setBusy(true);
    try {
      const res = await fetch("/api/run/eval", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const out = await res.json();
      setMetrics(out);
    } finally {
      setBusy(false);
    }
  }

  async function loadKpi() {
    setBusy(true);
    try {
      const res = await fetch("/api/kpi");
      if (!res.ok) throw new Error(await res.text());
      const out = (await res.json()) as KPIReport;
      setKpi(out);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={loadKpi} disabled={busy} variant="secondary">
          {busy ? "Loading..." : "Refresh KPIs"}
        </Button>
        {kpi?.generatedAt ? (
          <Badge variant="outline" className="font-mono">
            Updated {kpi.generatedAt.slice(0, 19)}
          </Badge>
        ) : null}
      </div>

      {kpi ? <KpiCards kpi={kpi} /> : null}
      {kpi ? <KpiCharts kpi={kpi} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card/60 backdrop-blur-xl border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Retrieval Evaluation (Questions)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button onClick={runEval} disabled={busy}>
              {busy ? "Running..." : "Run Hit@K Evaluation"}
            </Button>
            {!metrics ? (
              <div className="text-sm text-muted-foreground">
                This runs retrieval over the correct corpus per `Answer_Type` and scores hit@1/3/5 against `Target_ID`.
              </div>
            ) : (
              <ScrollArea className="h-[360px] rounded-md border bg-muted/30 p-3">
                <pre className="text-xs leading-5">{JSON.stringify(metrics, null, 2)}</pre>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur-xl border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Dataset Health</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] rounded-md border bg-muted/30 p-3">
              <pre className="text-xs leading-5">{JSON.stringify(props.health, null, 2)}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCards(props: { kpi: KPIReport }) {
  const k = props.kpi;

  const guardrailBlocks = Math.max(0, k.learning.kbDrafts.total - k.learning.kbDrafts.guardrailOk);
  const avgQa = k.learning.qaRuns.avgOverallScore;

  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
      <MetricCard
        title="Self-Updating Knowledge"
        icon={<Brain className="h-4 w-4" />}
        accent="cyan"
        primary={`${k.learning.published}`}
        primaryLabel="published KBs (local)"
        secondaryLines={[
          `Drafts: ${k.learning.kbDrafts.total} (blocked: ${guardrailBlocks})`,
          `Lineage completeness: ${Math.round(k.learning.lineageCompleteness * 100)}%`,
        ]}
        progress={k.learning.lineageCompleteness}
      />

      <MetricCard
        title="Coaching + QA"
        icon={<FileCheck className="h-4 w-4" />}
        accent="mint"
        primary={avgQa === null ? "—" : `${avgQa}%`}
        primaryLabel="avg overall QA score"
        secondaryLines={[
          `QA runs: ${k.learning.qaRuns.total}`,
          `Autozero rate: ${k.learning.qaRuns.autozeroRate ?? "—"}`,
        ]}
        progress={avgQa === null ? null : clamp01(avgQa / 100)}
      />

      <MetricCard
        title="Safety + Guardrails"
        icon={<ShieldCheck className="h-4 w-4" />}
        accent="amber"
        primary={`${Math.round(k.learning.kbDrafts.guardrailBlockRate * 100)}%`}
        primaryLabel="drafts blocked"
        secondaryLines={[
          `Guardrail OK: ${k.learning.kbDrafts.guardrailOk}/${k.learning.kbDrafts.total}`,
          `Gap detection rate: ${Math.round(k.learning.gapDetections.gapRate * 100)}%`,
        ]}
        progress={1 - k.learning.kbDrafts.guardrailBlockRate}
      />

      <MetricCard
        title="Retrieval Proof"
        icon={<TrendingUp className="h-4 w-4" />}
        accent="cyan"
        primary={`${k.retrieval.overall["hit@1"]}`}
        primaryLabel="hit@1 (overall)"
        secondaryLines={[`hit@3: ${k.retrieval.overall["hit@3"]}`, `hit@5: ${k.retrieval.overall["hit@5"]}`]}
        progress={k.retrieval.overall["hit@1"]}
      />

      <MetricCard
        title="KB Quality"
        icon={<Database className="h-4 w-4" />}
        accent="mint"
        primary={`${k.kbQuality.total}`}
        primaryLabel="KB articles"
        secondaryLines={[
          `Learned: ${k.kbQuality.learned} | Seed: ${k.kbQuality.seed}`,
          `UpdatedAt coverage: ${Math.round(k.kbQuality.updatedAtRate * 100)}%`,
        ]}
        progress={k.kbQuality.updatedAtRate}
      />

      <MetricCard
        title="Root Cause Mining"
        icon={<Activity className="h-4 w-4" />}
        accent="amber"
        primary={`${k.rootCauses?.[0]?.count ?? 0}`}
        primaryLabel="top recurring issue"
        secondaryLines={[
          `Top: ${k.rootCauses?.[0]?.rootCause ?? "—"}`,
          `Unique root causes: ${k.rootCauseUnique ?? "—"}`,
        ]}
        progress={null}
      />

      <MetricCard
        title="Autopilot Outcomes"
        icon={<Rocket className="h-4 w-4" />}
        accent="mint"
        primary={`${props.kpi.autopilot.published}/${props.kpi.autopilot.seeded}`}
        primaryLabel="published / seeded"
        secondaryLines={[
          `Needs review: ${props.kpi.autopilot.needsReview}`,
          `Failed: ${props.kpi.autopilot.failed}`,
          `Stuck (>60s): ${props.kpi.autopilot.stuck}`,
        ]}
        progress={
          props.kpi.autopilot.seeded
            ? props.kpi.autopilot.published / props.kpi.autopilot.seeded
            : null
        }
      />
    </div>
  );
}

function MetricCard(props: {
  title: string;
  icon: ReactNode;
  accent: "cyan" | "mint" | "amber";
  primary: string;
  primaryLabel: string;
  secondaryLines: string[];
  progress: number | null;
}) {
  const accentClass =
    props.accent === "cyan"
      ? "from-[rgba(var(--fx-cyan),0.55)]"
      : props.accent === "mint"
        ? "from-[rgba(var(--fx-mint),0.50)]"
        : "from-[rgba(var(--fx-amber),0.45)]";

  return (
    <Card className="group bg-card/60 backdrop-blur-xl border-border/60 hover:-translate-y-0.5 transition will-change-transform overflow-hidden">
      <div className={`h-[2px] w-full bg-gradient-to-r ${accentClass} to-transparent`} />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border bg-background/60">
              {props.icon}
            </span>
            <span className="font-medium text-foreground/90">{props.title}</span>
          </div>
          <div className="h-2 w-2 rounded-full bg-[rgb(var(--fx-cyan))] opacity-0 group-hover:opacity-100 transition" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pb-4">
        <div>
          <div className="text-3xl font-semibold tracking-tight tabular-nums">{props.primary}</div>
          <div className="text-xs text-muted-foreground">{props.primaryLabel}</div>
        </div>

        {props.progress === null ? null : (
          <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[rgb(var(--fx-cyan))] via-[rgb(var(--fx-mint))] to-[rgb(var(--fx-amber))]"
              style={{ width: `${Math.round(clamp01(props.progress) * 100)}%` }}
            />
          </div>
        )}

        <div className="grid gap-1 text-xs text-muted-foreground">
          {props.secondaryLines.slice(0, 3).map((l) => (
            <div key={l} className="flex items-center justify-between gap-3">
              <span className="truncate">{l}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function clamp01(n: number) {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function KpiCharts(props: { kpi: KPIReport }) {
  const byType = props.kpi.retrieval.byType;
  const retrievalRows = Object.keys(byType).map((t) => ({
    type: t,
    hit1: byType[t]?.["hit@1"] ?? 0,
    hit3: byType[t]?.["hit@3"] ?? 0,
    hit5: byType[t]?.["hit@5"] ?? 0,
  }));
  const decisionsBy: Record<string, number> = props.kpi.learning.decisionsBy;
  const decisionRows = Object.keys(decisionsBy).map((d) => ({
    decision: d,
    count: decisionsBy[d],
  }));

  const kbPie = [
    { name: "Seed", value: props.kpi.kbQuality.seed, color: "#0ea5e9" },
    { name: "Learned", value: props.kpi.kbQuality.learned, color: "#22c55e" },
  ];

  const retrievalConfig = {
    hit1: { label: "hit@1", color: "var(--chart-1)" },
    hit3: { label: "hit@3", color: "var(--chart-2)" },
    hit5: { label: "hit@5", color: "var(--chart-3)" },
  } satisfies ChartConfig;

  const decisionsConfig = {
    count: { label: "Decisions", color: "var(--chart-4)" },
  } satisfies ChartConfig;

  const kbConfig = {
    seed: { label: "Seed", color: "var(--chart-1)" },
    learned: { label: "Learned", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="bg-card/60 backdrop-blur-xl border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Retrieval Hit@K by Answer_Type</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ChartContainer config={retrievalConfig} className="min-h-[260px] w-full">
            <BarChart data={retrievalRows} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="type" tickLine={false} tickMargin={10} axisLine={false} />
              <YAxis domain={[0, 1]} tickLine={false} axisLine={false} tickMargin={10} />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="hit1" fill="var(--color-hit1)" radius={6} name="hit@1" />
              <Bar dataKey="hit3" fill="var(--color-hit3)" radius={6} name="hit@3" />
              <Bar dataKey="hit5" fill="var(--color-hit5)" radius={6} name="hit@5" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="bg-card/60 backdrop-blur-xl border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Governance Decisions</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ChartContainer config={decisionsConfig} className="min-h-[260px] w-full">
            <BarChart data={decisionRows} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="decision" tickLine={false} tickMargin={10} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={10} />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={6} name="decisions" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="bg-card/60 backdrop-blur-xl border-border/60">
        <CardHeader>
          <CardTitle className="text-base">KB Composition</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ChartContainer config={kbConfig} className="min-h-[260px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              <Pie data={kbPie} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={3}>
                {kbPie.map((e) => (
                  <Cell
                    key={e.name}
                    fill={e.name === "Seed" ? "var(--color-seed)" : "var(--color-learned)"}
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="bg-card/60 backdrop-blur-xl border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Knowledge Engine</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">Lineage completeness</div>
              <div className="font-mono text-foreground">{props.kpi.learning.lineageCompleteness}</div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[rgb(var(--fx-cyan))] via-[rgb(var(--fx-mint))] to-[rgb(var(--fx-amber))]"
                style={{ width: `${Math.round(props.kpi.learning.lineageCompleteness * 100)}%` }}
              />
            </div>
          </div>

          <div className="grid gap-2 rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">Guardrail block rate</div>
              <div className="font-mono text-foreground">{props.kpi.learning.kbDrafts.guardrailBlockRate}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">Gap detection rate</div>
              <div className="font-mono text-foreground">{props.kpi.learning.gapDetections.gapRate}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
