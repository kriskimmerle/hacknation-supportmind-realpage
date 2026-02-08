import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import { datasetHealth } from "@/lib/dataset";
import { getRootCauseTop } from "@/lib/reports";
import { readAutopilotEvents } from "@/lib/autopilot";

import { DashboardClient } from "@/components/app/dashboard-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function DashboardPage() {
  const health = datasetHealth();
  const rootCauses = getRootCauseTop(8);
  const recent = readAutopilotEvents(8).slice().reverse();
  return (
    <div className="grid gap-4">
      <Card className="bg-card/60 backdrop-blur-xl border-border/60">
        <CardHeader>
          <CardTitle>Dashboard / Proof</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use this page during the demo to show: retrieval hit@k from deterministic ground truth, provenance completeness
          from lineage logs, and learning/governance activity.
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-card/60 backdrop-blur-xl border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="h-10">
                <Link href="/autopilot">Open Autopilot</Link>
              </Button>
              <Button asChild variant="secondary" className="h-10">
                <Link href="/cases">Browse Cases</Link>
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Dataset:
              <span className="ml-2 inline-block max-w-full font-mono break-all">{health.datasetPath}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur-xl border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Latest Autopilot Events</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {recent.length === 0 ? (
              <div className="text-muted-foreground">No autopilot events yet. Seed a case from Autopilot.</div>
            ) : (
              <ScrollArea className="h-[220px] rounded-xl border bg-muted/20 p-3">
                <div className="grid gap-2">
                  {recent.map((e) => (
                    <div key={String(e.seq) + e.at} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-muted-foreground truncate">{e.ticketNumber}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{e.summary}</div>
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] max-w-[140px] truncate">
                        {e.stage}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur-xl border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Top Root Causes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="rounded-md border bg-muted/30 p-3">
              {rootCauses.length === 0 ? (
                <div className="text-muted-foreground">No Root_Cause values found.</div>
              ) : (
                <div className="grid gap-2">
                  {rootCauses.map((rc) => (
                    <div key={rc.rootCause} className="flex items-start justify-between gap-4">
                      <div className="flex-1">{rc.rootCause}</div>
                      <div className="font-mono text-xs">{rc.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <DashboardClient health={health} />
    </div>
  );
}
