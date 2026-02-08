import { NextResponse } from "next/server";

import { getCaseByTicketNumber } from "@/lib/dataset";
import { audit } from "@/lib/storage";
import { buildXRayReport } from "@/lib/xray";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ ticket: string }> }) {
  const { ticket } = await ctx.params;
  const { ticket: t, conversation } = getCaseByTicketNumber(ticket);
  audit({ type: "case_view", ticketNumber: ticket, payload: { hasTicket: !!t, hasConversation: !!conversation } });
  if (t) {
    const x = buildXRayReport(ticket);
    audit({
      type: "case_aggregate",
      ticketNumber: ticket,
      ok: true,
      summary: "Aggregated case context from sources",
      payload: {
        datasetPath: x.datasetPath,
        sources: x.sources.map((s) => ({ label: s.label, ref: s.ref })),
        joins: x.joins,
        aggregation: x.aggregation.caseContext,
      },
    });
  }
  return NextResponse.json({ ticket: t, conversation });
}
