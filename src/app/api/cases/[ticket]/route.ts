import { NextResponse } from "next/server";

import { getCaseByTicketNumber } from "@/lib/dataset";
import { audit } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ ticket: string }> }) {
  const { ticket } = await ctx.params;
  const { ticket: t, conversation } = getCaseByTicketNumber(ticket);
  audit({ type: "case_view", ticketNumber: ticket, payload: { hasTicket: !!t, hasConversation: !!conversation } });
  return NextResponse.json({ ticket: t, conversation });
}
