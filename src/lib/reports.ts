import fs from "node:fs";

import { loadWorkbook } from "@/lib/dataset";
import { projectDataPath } from "@/lib/storage";

export function getRootCauseTop(n: number = 8) {
  const wb = loadWorkbook();
  const tickets = wb.sheets["Tickets"] || [];
  const counts = new Map<string, number>();
  for (const t of tickets) {
    const rc = (t.Root_Cause || "").trim();
    if (!rc) continue;
    counts.set(rc, (counts.get(rc) || 0) + 1);
  }
  const items = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([rootCause, count]) => ({ rootCause, count }));
  return items;
}

export function getLocalLearningStats() {
  const draftsDir = projectDataPath("kb_drafts");
  const publishedDir = projectDataPath("kb_published");
  const decisionsPath = projectDataPath("governance", "decisions.jsonl");
  const lineagePath = projectDataPath("lineage", "kb_lineage.jsonl");

  const drafts = safeCountFiles(draftsDir, ".json");
  const published = safeCountFiles(publishedDir, ".json");

  const decisions = safeReadLines(decisionsPath);
  const decisionsBy: Record<string, number> = {};
  for (const line of decisions) {
    try {
      const j = JSON.parse(line);
      const d = String(j.decision || "");
      decisionsBy[d] = (decisionsBy[d] || 0) + 1;
    } catch {
      // ignore
    }
  }

  const lineageLines = safeReadLines(lineagePath);
  const edges = lineageLines.length;
  const kbEdgeCounts = new Map<string, number>();
  for (const line of lineageLines) {
    try {
      const j = JSON.parse(line);
      const kb = String(j.kbArticleId || "");
      if (!kb) continue;
      kbEdgeCounts.set(kb, (kbEdgeCounts.get(kb) || 0) + 1);
    } catch {
      // ignore
    }
  }
  const completeLineage = Array.from(kbEdgeCounts.values()).filter((c) => c >= 3).length;
  const lineageKbCount = kbEdgeCounts.size;
  const lineageCompleteness = lineageKbCount ? round3(completeLineage / lineageKbCount) : 0;

  return {
    drafts,
    published,
    decisionsTotal: decisions.length,
    decisionsBy,
    lineageEdges: edges,
    lineageKbCount,
    lineageCompleteness,
  };
}

function safeCountFiles(dir: string, suffix: string) {
  try {
    const items = fs.readdirSync(dir);
    return items.filter((f) => f.endsWith(suffix)).length;
  } catch {
    return 0;
  }
}

function safeReadLines(filePath: string) {
  try {
    const txt = fs.readFileSync(filePath, "utf-8");
    return txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
