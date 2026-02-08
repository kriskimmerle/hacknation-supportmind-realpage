import { NextResponse } from "next/server";

import { getOpenAI } from "@/lib/openai";
import {
  appendSimCase,
  newSimConversationId,
  newSimTicketNumber,
  type SimConversation,
  type SimTicket,
} from "@/lib/sim";
import { logAutopilotEvent } from "@/lib/autopilot";
import { projectDataPath, writeJson, audit } from "@/lib/storage";
import { traceLLMCall, writeTraceArtifact } from "@/lib/trace";

export const runtime = "nodejs";

export async function POST() {
  const ticketNumber = newSimTicketNumber();
  const conversationId = newSimConversationId();

  const client = getOpenAI();
  const prompt = `Generate ONE synthetic support case and conversation for a property management SaaS.

Constraints:
- Return JSON only.
- Ticket_Number must be ${ticketNumber}.
- Conversation_ID must be ${conversationId}.
- Include: Subject, Description, Resolution, Priority, Tier, Category, Module.
- Transcript must be a realistic call/chat between Customer and Agent.
- If a script/runbook would be required, include Script_ID as "SCRIPT-####" style.
- Keep content short but specific (demo-friendly).

JSON schema:
{
  "ticket": {
    "Ticket_Number": string,
    "Subject": string,
    "Description": string,
    "Resolution": string,
    "Priority": "High"|"Medium"|"Low",
    "Tier": "1.0"|"2.0"|"3.0",
    "Category": string,
    "Module": string,
    "Script_ID"?: string,
    "KB_Article_ID"?: string,
    "Generated_KB_Article_ID"?: string
  },
  "conversation": {
    "Ticket_Number": string,
    "Conversation_ID": string,
    "Channel": "Call"|"Chat",
    "Issue_Summary": string,
    "Transcript": string
  }
}`;

  const started = Date.now();
  const resp = await client.responses.create({ model: "gpt-4.1-mini", input: prompt });
  const durationMs = Date.now() - started;
  const json = safeJsonParse(resp.output_text);
  if (!json || typeof json !== "object") {
    return NextResponse.json({ error: "Seed agent did not return JSON" }, { status: 500 });
  }

  const obj = json as Record<string, unknown>;
  const ticket = (obj.ticket && typeof obj.ticket === "object" ? (obj.ticket as Record<string, string>) : {}) as Record<
    string,
    string
  >;
  const conversation =
    (obj.conversation && typeof obj.conversation === "object"
      ? (obj.conversation as Record<string, string>)
      : {}) as Record<string, string>;
  ticket.Ticket_Number = ticketNumber;
  conversation.Ticket_Number = ticketNumber;
  conversation.Conversation_ID = conversationId;

  const simTicket: SimTicket = { Ticket_Number: ticketNumber, ...(ticket as Record<string, string>) };
  const simConversation: SimConversation = {
    Ticket_Number: ticketNumber,
    Conversation_ID: conversationId,
    ...(conversation as Record<string, string>),
  };

  appendSimCase(simTicket, simConversation);

  const artifactPath = projectDataPath("autopilot", "seed", `${ticketNumber}.json`);
  writeJson(artifactPath, { ticket: simTicket, conversation: simConversation, raw: resp.output_text });

  const tracePath = writeTraceArtifact({
    ticketNumber,
    scope: "seed",
    kind: "llm",
    data: { model: "gpt-4.1-mini", prompt, outputText: resp.output_text, normalized: { ticket: simTicket, conversation: simConversation } },
  });
  traceLLMCall({
    ticketNumber,
    stage: "seed",
    model: "gpt-4.1-mini",
    input: prompt,
    outputText: resp.output_text,
    durationMs,
    parseOk: true,
    artifactPath: tracePath,
  });
  audit({
    type: "seed",
    ticketNumber,
    ok: true,
    summary: `Seeded sim case ${ticketNumber}`,
    payload: {
      ticketNumber,
      conversationId,
      artifacts: {
        autopilotSeed: artifactPath,
        trace: tracePath,
        simTickets: projectDataPath("sim", "tickets.jsonl"),
        simConversations: projectDataPath("sim", "conversations.jsonl"),
      },
      note: "Sim seed is an LLM-generated ticket+transcript used to mimic real-world incoming cases.",
    },
  });

  logAutopilotEvent({
    id: `seed-${ticketNumber}`,
    ticketNumber,
    stage: "seeded",
    ok: true,
    summary: `Seeded new case ${ticketNumber}`,
    artifactPaths: { seed: artifactPath },
  });

  return NextResponse.json({ ticketNumber, ticket: simTicket, conversation: simConversation });
}

function safeJsonParse(s: string): unknown {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}
