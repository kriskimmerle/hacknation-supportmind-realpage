import { NextResponse } from "next/server";
import { getDemoCases, type DemoCase } from "@/lib/demo/badCaseSeed";
import { audit, writeJson, projectDataPath } from "@/lib/storage";
import fs from "node:fs";

export const runtime = "nodejs";

/**
 * GET /api/demo/seed - List available demo cases
 */
export async function GET() {
  const cases = getDemoCases();
  return NextResponse.json({
    cases: cases.map(c => ({
      ticketNumber: c.ticketNumber,
      subject: c.subject,
      expectedOutcome: c.expectedOutcome,
      blockedReasons: c.blockedReasons,
    })),
  });
}

/**
 * POST /api/demo/seed - Seed demo cases into the sim tickets
 */
export async function POST() {
  const cases = getDemoCases();
  const simDir = projectDataPath("sim");
  
  // Ensure sim directory exists
  if (!fs.existsSync(simDir)) {
    fs.mkdirSync(simDir, { recursive: true });
  }
  
  // Write each case to sim/tickets.jsonl
  const ticketsFile = projectDataPath("sim", "tickets.jsonl");
  const lines: string[] = [];
  
  for (const c of cases) {
    const ticket = {
      Ticket_Number: c.ticketNumber,
      Subject: c.subject,
      Description: c.description,
      Resolution: c.resolution,
      Tier: "T1",
      Priority: "High",
      Category: "Demo",
      Module: "Demo",
    };
    lines.push(JSON.stringify(ticket));
    
    // Also write the transcript
    const transcriptFile = projectDataPath("sim", `${c.ticketNumber}_transcript.txt`);
    fs.writeFileSync(transcriptFile, c.transcript);
  }
  
  fs.writeFileSync(ticketsFile, lines.join("\n") + "\n");
  
  audit({
    type: "demo_seed",
    payload: {
      cases: cases.map(c => c.ticketNumber),
      ticketsFile,
    },
  });
  
  return NextResponse.json({
    success: true,
    seeded: cases.length,
    cases: cases.map(c => ({
      ticketNumber: c.ticketNumber,
      expectedOutcome: c.expectedOutcome,
    })),
    message: "Demo cases seeded. Use DEMO-HAPPY-001 for golden path, DEMO-BAD-002 for Fair Housing block, DEMO-BAD-003 for legal/nocite block.",
  });
}
