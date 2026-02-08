import fs from "node:fs";

import { projectDataPath, appendJsonl, newId } from "@/lib/storage";

export type SimTicket = Record<string, string> & {
  Ticket_Number: string;
};

export type SimConversation = Record<string, string> & {
  Ticket_Number: string;
  Conversation_ID: string;
};

const SIM_DIR = () => projectDataPath("sim");
const TICKETS_PATH = () => projectDataPath("sim", "tickets.jsonl");
const CONV_PATH = () => projectDataPath("sim", "conversations.jsonl");

export function loadSimTickets(): SimTicket[] {
  return readJsonl(TICKETS_PATH()) as SimTicket[];
}

export function loadSimConversations(): SimConversation[] {
  return readJsonl(CONV_PATH()) as SimConversation[];
}

export function getSimCase(ticketNumber: string): { ticket: SimTicket | null; conversation: SimConversation | null } {
  const tickets = loadSimTickets();
  const conv = loadSimConversations();
  const t = tickets.find((x) => (x.Ticket_Number || "").trim() === ticketNumber) || null;
  const c = conv.find((x) => (x.Ticket_Number || "").trim() === ticketNumber) || null;
  return { ticket: t, conversation: c };
}

export function appendSimCase(ticket: SimTicket, conversation: SimConversation) {
  fs.mkdirSync(SIM_DIR(), { recursive: true });
  appendJsonl(TICKETS_PATH(), ticket);
  appendJsonl(CONV_PATH(), conversation);
}

export function newSimTicketNumber() {
  // Keep dataset-looking ids; use a stable prefix.
  return `CS-SIM-${newId("case")}`.replace(/[^A-Z0-9\-]/gi, "");
}

export function newSimConversationId() {
  return `CONV-SIM-${newId("conv")}`.replace(/[^A-Z0-9\-]/gi, "");
}

function readJsonl(filePath: string): unknown[] {
  try {
    const txt = fs.readFileSync(filePath, "utf-8");
    return txt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as unknown[];
  } catch {
    return [];
  }
}
