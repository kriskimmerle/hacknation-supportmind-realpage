import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { PROJECT_DATA_DIR } from "@/lib/config";

export type AuditEvent = {
  at: string;
  type:
    | "health"
    | "case_view"
    | "retrieve"
    | "llm_call"
    | "case_aggregate"
    | "seed"
    | "gap_detect"
    | "kb_draft"
    | "kb_publish"
    | "qa_eval"
    | "guardrail";
  ticketNumber?: string;
  ok?: boolean;
  summary?: string;
  payload: unknown;
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function appendJsonl(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, JSON.stringify(data) + "\n");
}

export function projectDataPath(...parts: string[]) {
  return path.join(process.cwd(), PROJECT_DATA_DIR, ...parts);
}

export function audit(event: Omit<AuditEvent, "at">) {
  const full: AuditEvent = { at: new Date().toISOString(), ...event };
  appendJsonl(projectDataPath("audit", "events.jsonl"), full);
  return full;
}

export function readAuditEvents(params?: {
  ticketNumber?: string;
  limit?: number;
  types?: AuditEvent["type"][];
}): AuditEvent[] {
  const file = projectDataPath("audit", "events.jsonl");
  const limit = params?.limit ?? 80;
  try {
    const txt = fs.readFileSync(file, "utf-8");
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out: AuditEvent[] = [];
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      try {
        const raw = JSON.parse(lines[i]) as unknown;
        if (!raw || typeof raw !== "object") continue;
        const j = raw as Partial<AuditEvent>;

        if (params?.ticketNumber) {
          const tn = (j.ticketNumber || "").trim();
          if (tn !== params.ticketNumber.trim()) continue;
        }
        if (params?.types && params.types.length) {
          const t = j.type as AuditEvent["type"] | undefined;
          if (!t || !params.types.includes(t)) continue;
        }

        // Best-effort normalization for older events.
        const at = typeof j.at === "string" ? j.at : "";
        const type = j.type as AuditEvent["type"];
        if (!type) continue;
        out.push({
          at,
          type,
          ticketNumber: typeof j.ticketNumber === "string" ? j.ticketNumber : undefined,
          ok: typeof (j as { ok?: unknown }).ok === "boolean" ? (j as { ok: boolean }).ok : undefined,
          summary: typeof (j as { summary?: unknown }).summary === "string" ? (j as { summary: string }).summary : undefined,
          payload: (j as { payload?: unknown }).payload,
        });
      } catch {
        // ignore
      }
    }
    // Return oldest -> newest so UI can render a timeline.
    return out.reverse();
  } catch {
    return [];
  }
}

export function newId(prefix: string) {
  const rand = crypto.randomBytes(6).toString("hex");
  return `${prefix}-${rand}`;
}
