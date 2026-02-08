import { NextResponse } from "next/server";

import { getCaseByTicketNumber } from "@/lib/dataset";
import { runQaEvaluation } from "@/lib/agents/qaEval";
import { audit, writeJson, projectDataPath } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { ticketNumber: string };
  const ticketNumber = body.ticketNumber;
  const { ticket, conversation } = getCaseByTicketNumber(ticketNumber);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const ticketFields = ticket;
  const qa = await runQaEvaluation({
    ticketNumber,
    transcript: conversation?.Transcript,
    ticketFields,
  });

  const qaPath = projectDataPath("qa", `${ticketNumber}.json`);
  writeJson(qaPath, qa);

  const overall = String((qa as any)?.Overall_Weighted_Score || "");
  const red = (qa as any)?.Red_Flags && typeof (qa as any).Red_Flags === "object" ? (qa as any).Red_Flags : {};
  const redYes = Object.values(red).filter((v: any) => String(v?.score || "").toLowerCase() === "yes").length;

  audit({
    type: "qa_eval",
    ticketNumber,
    ok: true,
    summary: overall ? `QA scored ${overall} (red flags: ${redYes})` : `QA completed (red flags: ${redYes})`,
    payload: { saved: true, qaPath, overallWeightedScore: overall, redFlagsYes: redYes },
  });
  return NextResponse.json({ qa });
}
