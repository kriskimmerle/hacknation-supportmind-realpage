import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { getCaseByTicketNumber, loadWorkbook } from "@/lib/dataset";
import { CaseRunner } from "@/components/app/case-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CasePage(props: { params: Promise<{ ticket: string }> }) {
  const { ticket } = await props.params;
  const { ticket: t, conversation } = getCaseByTicketNumber(ticket);

  if (!t) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Case not found</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Ticket {ticket} not found.</CardContent>
      </Card>
    );
  }

  const wb = loadWorkbook();
  const scripts = wb.sheets["Scripts_Master"] || [];
  const scriptRow = t.Script_ID
    ? scripts.find((r) => (r.Script_ID || "").trim() === (t.Script_ID || "").trim())
    : null;

  const scriptMeta = scriptRow
    ? {
        Script_ID: scriptRow.Script_ID || "",
        Script_Title: scriptRow.Script_Title || "",
        Script_Inputs: scriptRow.Script_Inputs || "",
        Script_Purpose: scriptRow.Script_Purpose || "",
      }
    : null;

  return (
    <div className="min-w-0">
      <CaseRunner ticket={t} conversation={conversation} script={scriptMeta} />
    </div>
  );
}
