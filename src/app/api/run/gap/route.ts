import { NextResponse } from "next/server";

import { getCaseByTicketNumber } from "@/lib/dataset";
import { detectGap } from "@/lib/agents/gapDetector";
import { audit } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { ticketNumber: string };
  const ticketNumber = body.ticketNumber;
  const { ticket, conversation } = getCaseByTicketNumber(ticketNumber);

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const result = await detectGap({
    ticketNumber,
    subject: ticket.Subject,
    description: ticket.Description,
    resolution: ticket.Resolution,
    transcript: conversation?.Transcript,
    scriptId: ticket.Script_ID,
    kbId: ticket.KB_Article_ID,
    generatedKbId: ticket.Generated_KB_Article_ID,
  });

  audit({ type: "gap_detect", ticketNumber, payload: result });
  return NextResponse.json(result);
}
