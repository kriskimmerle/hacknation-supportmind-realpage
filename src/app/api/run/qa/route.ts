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

  writeJson(projectDataPath("qa", `${ticketNumber}.json`), qa);
  audit({ type: "qa_eval", ticketNumber, payload: { saved: true } });
  return NextResponse.json({ qa });
}
