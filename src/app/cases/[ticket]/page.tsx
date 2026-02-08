import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { getCaseByTicketNumber } from "@/lib/dataset";
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

  return (
    <div className="min-w-0">
      <CaseRunner ticket={t} conversation={conversation} />
    </div>
  );
}
