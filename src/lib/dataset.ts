import fs from "node:fs";
import * as XLSX from "xlsx";

import { DATASET_PATH } from "@/lib/config";
import { loadSimTickets, getSimCase } from "@/lib/sim";

export type SheetRow = Record<string, string>;

export type WorkbookData = {
  sheets: Record<string, SheetRow[]>;
  loadedAt: string;
  path: string;
};

function toStringCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function sheetToRows(ws: XLSX.WorkSheet): SheetRow[] {
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: false,
  });
  return json.map((r) => {
    const out: SheetRow = {};
    for (const [k, v] of Object.entries(r)) out[String(k).trim()] = toStringCell(v).trim();
    return out;
  });
}

function filterNonEmpty(rows: SheetRow[], key: string): SheetRow[] {
  return rows.filter((r) => (r[key] || "").trim() !== "");
}

const PRIMARY_KEYS: Record<string, string> = {
  Conversations: "Ticket_Number",
  Tickets: "Ticket_Number",
  Questions: "Question_ID",
  Scripts_Master: "Script_ID",
  Placeholder_Dictionary: "Placeholder",
  Knowledge_Articles: "KB_Article_ID",
  KB_Lineage: "KB_Article_ID",
  Existing_Knowledge_Articles: "KB_Article_ID",
  Learning_Events: "Event_ID",
  QA_Evaluation_Prompt: "QA Evaluation Prompt for Support Interactions (Calls/Chats) AND Case Tickets (with Scoring)\n--------------------------------------------------------------------------------\n\nYou are a Quality Analyst (QA) reviewing:\n1) a support interaction transcript (phone call or chat), AND/OR\n2) the associated case/ticket record (Salesforce case fields: Description, Resolution, Notes, Category, etc.).\n\nYour task:\n- Evaluate the agent’s performance and documentation quality using ONLY the evidence provided.\n- Mark each parameter as Yes / No / N/A.\n- If “No”, you MUST cite Tracking Items verbatim from the Tracking Items Library (at the end) and include transcript/case evidence.\n- Compute a weighted score out of 100%.\n",
};

// The QA_Evaluation_Prompt sheet is a single-column wall of text; treat as raw rows.
function loadSheet(wb: XLSX.WorkBook, name: string): SheetRow[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  if (name === "QA_Evaluation_Prompt") {
    // Some workbooks store the rubric as a single large cell without headers.
    // Read as 2D array and extract the longest text cell.
    const arr = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });
    let best = "";
    for (const row of arr) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        const t = String(cell || "").trim();
        if (t.length > best.length) best = t;
      }
    }
    return best ? [{ text: best }] : [];
  }

  const rows = sheetToRows(ws);

  const pk = PRIMARY_KEYS[name];
  if (!pk) return rows;

  return filterNonEmpty(rows, pk);
}

export function loadWorkbook(datasetPath: string = DATASET_PATH): WorkbookData {
  const g = globalThis as unknown as { __supportmind?: WorkbookData };
  if (g.__supportmind?.path === datasetPath) return g.__supportmind;

  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Dataset not found at ${datasetPath}. Set DATASET_PATH.`);
  }
  // NOTE: In Next.js server runtime, XLSX.readFile can behave inconsistently.
  // Reading via fs + XLSX.read is more reliable.
  const buf = fs.readFileSync(datasetPath);
  const wb = XLSX.read(buf, { type: "buffer", cellText: true, cellDates: false });
  const sheets: Record<string, SheetRow[]> = {};
  for (const name of wb.SheetNames) sheets[name] = loadSheet(wb, name);

  const data: WorkbookData = {
    sheets,
    loadedAt: new Date().toISOString(),
    path: datasetPath,
  };

  g.__supportmind = data;
  return data;
}

export function getQaPromptText(data: WorkbookData): string {
  const rows = data.sheets["QA_Evaluation_Prompt"] || [];
  for (const row of rows) {
    const t = (row.text || "").trim();
    if (t.length > 200) return t;
  }
  return "";
}

export function datasetHealth() {
  const data = loadWorkbook();
  const counts: Record<string, number> = {};
  for (const [name, rows] of Object.entries(data.sheets)) counts[name] = rows.length;

  const tickets = data.sheets["Tickets"] || [];
  const conv = data.sheets["Conversations"] || [];
  const ticketIds = new Set(tickets.map((r) => (r.Ticket_Number || "").trim()).filter(Boolean));
  const convIds = new Set(conv.map((r) => (r.Ticket_Number || "").trim()).filter(Boolean));

  const joinCoverage = {
    conversationsToTickets: convIds.size === 0 ? null : (intersectionSize(convIds, ticketIds) / convIds.size),
    ticketsToConversations: ticketIds.size === 0 ? null : (intersectionSize(ticketIds, convIds) / ticketIds.size),
  };

  return {
    datasetPath: data.path,
    loadedAt: data.loadedAt,
    sheetCounts: counts,
    joinCoverage,
  };
}

function intersectionSize(a: Set<string>, b: Set<string>) {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

export function listTicketNumbers(limit: number = 2000): string[] {
  const data = loadWorkbook();
  const tickets = data.sheets["Tickets"] || [];
  const out: string[] = [];

  // include sim tickets first (so demo feels "live")
  for (const t of loadSimTickets()) {
    const id = (t.Ticket_Number || "").trim();
    if (!id) continue;
    out.push(id);
    if (out.length >= limit) return out;
  }

  for (const r of tickets) {
    const id = (r.Ticket_Number || "").trim();
    if (!id) continue;
    out.push(id);
    if (out.length >= limit) break;
  }
  return out;
}

export function getCaseByTicketNumber(ticketNumber: string) {
  const sim = getSimCase(ticketNumber);
  if (sim.ticket) return sim;

  const data = loadWorkbook();
  const tickets = data.sheets["Tickets"] || [];
  const conv = data.sheets["Conversations"] || [];

  const ticket = tickets.find((r) => (r.Ticket_Number || "").trim() === ticketNumber) || null;
  const conversation = conv.find((r) => (r.Ticket_Number || "").trim() === ticketNumber) || null;

  return { ticket, conversation };
}
