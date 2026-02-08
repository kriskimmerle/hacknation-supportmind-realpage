import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutopilotClient } from "@/components/app/autopilot-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function AutopilotPage() {
  return (
    <div className="grid gap-4">
      <Card className="bg-card/60 backdrop-blur-xl border-border/60">
        <CardHeader>
          <CardTitle>Autopilot</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Seed new cases, then watch the agentic pipeline run automatically: gap detection → KB drafting → QA rubric →
          guardrails → auto-publish (or route to human review). All artifacts are saved locally.
        </CardContent>
      </Card>
      <AutopilotClient />
    </div>
  );
}
