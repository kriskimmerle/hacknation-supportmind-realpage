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
    | "gap_detect"
    | "kb_draft"
    | "kb_publish"
    | "qa_eval"
    | "guardrail";
  ticketNumber?: string;
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

export function newId(prefix: string) {
  const rand = crypto.randomBytes(6).toString("hex");
  return `${prefix}-${rand}`;
}
