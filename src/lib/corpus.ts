import { loadWorkbook, type SheetRow } from "@/lib/dataset";
import { BM25Index, type Doc } from "@/lib/search/bm25";
import fs from "node:fs";
import path from "node:path";
import { projectDataPath } from "@/lib/storage";

export type CorpusType = "KB" | "SCRIPT" | "TICKET_RESOLUTION";

export type Corpus = {
  type: CorpusType;
  docs: Doc[];
  index: BM25Index;
};

function buildKbDocs(rows: SheetRow[]): Doc[] {
  return rows
    .map((r) => {
      const id = (r.KB_Article_ID || "").trim();
      const title = (r.Title || "").trim();
      const body = (r.Body || "").trim();
      if (!id || (!title && !body)) return null;
      const text = [`KB_Article_ID: ${id}`, title, body].filter(Boolean).join("\n\n");
      return {
        id,
        text,
        meta: {
          title,
          sourceType: (r.Source_Type || "").trim(),
          status: (r.Status || "").trim(),
          category: (r.Category || "").trim(),
          module: (r.Module || "").trim(),
        },
      } satisfies Doc;
    })
    .filter(Boolean) as Doc[];
}

function buildScriptDocs(rows: SheetRow[]): Doc[] {
  return rows
    .map((r) => {
      const id = (r.Script_ID || "").trim();
      if (!id) return null;
      const title = (r.Script_Title || "").trim();
      const inputs = (r.Script_Inputs || "").trim();
      const purpose = (r.Script_Purpose || "").trim();
      const text = [
        `Script_ID: ${id}`,
        `Title: ${title}`,
        purpose ? `Purpose: ${purpose}` : "",
        inputs ? `Inputs: ${inputs}` : "",
        (r.Script_Text_Sanitized || "").trim(),
      ]
        .filter(Boolean)
        .join("\n");
      return {
        id,
        text,
        meta: {
          title,
          inputs,
          module: (r.Module || "").trim(),
          category: (r.Category || "").trim(),
        },
      } satisfies Doc;
    })
    .filter(Boolean) as Doc[];
}

function buildTicketDocs(rows: SheetRow[]): Doc[] {
  return rows
    .map((r) => {
      const id = (r.Ticket_Number || "").trim();
      if (!id) return null;
      const subject = (r.Subject || "").trim();
      const desc = (r.Description || "").trim();
      const res = (r.Resolution || "").trim();
      const text = [
        `Ticket_Number: ${id}`,
        `Subject: ${subject}`,
        desc ? `Description: ${desc}` : "",
        res ? `Resolution: ${res}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      return {
        id,
        text,
        meta: {
          subject,
          tier: (r.Tier || "").trim(),
          priority: (r.Priority || "").trim(),
          category: (r.Category || "").trim(),
          module: (r.Module || "").trim(),
          scriptId: (r.Script_ID || "").trim(),
          kbId: (r.KB_Article_ID || "").trim(),
        },
      } satisfies Doc;
    })
    .filter(Boolean) as Doc[];
}

// For cases seeded by the autopilot generator.
function buildSimTicketDocs(): Doc[] {
  const file = projectDataPath("sim", "tickets.jsonl");
  try {
    const txt = fs.readFileSync(file, "utf-8");
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out: Doc[] = [];
    for (const line of lines) {
      try {
        const r = JSON.parse(line) as Record<string, string>;
        const id = (r.Ticket_Number || "").trim();
        if (!id) continue;
        const subject = (r.Subject || "").trim();
        const desc = (r.Description || "").trim();
        const res = (r.Resolution || "").trim();
        const text = [
          `Ticket_Number: ${id}`,
          subject ? `Subject: ${subject}` : "",
          desc ? `Description: ${desc}` : "",
          res ? `Resolution: ${res}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        out.push({
          id,
          text,
          meta: {
            subject,
            tier: (r.Tier || "").trim(),
            priority: (r.Priority || "").trim(),
            category: (r.Category || "").trim(),
            module: (r.Module || "").trim(),
            scriptId: (r.Script_ID || "").trim(),
          },
        });
      } catch {
        // ignore
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function getCorpora(): Record<CorpusType, Corpus> {
  const g = globalThis as unknown as {
    __corpora?: Record<CorpusType, Corpus>;
    __corporaSig?: string;
  };

  const sig = `${publishedSig()}`;
  if (g.__corpora && g.__corporaSig === sig) return g.__corpora;

  const wb = loadWorkbook();
  const kbDocs = mergeDocsById(buildKbDocs(wb.sheets["Knowledge_Articles"] || []), loadLocalPublishedKbDocs());
  const scriptDocs = buildScriptDocs(wb.sheets["Scripts_Master"] || []);
  const ticketDocs = [...buildSimTicketDocs(), ...buildTicketDocs(wb.sheets["Tickets"] || [])];

  const corpora: Record<CorpusType, Corpus> = {
    KB: { type: "KB", docs: kbDocs, index: new BM25Index(kbDocs) },
    SCRIPT: { type: "SCRIPT", docs: scriptDocs, index: new BM25Index(scriptDocs) },
    TICKET_RESOLUTION: { type: "TICKET_RESOLUTION", docs: ticketDocs, index: new BM25Index(ticketDocs) },
  };

  g.__corpora = corpora;
  g.__corporaSig = sig;
  return corpora;
}

function mergeDocsById(primary: Doc[], overrides: Doc[]): Doc[] {
  const m = new Map<string, Doc>();
  for (const d of primary) m.set(d.id, d);
  for (const d of overrides) m.set(d.id, d);
  return Array.from(m.values());
}

function loadLocalPublishedKbDocs(): Doc[] {
  const dir = projectDataPath("kb_published");
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    const docs: Doc[] = [];
    for (const f of files) {
      const raw = fs.readFileSync(path.join(dir, f), "utf-8");
      const j = JSON.parse(raw) as Record<string, unknown>;
      const draft = (j.draft && typeof j.draft === "object" ? (j.draft as Record<string, unknown>) : null) as
        | Record<string, unknown>
        | null;
      const kbDraftId = draft ? draft.kbDraftId : null;
      if (typeof kbDraftId !== "string" || !kbDraftId) continue;
      const id = kbDraftId;
      const title = typeof draft?.title === "string" ? draft.title : "Local Published KB";
      const body = typeof draft?.bodyMarkdown === "string" ? draft.bodyMarkdown : "";
      docs.push({
        id,
        text: [`KB_Article_ID: ${id}`, title, body].filter(Boolean).join("\n\n"),
        meta: { title, sourceType: "LOCAL_PUBLISHED", status: "active" },
      });
    }
    return docs;
  } catch {
    return [];
  }
}

function publishedSig(): string {
  const dir = projectDataPath("kb_published");
  try {
    const st = fs.statSync(dir);
    return String(st.mtimeMs);
  } catch {
    return "0";
  }
}
