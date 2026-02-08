import fs from "node:fs";

import { projectDataPath, appendJsonl } from "@/lib/storage";

export type AutopilotEvent = {
  id: string;
  seq: number;
  at: string;
  ticketNumber: string;
  stage:
    | "seeded"
    | "gap_detect"
    | "kb_draft"
    | "qa_eval_started"
    | "qa_eval"
    | "guardrail"
    | "publish_started"
    | "published"
    | "needs_review"
    | "failed";
  ok: boolean;
  summary: string;
  artifactPaths: Record<string, string>;
};

const EVENTS_PATH = () => projectDataPath("autopilot", "events.jsonl");

let seqCounter = 0;

export function nextEventSeq() {
  // Monotonic ordering even when timestamps collide.
  seqCounter = (seqCounter + 1) % 1000;
  return Date.now() * 1000 + seqCounter;
}

export function logAutopilotEvent(ev: Omit<AutopilotEvent, "at" | "seq">) {
  const full: AutopilotEvent = { at: new Date().toISOString(), seq: nextEventSeq(), ...ev };
  appendJsonl(EVENTS_PATH(), full);
  return full;
}

export function readAutopilotEvents(limit: number = 50): AutopilotEvent[] {
  const file = EVENTS_PATH();
  try {
    const txt = fs.readFileSync(file, "utf-8");
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out: AutopilotEvent[] = [];
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      try {
        const raw = JSON.parse(lines[i]) as unknown;
        if (!raw || typeof raw !== "object") continue;
        const j = raw as Partial<AutopilotEvent>;
        const seq = typeof (j as { seq?: unknown }).seq === "number" ? (j as { seq: number }).seq : 0;
        out.push({ ...(j as AutopilotEvent), seq });
      } catch {
        // ignore
      }
    }
    return out;
  } catch {
    return [];
  }
}
