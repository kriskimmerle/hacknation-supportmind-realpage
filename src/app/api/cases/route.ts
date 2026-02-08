import { NextResponse } from "next/server";

import { listTicketNumbers, getCaseByTicketNumber } from "@/lib/dataset";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "200") || 200;
  const ids = listTicketNumbers(limit);

  // Basic lightweight list with subject/priority
  const items = ids.map((id) => {
    const { ticket, conversation } = getCaseByTicketNumber(id);
    return {
      ticketNumber: id,
      subject: ticket?.Subject || "",
      priority: ticket?.Priority || "",
      tier: ticket?.Tier || "",
      category: ticket?.Category || "",
      module: ticket?.Module || "",
      scriptId: ticket?.Script_ID || "",
      kbId: ticket?.KB_Article_ID || "",
      generatedKbId: ticket?.Generated_KB_Article_ID || "",
      channel: conversation?.Channel || "",
    };
  });

  return NextResponse.json({ items });
}
