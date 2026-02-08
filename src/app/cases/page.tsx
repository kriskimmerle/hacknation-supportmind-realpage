import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CasesClient } from "@/components/app/cases-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function CasesPage() {
  return (
    <div className="grid gap-4">
      <Card className="bg-card/60 backdrop-blur-xl border-border/60">
        <CardHeader>
          <CardTitle>Cases</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Browse the synthetic Salesforce-style cases. Use search + filters to find Tier-3 issues and run the learning
          loop (gap detection → KB draft → QA → governance).
        </CardContent>
      </Card>

      <CasesClient />
    </div>
  );
}
