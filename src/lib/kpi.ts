import fs from "node:fs";
import path from "node:path";

import { datasetHealth, loadWorkbook } from "@/lib/dataset";
import { runRetrievalEval } from "@/lib/eval";
import { getLocalLearningStats, getRootCauseTop } from "@/lib/reports";
import { projectDataPath } from "@/lib/storage";

export type KPIReport = {
  generatedAt: string;
  dataset: ReturnType<typeof datasetHealth>;
  questions: {
    answerTypeCounts: Record<string, number>;
  };
  retrieval: ReturnType<typeof runRetrievalEval>;
  learning: ReturnType<typeof getLocalLearningStats> & {
    gapDetections: { total: number; gaps: number; gapRate: number };
    kbDrafts: { total: number; guardrailOk: number; guardrailBlockRate: number };
    qaRuns: { total: number; avgOverallScore: number | null; autozeroRate: number | null };
    usageTop: {
      kb: Array<{ id: string; count: number }>;
      scripts: Array<{ id: string; count: number }>;
      tickets: Array<{ id: string; count: number }>;
    };
  };
  autopilot: {
    seeded: number;
    published: number;
    needsReview: number;
    failed: number;
    stuck: number;
  };
  rootCauses: Array<{ rootCause: string; count: number }>;
  rootCauseUnique: number;
  kbQuality: {
    total: number;
    seed: number;
    learned: number;
    active: number;
    hasUpdatedAt: number;
    updatedAtRate: number;
  };
};

export function buildKPIReport(): KPIReport {
  const dataset = datasetHealth();
  const wb = loadWorkbook();
  const questions = wb.sheets["Questions"] || [];
  const answerTypeCounts: Record<string, number> = {};
  for (const q of questions) {
    const at = (q.Answer_Type || "").trim().toUpperCase();
    if (!at) continue;
    answerTypeCounts[at] = (answerTypeCounts[at] || 0) + 1;
  }

  const retrieval = runRetrievalEval([1, 3, 5]);
  const learningBase = getLocalLearningStats();
  const rootCauses = getRootCauseTop(10);
  const rootCauseUnique = countUniqueRootCauses();

  const autopilot = computeAutopilotStats();

  // Gap detection stats from audit log
  const auditLines = safeReadLines(projectDataPath("audit", "events.jsonl"));
  let gapTotal = 0;
  let gapTrue = 0;
  const usageCounts = {
    KB: new Map<string, number>(),
    SCRIPT: new Map<string, number>(),
    TICKET_RESOLUTION: new Map<string, number>(),
  };
  for (const line of auditLines) {
    const ev = safeJson(line);
    const type = getString(ev, "type");
    if (!type) continue;
    if (type === "gap_detect") {
      gapTotal += 1;
      const payload = getObject(ev, "payload");
      const gapDetected = getBoolean(payload, "gapDetected");
      if (gapDetected) gapTrue += 1;

      const evidence = getArray(payload, "evidence");
      for (const e of evidence) {
        const st = getString(e, "sourceType");
        const id = getString(e, "sourceId");
        if (!st || !id) continue;
        const m = (usageCounts as Record<string, Map<string, number>>)[st] as
          | Map<string, number>
          | undefined;
        if (m) m.set(id, (m.get(id) || 0) + 1);
      }
    }

    // retrieval events (chat, etc.)
    if (type === "retrieve") {
      const payload = getObject(ev, "payload");
      const evidence = getArray(payload, "evidence");
      for (const e of evidence) {
        const st = getString(e, "sourceType");
        const id = getString(e, "sourceId");
        if (!st || !id) continue;
        const m = (usageCounts as Record<string, Map<string, number>>)[st] as
          | Map<string, number>
          | undefined;
        if (m) m.set(id, (m.get(id) || 0) + 1);
      }
    }
  }
  const gapRate = gapTotal ? round3(gapTrue / gapTotal) : 0;

  // Draft stats from kb_drafts
  const draftsDir = projectDataPath("kb_drafts");
  const draftFiles = safeListJson(draftsDir);
  let guardrailOk = 0;
  for (const f of draftFiles) {
    const j = safeJson(fs.readFileSync(path.join(draftsDir, f), "utf-8"));
    if (getNestedBoolean(j, ["guardrails", "ok"])) guardrailOk += 1;
  }
  const guardrailBlockRate = draftFiles.length ? round3(1 - guardrailOk / draftFiles.length) : 0;

  // QA stats from .data/qa
  const qaDir = projectDataPath("qa");
  const qaFiles = safeListJson(qaDir);
  const overallScores: number[] = [];
  let autozeroCount = 0;
  for (const f of qaFiles) {
    const j = safeJson(fs.readFileSync(path.join(qaDir, f), "utf-8"));
    const s = getString(j, "Overall_Weighted_Score");
    const n = parsePercent(s);
    if (n !== null) overallScores.push(n);
    if (n === 0) autozeroCount += 1;
  }
  const avgOverallScore = overallScores.length ? round3(overallScores.reduce((a, b) => a + b, 0) / overallScores.length) : null;
  const autozeroRate = overallScores.length ? round3(autozeroCount / overallScores.length) : null;

  // KB quality metrics
  const kb = wb.sheets["Knowledge_Articles"] || [];
  let seed = 0;
  let learned = 0;
  let active = 0;
  let hasUpdatedAt = 0;
  for (const a of kb) {
    const st = (a.Source_Type || "").trim();
    if (st === "SEED_KB") seed += 1;
    else learned += 1;
    if ((a.Status || "").trim().toLowerCase() === "active") active += 1;
    if ((a.Updated_At || "").trim()) hasUpdatedAt += 1;
  }
  const updatedAtRate = kb.length ? round3(hasUpdatedAt / kb.length) : 0;

  const usageTop = {
    kb: topN(usageCounts.KB, 8),
    scripts: topN(usageCounts.SCRIPT, 8),
    tickets: topN(usageCounts.TICKET_RESOLUTION, 8),
  };

  return {
    generatedAt: new Date().toISOString(),
    dataset,
    questions: { answerTypeCounts },
    retrieval,
    learning: {
      ...learningBase,
      gapDetections: { total: gapTotal, gaps: gapTrue, gapRate },
      kbDrafts: { total: draftFiles.length, guardrailOk, guardrailBlockRate },
      qaRuns: { total: qaFiles.length, avgOverallScore, autozeroRate },
      usageTop,
    },
    autopilot,
    rootCauses,
    rootCauseUnique,
    kbQuality: {
      total: kb.length,
      seed,
      learned,
      active,
      hasUpdatedAt,
      updatedAtRate,
    },
  };
}

function computeAutopilotStats() {
  const evLines = safeReadLines(projectDataPath("autopilot", "events.jsonl"));
  const byTicket = new Map<string, { lastStage: string; lastAt: string }>();
  let seeded = 0;
  for (const l of evLines) {
    const j = safeJson(l);
    const ticket = getString(j, "ticketNumber");
    const stage = getString(j, "stage");
    const at = getString(j, "at");
    if (!ticket || !stage || !at) continue;
    if (stage === "seeded") seeded += 1;
    const cur = byTicket.get(ticket);
    if (!cur || at > cur.lastAt) byTicket.set(ticket, { lastStage: stage, lastAt: at });
  }

  let published = 0;
  let needsReview = 0;
  let failed = 0;
  let stuck = 0;

  for (const [, v] of byTicket.entries()) {
    if (v.lastStage === "published") published += 1;
    else if (v.lastStage === "needs_review") needsReview += 1;
    else if (v.lastStage === "failed") failed += 1;
    else if (v.lastStage === "qa_eval_started" || v.lastStage === "publish_started") {
      const t = Date.parse(v.lastAt);
      if (Number.isFinite(t) && Date.now() - t > 60_000) stuck += 1;
    }
  }

  return { seeded, published, needsReview, failed, stuck };
}

function countUniqueRootCauses() {
  const wb = loadWorkbook();
  const tickets = wb.sheets["Tickets"] || [];
  const s = new Set<string>();
  for (const t of tickets) {
    const rc = (t.Root_Cause || "").trim();
    if (rc) s.add(rc);
  }
  return s.size;
}

function safeReadLines(filePath: string) {
  try {
    const txt = fs.readFileSync(filePath, "utf-8");
    return txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getObject(v: unknown, key: string): Record<string, unknown> | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const child = o[key];
  if (!child || typeof child !== "object") return null;
  return child as Record<string, unknown>;
}

function getArray(v: Record<string, unknown> | null, key: string): unknown[] {
  if (!v) return [];
  const child = v[key];
  return Array.isArray(child) ? child : [];
}

function getString(v: unknown, key: string): string | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const child = o[key];
  return typeof child === "string" ? child : null;
}

function getBoolean(v: Record<string, unknown> | null, key: string): boolean {
  if (!v) return false;
  return v[key] === true;
}

function getNestedBoolean(v: unknown, path: string[]): boolean {
  let cur: unknown = v;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return false;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur === true;
}

function safeListJson(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
}

function topN(m: Map<string, number>, n: number) {
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, count]) => ({ id, count }));
}

function parsePercent(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)%/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
